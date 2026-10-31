import type { MigrationInterface, QueryRunner } from "typeorm";
export class Learning1770000001000 implements MigrationInterface {
  name = "Learning1770000001000";
  async up(q: QueryRunner) {
    await q.query(`
  CREATE TABLE actividades_generadas (
   id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES actores ON DELETE CASCADE,
   fragmento_id uuid NOT NULL REFERENCES fragmentos ON DELETE CASCADE,
   data jsonb NOT NULL, intento text NOT NULL DEFAULT '', revelada boolean NOT NULL DEFAULT false,
   created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(actor_id,fragmento_id)
  );
  ALTER TABLE solicitudes_ia ADD COLUMN fragmento_id uuid REFERENCES fragmentos ON DELETE CASCADE;
  CREATE TABLE revisiones_nodo (
   id uuid PRIMARY KEY, nodo_id uuid NOT NULL REFERENCES nodos ON DELETE CASCADE,
   titulo text NOT NULL, contenido text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX ON revisiones_nodo(nodo_id,created_at);
 `);
  }
  async down(): Promise<void> {
    throw new Error(
      "No se eliminan evidencias ni contenido por reversión automática.",
    );
  }
}
