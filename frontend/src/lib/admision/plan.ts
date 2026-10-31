/**
 * Plan de puntos: en qué cursos rinde más cada hora de estudio de la semana. Traído de Audix Admisión
 * (src/plan), con el peso del molde real de CALIBRA y el acierto del propio alumno.
 *
 * Es una heurística a la vista, no un dato oficial: las horas que cuesta subir 10 puntos porcentuales de
 * acierto en cada curso son SUPUESTOS de Audix (sin validar con alumnos) y la pantalla lo dice.
 */
import { moldeDe, type AreaExamen } from "@/lib/admision/motor/admision-molde";
import { puntosDe } from "./formula";

/** Horas para subir +10 puntos porcentuales de acierto (supuesto de Audix, ajustable). */
export const HORAS_POR_10PP: Record<string, number> = {
  actitudinal: 2, "habilidad-verbal": 6, "habilidad-logico-matematica": 6,
  aritmetica: 4, algebra: 4, geometria: 4, trigonometria: 4, fisica: 4, quimica: 3.5, biologia: 3,
  lenguaje: 3, literatura: 2.5, psicologia: 2.5, "educacion-civica": 2, "historia-del-peru": 2.5,
  "historia-universal": 2.5, geografia: 2.5, economia: 2.5, filosofia: 2.5,
};
const HORAS_POR_DEFECTO = 3;
/** Acierto que se supone en un curso del que aún no hay respuestas. */
export const ACIERTO_SIN_DATOS = 0.4;
/** Ningún curso se lleva más de esta parte de las horas (si no, salen planes de un solo curso). */
export const TOPE_POR_CURSO = 0.35;
const BLOQUE = 0.5;
const TECHO = 0.95;

export interface ConteoDeCurso { curso: string; aciertos: number; errores: number; blancos: number }
export interface PrioridadDelPlan {
  curso: string; peso: number; acierto: number; sinDatos: boolean;
  /** Puntos esperados por hora con el primer bloque de estudio. */
  puntosPorHora: number;
  horas: number;
  /** Puntos que se esperan ganar con esas horas (estimación). */
  puntosEsperados: number;
}

const horas10 = (curso: string) => HORAS_POR_10PP[curso] ?? HORAS_POR_DEFECTO;

/** Puntos por hora de un curso con su acierto actual, con rendimientos decrecientes cerca del techo. */
function rinde(curso: string, peso: number, acierto: number) {
  const margen = Math.max(0, TECHO - acierto);
  if (margen === 0) return 0;
  const v = puntosDe(curso);
  // +10 pp de acierto = peso × 0,1 preguntas más bien, que reemplazan (de media) un error o un blanco.
  const ganancia10 = peso * 0.1 * (v.acierto - (v.error + v.blanco) / 2);
  return (ganancia10 / horas10(curso)) * Math.min(1, margen / 0.3);
}

export function planDePuntos(conteos: ConteoDeCurso[], area: AreaExamen, horasSemana: number) {
  const horasTotales = Math.max(0, Math.floor(horasSemana * 2) / 2);
  const estado = moldeDe(area).map(({ curso, preguntas: peso }) => {
    const c = conteos.find((x) => x.curso === curso);
    const n = c ? c.aciertos + c.errores + c.blancos : 0;
    const acierto = n ? c!.aciertos / n : ACIERTO_SIN_DATOS;
    return { curso, peso, acierto0: acierto, acierto, sinDatos: n === 0, horas: 0, puntos: 0 };
  });
  const tope = Math.max(2, horasTotales * TOPE_POR_CURSO);
  for (let h = 0; h + BLOQUE <= horasTotales + 1e-9; h += BLOQUE) {
    let mejor: (typeof estado)[number] | null = null;
    let mejorRinde = 0;
    for (const e of estado) {
      if (e.horas + BLOQUE > tope + 1e-9) continue;
      const r = rinde(e.curso, e.peso, e.acierto);
      if (r > mejorRinde) { mejor = e; mejorRinde = r; }
    }
    if (!mejor) break;
    mejor.horas += BLOQUE;
    mejor.puntos += mejorRinde * BLOQUE;
    mejor.acierto = Math.min(TECHO, mejor.acierto + (0.1 / horas10(mejor.curso)) * BLOQUE);
  }
  const prioridades: PrioridadDelPlan[] = estado.map((e) => ({
    curso: e.curso, peso: e.peso, acierto: Math.round(e.acierto0 * 100) / 100, sinDatos: e.sinDatos,
    puntosPorHora: Math.round(rinde(e.curso, e.peso, e.acierto0) * 10) / 10, horas: e.horas, puntosEsperados: Math.round(e.puntos),
  })).sort((a, b) => b.horas - a.horas || b.puntosPorHora - a.puntosPorHora);
  return { horasTotales, prioridades, puntosEsperados: prioridades.reduce((s, p) => s + p.puntosEsperados, 0) };
}
