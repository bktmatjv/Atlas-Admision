import type { AreaUnmsm, CarreraUnmsm } from "./datos-unmsm";

/** Sin tildes, en minúsculas y con los signos como espacios. */
export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, " ").trim();

/**
 * Las escuelas que casan con lo que escribe el alumno: cada palabra tiene que ser el comienzo de alguna
 * palabra del nombre, en cualquier orden («ing sist», «tec med»). Primero las sedes principales (sin
 * paréntesis) y las que casan desde la primera palabra.
 */
export function buscarEscuelas(carreras: CarreraUnmsm[], consulta: string, limite = 8): CarreraUnmsm[] {
  const piezas = normalizar(consulta).split(" ").filter(Boolean);
  if (!piezas.length) return [];
  return carreras
    .map((c) => ({ c, palabras: normalizar(c.nombre).split(" ") }))
    .filter(({ palabras }) => piezas.every((p) => palabras.some((w) => w.startsWith(p))))
    .map(({ c, palabras }) => ({ c, sede: c.nombre.includes("(") ? 1 : 0, inicio: palabras[0].startsWith(piezas[0]) ? 0 : 1 }))
    .sort((a, b) => a.sede - b.sede || a.inicio - b.inicio || a.c.nombre.localeCompare(b.c.nombre, "es"))
    .slice(0, limite)
    .map((x) => x.c);
}

/** Medicina Humana rinde su propio examen (jornada y cuadernillo aparte); las demás, el de su área. */
export function areaDelExamen(c: Pick<CarreraUnmsm, "id" | "area">): AreaUnmsm | "medicina" {
  return c.id === "medicina-humana" ? "medicina" : c.area;
}
