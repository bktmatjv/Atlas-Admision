// Clave estable del turno que el sistema dispara al entregar una comprobación: reintentar no duplica.
export const claveEvento = (comprobacionId: string) =>
  `evento-${comprobacionId}`;

/** Texto del chip bajo el mensaje del tutor cuando agregó ideas al mapa. */
export function etiquetaIdeas(n: number) {
  if (!(n > 0)) return null;
  return n === 1 ? "+1 idea en tu mapa" : `+${n} ideas en tu mapa`;
}
