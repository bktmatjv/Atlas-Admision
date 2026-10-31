import type { MigrationInterface, QueryRunner } from "typeorm";

// Solo nombres de herramientas ejecutadas. Nunca argumentos, resultados ni razonamiento privado.
export class PasosAgente1770000007000 implements MigrationInterface {
  name = "PasosAgente1770000007000";
  async up(q: QueryRunner) {
    await q.query(
      "ALTER TABLE mensajes ADD COLUMN pasos jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(pasos) = 'array')",
    );
  }
  async down(): Promise<void> {
    throw new Error("No se eliminan pasos guardados por reversión automática.");
  }
}
