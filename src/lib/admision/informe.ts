/**
 * El informe de un intento entregado (spec §4 de Atlas + lo que trajo Audix Admisión). Lo calcula el
 * navegador con lo que ya devuelve `admision_preguntas_del_intento` al entregar: el servidor corrige
 * (`_shared/admision-correccion.ts`) y aquí se explica, con la misma fórmula (`formula.test.ts`).
 * Sin análisis del tiempo (decisión de Axel).
 */
import { moldeDe, type AreaExamen } from "@/lib/admision/motor/admision-molde";
import { cursoPorId } from "./temario";
import { puntosDe, redondear3 } from "./formula";
import { puntajeComparable, type IntentoComparable } from "./ingresaba";

export interface PreguntaCorregida { pregunta_id: string; curso: string | null; tema: string | null; clave: string | null }
export interface RespuestaCorregida { opcion: string | null; correcta: boolean | null; confianza?: number | null }

export interface CursoDelInforme {
  curso: string;
  /** Preguntas del curso en el examen de su área (el molde); 0 si no está en el molde. */
  peso: number;
  preguntas: number; aciertos: number; errores: number; blancos: number;
  puntos: number;
  /** Lo que le faltó para el máximo del curso: 20 por cada no acierto y lo que restó cada error. */
  perdidos: number;
  /** Puntos perdidos × peso del curso en su área (spec §4). */
  prioridad: number;
}

export interface TemaDelInforme { curso: string; tema: string; nombre: string; preguntas: number; aciertos: number; acierto: number }

export interface Fallada { pregunta_id: string; indice: number; curso: string | null; tema: string | null; tipo: "incorrecta" | "blanco"; opcion: string | null; clave: string }

export interface Informe { porCurso: CursoDelInforme[]; porTema: TemaDelInforme[]; falladas: Fallada[] }

/** Por debajo de 3 preguntas, el porcentaje de un tema es ruido (spec §4). */
export const MINIMO_POR_TEMA = 3;

export function nombreDelTema(curso: string | null, tema: string): string {
  return (curso && cursoPorId(curso)?.temas.find((t) => t.id === tema)?.nombre) || tema;
}

export function informeDe(preguntas: PreguntaCorregida[], respuestas: Record<string, RespuestaCorregida | undefined>, area: AreaExamen): Informe {
  const peso = new Map(moldeDe(area).map((h) => [h.curso, h.preguntas]));
  const cursos = new Map<string, { preguntas: number; aciertos: number; errores: number; blancos: number; mil: number; perdidosMil: number }>();
  const temas = new Map<string, { curso: string; tema: string; preguntas: number; aciertos: number }>();
  const falladas: Fallada[] = [];
  preguntas.forEach((p, indice) => {
    if (p.clave === null) return; // anulada
    const r = respuestas[p.pregunta_id];
    const opcion = r?.opcion ?? null;
    const estado = opcion === null ? "blanco" : opcion === p.clave ? "acierto" : "error";
    const curso = p.curso ?? "sin_curso";
    const v = puntosDe(p.curso);
    const c = cursos.get(curso) ?? { preguntas: 0, aciertos: 0, errores: 0, blancos: 0, mil: 0, perdidosMil: 0 };
    c.preguntas++;
    if (estado === "acierto") { c.aciertos++; c.mil += Math.round(v.acierto * 1000); }
    else {
      const puntos = estado === "error" ? v.error : v.blanco;
      if (estado === "error") c.errores++; else c.blancos++;
      c.mil += Math.round(puntos * 1000);
      c.perdidosMil += Math.round((v.acierto - puntos) * 1000);
      falladas.push({ pregunta_id: p.pregunta_id, indice, curso: p.curso, tema: p.tema, tipo: estado === "error" ? "incorrecta" : "blanco", opcion, clave: p.clave });
    }
    cursos.set(curso, c);
    if (p.tema) {
      const k = `${curso}\u0000${p.tema}`;
      const t = temas.get(k) ?? { curso, tema: p.tema, preguntas: 0, aciertos: 0 };
      t.preguntas++;
      if (estado === "acierto") t.aciertos++;
      temas.set(k, t);
    }
  });

  const porCurso = [...cursos.entries()].map(([curso, c]): CursoDelInforme => {
    const perdidos = c.perdidosMil / 1000;
    const w = peso.get(curso) ?? 0;
    return { curso, peso: w, preguntas: c.preguntas, aciertos: c.aciertos, errores: c.errores, blancos: c.blancos, puntos: c.mil / 1000, perdidos, prioridad: redondear3(perdidos * w) };
  }).sort((a, b) => b.prioridad - a.prioridad || b.perdidos - a.perdidos);

  const porTema = [...temas.values()].filter((t) => t.preguntas >= MINIMO_POR_TEMA)
    .map((t) => ({ ...t, nombre: nombreDelTema(t.curso, t.tema), acierto: t.aciertos / t.preguntas }))
    .sort((a, b) => a.acierto - b.acierto || b.preguntas - a.preguntas)
    .map(({ curso, tema, nombre, preguntas: n, aciertos, acierto }) => ({ curso, tema, nombre, preguntas: n, aciertos, acierto }));

  return { porCurso, porTema, falladas };
}

type ConteoGuardado = { aciertos: number; errores: number; blancos: number };
export interface IntentoParaEvolucion extends IntentoComparable {
  created_at: string;
  informe: { maximo: number; porCurso?: Record<string, ConteoGuardado> } | null;
}

/**
 * Cómo va entre simulacros, desde el segundo intento completo (spec §4): la serie de puntajes y, entre los
 * dos últimos, el acierto de cada curso que estuvo en los dos.
 */
export function evolucion(intentos: IntentoParaEvolucion[]) {
  const completos = intentos
    .map((i) => ({ i, c: puntajeComparable(i) }))
    .filter((x): x is { i: IntentoParaEvolucion; c: { puntaje: number; proyectado: boolean } } => x.c !== null)
    .sort((a, b) => a.i.created_at.localeCompare(b.i.created_at));
  if (completos.length < 2) return null;
  const serie = completos.map(({ i, c }) => ({ fecha: i.created_at, puntaje: c.puntaje, proyectado: c.proyectado }));
  const acierto = (x?: ConteoGuardado) => {
    const n = x ? x.aciertos + x.errores + x.blancos : 0;
    return n ? x!.aciertos / n : null;
  };
  const [penultimo, ultimo] = completos.slice(-2).map((x) => x.i.informe?.porCurso ?? {});
  const cursos = Object.keys(ultimo).flatMap((curso) => {
    const antes = acierto(penultimo[curso]);
    const ahora = acierto(ultimo[curso]);
    return antes === null || ahora === null ? [] : [{ curso, antes, ahora }];
  });
  return { serie, cambio: redondear3(serie.at(-1)!.puntaje - serie.at(-2)!.puntaje), cursos };
}
