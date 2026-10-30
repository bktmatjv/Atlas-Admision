import type { MigrationInterface, QueryRunner } from "typeorm";
export class Harness1770000002000 implements MigrationInterface {
  name = "Harness1770000002000";
  async up(q: QueryRunner) {
    await q.query(`
  ALTER TABLE nodos ADD COLUMN idea_clave text;
  ALTER TABLE nodos ADD COLUMN created_at timestamptz NOT NULL DEFAULT clock_timestamp();
  CREATE TABLE rastros_error (
   id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES actores ON DELETE CASCADE,
   arbol_id uuid NOT NULL REFERENCES arboles ON DELETE CASCADE,
   comprobacion_id uuid NOT NULL UNIQUE REFERENCES comprobaciones ON DELETE CASCADE,
   respuesta text NOT NULL, idea_clave text,
   nodo_retorno_id uuid REFERENCES nodos ON DELETE SET NULL,
   nivel_ayuda text NOT NULL CHECK(nivel_ayuda IN ('pista','ejemplo','explicacion_completa')),
   created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX ON rastros_error(arbol_id,created_at DESC);
 `);
  }
  async down(): Promise<void> {
    throw new Error(
      "No se eliminan rastros de error ni contenido por reversión automática.",
    );
  }
}
