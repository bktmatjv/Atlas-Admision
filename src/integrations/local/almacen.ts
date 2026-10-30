/**
 * Lo del alumno (intentos, respuestas, perfil y cuaderno de errores) vive en su navegador: no hay
 * cuentas. Cada tabla es una lista de filas en `localStorage`.
 *
 * Si el almacenamiento está bloqueado (modo privado estricto) se sigue en memoria: la sesión
 * funciona, pero no se recuerda al volver.
 */

export const TABLAS_DEL_ALUMNO = ["admision_intentos", "admision_respuestas", "admision_perfil", "admision_errores"] as const;
export type TablaDelAlumno = (typeof TABLAS_DEL_ALUMNO)[number];

const PREFIJO = "atlas-admision:v1:";
const enMemoria = new Map<string, unknown[]>();

export function leerTabla<T>(tabla: TablaDelAlumno): T[] {
  try {
    const crudo = localStorage.getItem(PREFIJO + tabla);
    if (crudo !== null) return JSON.parse(crudo) as T[];
  } catch {
    // Bloqueado o corrupto: lo que haya en memoria.
  }
  return (enMemoria.get(tabla) as T[] | undefined) ?? [];
}

export function escribirTabla<T>(tabla: TablaDelAlumno, filas: T[]): void {
  enMemoria.set(tabla, filas);
  try {
    localStorage.setItem(PREFIJO + tabla, JSON.stringify(filas));
  } catch {
    // Lleno o bloqueado: queda en memoria para esta sesión.
  }
}

/** Borra todo lo del alumno (el botón «Empezar de cero»). */
export function borrarTodo(): void {
  for (const t of TABLAS_DEL_ALUMNO) {
    enMemoria.delete(t);
    try { localStorage.removeItem(PREFIJO + t); } catch { /* nada que borrar */ }
  }
}
