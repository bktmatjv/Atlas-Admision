import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import type { Response } from "express";
import { settings } from "../../config.js";
const derivar = promisify(scrypt);
export const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");
export async function claveHash(clave: string, sal = randomBytes(16).toString("hex")) {
  const key = await derivar(clave, sal, 64) as Buffer;
  return `${sal}:${key.toString("hex")}`;
}
export async function claveValida(clave: string, hash: string) {
  const [sal, esperado] = hash.split(":");
  const actual = (await claveHash(clave, sal)).split(":")[1];
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(esperado, "hex"));
}
// Misma derivación para un usuario inexistente; no revelar existencia por coste del hash.
export const HASH_FICTICIO = `${"0".repeat(32)}:${"0".repeat(128)}`;
export function emitirCookie(res: Response, token: string) {
  res.cookie("atlas_sid", token, {
    httpOnly: true, secure: settings().NODE_ENV === "production",
    sameSite: settings().COOKIE_SAME_SITE, maxAge: 30 * 86400 * 1000, path: "/",
  });
  res.setHeader("Cache-Control", "no-store");
}
export function codigoValido(codigo: string, hash: string) {
  return timingSafeEqual(Buffer.from(hashToken(codigo), "hex"), Buffer.from(hash, "hex"));
}
