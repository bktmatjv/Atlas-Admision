import type { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1770000000000 implements MigrationInterface {
  name = "Initial1770000000000";
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE actores (id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE sesiones (hash text PRIMARY KEY, actor_id uuid NOT NULL REFERENCES actores ON DELETE CASCADE,
        expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days');
      CREATE INDEX ON sesiones(expires_at);
      CREATE TABLE perfiles (actor_id uuid PRIMARY KEY REFERENCES actores ON DELETE CASCADE, data jsonb NOT NULL);
      CREATE TABLE cursos (id text PRIMARY KEY, nombre text NOT NULL, bloque text NOT NULL);
      CREATE TABLE temas (curso_id text NOT NULL REFERENCES cursos, id text NOT NULL, nombre text NOT NULL, PRIMARY KEY(curso_id,id));
      CREATE TABLE examenes (id text PRIMARY KEY, data jsonb NOT NULL);
      CREATE TABLE lecturas (id text PRIMARY KEY, examen_id text NOT NULL REFERENCES examenes, data jsonb NOT NULL);
      CREATE TABLE preguntas (id text PRIMARY KEY, examen_id text NOT NULL REFERENCES examenes,
        texto_id text REFERENCES lecturas, curso_id text NOT NULL, tema_id text NOT NULL,
        familia text NOT NULL, data jsonb NOT NULL, FOREIGN KEY(curso_id,tema_id) REFERENCES temas(curso_id,id));
      CREATE INDEX ON preguntas(curso_id,tema_id);
      CREATE INDEX ON preguntas(familia);
      CREATE TABLE carreras (id text PRIMARY KEY, data jsonb NOT NULL);
      CREATE TABLE procesos (ciclo text PRIMARY KEY, data jsonb NOT NULL);
      CREATE TABLE resultados (ciclo text REFERENCES procesos, carrera_id text REFERENCES carreras, data jsonb NOT NULL, PRIMARY KEY(ciclo,carrera_id));
      CREATE TABLE distribuciones (ciclo text REFERENCES procesos, carrera_id text REFERENCES carreras, data jsonb NOT NULL, PRIMARY KEY(ciclo,carrera_id));
      CREATE TABLE items_dia_examen (id text PRIMARY KEY, data jsonb NOT NULL);
      CREATE TABLE importaciones_banco (hash text PRIMARY KEY, reporte jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE intentos (id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES actores ON DELETE CASCADE,
        estado text NOT NULL DEFAULT 'en_curso' CHECK(estado IN ('en_curso','entregado')),
        vence_en timestamptz, created_at timestamptz NOT NULL DEFAULT now(), data jsonb NOT NULL);
      CREATE INDEX ON intentos(actor_id,created_at DESC);
      CREATE TABLE intento_preguntas (intento_id uuid REFERENCES intentos ON DELETE CASCADE,
        pregunta_id text REFERENCES preguntas, orden int NOT NULL, snapshot jsonb NOT NULL,
        PRIMARY KEY(intento_id,pregunta_id), UNIQUE(intento_id,orden));
      CREATE TABLE respuestas (intento_id uuid, pregunta_id text, opcion text, marcada boolean NOT NULL DEFAULT false,
        confianza smallint CHECK(confianza BETWEEN 1 AND 3), version bigint NOT NULL, revelada boolean NOT NULL DEFAULT false,
        correcta boolean, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(intento_id,pregunta_id),
        FOREIGN KEY(intento_id,pregunta_id) REFERENCES intento_preguntas ON DELETE CASCADE);
      CREATE TABLE errores_repaso (actor_id uuid REFERENCES actores ON DELETE CASCADE, pregunta_id text REFERENCES preguntas,
        caja smallint NOT NULL CHECK(caja BETWEEN 1 AND 3), proxima date NOT NULL, dominada boolean NOT NULL,
        veces int NOT NULL, repasos int NOT NULL, agregada_en date NOT NULL, PRIMARY KEY(actor_id,pregunta_id));
      CREATE INDEX ON errores_repaso(actor_id,proxima) WHERE NOT dominada;
      CREATE TABLE cursos_personales (id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES actores ON DELETE CASCADE,
        titulo text NOT NULL, objetivo text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
      CREATE INDEX ON cursos_personales(actor_id,created_at DESC);
      CREATE TABLE documentos (id uuid PRIMARY KEY, curso_id uuid NOT NULL REFERENCES cursos_personales ON DELETE CASCADE,
        nombre text NOT NULL, hash text NOT NULL, ruta text NOT NULL, formato text NOT NULL,
        estado text NOT NULL CHECK(estado IN ('recibido','extrayendo','requiere_revision','listo','fallido','cancelado')),
        error text, temas jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(curso_id,hash));
      CREATE TABLE fragmentos (id uuid PRIMARY KEY, documento_id uuid NOT NULL REFERENCES documentos ON DELETE CASCADE,
        pagina int NOT NULL, posicion int NOT NULL, texto text NOT NULL,
        busqueda tsvector GENERATED ALWAYS AS (to_tsvector('spanish', texto)) STORED,
        UNIQUE(documento_id,pagina,posicion));
      CREATE INDEX fragmentos_busqueda ON fragmentos USING GIN(busqueda);
      CREATE TABLE trabajos_importacion (documento_id uuid PRIMARY KEY REFERENCES documentos ON DELETE CASCADE,
        estado text NOT NULL DEFAULT 'pendiente', intento int NOT NULL DEFAULT 0, lease_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE arboles (id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES actores ON DELETE CASCADE,
        titulo text NOT NULL, pregunta_id text REFERENCES preguntas, intento_id uuid REFERENCES intentos ON DELETE CASCADE,
        documento_id uuid REFERENCES documentos ON DELETE CASCADE, fragmento_id uuid REFERENCES fragmentos ON DELETE CASCADE,
        concepto text, created_at timestamptz NOT NULL DEFAULT now());
      CREATE INDEX ON arboles(actor_id,created_at DESC);
      CREATE TABLE nodos (id uuid PRIMARY KEY, arbol_id uuid NOT NULL REFERENCES arboles ON DELETE CASCADE,
        padre_id uuid, profundidad smallint NOT NULL CHECK(profundidad BETWEEN 0 AND 5), orden int NOT NULL,
        tipo text NOT NULL CHECK(tipo IN ('raiz','aclaracion','subpregunta','ejemplo','contraste','conexion','aplicacion')),
        titulo text NOT NULL, contenido text NOT NULL, procedencia text NOT NULL, prompt_version text NOT NULL,
        citas jsonb NOT NULL DEFAULT '[]', UNIQUE(arbol_id,id), UNIQUE(arbol_id,padre_id,orden),
        FOREIGN KEY(arbol_id,padre_id) REFERENCES nodos(arbol_id,id));
      CREATE UNIQUE INDEX raiz_unica ON nodos(arbol_id) WHERE padre_id IS NULL;
      CREATE TABLE solicitudes_ia (actor_id uuid REFERENCES actores ON DELETE CASCADE, clave text NOT NULL,
        huella text NOT NULL, estado text NOT NULL, arbol_id uuid REFERENCES arboles ON DELETE CASCADE,
        respuesta_json jsonb, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,clave));
      CREATE TABLE comprobaciones (id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES actores ON DELETE CASCADE,
        arbol_id uuid NOT NULL REFERENCES arboles ON DELETE CASCADE, actividad_id text NOT NULL, version text NOT NULL,
        concepto text NOT NULL, enunciado text NOT NULL, respuesta text, justificacion text, resultado jsonb,
        created_at timestamptz NOT NULL DEFAULT now(), entregado_at timestamptz);
      CREATE TABLE evidencias (id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES actores ON DELETE CASCADE,
        tipo text NOT NULL, arbol_id uuid REFERENCES arboles ON DELETE CASCADE,
        intento_id uuid REFERENCES intentos ON DELETE CASCADE, comprobacion_id uuid REFERENCES comprobaciones ON DELETE CASCADE,
        detalle jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
      CREATE INDEX ON evidencias(actor_id,created_at DESC);
    `);
  }
  async down(): Promise<void> {
    throw new Error(
      "Reversión destructiva no automática; restaurar una copia autorizada.",
    );
  }
}
