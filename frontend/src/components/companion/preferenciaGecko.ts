export type EstadoGecko = "abierto" | "minimizado" | "oculto";

export const LLAVE_GECKO = "calibra_gecko_estado";
const ANCHO_CHICO = 768;
// Pantallas con formularios o campos de respuesta: el compañero no debe taparlos por defecto.
const RUTAS_CON_CAMPOS = ["/admision", "/cursos", "/aprender"];

const valido = (v: unknown): v is EstadoGecko =>
  v === "abierto" || v === "minimizado" || v === "oculto";

/** Solo es una preferencia de vista: si el almacenamiento falla, se usa el valor por defecto. */
export function leerEstadoGecko(
  storage: Pick<Storage, "getItem"> | null,
): EstadoGecko | null {
  try {
    const v = storage?.getItem(LLAVE_GECKO);
    return valido(v) ? v : null;
  } catch {
    return null;
  }
}

export function guardarEstadoGecko(
  storage: Pick<Storage, "setItem"> | null,
  estado: EstadoGecko,
) {
  try {
    storage?.setItem(LLAVE_GECKO, estado);
  } catch {
    // Navegador restringido: la elección vale solo para esta visita.
  }
}

/** La elección guardada manda; sin ella, minimizado en anchos chicos y sobre formularios. */
export function estadoInicialGecko(
  guardado: EstadoGecko | null,
  ancho: number,
  ruta: string,
): EstadoGecko {
  if (guardado) return guardado;
  if (ancho < ANCHO_CHICO) return "minimizado";
  return RUTAS_CON_CAMPOS.some((r) => ruta === r || ruta.startsWith(`${r}/`))
    ? "minimizado"
    : "abierto";
}
