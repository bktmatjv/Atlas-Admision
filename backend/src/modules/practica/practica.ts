import {
  Body,
  Controller,
  Get,
  Injectable,
  Inject,
  Module,
  Param,
  Post,
  Put,
  Req,
  Query,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { EntityManager } from "typeorm";
import { Database } from "../../database/database.js";
import { validate } from "../../http.js";
import {
  ContenidoModule,
  ContenidoService,
  type Question,
} from "../contenido/contenido.js";
import type { ActorRequest } from "../identidad/identidad.js";
import {
  armarReal,
  armarSimulacro,
  armarPractica,
  armarDiagnostico,
  duracionMinutos,
} from "@atlas/motor/admision-armado";
import { corregir } from "@atlas/motor/admision-correccion";
import {
  diaDeLima,
  anotarFallos,
  aplicarRepaso,
  type EntradaDeErrores,
} from "@atlas/motor/admision-leitner";
import type { AreaExamen } from "@atlas/motor/admision-molde";
const areaSchema = z.enum(["A", "B", "C", "D", "E", "medicina"]);
export const crearIntento = z
  .object({
    modo: z.enum(["real", "simulacro", "practica", "diagnostico", "repaso"]),
    area: areaSchema.default("A"),
    tipo: z.enum(["practica", "cronometrado"]).optional(),
    examen_id: z.string().max(100).optional(),
    curso: z.string().max(100).optional(),
    tema: z.string().max(100).optional(),
    n: z.number().int().min(1).max(50).optional(),
    ver_soluciones: z.boolean().optional(),
  })
  .strict();
export const respuestasSchema = z
  .array(
    z
      .object({
        pregunta_id: z.string().max(100),
        opcion: z.string().max(5).nullable(),
        marcada: z.boolean(),
        confianza: z.number().int().min(1).max(3).nullable().optional(),
        version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
      })
      .strict(),
  )
  .max(120);
type AttemptData = {
  id: string;
  modo: string;
  area: AreaExamen;
  tipo: string;
  preguntas: string[];
  started_at: string;
  duration_minutes: number | null;
  ver_soluciones: boolean;
  examen_id: string | null;
  filtro: { curso: string; tema?: string } | null;
  user_id: string;
  estado: string;
  created_at: string;
  puntaje?: number;
  informe?: unknown;
};
type AttemptRow = {
  id: string;
  data: AttemptData;
  estado: string;
  vence_en: Date | null;
};
type Snapshot = Question & {
  texto_etiqueta: string | null;
  texto_cuerpo: string | null;
};
@Injectable()
export class PracticaService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(ContenidoService) private content: ContenidoService,
  ) {}
  async propio(actor: string, id: string, m?: EntityManager, lock = false) {
    const [row] = await this.db.query<AttemptRow>(
      `SELECT * FROM intentos WHERE id=$1 AND actor_id=$2${lock ? " FOR UPDATE" : ""}`,
      [id, actor],
      m,
    );
    if (!row)
      throw new NotFoundException("Este intento no existe o no es tuyo.");
    return row;
  }
  async snapshots(id: string, m?: EntityManager) {
    return (
      await this.db.query<{ snapshot: Snapshot }>(
        "SELECT snapshot FROM intento_preguntas WHERE intento_id=$1 ORDER BY orden",
        [id],
        m,
      )
    ).map((p) => p.snapshot);
  }
  async list(actor: string) {
    return (
      await this.db.query<AttemptRow>(
        "SELECT * FROM intentos WHERE actor_id=$1 ORDER BY created_at DESC LIMIT 100",
        [actor],
      )
    ).map((i) => ({ ...i.data, estado: i.estado }));
  }
  async create(actor: string, input: z.infer<typeof crearIntento>) {
    const b = await this.content.banco(),
      vistas = new Map<string, string>();
    for (const i of await this.list(actor))
      for (const id of i.preguntas)
        if (!vistas.has(id)) vistas.set(id, i.created_at);
    let ids: string[],
      area = input.area,
      tipo = input.tipo ?? "cronometrado";
    if (input.modo === "real") {
      const e = b.examenes.find((e) => e.id === input.examen_id);
      if (!e) throw new NotFoundException("Examen no encontrado.");
      area = e.area as AreaExamen;
      ids = armarReal(b.preguntas, e.id);
    } else if (input.modo === "practica") {
      tipo = "practica";
      ids = armarPractica(
        b.preguntas,
        { curso: input.curso ?? "", tema: input.tema },
        input.n ?? 10,
        vistas,
        Math.random,
      );
    } else if (input.modo === "diagnostico") {
      tipo = "cronometrado";
      ids = armarDiagnostico(b.preguntas, area, vistas, Math.random);
    } else if (input.modo === "repaso") {
      tipo = "practica";
      ids = (
        await this.db.query<{ pregunta_id: string }>(
          "SELECT pregunta_id FROM errores_repaso WHERE actor_id=$1 AND NOT dominada AND proxima<=$2 ORDER BY proxima,caja LIMIT $3",
          [actor, diaDeLima(new Date()), input.n ?? 10],
        )
      ).map((e) => e.pregunta_id);
    } else ids = armarSimulacro(b.preguntas, area, vistas, Math.random);
    if (!ids.length)
      throw new BadRequestException(
        "No hay preguntas disponibles para esta selección.",
      );
    const id = randomUUID(),
      start = new Date(),
      minutes =
        tipo === "practica"
          ? null
          : input.modo === "diagnostico"
            ? 30
            : duracionMinutos(ids.length);
    const data: AttemptData = {
      id,
      user_id: actor,
      modo: input.modo === "practica" ? "simulacro" : input.modo,
      area,
      tipo,
      preguntas: ids,
      started_at: start.toISOString(),
      created_at: start.toISOString(),
      duration_minutes: minutes,
      estado: "en_curso",
      examen_id: input.examen_id ?? null,
      filtro:
        input.modo === "practica"
          ? { curso: input.curso!, tema: input.tema }
          : null,
      ver_soluciones:
        tipo === "practica" &&
        (input.ver_soluciones === true || input.modo === "repaso"),
    };
    const byId = new Map(b.preguntas.map((p) => [p.id, p]));
    await this.db.transaction(async (m) => {
      await m.query(
        "INSERT INTO intentos(id,actor_id,vence_en,data) VALUES($1,$2,$3,$4)",
        [
          id,
          actor,
          minutes ? new Date(start.getTime() + minutes * 60000) : null,
          data,
        ],
      );
      for (const [orden, pid] of ids.entries()) {
        const p = byId.get(pid)!,
          t = b.textos.find((t) => t.id === p.texto_id);
        await m.query("INSERT INTO intento_preguntas VALUES($1,$2,$3,$4)", [
          id,
          pid,
          orden,
          {
            ...p,
            texto_etiqueta: t?.etiqueta ?? null,
            texto_cuerpo: t?.cuerpo ?? null,
          },
        ]);
      }
    });
    return { intento_id: id, preguntas: ids.length };
  }
  async get(actor: string, id: string) {
    const row = await this.propio(actor, id);
    return { ...row.data, estado: row.estado, vence_en: row.vence_en };
  }
  async questions(actor: string, id: string) {
    const i = await this.propio(actor, id);
    const revealed = new Set(
      (
        await this.db.query<{ pregunta_id: string }>(
          "SELECT pregunta_id FROM respuestas WHERE intento_id=$1 AND revelada",
          [id],
        )
      ).map((r) => r.pregunta_id),
    );
    return (await this.snapshots(id)).map((p, n) => ({
      pregunta_id: p.id,
      orden: n + 1,
      numero: p.numero,
      enunciado: p.enunciado,
      opciones: p.opciones,
      graficos: p.graficos,
      texto_id: p.texto_id,
      texto_etiqueta: p.texto_etiqueta,
      texto_cuerpo: p.texto_cuerpo,
      curso: p.curso,
      tema: p.tema,
      clave: i.estado === "entregado" || revealed.has(p.id) ? p.clave : null,
      solucion:
        i.estado === "entregado" || revealed.has(p.id) ? p.solucion : null,
    }));
  }
  async responses(actor: string, id: string) {
    await this.propio(actor, id);
    return this.db.query("SELECT * FROM respuestas WHERE intento_id=$1", [id]);
  }
  async save(
    actor: string,
    id: string,
    rows: z.infer<typeof respuestasSchema>,
  ) {
    return this.db.transaction(async (m) => {
      const i = await this.propio(actor, id, m, true);
      if (
        i.estado !== "en_curso" ||
        (i.vence_en && new Date(i.vence_en).getTime() <= Date.now())
      )
        throw new ConflictException(
          "El intento está cerrado o su tiempo terminó. Entrega las respuestas ya guardadas.",
        );
      const ps = new Map((await this.snapshots(id, m)).map((p) => [p.id, p]));
      for (const r of rows) {
        const p = ps.get(r.pregunta_id);
        if (!p || (r.opcion !== null && !Object.hasOwn(p.opciones, r.opcion)))
          throw new BadRequestException(
            "Pregunta u opción no válida en este intento.",
          );
        await m.query(
          `INSERT INTO respuestas(intento_id,pregunta_id,opcion,marcada,confianza,version) VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(intento_id,pregunta_id) DO UPDATE SET opcion=EXCLUDED.opcion,marcada=EXCLUDED.marcada,confianza=EXCLUDED.confianza,version=EXCLUDED.version,updated_at=now()
      WHERE respuestas.version<EXCLUDED.version AND NOT respuestas.revelada`,
          [
            id,
            r.pregunta_id,
            r.opcion,
            r.marcada,
            r.opcion ? (r.confianza ?? null) : null,
            r.version,
          ],
        );
      }
      const saved = await this.db.query<{
        pregunta_id: string;
        version: string;
      }>(
        "SELECT pregunta_id,version FROM respuestas WHERE intento_id=$1 AND pregunta_id=ANY($2::text[])",
        [id, rows.map((r) => r.pregunta_id)],
        m,
      );
      const versiones = Object.fromEntries(
        saved.map((r) => [r.pregunta_id, Number(r.version)]),
      );
      return {
        guardadas: rows.every((r) => versiones[r.pregunta_id] === r.version),
        versiones,
      };
    });
  }
  async deliver(actor: string, id: string) {
    return this.db.transaction(async (m) => {
      await m.query("SELECT id FROM actores WHERE id=$1 FOR UPDATE", [actor]);
      const row = await this.propio(actor, id, m, true);
      if (row.estado === "entregado") return row.data.informe;
      const ps = await this.snapshots(id, m);
      const rs = await m.query("SELECT * FROM respuestas WHERE intento_id=$1", [
        id,
      ]);
      const r = corregir(ps, rs),
        { porPregunta, ...informe } = r;
      for (const p of porPregunta)
        await m.query(
          "UPDATE respuestas SET correcta=$3 WHERE intento_id=$1 AND pregunta_id=$2",
          [id, p.pregunta_id, p.correcta],
        );
      await m.query(
        "UPDATE intentos SET estado='entregado',data=data || $2::jsonb WHERE id=$1",
        [
          id,
          JSON.stringify({
            estado: "entregado",
            entregado_at: new Date().toISOString(),
            puntaje: r.puntaje,
            informe,
          }),
        ],
      );
      const old = await this.db.query<EntradaDeErrores>(
        "SELECT pregunta_id,caja,proxima::text,dominada,veces,repasos,agregada_en::text FROM errores_repaso WHERE actor_id=$1 FOR UPDATE",
        [actor],
        m,
      );
      const map = new Map(old.map((e) => [e.pregunta_id, e])),
        hoy = diaDeLima(new Date());
      const updates =
        row.data.modo === "repaso"
          ? porPregunta
              .filter((p) => map.has(p.pregunta_id))
              .map((p) =>
                aplicarRepaso(
                  map.get(p.pregunta_id)!,
                  p.correcta === true,
                  hoy,
                ),
              )
          : anotarFallos(
              map,
              porPregunta
                .filter((p) => p.correcta === false)
                .map((p) => p.pregunta_id),
              hoy,
            );
      for (const e of updates)
        await m.query(
          "INSERT INTO errores_repaso VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(actor_id,pregunta_id) DO UPDATE SET caja=EXCLUDED.caja,proxima=EXCLUDED.proxima,dominada=EXCLUDED.dominada,veces=EXCLUDED.veces,repasos=EXCLUDED.repasos",
          [
            actor,
            e.pregunta_id,
            e.caja,
            e.proxima,
            e.dominada,
            e.veces,
            e.repasos,
            e.agregada_en,
          ],
        );
      await m.query(
        "INSERT INTO evidencias(id,actor_id,tipo,intento_id,detalle) VALUES($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          actor,
          rs.some((r: { revelada: boolean }) => r.revelada)
            ? "resolvio_con_ayuda"
            : "intento_entregado",
          id,
          {
            aciertos: r.aciertos,
            total: ps.length,
            nota: "Resultado de práctica; no certifica comprensión ni transferencia.",
          },
        ],
      );
      return informe;
    });
  }
  async reveal(actor: string, id: string, pid: string) {
    return this.db.transaction(async (m) => {
      await m.query("SELECT id FROM actores WHERE id=$1 FOR UPDATE", [actor]);
      if (
        (
          await m.query(
            "SELECT id FROM comprobaciones WHERE actor_id=$1 AND entregado_at IS NULL",
            [actor],
          )
        ).length
      )
        throw new ConflictException(
          "Finaliza la comprobación antes de consultar soluciones.",
        );
      const i = await this.propio(actor, id, m, true);
      if (
        i.estado !== "entregado" &&
        (i.data.tipo !== "practica" || !i.data.ver_soluciones)
      )
        throw new ConflictException(
          "Las soluciones no están habilitadas durante este intento.",
        );
      const p = (await this.snapshots(id, m)).find((p) => p.id === pid);
      if (!p) throw new NotFoundException("Pregunta no encontrada.");
      const [r] = await this.db.query(
        "UPDATE respuestas SET revelada=true WHERE intento_id=$1 AND pregunta_id=$2 AND opcion IS NOT NULL RETURNING pregunta_id",
        [id, pid],
        m,
      );
      if (!r)
        throw new ConflictException(
          "Guarda una respuesta antes de consultar la solución.",
        );
      await m.query(
        "INSERT INTO evidencias(id,actor_id,tipo,intento_id,detalle) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), actor, "consulto_solucion", id, { pregunta_id: pid }],
      );
      return { clave: p.clave, solucion: p.solucion };
    });
  }
  async contexto(actor: string, id: string, pid: string) {
    const i = await this.propio(actor, id);
    if (i.estado === "en_curso" && i.data.tipo === "cronometrado")
      throw new ConflictException(
        "Termina el simulacro antes de abrir el tutor.",
      );
    const p = (await this.snapshots(id)).find((p) => p.id === pid);
    if (!p)
      throw new NotFoundException("Pregunta no encontrada en tu intento.");
    return p;
  }
  async topics(area: string) {
    const b = await this.content.banco(),
      exams = new Map(
        b.examenes.filter((e) => e.area === area).map((e) => [e.id, e.ciclo]),
      );
    const ps = b.preguntas.filter((p) => exams.has(p.examen_id));
    const total = new Set(ps.map((p) => exams.get(p.examen_id))).size;
    const map = new Map<
      string,
      { curso: string; tema: string; ciclos: Set<string>; preguntas: number }
    >();
    for (const p of ps) {
      const k = p.curso + "|" + p.tema;
      const v = map.get(k) ?? {
        curso: p.curso,
        tema: p.tema,
        ciclos: new Set<string>(),
        preguntas: 0,
      };
      v.ciclos.add(exams.get(p.examen_id)!);
      v.preguntas++;
      map.set(k, v);
    }
    return [...map.values()].map((v) => ({
      curso: v.curso,
      tema: v.tema,
      preguntas: v.preguntas,
      procesos: v.ciclos.size,
      procesos_del_area: total,
    }));
  }
}
@Controller()
export class PracticaController {
  constructor(
    @Inject(PracticaService) private s: PracticaService,
    @Inject(Database) private db: Database,
  ) {}
  @Get("intentos") list(@Req() r: ActorRequest) {
    return this.s.list(r.actorId);
  }
  @Post("intentos") create(@Req() r: ActorRequest, @Body() b: unknown) {
    return this.s.create(r.actorId, validate(crearIntento, b));
  }
  @Get("intentos/:id") get(@Req() r: ActorRequest, @Param("id") id: string) {
    return this.s.get(r.actorId, validate(z.string().uuid(), id));
  }
  @Get("intentos/:id/preguntas") questions(
    @Req() r: ActorRequest,
    @Param("id") id: string,
  ) {
    return this.s.questions(r.actorId, validate(z.string().uuid(), id));
  }
  @Get("intentos/:id/respuestas") responses(
    @Req() r: ActorRequest,
    @Param("id") id: string,
  ) {
    return this.s.responses(r.actorId, validate(z.string().uuid(), id));
  }
  @Put("intentos/:id/respuestas") save(
    @Req() r: ActorRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.s.save(
      r.actorId,
      validate(z.string().uuid(), id),
      validate(respuestasSchema, b),
    );
  }
  @Post("intentos/:id/entrega") deliver(
    @Req() r: ActorRequest,
    @Param("id") id: string,
  ) {
    return this.s.deliver(r.actorId, validate(z.string().uuid(), id));
  }
  @Post("intentos/:id/preguntas/:pid/solucion") reveal(
    @Req() r: ActorRequest,
    @Param("id") id: string,
    @Param("pid") pid: string,
  ) {
    return this.s.reveal(r.actorId, validate(z.string().uuid(), id), pid);
  }
  @Get("temas-frecuentes") topics(@Query("area") area: string) {
    return this.s.topics(validate(areaSchema, area));
  }
  @Get("errores") errors(@Req() r: ActorRequest) {
    return this.db.query(
      "SELECT pregunta_id,caja,proxima::text,dominada,veces,repasos,agregada_en::text FROM errores_repaso WHERE actor_id=$1",
      [r.actorId],
    );
  }
}
@Module({
  imports: [ContenidoModule],
  providers: [PracticaService],
  controllers: [PracticaController],
  exports: [PracticaService],
})
export class PracticaModule {}
