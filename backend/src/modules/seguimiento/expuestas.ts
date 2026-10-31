import type { EntityManager } from "typeorm";
import type { Database } from "../../database/database.js";
import { claveInstancia, generar } from "./plantillas.js";
// Lo que el estudiante ya vio: comprobaciones (curadas o de plantilla) y prácticas/predicciones
// de la charla. Una instancia de plantilla no se repite en ninguna de las dos.
export async function clavesExpuestas(
  db: Database,
  actor: string,
  m?: EntityManager,
) {
  const claves = new Set<string>();
  for (const r of await db.query<{ actividad_id: string }>(
    "SELECT actividad_id FROM comprobaciones WHERE actor_id=$1",
    [actor],
    m,
  ))
    claves.add(r.actividad_id);
  for (const r of await db.query<{
    bloques: { tipo?: string; plantilla?: string; semilla?: number }[];
  }>(
    "SELECT m.bloques FROM mensajes m JOIN conversaciones c ON c.id=m.conversacion_id WHERE c.actor_id=$1 AND m.rol='tutor' AND m.bloques<>'[]'::jsonb",
    [actor],
    m,
  ))
    for (const b of r.bloques)
      if (
        (b.tipo === "practica" || b.tipo === "prediccion") &&
        b.plantilla &&
        typeof b.semilla === "number"
      )
        claves.add(claveInstancia(generar(b.plantilla, b.semilla)));
  return claves;
}
