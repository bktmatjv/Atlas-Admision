import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Inject,
  Module,
  Param,
  Post,
  Put,
  Req,
  Headers,
  UploadedFile,
  UseInterceptors,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { Database } from "../../database/database.js";
import { validate } from "../../http.js";
import { settings } from "../../config.js";
import { digest, type ActorRequest } from "../identidad/identidad.js";
import { TutorModule, TutorService } from "../tutor/tutor.js";
import { extractDocument } from "./extraction.js";
import { TutorAI } from "../tutor/ai.js";
const uuid = (id: string) => validate(z.string().uuid(), id);
type Doc = {
  id: string;
  curso_id: string;
  nombre: string;
  ruta: string;
  formato: string;
  estado: string;
  hash: string;
  temas: unknown[];
  error: string | null;
};
@Injectable()
export class DocumentosService {
  private timer?: ReturnType<typeof setInterval>;
  private running: Promise<void> | null = null;
  constructor(
    @Inject(Database) private db: Database,
    @Inject(TutorAI) private ai: TutorAI,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      if (!this.running)
        this.running = this.processOne()
          .catch(() =>
            console.error(
              "Importación: fallo de infraestructura; se reintentará al recuperar la conexión.",
            ),
          )
          .finally(() => {
            this.running = null;
          });
    }, 1000);
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.running) await this.running;
  }
  async course(actor: string, id: string) {
    const [c] = await this.db.query<{ id: string; titulo: string }>(
      "SELECT * FROM cursos_personales WHERE id=$1 AND actor_id=$2",
      [id, actor],
    );
    if (!c) throw new NotFoundException("Curso no encontrado.");
    return c;
  }
  async document(actor: string, id: string) {
    const [d] = await this.db.query<Doc>(
      "SELECT d.* FROM documentos d JOIN cursos_personales c ON c.id=d.curso_id WHERE d.id=$1 AND c.actor_id=$2",
      [id, actor],
    );
    if (!d) throw new NotFoundException("Documento no encontrado.");
    return d;
  }
  async upload(
    actor: string,
    cid: string,
    file: Express.Multer.File | undefined,
  ) {
    await this.course(actor, cid);
    if (!file)
      throw new BadRequestException(
        "Adjunta un archivo PDF con texto, TXT o Markdown.",
      );
    const name = file.originalname.replace(/[\\/]/g, "_").slice(0, 180),
      ext = name.split(".").at(-1)?.toLowerCase();
    if (!["pdf", "txt", "md"].includes(ext ?? ""))
      throw new BadRequestException(
        "Formato no admitido. Usa PDF con texto, TXT o Markdown.",
      );
    if (ext === "pdf" && file.buffer.subarray(0, 5).toString() !== "%PDF-")
      throw new BadRequestException(
        "La firma del archivo no corresponde a PDF.",
      );
    if (
      ext !== "pdf" &&
      (file.buffer.includes(0) ||
        file.buffer.subarray(0, 5).toString() === "%PDF-")
    )
      throw new BadRequestException("El contenido no es texto válido.");
    const [{ n }] = await this.db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM documentos d JOIN cursos_personales c ON c.id=d.curso_id WHERE c.actor_id=$1",
      [actor],
    );
    if (n >= 20)
      throw new BadRequestException(
        "Límite de 20 documentos por sesión. Elimina los que no uses.",
      );
    const hash = digest(file.buffer.toString("base64"));
    const [old] = await this.db.query<Doc>(
      "SELECT * FROM documentos WHERE curso_id=$1 AND hash=$2",
      [cid, hash],
    );
    if (old) return { id: old.id, estado: old.estado };
    const id = randomUUID(),
      dir = resolve(settings().UPLOAD_DIR),
      path = resolve(dir, id);
    await mkdir(dir, { recursive: true });
    await writeFile(path, file.buffer, { flag: "wx" });
    try {
      await this.db.transaction(async (m) => {
        await m.query("SELECT id FROM actores WHERE id=$1 FOR UPDATE", [actor]);
        const [{ n }] = await m.query(
          "SELECT count(*)::int AS n FROM documentos d JOIN cursos_personales c ON c.id=d.curso_id WHERE c.actor_id=$1",
          [actor],
        );
        if (n >= 20)
          throw new BadRequestException("Límite de 20 documentos por sesión.");
        await m.query(
          "INSERT INTO documentos(id,curso_id,nombre,hash,ruta,formato,estado) VALUES($1,$2,$3,$4,$5,$6,'recibido')",
          [id, cid, name, hash, path, ext],
        );
        await m.query(
          "INSERT INTO trabajos_importacion(documento_id) VALUES($1)",
          [id],
        );
      });
    } catch (e) {
      await unlink(path).catch(() => undefined);
      const [duplicate] = await this.db.query<Doc>(
        "SELECT * FROM documentos WHERE curso_id=$1 AND hash=$2",
        [cid, hash],
      );
      if (duplicate) return { id: duplicate.id, estado: duplicate.estado };
      throw e;
    }
    return { id, estado: "recibido" };
  }
  async processOne() {
    const job = await this.db.transaction(async (m) => {
      const [j] = await m.query(
        "SELECT * FROM trabajos_importacion WHERE estado='pendiente' OR (estado='procesando' AND lease_until<now()) ORDER BY updated_at LIMIT 1 FOR UPDATE SKIP LOCKED",
      );
      if (!j) return null;
      const [d] = await m.query("SELECT * FROM documentos WHERE id=$1", [
        j.documento_id,
      ]);
      await m.query(
        "UPDATE trabajos_importacion SET estado='procesando',intento=intento+1,lease_until=now()+interval '2 minutes',updated_at=now() WHERE documento_id=$1",
        [j.documento_id],
      );
      await m.query(
        "UPDATE documentos SET estado='extrayendo',error=NULL WHERE id=$1",
        [j.documento_id],
      );
      return { ...d, intento: j.intento + 1 } as Doc & { intento: number };
    });
    if (!job) return;
    try {
      const pages = await extractDocument(job.ruta, job.formato);
      const chunks = pages.flatMap((text, p) => {
        const pieces = [];
        for (let i = 0; i < text.length; i += 2000)
          pieces.push({
            id: randomUUID(),
            pagina: p + 1,
            posicion: i,
            texto: text.slice(i, i + 2000),
          });
        return pieces;
      });
      if (!chunks.length) throw new Error("No se encontró texto legible.");
      // Se conserva todo el texto extraído; la organización automática se limita a una muestra y lo declara.
      let temas: unknown[] = [],
        note: string | null = null;
      try {
        const chosen = chunks.slice(0, 12);
        const result = await this.ai.organize(chosen);
        if (
          result.temas.some((t) => !chosen.some((f) => f.id === t.fragmento_id))
        )
          throw new Error("La IA citó un fragmento inexistente.");
        temas = result.temas;
        if (chunks.length > 12)
          note =
            "Organización inicial basada en los primeros 12 fragmentos; revisa el resto del documento.";
      } catch {
        note =
          "Texto extraído. No se pudo organizar con IA; puedes revisar y usar los fragmentos manualmente.";
      }
      await this.db.transaction(async (m) => {
        const [valid] = await m.query(
          "SELECT * FROM trabajos_importacion WHERE documento_id=$1 AND intento=$2 AND estado='procesando' FOR UPDATE",
          [job.id, job.intento],
        );
        if (!valid) return;
        await m.query("DELETE FROM fragmentos WHERE documento_id=$1", [job.id]);
        for (const f of chunks)
          await m.query(
            "INSERT INTO fragmentos(id,documento_id,pagina,posicion,texto) VALUES($1,$2,$3,$4,$5)",
            [f.id, job.id, f.pagina, f.posicion, f.texto],
          );
        await m.query(
          "UPDATE documentos SET estado='requiere_revision',temas=$2,error=$3 WHERE id=$1",
          [job.id, JSON.stringify(temas), note],
        );
        await m.query(
          "UPDATE trabajos_importacion SET estado='completado',lease_until=NULL WHERE documento_id=$1",
          [job.id],
        );
      });
    } catch (e) {
      const error =
        e instanceof Error && /supera|texto|OCR|PDF/.test(e.message)
          ? e.message
          : "No se pudo extraer el archivo. Comprueba que no está dañado ni protegido.";
      await this.db.transaction(async (m) => {
        const [valid] = await this.db.query(
          "UPDATE trabajos_importacion SET estado='fallido',lease_until=NULL WHERE documento_id=$1 AND intento=$2 AND estado='procesando' RETURNING documento_id",
          [job.id, job.intento],
          m,
        );
        if (valid)
          await m.query(
            "UPDATE documentos SET estado='fallido',error=$2 WHERE id=$1",
            [job.id, error],
          );
      });
    }
  }
  async remove(actor: string, id: string) {
    const d = await this.document(actor, id);
    // Borrar primero el original: si falla no confirmamos un borrado completo. Reintento tolera ENOENT.
    await unlink(d.ruta).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
    await this.db.query("DELETE FROM documentos WHERE id=$1", [id]);
    return {
      eliminado: true,
      nota: "El archivo y sus árboles/fragmentos derivados se retiraron. Las copias de seguridad siguen la política del despliegue.",
    };
  }
}
@Throttle({ default: { limit: 20, ttl: 60000 } })
@Controller()
export class DocumentosController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(DocumentosService) private s: DocumentosService,
    @Inject(TutorAI) private ai: TutorAI,
    @Inject(TutorService) private tutor: TutorService,
  ) {}
  @Get("cursos") courses(@Req() r: ActorRequest) {
    return this.db.query(
      "SELECT * FROM cursos_personales WHERE actor_id=$1 ORDER BY created_at DESC",
      [r.actorId],
    );
  }
  @Post("cursos") async create(@Req() r: ActorRequest, @Body() b: unknown) {
    const data = validate(
      z
        .object({
          titulo: z.string().min(1).max(120),
          objetivo: z.string().max(1000).default(""),
        })
        .strict(),
      b,
    );
    const id = randomUUID();
    await this.db.query(
      "INSERT INTO cursos_personales(id,actor_id,titulo,objetivo) VALUES($1,$2,$3,$4)",
      [id, r.actorId, data.titulo, data.objetivo],
    );
    return { id, ...data };
  }
  @Get("cursos/:id") async get(
    @Req() r: ActorRequest,
    @Param("id") id: string,
  ) {
    const c = await this.s.course(r.actorId, uuid(id));
    return {
      ...c,
      documentos: await this.db.query(
        "SELECT id,nombre,estado,error,temas,created_at FROM documentos WHERE curso_id=$1 ORDER BY created_at DESC",
        [id],
      ),
    };
  }
  @Post("cursos/:id/documentos")
  @UseInterceptors(
    FileInterceptor("archivo", {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1 },
    }),
  )
  upload(
    @Req() r: ActorRequest,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.s.upload(r.actorId, uuid(id), file);
  }
  @Get("documentos/:id") async doc(
    @Req() r: ActorRequest,
    @Param("id") id: string,
  ) {
    const d = await this.s.document(r.actorId, uuid(id));
    const { ruta, ...safe } = d;
    const propuestas = await this.db.query(
      "SELECT a.id,a.fragmento_id,a.data AS actividad,a.intento,a.revelada FROM actividades_generadas a JOIN fragmentos f ON f.id=a.fragmento_id WHERE f.documento_id=$1 AND a.actor_id=$2 ORDER BY a.created_at DESC",
      [id, r.actorId],
    );
    return {
      ...safe,
      propuestas,
      fragmentos: await this.db.query(
        "SELECT id,pagina,posicion,texto FROM fragmentos WHERE documento_id=$1 ORDER BY pagina,posicion",
        [id],
      ),
    };
  }
  @Post("documentos/:id/confirmar") async confirm(
    @Req() r: ActorRequest,
    @Param("id") id: string,
  ) {
    const d = await this.s.document(r.actorId, uuid(id));
    if (d.estado !== "requiere_revision")
      throw new ConflictException(
        "El documento todavía no está listo para revisar.",
      );
    await this.db.query("UPDATE documentos SET estado='listo' WHERE id=$1", [
      id,
    ]);
    return { listo: true };
  }
  @Delete("documentos/:id") remove(
    @Req() r: ActorRequest,
    @Param("id") id: string,
  ) {
    return this.s.remove(r.actorId, uuid(id));
  }
  @Post("documentos/:id/reintentar") async retry(
    @Req() r: ActorRequest,
    @Param("id") id: string,
  ) {
    const d = await this.s.document(r.actorId, uuid(id));
    if (d.estado !== "fallido")
      throw new ConflictException("Solo se reintentan importaciones fallidas.");
    await this.db.transaction(async (m) => {
      await m.query(
        "UPDATE documentos SET estado='recibido',error=NULL WHERE id=$1",
        [id],
      );
      await m.query(
        "UPDATE trabajos_importacion SET estado='pendiente',updated_at=now() WHERE documento_id=$1",
        [id],
      );
    });
    return { estado: "recibido" };
  }
  @Put("actividades-generadas/:id/intento") async saveActivity(
    @Req() r: ActorRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const b = validate(
      z
        .object({
          intento: z.string().max(3000),
          revelada: z.boolean().default(false),
        })
        .strict(),
      body,
    );
    const [saved] = await this.db.query(
      "UPDATE actividades_generadas SET intento=$3,revelada=revelada OR $4 WHERE id=$1 AND actor_id=$2 RETURNING id,intento,revelada",
      [uuid(id), r.actorId, b.intento, b.revelada],
    );
    if (!saved) throw new NotFoundException("Actividad no encontrada.");
    return saved;
  }
  @Post("fragmentos/:id/actividad") async activity(
    @Req() r: ActorRequest,
    @Param("id") id: string,
    @Headers("idempotency-key") key: string,
  ) {
    const [f] = await this.db.query<{
      texto: string;
      pagina: number;
      documento_id: string;
    }>(
      "SELECT f.texto,f.pagina,f.documento_id FROM fragmentos f JOIN documentos d ON d.id=f.documento_id JOIN cursos_personales c ON c.id=d.curso_id WHERE f.id=$1 AND c.actor_id=$2 AND d.estado='listo'",
      [uuid(id), r.actorId],
    );
    if (!f)
      throw new NotFoundException("Fragmento no encontrado o sin confirmar.");
    return this.tutor.formative(r.actorId, key, id, async () => {
      const [old] = await this.db.query<{
        id: string;
        data: object;
        intento: string;
        revelada: boolean;
      }>(
        "SELECT * FROM actividades_generadas WHERE actor_id=$1 AND fragmento_id=$2",
        [r.actorId, id],
      );
      let saved = old;
      if (!saved) {
        const actividad = await this.ai.activity(f.texto);
        await this.db.query(
          "INSERT INTO actividades_generadas(id,actor_id,fragmento_id,data) VALUES($1,$2,$3,$4) ON CONFLICT(actor_id,fragmento_id) DO NOTHING",
          [randomUUID(), r.actorId, id, actividad],
        );
        [saved] = await this.db.query(
          "SELECT * FROM actividades_generadas WHERE actor_id=$1 AND fragmento_id=$2",
          [r.actorId, id],
        );
      }
      return {
        id: saved.id,
        actividad: saved.data,
        intento: saved.intento,
        revelada: saved.revelada,
        fragmento_id: id,
        pagina: f.pagina,
        estado: "generada_no_revisada",
        nota: "Propuesta formativa: respuesta no verificada académicamente; no suma evidencia de transferencia.",
      };
    });
  }
}
@Module({
  imports: [TutorModule],
  providers: [DocumentosService],
  controllers: [DocumentosController],
  exports: [DocumentosService],
})
export class DocumentosModule {}
