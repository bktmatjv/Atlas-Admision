/**
 * Tu progreso (tramo 6 de Audix): la racha de días de estudio y el percentil frente a los postulantes
 * reales de tu escuela (histogramas oficiales de la OCA, solo conteos). El percentil «frente a usuarios»
 * de Audix, hecho con una distribución inventada, no se trajo.
 */
import type { DistribucionUnmsm } from "./datos-unmsm";
import { diaDeLima, sumarDias } from "@/lib/admision/motor/admision-leitner";

/** Días seguidos (en Lima) con algo entregado; la actual cuenta hasta hoy o ayer: hoy aún puede estudiar. */
export function racha(entregas: string[], hoy: string) {
  const dias = new Set(entregas.map((iso) => diaDeLima(iso)));
  let mejor = 0, corrida = 0;
  let previo: string | null = null;
  for (const d of [...dias].sort()) {
    corrida = previo && sumarDias(previo, 1) === d ? corrida + 1 : 1;
    mejor = Math.max(mejor, corrida);
    previo = d;
  }
  let actual = 0;
  let cursor = dias.has(hoy) ? hoy : sumarDias(hoy, -1);
  while (dias.has(cursor)) { actual++; cursor = sumarDias(cursor, -1); }
  return { actual, mejor, ultimos7: Array.from({ length: 7 }, (_, i) => dias.has(sumarDias(hoy, i - 6))) };
}

/** Qué parte de los postulantes sacó menos que `puntaje` (0–100), repartiendo cada tramo por igual. */
export function percentil(d: DistribucionUnmsm, puntaje: number): number {
  const total = d.conteos.reduce((s, c) => s + c, 0);
  if (total === 0) return 0;
  let debajo = 0;
  d.conteos.forEach((c, i) => {
    const ini = d.desde + i * d.ancho;
    if (puntaje >= ini + d.ancho) debajo += c;
    else if (puntaje > ini) debajo += (c * (puntaje - ini)) / d.ancho;
  });
  return Math.round((debajo / total) * 1000) / 10;
}
