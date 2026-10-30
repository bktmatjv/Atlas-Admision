/**
 * Estrategia de marcado: como las incorrectas restan, ¿cuándo conviene dejar en blanco? Traída de Audix
 * Admisión (src/estrategia). El umbral sale de la fórmula (≈ 5,3 % en San Marcos, 0 % en la actitudinal);
 * la calibración, de la confianza que el alumno marca al responder (opcional, columna `confianza`).
 */
import { umbralMarcar, valorDeMarcar } from "./formula";

/** Intervalo de Wilson del 95 % para una proporción: evita conclusiones con pocas preguntas. */
export function wilson(aciertos: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const z = 1.96;
  const p = aciertos / n;
  const den = 1 + z ** 2 / n;
  const centro = (p + z ** 2 / (2 * n)) / den;
  const margen = (z * Math.sqrt((p * (1 - p)) / n + z ** 2 / (4 * n ** 2))) / den;
  return [Math.max(0, centro - margen), Math.min(1, centro + margen)];
}

export interface RespuestaParaCalibrar { curso: string | null; opcion: string | null; correcta: boolean | null; confianza: number | null }

export interface NivelDeConfianza {
  confianza: 1 | 2 | 3;
  preguntas: number; aciertos: number;
  tasa: number | null;
  rango: [number, number];
  recomendacion: "marcar" | "blanco" | "pocos-datos";
}

/** Por debajo de 8 respuestas en un nivel, no se recomienda nada. */
export const MINIMO_POR_NIVEL = 8;
/** Curso de referencia con descuento para el umbral general. */
const CURSO_QUE_RESTA = "algebra";

export function calibracion(respuestas: RespuestaParaCalibrar[]) {
  const umbral = umbralMarcar(CURSO_QUE_RESTA);
  const conteo = { 1: { n: 0, ok: 0 }, 2: { n: 0, ok: 0 }, 3: { n: 0, ok: 0 } } as Record<1 | 2 | 3, { n: number; ok: number }>;
  let blancos = 0, blancosActitudinal = 0, regaladosMil = 0, conConfianza = 0;
  for (const r of respuestas) {
    if (r.opcion === null) {
      blancos++;
      if (r.curso === "actitudinal") blancosActitudinal++;
      regaladosMil += Math.round(Math.max(0, valorDeMarcar(1 / 5, r.curso)) * 1000);
      continue;
    }
    if (r.confianza !== 1 && r.confianza !== 2 && r.confianza !== 3) continue;
    conConfianza++;
    conteo[r.confianza].n++;
    if (r.correcta) conteo[r.confianza].ok++;
  }
  const niveles = ([1, 2, 3] as const).map((confianza): NivelDeConfianza => {
    const { n, ok } = conteo[confianza];
    const rango = wilson(ok, n);
    return {
      confianza, preguntas: n, aciertos: ok, tasa: n ? ok / n : null, rango,
      // Solo «blanco» si estamos razonablemente seguros de que acierta por debajo del umbral.
      recomendacion: n < MINIMO_POR_NIVEL ? "pocos-datos" : rango[1] < umbral ? "blanco" : "marcar",
    };
  });
  return { umbral, niveles, blancos, blancosActitudinal, puntosRegaladosEnBlanco: Math.round(regaladosMil / 100) / 10, respuestasConConfianza: conConfianza };
}

export type Calibracion = ReturnType<typeof calibracion>;
