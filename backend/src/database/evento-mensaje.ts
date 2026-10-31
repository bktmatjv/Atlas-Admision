import type { MigrationInterface, QueryRunner } from "typeorm";

// Marca los mensajes que dispara el sistema (p. ej. la entrega de una comprobación): no los escribió el estudiante.
export class EventoMensaje1770000009000 implements MigrationInterface {
  name = "EventoMensaje1770000009000";
  async up(q: QueryRunner) {
    await q.query(
      "ALTER TABLE mensajes ADD COLUMN evento text CHECK (evento IS NULL OR evento IN ('comprobacion_entregada'))",
    );
  }
  async down(): Promise<void> {
    throw new Error("No se eliminan eventos guardados por reversión automática.");
  }
}
