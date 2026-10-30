/**
 * Lo puro de la pantalla del examen de admisión: cómo se pinta cada celda de la cuadrícula,
 * qué se le dice al alumno antes de entregar y la cola de respuestas que no se pudieron guardar.
 */
import { crearCola } from "@/lib/cola-de-respuestas";

export type EstadoDeCelda = "actual" | "acierto" | "fallo" | "marcada" | "respondida" | "blanco";

/** Corregido el intento, manda la corrección; si no, la actual, luego la marcada, luego si tiene respuesta. */
export function estadoDeCelda(c: { actual: boolean; respondida: boolean; marcada: boolean; correcta: boolean | null }): EstadoDeCelda {
  if (c.correcta === true) return "acierto";
  if (c.correcta === false) return "fallo";
  if (c.actual) return "actual";
  if (c.marcada) return "marcada";
  return c.respondida ? "respondida" : "blanco";
}

export interface EstadoDeRespuesta { opcion: string | null; marcada: boolean }

export function resumenParaEntregar(ids: string[], respuestas: Record<string, EstadoDeRespuesta | undefined>) {
  let respondidas = 0, marcadas = 0;
  for (const id of ids) {
    const r = respuestas[id];
    if (r?.opcion) respondidas++;
    if (r?.marcada) marcadas++;
  }
  return { respondidas, blancos: ids.length - respondidas, marcadas };
}

const LETRAS = ["A", "B", "C", "D", "E"] as const;

/** Las letras que trae la pregunta (2022-I tiene 4 opciones, 2026-I tiene 5). */
export function letrasDe(opciones: Record<string, string | undefined>): string[] {
  return LETRAS.filter((l) => (opciones[l] ?? "").trim() !== "");
}

/* ─────────────── La cola de lo que no se pudo guardar (sin conexión) ─────────────── */

/** `confianza` (1 dudo, 2 más o menos, 3 seguro) es opcional: de 20261015130000, el tramo 2 de Audix. */
export interface Pendiente { pregunta_id: string; opcion: string | null; marcada: boolean; confianza?: number | null }

// La cola vive en `src/lib/cola-de-respuestas.ts`, compartida con el Predictor de examen; aquí con
// su prefijo de siempre para no perder las colas que ya hubiera en los navegadores.
const cola = crearCola<Pendiente>("admision-cola:");

/** La última respuesta de cada pregunta gana: la anterior sobra. */
export const encolar = cola.encolar;

/** Quita lo que se guardó, solo si en la cola sigue con ese mismo valor (si cambió entretanto, falta guardarlo). */
// La confianza cuenta como un campo más: si cambió entretanto, falta guardarla.
export const quitarDeLaCola = cola.quitar;

export const leerCola = cola.leer;

/**
 * ¿Falló el guardado porque la base aún no tiene la columna `confianza`? Pasa si el front se publica antes
 * que el SQL del tramo 2: entonces se reenvía sin ella, que una respuesta del examen no se pierde por eso.
 */
export function faltaLaColumnaConfianza(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (error.code === "PGRST204" || error.code === "42703") && /confianza/.test(error.message ?? "");
}

export const sinConfianza = (cola: Pendiente[]): Pendiente[] => cola.map(({ confianza: _, ...resto }) => resto);

export const escribirCola = cola.escribir;
