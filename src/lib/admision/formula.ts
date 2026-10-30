/**
 * La fórmula de San Marcos en el navegador. Es la copia de `supabase/functions/_shared/admision-correccion.ts`
 * (el servidor corrige; aquí se explica): `formula.test.ts` exige que las dos den lo mismo.
 *
 * +20 por correcta, −1,125 por incorrecta, 0 en blanco; la sección actitudinal no descuenta. Desde
 * 2025-I no hay mínimo de 900: se ingresa por orden de mérito con puntaje positivo, y si hay empate en
 * el último puesto ingresan todos. Fuente: prensa y una copia del Reglamento 2026-I (el oficial solo se
 * descarga pagando): por verificar. Ver scripts/admision/unmsm/FUENTES.md.
 */
export const FORMULA_UNMSM = {
  acierto: 20,
  error: -1.125,
  blanco: 0,
  /** Cursos en los que una incorrecta no resta. */
  sinDescuento: ["actitudinal"] as readonly string[],
  maximo: 2000,
  /** Para ingresar hace falta un puntaje estrictamente mayor que este. */
  puntajeMinimoGeneral: 0,
  empateIngresanTodos: true,
  fuente: "Infobae, 23-02-2026; Andina; copia del Reglamento 2026-I (Scribd)",
  verificado: false,
} as const;

const MIL = 1000;
export const redondear3 = (x: number) => Math.round(x * MIL) / MIL;

/** Puntos de cada tipo de respuesta en un curso. */
export function puntosDe(curso: string | null) {
  const f = FORMULA_UNMSM;
  return { acierto: f.acierto, error: curso && f.sinDescuento.includes(curso) ? 0 : f.error, blanco: f.blanco };
}

/** Correctas más (en lugar de blancos) para subir `puntos`. */
export function preguntasParaSubir(puntos: number): number {
  if (puntos <= 0) return 0;
  return Math.ceil(Math.round(puntos * MIL) / ((FORMULA_UNMSM.acierto - FORMULA_UNMSM.blanco) * MIL));
}

/** San Marcos exige puntaje positivo para ocupar una vacante. */
export const cumpleRequisitoGeneral = (puntaje: number) => puntaje > FORMULA_UNMSM.puntajeMinimoGeneral;

/**
 * Probabilidad mínima de acierto para que marcar convenga más que dejar en blanco:
 * p·acierto + (1 − p)·error > blanco ⇔ p > (blanco − error) / (acierto − error). En San Marcos, ≈ 5,3 %;
 * en la actitudinal, 0 %: ahí marcar nunca resta.
 */
export function umbralMarcar(curso: string | null): number {
  const v = puntosDe(curso);
  return Math.max(0, (v.blanco - v.error) / (v.acierto - v.error));
}

/** Puntos esperados de marcar con probabilidad de acierto `p`, frente a dejarla en blanco. */
export function valorDeMarcar(p: number, curso: string | null): number {
  const v = puntosDe(curso);
  return p * v.acierto + (1 - p) * v.error - v.blanco;
}
