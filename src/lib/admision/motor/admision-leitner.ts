/**
 * El cuaderno de errores de admisión: Leitner 1/3/7 días, traído de Audix Admisión (src/errores) y llevado
 * por el servidor (`admision-entregar` anota los fallos y aplica los repasos; `admision-armar` arma el
 * repaso de hoy). El navegador importa este mismo fichero para el resumen: no hay segunda copia.
 * Las fechas son días de Lima (AAAA-MM-DD).
 */
export const DIAS_POR_CAJA = { 1: 1, 2: 3, 3: 7 } as const;
export type Caja = keyof typeof DIAS_POR_CAJA;

export interface EntradaDeErrores {
  pregunta_id: string;
  caja: Caja;
  proxima: string;
  veces: number;
  repasos: number;
  dominada: boolean;
  agregada_en: string;
}

export const diaDeLima = (iso: string | Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(typeof iso === "string" ? new Date(iso) : iso);

export function sumarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Las incorrectas de un intento entran (o vuelven) a la caja 1, con repaso mañana. */
export function anotarFallos(previas: Map<string, EntradaDeErrores>, falladas: string[], hoy: string): EntradaDeErrores[] {
  return [...new Set(falladas)].map((pregunta_id) => {
    const p = previas.get(pregunta_id);
    return {
      pregunta_id, caja: 1, proxima: sumarDias(hoy, DIAS_POR_CAJA[1]), veces: (p?.veces ?? 0) + 1,
      repasos: p?.repasos ?? 0, dominada: false, agregada_en: p?.agregada_en ?? hoy,
    };
  });
}

/** Acertar sube de caja (en la 3, dominada); fallar o dejarla en blanco la devuelve a la 1. */
export function aplicarRepaso(e: EntradaDeErrores, acerto: boolean, hoy: string): EntradaDeErrores {
  if (!acerto) return { ...e, caja: 1, proxima: sumarDias(hoy, DIAS_POR_CAJA[1]), repasos: e.repasos + 1, veces: e.veces + 1, dominada: false };
  if (e.caja === 3) return { ...e, repasos: e.repasos + 1, dominada: true };
  const caja = (e.caja + 1) as Caja;
  return { ...e, caja, proxima: sumarDias(hoy, DIAS_POR_CAJA[caja]), repasos: e.repasos + 1 };
}

/** Las que tocan hoy (y las atrasadas): primero las más atrasadas y las de caja más baja. */
export function paraHoy<T extends Pick<EntradaDeErrores, "pregunta_id" | "caja" | "proxima" | "dominada">>(entradas: T[], hoy: string): T[] {
  return entradas.filter((e) => !e.dominada && e.proxima <= hoy)
    .sort((a, b) => a.proxima.localeCompare(b.proxima) || a.caja - b.caja || a.pregunta_id.localeCompare(b.pregunta_id));
}

export function resumenDelCuaderno(entradas: Pick<EntradaDeErrores, "pregunta_id" | "caja" | "proxima" | "dominada">[], hoy: string) {
  const activas = entradas.filter((e) => !e.dominada);
  return {
    hoy: paraHoy(entradas, hoy).length,
    porCaja: { 1: activas.filter((e) => e.caja === 1).length, 2: activas.filter((e) => e.caja === 2).length, 3: activas.filter((e) => e.caja === 3).length },
    dominadas: entradas.length - activas.length,
    proxima: activas.filter((e) => e.proxima > hoy).map((e) => e.proxima).sort()[0] ?? null,
    total: entradas.length,
  };
}
