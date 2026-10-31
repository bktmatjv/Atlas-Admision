import type { MigrationInterface, QueryRunner } from "typeorm";
// Aditiva: una revisión de nodo recuerda si la pidió el estudiante o la hizo el agente.
// Solo las del estudiante cuentan como exploración.
export class Revisiones1770000005000 implements MigrationInterface {
  name = "Revisiones1770000005000";
  async up(q: QueryRunner) {
    await q.query(`
  ALTER TABLE revisiones_nodo ADD COLUMN por text NOT NULL DEFAULT 'estudiante' CHECK(por IN ('estudiante','agente'));
 `);
  }
  async down(): Promise<void> {
    throw new Error(
      "No se eliminan revisiones de nodos por reversión automática.",
    );
  }
}
