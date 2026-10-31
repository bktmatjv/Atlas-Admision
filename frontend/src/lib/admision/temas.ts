/**
 * Los temas que más vienen, por curso, a partir de lo que devuelve `admision_temas_frecuentes`
 * (20261015140000): recuentos de los exámenes reales del banco. Traído de Audix Admisión (src/temas),
 * donde salía vacío por no tener exámenes reales.
 */
import { CURSOS, cursoPorId } from "./temario";
import { nombreDelTema } from "./informe";

export type Categoria = "siempre" | "a-veces" | "rara-vez" | "nunca";

/** ≥ 75 % de los procesos: «siempre viene»; ≥ 35 %: «a veces»; menos: «rara vez». */
export const categoria = (frecuencia: number): Categoria =>
  frecuencia >= 0.75 ? "siempre" : frecuencia >= 0.35 ? "a-veces" : frecuencia > 0 ? "rara-vez" : "nunca";

/** Con menos procesos que esto, la pantalla avisa de que la estadística es orientativa. */
export const PROCESOS_MINIMOS = 3;

export interface FilaDeTema { curso: string; tema: string; procesos: number; preguntas: number; procesos_del_area: number }
export interface TemaFrecuente {
  tema: string; nombre: string; procesos: number; preguntas: number;
  frecuencia: number;
  /** Preguntas por examen, de media. */
  porProceso: number;
  categoria: Categoria;
}

export function agruparTemas(filas: FilaDeTema[]) {
  const procesos = filas[0]?.procesos_del_area ?? 0;
  if (!procesos) return { procesos: 0, cursos: [] as { curso: string; nombre: string; preguntas: number; temas: TemaFrecuente[] }[] };
  const porCurso = new Map<string, FilaDeTema[]>();
  for (const f of filas) porCurso.set(f.curso, [...(porCurso.get(f.curso) ?? []), f]);
  const cursos = [...porCurso.entries()].map(([curso, lista]) => {
    const vistos = new Set(lista.map((f) => f.tema));
    const nunca = (cursoPorId(curso)?.temas ?? []).filter((t) => !vistos.has(t.id))
      .map((t) => ({ curso, tema: t.id, procesos: 0, preguntas: 0, procesos_del_area: procesos }));
    const temas = [...lista, ...nunca].map((f): TemaFrecuente => {
      const frecuencia = f.procesos / procesos;
      return {
        tema: f.tema, nombre: nombreDelTema(curso, f.tema), procesos: f.procesos, preguntas: f.preguntas,
        frecuencia, porProceso: Math.round((f.preguntas / procesos) * 10) / 10, categoria: categoria(frecuencia),
      };
    }).sort((a, b) => b.frecuencia - a.frecuencia || b.preguntas - a.preguntas || a.nombre.localeCompare(b.nombre, "es"));
    return { curso, nombre: cursoPorId(curso)?.nombre ?? curso, preguntas: lista.reduce((s, f) => s + f.preguntas, 0), temas };
  }).sort((a, b) => b.preguntas - a.preguntas || CURSOS.findIndex((c) => c.id === a.curso) - CURSOS.findIndex((c) => c.id === b.curso));
  return { procesos, cursos };
}
