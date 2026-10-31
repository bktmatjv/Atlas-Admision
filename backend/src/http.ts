import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  BadRequestException,
} from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
export function validate<S extends z.ZodType>(
  schema: S,
  value: unknown,
): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new BadRequestException(
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  return parsed.data;
}
// Un error puede traer su propio código estable (p. ej. `elige_tema`) para que el cliente decida qué hacer.
function codigoDe(e: unknown, status: number) {
  if (e instanceof HttpException) {
    const r = e.getResponse();
    if (typeof r === "object" && r && "codigo" in r && typeof r.codigo === "string" && /^[a-z_]{3,40}$/.test(r.codigo))
      return r.codigo;
  }
  return `HTTP_${status}`;
}
@Catch()
export class Errors implements ExceptionFilter {
  catch(e: unknown, host: ArgumentsHost) {
    const bodyError = e && typeof e === "object" && "type" in e ? e.type : null;
    const status =
      e instanceof HttpException
        ? e.getStatus()
        : bodyError === "entity.too.large"
          ? 413
          : bodyError === "entity.parse.failed"
            ? 400
            : 500;
    const message =
      e instanceof HttpException
        ? e.message
        : status === 413
          ? "La solicitud supera el tamaño permitido."
          : status === 400
            ? "El JSON de la solicitud no es válido."
            : "No se pudo completar la operación.";
    // No se registran bodies, claves, SQL o documentos en los errores públicos.
    if (status === 500)
      console.error(
        "Error interno",
        e instanceof Error ? e.name : "desconocido",
      );
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ error: { codigo: codigoDe(e, status), mensaje: message } });
  }
}
