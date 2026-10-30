import { CURSOS, cursoPorId } from "./temario.ts";
import type { PreguntaDelBanco, TextoExtraido } from "./tipos";

/**
 * De lo que deja scripts/admision/salida/ (banco.json y textos.json de cada examen) a las filas de
 * las tablas de admisión. Puro: subir.mjs hace la red.
 */

export type Area = "A" | "B" | "C" | "D" | "E" | "medicina";

export interface FilaExamen { universidad: "unmsm"; ciclo: string; area: Area; n_preguntas: number }
export interface FilaTexto { etiqueta: string; cuerpo: string }
export interface FilaPregunta {
  numero: number;
  /** Etiqueta de su lectura; subir.mjs la cambia por el id de admision_textos. */
  texto: string | null;
  bloque: string | null; curso: string | null; tema: string | null; topic_id: string | null;
  enunciado: string; opciones: Record<string, string>; clave: string | null;
  graficos: string[]; solucion: string | null; dificultad: number | null;
  origen: "real"; estado: "publicada" | "descartada"; motivo_descarte: string | null; avisos: string[];
}

/** «UNMSM_2026-I_Area-A» → unmsm / 2026-I / A; «…_Medicina-Humana» → medicina. */
export function parsearPrefijo(prefijo: string): { universidad: "unmsm"; ciclo: string; area: Area } {
  const m = /^UNMSM_(\d{4}-(?:I|II))_(?:Area-([A-E])|(Medicina-Humana))$/.exec(prefijo);
  if (!m) throw new Error(`Prefijo de examen no reconocido: ${prefijo}`);
  return { universidad: "unmsm", ciclo: m[1], area: m[2] ? (m[2] as Area) : "medicina" };
}

/** El título del tema de sistema: «Aritmética · Numeración». Único dentro de la clase de admisión. */
export function tituloDeTema(cursoId: string, temaId: string): string {
  const curso = cursoPorId(cursoId);
  const tema = curso?.temas.find((t) => t.id === temaId);
  if (!curso || !tema) throw new Error(`Tema fuera del temario: ${cursoId}/${temaId}`);
  return `${curso.nombre} · ${tema.nombre}`;
}

/** Todos los temas de sistema que tiene que haber en `topics`, en el orden del temario. */
export function titulosDelTemario(): string[] {
  return CURSOS.flatMap((c) => c.temas.map((t) => `${c.nombre} · ${t.nombre}`));
}

/**
 * Sin carpetas: «unmsm-2026-I-A-41-0-p12-….png». La subida se hace a mano en Lovable Cloud (sin
 * service role), y su Storage aplana lo que se arrastra: con carpetas, 469 de 530 quedaron en la raíz
 * y 48 nombres se pisaron entre exámenes (04-10-2026). El examen va en el nombre, que así es único.
 */
export function rutaDeGrafico(prefijo: string, recorte: string): string {
  const { universidad, ciclo, area } = parsearPrefijo(prefijo);
  return `${universidad}-${ciclo}-${area}-${recorte.split("/").pop()}`;
}

/**
 * Si un examen sube. La portada ofrece como «examen real» cada fila de `admision_examenes`: uno vacío o con
 * menos de la mitad publicable sería un examen roto. El mismo umbral con el que procesar-todo.mjs para.
 */
export function examenSubible({ preguntas, publicadas }: { preguntas: number; publicadas: number }): boolean {
  return preguntas > 0 && publicadas / preguntas >= 0.5;
}

/** Todas las filas de un examen. `temaId` da el id de `topics` para un título, o null si no existe. */
export function filasDeExamen(
  prefijo: string,
  banco: PreguntaDelBanco[],
  textos: TextoExtraido[],
  temaId: (titulo: string) => string | null,
): { examen: FilaExamen; textos: FilaTexto[]; preguntas: FilaPregunta[]; graficos: { local: string; ruta: string }[] } {
  const { universidad, ciclo, area } = parsearPrefijo(prefijo);
  const graficos: { local: string; ruta: string }[] = [];
  const preguntas = banco.map((p): FilaPregunta => {
    const a = p.analisis;
    const curso = a ? cursoPorId(a.curso) : undefined;
    const enTemario = Boolean(a && curso?.temas.some((t) => t.id === a.tema));
    const rutas = p.recortes.map((local) => {
      const ruta = rutaDeGrafico(prefijo, local);
      if (!graficos.some((g) => g.ruta === ruta)) graficos.push({ local, ruta });
      return ruta;
    });
    return {
      numero: p.numero,
      texto: p.texto,
      bloque: curso?.bloque ?? null,
      curso: a?.curso ?? null,
      tema: a?.tema ?? null,
      topic_id: a && enTemario ? temaId(tituloDeTema(a.curso, a.tema)) : null,
      enunciado: p.enunciado,
      opciones: Object.fromEntries(Object.entries(p.opciones).filter((e): e is [string, string] => typeof e[1] === "string")),
      clave: p.clave,
      graficos: rutas,
      solucion: a?.solucion ?? null,
      dificultad: a?.dificultad ?? null,
      origen: "real",
      estado: p.estado,
      motivo_descarte: p.motivos.length ? p.motivos.join(", ") : null,
      avisos: p.avisos ?? [],
    };
  });
  return {
    examen: { universidad, ciclo, area, n_preguntas: banco.length },
    textos: textos.map((t) => ({ etiqueta: t.etiqueta, cuerpo: t.cuerpo })),
    preguntas,
    graficos,
  };
}
