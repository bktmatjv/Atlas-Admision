import {
  Body,
  Controller,
  Get,
  Injectable,
  Inject,
  Module,
  Param,
  Post,
  Req,
  Headers,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Throttle } from "@nestjs/throttler";
import { Database } from "../../database/database.js";
import { validate } from "../../http.js";
import { digest, type ActorRequest } from "../identidad/identidad.js";
import { PracticaModule, PracticaService } from "../practica/practica.js";
import { conceptoDe } from "../seguimiento/actividades.js";
import { caminoHasta, construirRastro } from "../seguimiento/rastros.js";
import { TutorAI, PROMPT_VERSION } from "./ai.js";
const createSchema = z
  .object({
    intento_id: z.string().uuid().optional(),
    pregunta_id: z.string().max(100).optional(),
    fragmento_id: z.string().uuid().optional(),
    tema: z.enum(["porcentajes", "proporciones", "fracciones"]).optional(),
    solicitud: z.string().min(1).max(2000),
  })
  .strict()
  .refine(
    (b) =>
      Boolean(b.intento_id && b.pregunta_id) ||
      Boolean(b.fragmento_id) ||
      Boolean(b.tema),
    "Elige una pregunta, tema o fragmento.",
  );
type Tree = {
  id: string;
  actor_id: string;
  titulo: string;
  pregunta_id: string | null;
  intento_id: string | null;
  fragmento_id: string | null;
  documento_id: string | null;
  concepto: string | null;
};
type Node = {
  id: string;
  padre_id: string | null;
  profundidad: number;
  orden: number;
  titulo: string;
  contenido: string;
  tipo: string;
  citas: unknown[];
  idea_clave: string | null;
};
@Injectable()
export class TutorService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(PracticaService) private practice: PracticaService,
    @Inject(TutorAI) private ai: TutorAI,
  ) {}
  async own(actor: string, id: string) {
    const [t] = await this.db.query<Tree>(
      "SELECT * FROM arboles WHERE id=$1 AND actor_id=$2",
      [id, actor],
    );
    if (!t) throw new NotFoundException("Exploración no encontrada.");
    return t;
  }
  async get(actor: string, id: string) {
    const t = await this.own(actor, id);
    const nodos = await this.db.query<Node>(
      "SELECT id,padre_id,profundidad,orden,tipo,titulo,contenido,procedencia,citas,idea_clave FROM nodos WHERE arbol_id=$1 ORDER BY profundidad,orden",
      [id],
    );
    const [ultimo] = await this.db.query<{
      actividad_id: string;
      respuesta: string;
      idea_clave: string | null;
      nodo_retorno_id: string | null;
      nivel_ayuda: "pista" | "ejemplo" | "explicacion_completa";
    }>(
      "SELECT c.actividad_id,r.respuesta,r.idea_clave,r.nodo_retorno_id,r.nivel_ayuda FROM rastros_error r JOIN comprobaciones c ON c.id=r.comprobacion_id WHERE r.arbol_id=$1 AND r.actor_id=$2 ORDER BY r.created_at DESC LIMIT 1",
      [id, actor],
    );
    return {
      ...t,
      nodos,
      ultimo_rastro: ultimo
        ? {
            ...construirRastro(ultimo),
            camino: caminoHasta(nodos, ultimo.nodo_retorno_id),
          }
        : null,
    };
  }
  async material(actor: string, t: Partial<Tree>) {
    if (t.intento_id && t.pregunta_id) {
      const p = await this.practice.contexto(
        actor,
        t.intento_id,
        t.pregunta_id,
      );
      const rs = await this.practice.responses(actor, t.intento_id);
      return {
        texto: JSON.stringify({
          pregunta: p,
          intento: rs.find((r) => r.pregunta_id === t.pregunta_id),
        }),
        citas: [{ tipo: "banco", pregunta_id: p.id }],
        titulo: p.curso + " · " + p.tema,
        concepto: conceptoDe(p.curso, p.tema, p.enunciado),
      };
    }
    if (t.fragmento_id) {
      const [f] = await this.db.query<{
        texto: string;
        pagina: number;
        documento_id: string;
        nombre: string;
        hash: string;
      }>(
        `SELECT f.texto,f.pagina,d.id AS documento_id,d.nombre,d.hash FROM fragmentos f JOIN documentos d ON d.id=f.documento_id JOIN cursos_personales c ON c.id=d.curso_id WHERE f.id=$1 AND c.actor_id=$2 AND d.estado='listo'`,
        [t.fragmento_id, actor],
      );
      if (!f)
        throw new NotFoundException(
          "Confirma primero el material o comprueba que pertenece a tu curso.",
        );
      return {
        texto: f.texto,
        citas: [
          {
            tipo: "documento",
            fragmento_id: t.fragmento_id,
            documento_id: f.documento_id,
            pagina: f.pagina,
            nombre: f.nombre,
            version: f.hash,
          },
        ],
        titulo: f.nombre,
        concepto: null,
        documento_id: f.documento_id,
      };
    }
    return {
      texto: `Concepto: ${t.concepto}. Usa ejemplos diferentes sin proporcionar respuestas a futuras comprobaciones.`,
      citas: [{ tipo: "concepto", nombre: t.concepto }],
      titulo: t.titulo ?? t.concepto ?? "Exploración",
      concepto: t.concepto ?? null,
    };
  }
  async formative<T extends object>(
    actor: string,
    key: string,
    fragmentId: string,
    generate: () => Promise<T>,
  ): Promise<T> {
    const saved = await this.reserve(actor, key, {
      op: "practica-formativa",
      fragmentId,
    });
    if (saved.cached) return saved.cached as T;
    try {
      await this.db.query(
        "UPDATE solicitudes_ia SET fragmento_id=$3 WHERE actor_id=$1 AND clave=$2",
        [actor, key, fragmentId],
      );
      const result = await generate();
      await this.db.query(
        "UPDATE solicitudes_ia SET estado='completada',respuesta_json=$3 WHERE actor_id=$1 AND clave=$2",
        [actor, key, result],
      );
      return result;
    } catch (e) {
      await this.db.query(
        "UPDATE solicitudes_ia SET estado='fallida' WHERE actor_id=$1 AND clave=$2",
        [actor, key],
      );
      throw e;
    }
  }
  private async reserve(
    actor: string,
    key: string,
    input: unknown,
    treeId?: string,
  ) {
    validate(z.string().min(8).max(120), key);
    return this.db.transaction(async (m) => {
      await m.query("SELECT id FROM actores WHERE id=$1 FOR UPDATE", [actor]);
      await m.query(
        "UPDATE solicitudes_ia SET estado='fallida' WHERE actor_id=$1 AND estado='pendiente' AND created_at<now()-interval '2 minutes'",
        [actor],
      );
      const [old] = await m.query(
        "SELECT * FROM solicitudes_ia WHERE actor_id=$1 AND clave=$2",
        [actor, key],
      );
      const hash = digest(JSON.stringify(input));
      if (old) {
        if (old.huella !== hash)
          throw new ConflictException(
            "La clave de solicitud ya corresponde a otra operación.",
          );
        if (old.estado === "completada") return { cached: old.respuesta_json };
        if (old.estado === "pendiente")
          throw new ConflictException(
            "La solicitud sigue en proceso. Si se interrumpió, reintenta más tarde.",
          );
        throw new ConflictException(
          "La solicitud falló; inicia un nuevo intento para volver a consultar.",
        );
      }
      if (
        (
          await m.query(
            "SELECT id FROM comprobaciones WHERE actor_id=$1 AND entregado_at IS NULL",
            [actor],
          )
        ).length
      )
        throw new ConflictException(
          "Hay una comprobación sin ayuda en curso. Entrégala o vuelve explícitamente al modo de ayuda.",
        );
      await m.query(
        "INSERT INTO solicitudes_ia(actor_id,clave,huella,estado,arbol_id) VALUES($1,$2,$3,'pendiente',$4)",
        [actor, key, hash, treeId ?? null],
      );
      return { cached: null };
    });
  }
  async create(actor: string, b: z.infer<typeof createSchema>, key: string) {
    const reserved = await this.reserve(actor, key, { op: "crear", b });
    if (reserved.cached) return reserved.cached;
    try {
      const source = await this.material(actor, {
        intento_id: b.intento_id,
        pregunta_id: b.pregunta_id,
        fragmento_id: b.fragmento_id,
        concepto: b.tema,
      });
      const output = await this.ai.explain({
        solicitud: b.solicitud,
        material: source.texto,
        titulo: source.titulo,
      });
      const id = randomUUID(),
        root = randomUUID();
      await this.db.transaction(async (m) => {
        await m.query(
          "INSERT INTO arboles(id,actor_id,titulo,pregunta_id,intento_id,documento_id,fragmento_id,concepto) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            id,
            actor,
            output.titulo,
            b.pregunta_id ?? null,
            b.intento_id ?? null,
            "documento_id" in source ? source.documento_id : null,
            b.fragmento_id ?? null,
            source.concepto,
          ],
        );
        await m.query(
          "INSERT INTO nodos VALUES($1,$2,NULL,0,0,'raiz',$3,$4,$5,$6,$7)",
          [
            root,
            id,
            output.titulo,
            output.explicacion,
            "Generado por IA; no revisado",
            PROMPT_VERSION,
            JSON.stringify(source.citas),
          ],
        );
        for (const [n, h] of output.hijos_propuestos.entries())
          await m.query(
            "INSERT INTO nodos VALUES($1,$2,$3,1,$4,$5,$6,$7,$8,$9,$10)",
            [
              randomUUID(),
              id,
              root,
              n,
              h.tipo,
              h.titulo,
              h.contenido,
              "Generado por IA; no revisado",
              PROMPT_VERSION,
              JSON.stringify(source.citas),
            ],
          );
        await m.query(
          "UPDATE solicitudes_ia SET estado='completada',arbol_id=$3,respuesta_json=$4 WHERE actor_id=$1 AND clave=$2",
          [actor, key, id, { id }],
        );
      });
      return { id };
    } catch (e) {
      await this.db.query(
        "UPDATE solicitudes_ia SET estado='fallida' WHERE actor_id=$1 AND clave=$2",
        [actor, key],
      );
      throw e;
    }
  }
  async expand(
    actor: string,
    id: string,
    nid: string,
    solicitud: string,
    key: string,
    clarify = false,
  ) {
    const tree = await this.own(actor, id);
    const [node] = await this.db.query<Node>(
      "SELECT * FROM nodos WHERE arbol_id=$1 AND id=$2",
      [id, nid],
    );
    if (!node) throw new NotFoundException("Nodo no encontrado.");
    if (!clarify && node.profundidad >= 5)
      throw new ConflictException(
        "Esta rama llegó a su profundidad máxima. Vuelve a otra rama.",
      );
    const reserved = await this.reserve(
      actor,
      key,
      { op: clarify ? "aclarar" : "expandir", id, nid, solicitud },
      id,
    );
    if (reserved.cached) return reserved.cached;
    try {
      const source = await this.material(actor, tree);
      const all = await this.db.query<Node>(
        "SELECT * FROM nodos WHERE arbol_id=$1",
        [id],
      );
      const ancestors: Node[] = [];
      let parent: Node | undefined = node;
      while (parent && ancestors.length < 6) {
        ancestors.unshift(parent);
        parent = all.find((n) => n.id === parent!.padre_id);
      }
      const path = ancestors
        .map((n) => n.titulo + ": " + n.contenido.slice(0, 1200))
        .join("\n");
      const out = await this.ai.explain({
        solicitud,
        material: source.texto + "\nContexto de la rama: " + path,
        titulo: node.titulo,
      });
      const result = await this.db.transaction(async (m) => {
        await m.query("SELECT id FROM arboles WHERE id=$1 FOR UPDATE", [id]);
        if (clarify) {
          await m.query(
            "INSERT INTO revisiones_nodo(id,nodo_id,titulo,contenido) SELECT $1,id,titulo,contenido FROM nodos WHERE id=$2",
            [randomUUID(), nid],
          );
          await m.query(
            "UPDATE nodos SET titulo=$2,contenido=$3,prompt_version=$4 WHERE id=$1",
            [nid, out.titulo, out.explicacion, PROMPT_VERSION],
          );
          const result = { id };
          await m.query(
            "UPDATE solicitudes_ia SET estado='completada',respuesta_json=$3 WHERE actor_id=$1 AND clave=$2",
            [actor, key, result],
          );
          return result;
        }
        const [{ n }] = await m.query(
          "SELECT count(*)::int AS n FROM nodos WHERE arbol_id=$1",
          [id],
        );
        const children = [
          {
            tipo: "aclaracion",
            titulo: out.titulo,
            contenido: out.explicacion,
          },
          ...out.hijos_propuestos,
        ].slice(0, 3);
        if (n + children.length > 30)
          throw new ConflictException(
            "Este árbol llegó a 30 nodos. Puedes seguir leyendo sus ramas.",
          );
        const [{ next }] = await m.query(
          "SELECT coalesce(max(orden),-1)+1 AS next FROM nodos WHERE arbol_id=$1 AND padre_id=$2",
          [id, nid],
        );
        for (const [n, h] of children.entries())
          await m.query(
            "INSERT INTO nodos VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
            [
              randomUUID(),
              id,
              nid,
              node.profundidad + 1,
              next + n,
              h.tipo,
              h.titulo,
              h.contenido,
              "Generado por IA; no revisado",
              PROMPT_VERSION,
              JSON.stringify(source.citas),
            ],
          );
        const result = { id };
        await m.query(
          "UPDATE solicitudes_ia SET estado='completada',respuesta_json=$3 WHERE actor_id=$1 AND clave=$2",
          [actor, key, result],
        );
        return result;
      });
      return result;
    } catch (e) {
      await this.db.query(
        "UPDATE solicitudes_ia SET estado='fallida' WHERE actor_id=$1 AND clave=$2",
        [actor, key],
      );
      throw e;
    }
  }
}
@Throttle({ default: { limit: 15, ttl: 60000 } })
@Controller("arboles")
export class TutorController {
  constructor(
    @Inject(TutorService) private s: TutorService,
    @Inject(Database) private db: Database,
  ) {}
  @Get() list(@Req() r: ActorRequest) {
    return this.db.query(
      "SELECT id,titulo,concepto,created_at FROM arboles WHERE actor_id=$1 ORDER BY created_at DESC LIMIT 50",
      [r.actorId],
    );
  }
  @Post() create(
    @Req() r: ActorRequest,
    @Body() b: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    return this.s.create(r.actorId, validate(createSchema, b), key);
  }
  @Get(":id") get(@Req() r: ActorRequest, @Param("id") id: string) {
    return this.s.get(r.actorId, validate(z.string().uuid(), id));
  }
  @Post(":id/nodos/:nid/aclarar") clarify(
    @Req() r: ActorRequest,
    @Param("id") id: string,
    @Param("nid") nid: string,
    @Body() b: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    const input = validate(
      z.object({ solicitud: z.string().min(1).max(2000) }).strict(),
      b,
    );
    return this.s.expand(
      r.actorId,
      validate(z.string().uuid(), id),
      validate(z.string().uuid(), nid),
      input.solicitud,
      key,
      true,
    );
  }
  @Post(":id/nodos/:nid/expandir") expand(
    @Req() r: ActorRequest,
    @Param("id") id: string,
    @Param("nid") nid: string,
    @Body() b: unknown,
    @Headers("idempotency-key") key: string,
  ) {
    const input = validate(
      z.object({ solicitud: z.string().min(1).max(2000) }).strict(),
      b,
    );
    return this.s.expand(
      r.actorId,
      validate(z.string().uuid(), id),
      validate(z.string().uuid(), nid),
      input.solicitud,
      key,
    );
  }
}
@Module({
  imports: [PracticaModule],
  providers: [TutorAI, TutorService],
  controllers: [TutorController],
  exports: [TutorAI, TutorService],
})
export class TutorModule {}
