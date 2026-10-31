import type { MigrationInterface, QueryRunner } from "typeorm";
// Aditiva: el rastro de error recuerda si vino de una actividad curada o de una plantilla.
export class Plantillas1770000004000 implements MigrationInterface {
  name = "Plantillas1770000004000";
  async up(q: QueryRunner) {
    await q.query(`
  ALTER TABLE rastros_error ADD COLUMN origen text NOT NULL DEFAULT 'curada' CHECK(origen IN ('curada','plantilla'));
  ALTER TABLE rastros_error ADD COLUMN plantilla text;
  ALTER TABLE rastros_error ADD COLUMN parametros jsonb;
 `);
  }
  async down(): Promise<void> {
    throw new Error(
      "No se eliminan rastros de error por reversión automática.",
    );
  }
}
