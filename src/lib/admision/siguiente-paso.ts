/**
 * El siguiente paso en /admision: el único botón principal de la portada. La auditoría del 17-10
 * contó cuatro «Empezar» principales seguidos, sin decir por dónde ir. Ahora:
 * - un intento a medias → seguir con él;
 * - sin diagnóstico ni examen completo entregado → el diagnóstico (30 preguntas, dice por dónde empezar);
 * - si no → un simulacro de su área.
 * Lo demás (examen real, práctica) sigue ahí, como secundario.
 */
export type SiguientePaso =
  | { tipo: "continuar"; intentoId: string; modo: string }
  | { tipo: "diagnostico" }
  | { tipo: "simulacro" };

export function siguientePasoDeAdmision(intentos: { id: string; modo: string; estado: string; filtro?: unknown }[]): SiguientePaso {
  const aMedias = intentos.find((i) => i.estado === "en_curso");
  if (aMedias) return { tipo: "continuar", intentoId: aMedias.id, modo: aMedias.modo };
  // Una práctica se guarda como simulacro con `filtro` (un curso o un tema): no cuenta.
  const conPuntoDePartida = intentos.some((i) => i.estado === "entregado" && !i.filtro && ["diagnostico", "simulacro", "real"].includes(i.modo));
  return conPuntoDePartida ? { tipo: "simulacro" } : { tipo: "diagnostico" };
}
