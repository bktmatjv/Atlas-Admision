/**
 * El puntaje de San Marcos (spec §3): +20 por acierto, −1,125 por error, 0 en blanco; la sección
 * actitudinal no descuenta. Esto último lo trajo Audix Admisión (15-10-2026): la prensa y una copia del
 * Reglamento 2026-I coinciden; el reglamento oficial solo se descarga pagando, así que sigue por
 * verificar (scripts/admision/unmsm/FUENTES.md). Antes Atlas cobraba −1,125 también en la actitudinal.
 *
 * `src/lib/admision/formula.ts` es la copia del navegador: `formula.test.ts` exige que den lo mismo.
 */
export const PUNTOS = { acierto: 20, error: -1.125, blanco: 0 } as const;

/** Cursos en los que una incorrecta no resta. */
export const SIN_DESCUENTO: readonly string[] = ["actitudinal"];

export const puntosDelError = (curso: string | null) => (curso && SIN_DESCUENTO.includes(curso) ? 0 : PUNTOS.error);

/**
 * Corrige un intento. Una pregunta sin clave (descartada después de armar el intento) queda anulada:
 * no cuenta como acierto, error ni blanco, y no suma al máximo. Mejor eso que cobrar −1,125 por ella.
 * Los puntos se suman en milésimas enteras: San Marcos publica 3 decimales (1469,125).
 */
export function corregir(
  preguntas: { id: string; clave: string | null; curso: string | null }[],
  respuestas: { pregunta_id: string; opcion: string | null }[],
) {
  const opcionDe = new Map(respuestas.map((r) => [r.pregunta_id, r.opcion]));
  const porCurso: Record<string, { aciertos: number; errores: number; blancos: number; puntos: number }> = {};
  const milesimas: Record<string, number> = {};
  let aciertos = 0, errores = 0, blancos = 0, anuladas = 0, total = 0;
  const porPregunta = preguntas.map((p) => {
    if (p.clave === null) {
      anuladas++;
      return { pregunta_id: p.id, correcta: null };
    }
    const opcion = opcionDe.get(p.id) ?? null;
    const correcta = opcion === null ? null : opcion === p.clave;
    const k = p.curso ?? "sin_curso";
    const c = (porCurso[k] ??= { aciertos: 0, errores: 0, blancos: 0, puntos: 0 });
    let mil: number;
    if (correcta === null) { blancos++; c.blancos++; mil = Math.round(PUNTOS.blanco * 1000); }
    else if (correcta) { aciertos++; c.aciertos++; mil = Math.round(PUNTOS.acierto * 1000); }
    else { errores++; c.errores++; mil = Math.round(puntosDelError(p.curso) * 1000); }
    milesimas[k] = (milesimas[k] ?? 0) + mil;
    total += mil;
    return { pregunta_id: p.id, correcta };
  });
  for (const [k, mil] of Object.entries(milesimas)) porCurso[k].puntos = mil / 1000;
  const maximo = (preguntas.length - anuladas) * PUNTOS.acierto;
  return { porPregunta, aciertos, errores, blancos, anuladas, puntaje: total / 1000, maximo, porCurso };
}
