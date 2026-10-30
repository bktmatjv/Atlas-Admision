/**
 * La cola local de lo que no se pudo guardar (sin conexión) mientras se rinde un examen.
 *
 * Nació en el examen de admisión (`src/lib/admision/intento.ts`) y la usa también el Predictor de
 * examen: cada uno con su prefijo de clave en `localStorage` (`admision-cola:`, `predictor-cola:`),
 * para que sus colas no se mezclen.
 */

type Almacen = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Dos respuestas son la misma si todos sus campos valen lo mismo. */
function iguales(a: object, b: object): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]);
}

export function crearCola<T extends { pregunta_id: string }>(prefijo: string) {
  const clave = (intentoId: string) => `${prefijo}${intentoId}`;
  return {
    /** La última respuesta de cada pregunta gana: la anterior sobra. */
    encolar(cola: T[], r: T): T[] {
      return [...cola.filter((p) => p.pregunta_id !== r.pregunta_id), r];
    },
    /** Quita lo que se guardó, solo si en la cola sigue con ese mismo valor (si cambió entretanto, falta guardarlo). */
    quitar(cola: T[], guardadas: T[]): T[] {
      return cola.filter((p) => !guardadas.some((g) => iguales(g, p)));
    },
    leer(almacen: Almacen, intentoId: string): T[] {
      try {
        const crudo = almacen.getItem(clave(intentoId));
        const datos: unknown = crudo ? JSON.parse(crudo) : [];
        return Array.isArray(datos) ? (datos as T[]) : [];
      } catch {
        return [];
      }
    },
    escribir(almacen: Almacen, intentoId: string, cola: T[]): void {
      try {
        if (cola.length) almacen.setItem(clave(intentoId), JSON.stringify(cola));
        else almacen.removeItem(clave(intentoId));
      } catch {
        // Sin almacenamiento (modo privado lleno): se pierde la cola, no la pantalla.
      }
    },
  };
}
