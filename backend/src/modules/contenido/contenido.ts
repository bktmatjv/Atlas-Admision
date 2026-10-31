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
import { guardarPerfil } from "./perfil.js";
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
    return guardarPerfil(this.db, req.actorId, input);
  }
}
@Module({
  controllers: [ContenidoController],
  providers: [ContenidoService],
  exports: [ContenidoService],
})
export class ContenidoModule {}
