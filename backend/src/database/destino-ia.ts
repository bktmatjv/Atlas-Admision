import type { MigrationInterface, QueryRunner } from "typeorm";
// Aditiva: registra qué destino del router (proveedor:modelo) respondió cada turno del tutor.
// Nullable: los mensajes anteriores y los del proveedor de pruebas no tienen destino.
export class DestinoIa1770000006000 implements MigrationInterface {
  name = "DestinoIa1770000006000";
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE mensajes ADD COLUMN destino_ia text`);
  }
  async down(): Promise<void> {
    throw new Error(
      "No se elimina el registro del destino de los turnos por reversión automática.",
    );
  }
}
