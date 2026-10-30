import {
  armarDiagnostico, armarPractica, armarReal, armarSimulacro, duracionMinutos, MINUTOS_DIAGNOSTICO, type PreguntaParaArmar,
} from "@/lib/admision/motor/admision-armado";
import type { AreaExamen } from "@/lib/admision/motor/admision-molde";
import { corregir } from "@/lib/admision/motor/admision-correccion";
import { anotarFallos, aplicarRepaso, diaDeLima, paraHoy, type EntradaDeErrores } from "@/lib/admision/motor/admision-leitner";
import type { IntentoDeAdmision, PreguntaDelIntento, RespuestaDeAdmision } from "@/integrations/supabase/admision";
import { cargarBanco } from "./datos";
import { escribirTabla, leerTabla } from "./almacen";
import { ID_DEL_ALUMNO } from "./consulta";

/**
 * Lo que en Atlas hacían las edge functions `admision-armar` y `admision-entregar` y las funciones SQL
 * del módulo, ahora en el navegador. La lógica es la misma: los mismos módulos del motor
 * (armado, corrección y cuaderno de errores) que usaban las funciones.
 *
 * Sin servidor no hay secreto: la clave de cada pregunta viaja con el banco. Para practicar da igual;
 * no sirve para un ranking.
 */

/** Un fallo con el motivo para el alumno, con la forma que espera `functionErrorReason`. */
export class FalloDeFuncion extends Error {
  readonly context: Response;
  constructor(motivo: string, estado = 400) {
    super(motivo);
    this.context = new Response(JSON.stringify({ error: motivo }), { status: estado, headers: { "Content-Type": "application/json" } });
  }
}

const AREAS: AreaExamen[] = ["A", "B", "C", "D", "E", "medicina"];
const intentos = () => leerTabla<IntentoDeAdmision>("admision_intentos");
const respuestas = () => leerTabla<RespuestaDeAdmision>("admision_respuestas");
const errores = () => leerTabla<EntradaDeErrores & { user_id: string; updated_at: string }>("admision_errores");

type CuerpoDeArmar = {
  modo?: string; examen_id?: string; tipo?: string; area?: string; curso?: string; tema?: string; n?: number; ver_soluciones?: boolean;
};

export async function armar(body: CuerpoDeArmar): Promise<{ intento_id: string; preguntas: number }> {
  const modo = body?.modo;
  if (!["real", "simulacro", "practica", "repaso", "diagnostico"].includes(String(modo))) throw new FalloDeFuncion("modo no válido");
  const banco = await cargarBanco();
  const area: AreaExamen = AREAS.includes(body.area as AreaExamen) ? (body.area as AreaExamen) : "A";
  const nuevo = (fila: Partial<IntentoDeAdmision>) => {
    const intento = {
      id: crypto.randomUUID(), user_id: ID_DEL_ALUMNO, examen_id: null, filtro: null, ver_soluciones: false,
      started_at: new Date().toISOString(), duration_minutes: null, estado: "en_curso", entregado_at: null,
      puntaje: null, informe: null, created_at: new Date().toISOString(), ...fila,
    } as IntentoDeAdmision;
    escribirTabla("admision_intentos", [...intentos(), intento]);
    return { intento_id: intento.id, preguntas: intento.preguntas.length };
  };

  // El repaso del cuaderno de errores: las que tocan hoy, en Lima, que sigan en el banco.
  if (modo === "repaso") {
    const hoy = diaDeLima(new Date());
    const tocan = paraHoy(errores().filter((e) => !e.dominada && e.proxima <= hoy), hoy).map((x) => x.pregunta_id);
    const n = Math.min(Math.max(Number(body.n) || 10, 1), 30);
    const ids = tocan.filter((id) => banco.preguntaPorId.has(id)).slice(0, n);
    if (ids.length === 0) throw new FalloDeFuncion("No tienes preguntas por repasar hoy");
    return nuevo({ modo: "repaso", tipo: "practica", area, preguntas: ids, ver_soluciones: true });
  }

  let lista: PreguntaParaArmar[] = banco.preguntas;
  if (modo === "real") lista = lista.filter((p) => p.examen_id === body.examen_id);
  if (modo === "practica") lista = lista.filter((p) => p.curso === String(body.curso ?? ""));

  // Lo que ya vio: fecha de su último intento con cada pregunta (de los 300 más recientes, como Atlas).
  const vistas = new Map<string, string>();
  for (const i of [...intentos()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 300)) {
    for (const id of i.preguntas) if (!vistas.has(id)) vistas.set(id, i.created_at);
  }

  let ids: string[];
  let tipo: "cronometrado" | "practica";
  let areaDelIntento = area;
  let examenId: string | null = null;
  let filtro: { curso: string; tema?: string } | null = null;
  if (modo === "real") {
    const examen = banco.examenes.find((e) => e.id === body.examen_id);
    if (!examen) throw new FalloDeFuncion("examen no encontrado");
    examenId = examen.id;
    areaDelIntento = examen.area as AreaExamen;
    tipo = body.tipo === "practica" ? "practica" : "cronometrado";
    ids = armarReal(lista, examen.id);
  } else if (modo === "simulacro") {
    tipo = body.tipo === "practica" ? "practica" : "cronometrado";
    ids = armarSimulacro(lista, area, vistas, Math.random);
  } else if (modo === "diagnostico") {
    tipo = "cronometrado";
    ids = armarDiagnostico(lista, area, vistas, Math.random);
  } else {
    tipo = "practica";
    filtro = { curso: String(body.curso ?? ""), ...(body.tema ? { tema: String(body.tema) } : {}) };
    const n = Math.min(Math.max(Number(body.n) || 10, 1), 50);
    ids = armarPractica(lista, filtro, n, vistas, Math.random);
  }
  if (ids.length === 0) throw new FalloDeFuncion("No hay preguntas publicadas para esto todavía");

  return nuevo({
    modo: modo === "real" ? "real" : modo === "diagnostico" ? "diagnostico" : "simulacro",
    tipo, area: areaDelIntento, examen_id: examenId, filtro, preguntas: ids,
    ver_soluciones: tipo === "practica" && body.ver_soluciones === true,
    duration_minutes: tipo !== "cronometrado" ? null : modo === "diagnostico" ? MINUTOS_DIAGNOSTICO : duracionMinutos(ids.length),
  });
}

/** Corrige un intento (+20 / −1,125 / 0), marca cada respuesta, guarda el puntaje y anota el cuaderno. */
export async function entregar(body: { intento_id?: string }) {
  const todos = intentos();
  const i = todos.findIndex((x) => x.id === String(body?.intento_id ?? ""));
  if (i < 0) throw new FalloDeFuncion("Intento no encontrado", 404);
  const intento = todos[i];
  if (intento.estado === "entregado" && intento.informe) return intento.informe;

  const banco = await cargarBanco();
  const ids = intento.preguntas;
  const suyas = respuestas().filter((r) => r.intento_id === intento.id);
  // Una pregunta que ya no está en el banco entra sin clave (anulada), como en Atlas.
  const r = corregir(ids.map((id) => banco.preguntaPorId.get(id) ?? { id, clave: null, curso: null }), suyas);

  const opcionDe = new Map(suyas.map((x) => [x.pregunta_id, x.opcion]));
  const corregidas = r.porPregunta.filter((p) => banco.preguntaPorId.has(p.pregunta_id));
  const correctaDe = new Map(corregidas.map((p) => [p.pregunta_id, p.correcta]));
  const ahora = new Date().toISOString();
  const otras = respuestas().filter((x) => x.intento_id !== intento.id);
  const previas = new Map(suyas.map((x) => [x.pregunta_id, x]));
  escribirTabla("admision_respuestas", [
    ...otras,
    ...corregidas.map((p) => ({
      marcada: false, segundos: 0, revelada: false, confianza: null, ...previas.get(p.pregunta_id),
      intento_id: intento.id, pregunta_id: p.pregunta_id, opcion: opcionDe.get(p.pregunta_id) ?? null,
      correcta: correctaDe.get(p.pregunta_id) ?? null, updated_at: ahora,
    })),
  ]);

  const informe = {
    puntaje: r.puntaje, maximo: r.maximo, aciertos: r.aciertos, errores: r.errores, blancos: r.blancos, anuladas: r.anuladas, porCurso: r.porCurso,
  };
  todos[i] = { ...intento, estado: "entregado", entregado_at: ahora, puntaje: r.puntaje, informe };
  escribirTabla("admision_intentos", todos);

  // El cuaderno de errores: las incorrectas entran a la caja 1; en un repaso, cada una sube o vuelve.
  try {
    const hoy = diaDeLima(new Date());
    const cuaderno = errores();
    const mapa = new Map<string, EntradaDeErrores>(cuaderno.map((x) => [x.pregunta_id, x]));
    const filas = intento.modo === "repaso"
      ? corregidas.filter((p) => mapa.has(p.pregunta_id)).map((p) => aplicarRepaso(mapa.get(p.pregunta_id)!, p.correcta === true, hoy))
      : anotarFallos(mapa, corregidas.filter((p) => p.correcta === false).map((p) => p.pregunta_id), hoy);
    if (filas.length) {
      const nuevas = new Map(filas.map((f) => [f.pregunta_id, { user_id: ID_DEL_ALUMNO, ...f, updated_at: ahora }]));
      escribirTabla("admision_errores", [...cuaderno.filter((x) => !nuevas.has(x.pregunta_id)), ...nuevas.values()]);
    }
  } catch (e) {
    // Nunca tumba la entrega: el puntaje ya está guardado.
    console.error("cuaderno", e);
  }
  return informe;
}

/** `admision_preguntas_del_intento`: las preguntas en su orden; la clave y la solución, solo entregado. */
export async function preguntasDelIntento(intentoId: string): Promise<PreguntaDelIntento[]> {
  const intento = intentos().find((x) => x.id === intentoId);
  if (!intento) return [];
  const banco = await cargarBanco();
  const entregado = intento.estado === "entregado";
  return intento.preguntas.flatMap((id, i) => {
    const p = banco.preguntaPorId.get(id);
    if (!p) return [];
    const t = p.texto_id ? banco.textoPorId.get(p.texto_id) : undefined;
    return [{
      pregunta_id: p.id, orden: i + 1, numero: p.numero, enunciado: p.enunciado, opciones: p.opciones, graficos: p.graficos,
      texto_id: p.texto_id, texto_etiqueta: t?.etiqueta ?? null, texto_cuerpo: t?.cuerpo ?? null, curso: p.curso, tema: p.tema,
      clave: entregado ? p.clave : null, solucion: entregado ? p.solucion : null,
    }];
  });
}

/** `admision_revelar`: en una práctica con soluciones, la clave de una pregunta ya respondida. */
export async function revelar(intentoId: string, preguntaId: string): Promise<{ clave: string; solucion: string }[]> {
  const intento = intentos().find((x) => x.id === intentoId);
  if (!intento || intento.tipo !== "practica" || !intento.ver_soluciones) return [];
  const todas = respuestas();
  const i = todas.findIndex((r) => r.intento_id === intentoId && r.pregunta_id === preguntaId && r.opcion !== null);
  if (i < 0) return [];
  todas[i] = { ...todas[i], revelada: true };
  escribirTabla("admision_respuestas", todas);
  const p = (await cargarBanco()).preguntaPorId.get(preguntaId);
  return p ? [{ clave: p.clave ?? "", solucion: p.solucion ?? "" }] : [];
}

/** `admision_temas_frecuentes`: por curso y tema, en cuántos procesos del área salió y cuántas veces. */
export async function temasFrecuentes(area: string) {
  const banco = await cargarBanco();
  const cicloDe = new Map(banco.examenes.filter((e) => e.area === area).map((e) => [e.id, e.ciclo]));
  const delArea = banco.preguntas.filter((p) => cicloDe.has(p.examen_id) && p.origen === "real" && p.curso && p.tema);
  const total = new Set(delArea.map((p) => cicloDe.get(p.examen_id))).size;
  const grupos = new Map<string, { curso: string; tema: string; ciclos: Set<string>; preguntas: number }>();
  for (const p of delArea) {
    const k = `${p.curso}\u0000${p.tema}`;
    const g = grupos.get(k) ?? { curso: p.curso!, tema: p.tema!, ciclos: new Set<string>(), preguntas: 0 };
    g.ciclos.add(cicloDe.get(p.examen_id)!);
    g.preguntas++;
    grupos.set(k, g);
  }
  return [...grupos.values()]
    .sort((a, b) => a.curso.localeCompare(b.curso) || b.preguntas - a.preguntas)
    .map((g) => ({ curso: g.curso, tema: g.tema, procesos: g.ciclos.size, preguntas: g.preguntas, procesos_del_area: total }));
}
