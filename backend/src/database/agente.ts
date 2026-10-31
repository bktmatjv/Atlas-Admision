import type { MigrationInterface, QueryRunner } from "typeorm";
// Aditiva: amplía los tipos de nodo y agrega conversaciones, mensajes, aristas y respuestas a bloques.
export class Agente1770000003000 implements MigrationInterface {
  name = "Agente1770000003000";
  async up(q: QueryRunner) {
    await q.query(`
  ALTER TABLE nodos DROP CONSTRAINT nodos_tipo_check;
  ALTER TABLE nodos ADD CONSTRAINT nodos_tipo_check CHECK(tipo IN
   ('raiz','aclaracion','subpregunta','ejemplo','contraste','conexion','aplicacion','concepto','idea','error','pregunta'));
  ALTER TABLE nodos ADD COLUMN senal text CHECK(senal IS NULL OR senal='posible_confusion');
  ALTER TABLE actores ADD COLUMN foco_nodo_id uuid REFERENCES nodos ON DELETE SET NULL;
  ALTER TABLE actores ADD COLUMN grafo_version int NOT NULL DEFAULT 0;
  CREATE TABLE conversaciones (
   id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES actores ON DELETE CASCADE,
   arbol_id uuid NOT NULL REFERENCES arboles ON DELETE CASCADE,
   created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX ON conversaciones(actor_id,created_at DESC);
  CREATE TABLE mensajes (
   id uuid PRIMARY KEY, conversacion_id uuid NOT NULL REFERENCES conversaciones ON DELETE CASCADE,
   orden int NOT NULL, rol text NOT NULL CHECK(rol IN ('estudiante','tutor')),
   texto text NOT NULL, bloques jsonb NOT NULL DEFAULT '[]', grafo_ops jsonb NOT NULL DEFAULT '[]',
   descartes jsonb NOT NULL DEFAULT '[]', prompt_version text, degradado boolean NOT NULL DEFAULT false,
   clave text, created_at timestamptz NOT NULL DEFAULT now(),
   UNIQUE(conversacion_id,orden), UNIQUE(conversacion_id,clave)
  );
  CREATE TABLE aristas (
   id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES actores ON DELETE CASCADE,
   origen uuid NOT NULL REFERENCES nodos ON DELETE CASCADE,
   destino uuid NOT NULL REFERENCES nodos ON DELETE CASCADE,
   tipo text NOT NULL CHECK(tipo IN ('subtema','requiere','relacionado','contrasta_con','ejemplo_de','confusion_con')),
   creada_por text NOT NULL CHECK(creada_por IN ('ia','sistema')),
   created_at timestamptz NOT NULL DEFAULT now(),
   CHECK(origen<>destino), UNIQUE(origen,destino,tipo)
  );
  CREATE INDEX ON aristas(actor_id);
  CREATE TABLE respuestas_bloque (
   id uuid PRIMARY KEY, mensaje_id uuid NOT NULL REFERENCES mensajes ON DELETE CASCADE,
   actor_id uuid NOT NULL REFERENCES actores ON DELETE CASCADE,
   bloque_indice int NOT NULL, respuesta text NOT NULL,
   resultado jsonb, lectura jsonb, created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX ON respuestas_bloque(mensaje_id,bloque_indice);
 `);
  }
  async down(): Promise<void> {
    throw new Error(
      "No se eliminan conversaciones, grafo ni evidencias por reversión automática.",
    );
  }
}
