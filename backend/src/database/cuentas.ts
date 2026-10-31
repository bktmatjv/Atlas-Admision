import type { MigrationInterface, QueryRunner } from "typeorm";

export class Cuentas1770000008000 implements MigrationInterface {
  name = "Cuentas1770000008000";
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE cuentas (
      actor_id uuid PRIMARY KEY REFERENCES actores(id) ON DELETE CASCADE,
      usuario text UNIQUE NOT NULL CHECK (usuario ~ '^[a-z0-9_.]{3,30}$'),
      hash text NOT NULL,
      recuperacion_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    ); CREATE INDEX ON sesiones(actor_id);`);
  }
  async down(): Promise<void> {
    throw new Error("No se eliminan cuentas por reversión automática.");
  }
}
