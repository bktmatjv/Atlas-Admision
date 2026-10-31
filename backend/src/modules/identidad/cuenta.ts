import { Body, ConflictException, Controller, Get, Inject, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import type { Response } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { Database } from "../../database/database.js";
import { validate } from "../../http.js";
import type { ActorRequest } from "./identidad.js";
import { claveHash, claveValida, codigoValido, emitirCookie, HASH_FICTICIO, hashToken } from "./credenciales.js";
const usuario = z.string().trim().toLowerCase().regex(/^[a-z0-9_.]{3,30}$/, "Usa de 3 a 30 letras, números, puntos o guiones bajos.");
const clave = z.string().min(8, "Usa al menos 8 caracteres.").max(128);
const acceso = z.object({ usuario, contrasena: clave }).strict();
type Cuenta = { actor_id: string; usuario: string; hash: string; recuperacion_hash: string };

@Controller("cuenta")
export class CuentaController {
  constructor(@Inject(Database) private db: Database) {}
  @Get() async get(@Req() req: ActorRequest, @Res({ passthrough: true }) res: Response) {
    res.setHeader("Cache-Control", "no-store");
    const [cuenta] = await this.db.query<{ usuario: string }>("SELECT usuario FROM cuentas WHERE actor_id=$1", [req.actorId]);
    return { actorId: req.actorId, usuario: cuenta?.usuario ?? null };
  }
  @Post("registro") async registro(@Req() req: ActorRequest, @Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const p = validate(acceso, body);
    const hash = await claveHash(p.contrasena);
    const recuperacion = randomBytes(24).toString("hex"), token = randomBytes(32).toString("hex");
    try {
      await this.db.transaction(async (m) => {
        await m.query("SELECT id FROM actores WHERE id=$1 FOR UPDATE", [req.actorId]);
        // La sesión debe seguir vigente dentro de la transacción (registro/salida concurrentes).
        const vigente = await m.query("SELECT hash FROM sesiones WHERE hash=$1 AND actor_id=$2 AND expires_at>now() FOR UPDATE", [req.sessionHash, req.actorId]);
        if (!vigente.length) throw new UnauthorizedException("Inicia una sesión para continuar.");
        await m.query("INSERT INTO cuentas(actor_id,usuario,hash,recuperacion_hash) VALUES($1,$2,$3,$4)", [req.actorId, p.usuario, hash, hashToken(recuperacion)]);
        await m.query("DELETE FROM sesiones WHERE hash=$1", [req.sessionHash]);
        await m.query("INSERT INTO sesiones(hash,actor_id) VALUES($1,$2)", [hashToken(token), req.actorId]);
      });
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && e.code === "23505")
        throw new ConflictException("No se pudo crear la cuenta. Elige otro usuario o ingresa a tu cuenta.");
      throw e;
    }
    emitirCookie(res, token);
    return { actorId: req.actorId, usuario: p.usuario, codigo_recuperacion: recuperacion };
  }
  @Post("ingreso") async ingreso(@Req() req: ActorRequest, @Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const p = validate(acceso, body);
    const [cuenta] = await this.db.query<Cuenta>("SELECT actor_id,usuario,hash FROM cuentas WHERE usuario=$1", [p.usuario]);
    const valida = await claveValida(p.contrasena, cuenta?.hash ?? HASH_FICTICIO);
    if (!cuenta || !valida) throw new UnauthorizedException("Usuario o contraseña incorrectos.");
    const token = randomBytes(32).toString("hex");
    await this.db.transaction(async (m) => {
      const [actual] = await m.query("SELECT hash FROM cuentas WHERE actor_id=$1 FOR UPDATE", [cuenta.actor_id]);
      if (!actual || actual.hash !== cuenta.hash) throw new UnauthorizedException("Usuario o contraseña incorrectos.");
      if (req.sessionHash) await m.query("DELETE FROM sesiones WHERE hash=$1", [req.sessionHash]);
      await m.query("INSERT INTO sesiones(hash,actor_id) VALUES($1,$2)", [hashToken(token), cuenta.actor_id]);
    });
    emitirCookie(res, token);
    return { actorId: cuenta.actor_id, usuario: cuenta.usuario };
  }
  @Post("salida") async salida(@Req() req: ActorRequest, @Res({ passthrough: true }) res: Response) {
    await this.db.query("DELETE FROM sesiones WHERE hash=$1", [req.sessionHash]);
    res.clearCookie("atlas_sid", { path: "/" });
    res.setHeader("Cache-Control", "no-store");
    return { salida: true };
  }
  @Post("recuperar") async recuperar(@Req() req: ActorRequest, @Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const p = validate(acceso.extend({ codigo: z.string().regex(/^[a-f0-9]{48}$/) }), body);
    const hash = await claveHash(p.contrasena), token = randomBytes(32).toString("hex"), recuperacion = randomBytes(24).toString("hex");
    const cuenta = await this.db.transaction(async (m) => {
      const [c] = await m.query("SELECT actor_id,usuario,recuperacion_hash FROM cuentas WHERE usuario=$1 FOR UPDATE", [p.usuario]) as Cuenta[];
      if (!c || !codigoValido(p.codigo, c.recuperacion_hash)) throw new UnauthorizedException("Datos de recuperación incorrectos.");
      await m.query("UPDATE cuentas SET hash=$1,recuperacion_hash=$2 WHERE actor_id=$3", [hash, hashToken(recuperacion), c.actor_id]);
      // Un código comprometido no debe dejar sesiones antiguas abiertas.
      await m.query("DELETE FROM sesiones WHERE actor_id=$1 OR hash=$2", [c.actor_id, req.sessionHash ?? ""]);
      await m.query("INSERT INTO sesiones(hash,actor_id) VALUES($1,$2)", [hashToken(token), c.actor_id]);
      return c;
    });
    emitirCookie(res, token);
    return { actorId: cuenta.actor_id, usuario: cuenta.usuario, codigo_recuperacion: recuperacion };
  }
}
