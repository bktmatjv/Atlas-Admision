import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  Controller,
  Post,
  Get,
  Delete,
  Req,
  Res,
  Module,
} from "@nestjs/common";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import type { Request, Response } from "express";
import { Database } from "../../database/database.js";
import { settings } from "../../config.js";
export type ActorRequest = Request & { actorId: string };
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(Database) private db: Database) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<ActorRequest>();
    if (req.path.endsWith("/salud")) return true;
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.origin;
      const allowed = settings().FRONTEND_ORIGIN;
      if (
        req.headers["x-calibra-request"] !== "1" ||
        (origin &&
          origin !== allowed &&
          origin !== `${req.protocol}://${req.get("host")}`)
      )
        throw new ForbiddenException("Origen de solicitud no permitido.");
    }
    const token = req.cookies?.atlas_sid;
    if (typeof token === "string" && token.length === 64) {
      const [session] = await this.db.query<{ actor_id: string }>(
        "SELECT actor_id FROM sesiones WHERE hash=$1 AND expires_at>now()",
        [digest(token)],
      );
      if (session) {
        req.actorId = session.actor_id;
        const ayuda =
          /\/arboles\/[0-9a-f-]+/.test(req.path) ||
          (/\/documentos\/[0-9a-f-]+$/.test(req.path) &&
            req.method === "GET") ||
          req.path.includes("/fragmentos/") ||
          req.path.includes("/actividades-generadas/") ||
          req.path.endsWith("/solucion") ||
          /\/intentos\/[^/]+\/preguntas/.test(req.path);
        if (
          ayuda &&
          (
            await this.db.query(
              "SELECT id FROM comprobaciones WHERE actor_id=$1 AND entregado_at IS NULL",
              [req.actorId],
            )
          ).length
        )
          throw new ConflictException(
            "Finaliza la comprobación o vuelve al modo de ayuda para consultar este contenido.",
          );
        return true;
      }
    }
    if (req.method === "POST" && req.path.endsWith("/sesion")) return true;
    throw new UnauthorizedException("Inicia una sesión para continuar.");
  }
}
@Controller("sesion")
export class SessionController {
  constructor(@Inject(Database) private db: Database) {}
  @Post()
  async create(
    @Req() req: ActorRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (req.actorId) return { actorId: req.actorId, modo: "invitado" };
    const id = randomUUID(),
      token = randomBytes(32).toString("hex");
    await this.db.transaction(async (m) => {
      await m.query("INSERT INTO actores(id) VALUES($1)", [id]);
      await m.query("INSERT INTO sesiones(hash,actor_id) VALUES($1,$2)", [
        digest(token),
        id,
      ]);
    });
    res.cookie("atlas_sid", token, {
      httpOnly: true,
      secure: settings().NODE_ENV === "production",
      sameSite: settings().COOKIE_SAME_SITE,
      maxAge: 30 * 86400 * 1000,
      path: "/",
    });
    return { actorId: id, modo: "invitado" };
  }
  @Get() get(@Req() req: ActorRequest) {
    return { actorId: req.actorId, modo: "invitado" };
  }
  @Delete()
  async remove(
    @Req() req: ActorRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Evitar originales huérfanos: primero se eliminan con el módulo de documentos.
    await this.db.transaction(async (m) => {
      await m.query("SELECT id FROM actores WHERE id=$1 FOR UPDATE", [
        req.actorId,
      ]);
      const files = await m.query(
        "SELECT d.id FROM documentos d JOIN cursos_personales c ON c.id=d.curso_id WHERE c.actor_id=$1",
        [req.actorId],
      );
      if (files.length)
        throw new ForbiddenException(
          "Elimina primero tus documentos y sus archivos asociados.",
        );
      await m.query("DELETE FROM actores WHERE id=$1", [req.actorId]);
    });
    res.clearCookie("atlas_sid", { path: "/" });
    return { eliminado: true };
  }
}
@Module({
  controllers: [SessionController],
  providers: [SessionGuard],
  exports: [SessionGuard],
})
export class IdentidadModule {}
