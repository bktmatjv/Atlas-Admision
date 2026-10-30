import {
  Controller,
  Get,
  Injectable,
  Inject,
  Module,
  NotFoundException,
  Put,
  Body,
  Req,
} from "@nestjs/common";
import type { ActorRequest } from "../identidad/identidad.js";
import { Database } from "../../database/database.js";
import { z } from "zod";
import { validate } from "../../http.js";
import { CURSOS } from "@atlas/motor/temario";
export interface Question {
  id: string;
  examen_id: string;
  numero: number;
  texto_id: string | null;
  curso: string;
  tema: string;
  clave: string | null;
  enunciado: string;
  opciones: Record<string, string>;
  solucion: string | null;
  graficos: string[];
  origen: "real";
}
export interface Exam {
  id: string;
  area: string;
  ciclo: string;
  n_preguntas: number;
  [key: string]: unknown;
}
export interface Banco {
  preguntas: Question[];
  examenes: Exam[];
  textos: { id: string; etiqueta: string; cuerpo: string }[];
}
@Injectable()
export class ContenidoService {
  constructor(@Inject(Database) private db: Database) {}
  async banco(): Promise<Banco> {
    const [p, e, t] = await Promise.all([
      this.db.query<{ data: Question }>("SELECT data FROM preguntas"),
      this.db.query<{ data: Exam }>(
        "SELECT data FROM examenes ORDER BY data->>'ciclo' DESC",
      ),
      this.db.query<{ data: Banco["textos"][number] }>(
        "SELECT data FROM lecturas",
      ),
    ]);
    return {
      preguntas: p.map((x) => x.data),
      examenes: e.map((x) => x.data),
      textos: t.map((x) => x.data),
    };
  }
  async pregunta(id: string) {
    const [p] = await this.db.query<{ data: Question }>(
      "SELECT data FROM preguntas WHERE id=$1",
      [id],
    );
    if (!p) throw new NotFoundException("Pregunta no encontrada.");
    return p.data;
  }
  async unmsm() {
    const rows = await Promise.all([
      this.db.query<{ data: unknown }>("SELECT data FROM carreras"),
      this.db.query<{ data: unknown }>("SELECT data FROM procesos"),
      this.db.query<{ data: unknown }>("SELECT data FROM resultados"),
      this.db.query<{ data: unknown }>("SELECT data FROM distribuciones"),
      this.db.query<{ data: unknown }>("SELECT data FROM items_dia_examen"),
    ]);
    return {
      carreras: rows[0].map((x) => x.data),
      procesos: rows[1].map((x) => x.data),
      resultados: rows[2].map((x) => x.data),
      distribuciones: rows[3].map((x) => x.data),
      dia_examen: rows[4].map((x) => x.data),
    };
  }
}
@Controller()
export class ContenidoController {
  constructor(
    @Inject(ContenidoService) private contenido: ContenidoService,
    @Inject(Database) private db: Database,
  ) {}
  @Get("catalogo") catalogo() {
    return CURSOS;
  }
  @Get("examenes") async examenes() {
    return (
      await this.db.query<{ data: unknown }>(
        "SELECT e.data || jsonb_build_object('disponibles',count(p.id)) AS data FROM examenes e LEFT JOIN preguntas p ON p.examen_id=e.id GROUP BY e.id ORDER BY e.data->>'ciclo' DESC",
      )
    ).map((x) => x.data);
  }
  @Get("unmsm") unmsm() {
    return this.contenido.unmsm();
  }
  @Get("perfil") async perfil(@Req() req: ActorRequest) {
    return (
      (
        await this.db.query<{ data: unknown }>(
          "SELECT data FROM perfiles WHERE actor_id=$1",
          [req.actorId],
        )
      )[0]?.data ?? null
    );
  }
  @Put("perfil") async save(@Req() req: ActorRequest, @Body() input: unknown) {
    const p = validate(
      z
        .object({
          universidad: z.string().max(100).optional(),
          carrera_id: z.string().max(100).nullable().optional(),
          horas_semana: z.number().int().min(1).max(80).nullable().optional(),
        })
        .strict(),
      input,
    );
    if (
      p.carrera_id &&
      !(
        await this.db.query("SELECT id FROM carreras WHERE id=$1", [
          p.carrera_id,
        ])
      ).length
    )
      throw new NotFoundException("Carrera no encontrada.");
    const base = {
      user_id: req.actorId,
      universidad: "unmsm",
      carrera_id: null,
      horas_semana: null,
      origen: "alumno",
      updated_at: new Date().toISOString(),
      ...p,
    };
    const [result] = await this.db.query<{ data: unknown }>(
      `INSERT INTO perfiles(actor_id,data) VALUES($1,$2) ON CONFLICT(actor_id) DO UPDATE SET data=perfiles.data || $3::jsonb RETURNING data`,
      [
        req.actorId,
        base,
        JSON.stringify({ ...p, updated_at: base.updated_at }),
      ],
    );
    return result.data;
  }
}
@Module({
  controllers: [ContenidoController],
  providers: [ContenidoService],
  exports: [ContenidoService],
})
export class ContenidoModule {}
