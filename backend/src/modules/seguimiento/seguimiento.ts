import {
  Body,
  Controller,
  Get,
  Inject,
  Module,
  Param,
  Post,
  Put,
  Req,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Database } from "../../database/database.js";
import { validate } from "../../http.js";
import type { ActorRequest } from "../identidad/identidad.js";
import { ACTIVIDADES } from "./actividades.js";
@Controller()
export class SeguimientoController {
  constructor(@Inject(Database) private db: Database) {}
  @Get("evidencias") list(@Req() r: ActorRequest) {
    return this.db.query(
      "SELECT * FROM evidencias WHERE actor_id=$1 ORDER BY created_at DESC LIMIT 100",
      [r.actorId],
    );
  }
  @Post("comprobaciones") async start(
    @Req() r: ActorRequest,
    @Body() input: unknown,
  ) {
    const { arbol_id } = validate(
      z.object({ arbol_id: z.string().uuid() }).strict(),
      input,
    );
    return this.db.transaction(async (m) => {
      await m.query("SELECT id FROM actores WHERE id=$1 FOR UPDATE", [
        r.actorId,
      ]);
      const [tree] = await m.query(
        "SELECT * FROM arboles WHERE id=$1 AND actor_id=$2",
        [arbol_id, r.actorId],
      );
      if (!tree) throw new NotFoundException("Árbol no encontrado.");
      await m.query(
        "UPDATE solicitudes_ia SET estado='fallida' WHERE actor_id=$1 AND estado='pendiente' AND created_at<now()-interval '2 minutes'",
        [r.actorId],
      );
      const pending = await m.query(
        "SELECT clave FROM solicitudes_ia WHERE actor_id=$1 AND estado='pendiente'",
        [r.actorId],
      );
      if (pending.length)
        throw new ConflictException(
          "Espera a que termine la ayuda solicitada antes de comprobar.",
        );
      const active = await m.query(
        "SELECT id,enunciado FROM comprobaciones WHERE actor_id=$1 AND entregado_at IS NULL",
        [r.actorId],
      );
      if (active.length) return active[0];
      const exposed = await m.query(
        "SELECT actividad_id FROM comprobaciones WHERE actor_id=$1",
        [r.actorId],
      );
      const task = ACTIVIDADES.find(
        (a) =>
          a.concepto === tree.concepto &&
          !exposed.some(
            (e: { actividad_id: string }) => e.actividad_id === a.id,
          ),
      );
      if (!task)
        throw new ConflictException(
          "No hay otra actividad revisada disponible para este concepto. Puedes seguir explorando y practicando.",
        );
      const id = randomUUID();
      await m.query(
        "INSERT INTO comprobaciones(id,actor_id,arbol_id,actividad_id,version,concepto,enunciado) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [id, r.actorId, arbol_id, task.id, "v1", task.concepto, task.enunciado],
      );
      return {
        id,
        enunciado: task.enunciado,
        nota: "Sin ayudas de Atlas durante este intento. No detectamos ayuda externa; tu justificación no se calificará automáticamente.",
      };
    });
  }
  @Get("comprobaciones/activa") async active(@Req() r: ActorRequest) {
    return (
      (
        await this.db.query(
          "SELECT id,enunciado,arbol_id FROM comprobaciones WHERE actor_id=$1 AND entregado_at IS NULL",
          [r.actorId],
        )
      )[0] ?? null
    );
  }
  @Put("comprobaciones/:id/respuesta") async answer(
    @Req() r: ActorRequest,
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    validate(z.string().uuid(), id);
    const b = validate(
      z
        .object({
          respuesta: z.string().min(1).max(200),
          justificacion: z.string().max(3000).default(""),
        })
        .strict(),
      input,
    );
    return this.db.transaction(async (m) => {
      await m.query("SELECT id FROM actores WHERE id=$1 FOR UPDATE", [
        r.actorId,
      ]);
      const [row] = await m.query(
        "SELECT * FROM comprobaciones WHERE id=$1 AND actor_id=$2 FOR UPDATE",
        [id, r.actorId],
      );
      if (!row) throw new NotFoundException("Comprobación no encontrada.");
      if (row.resultado) return row.resultado;
      const task = ACTIVIDADES.find((t) => t.id === row.actividad_id)!;
      const num = Number(b.respuesta.trim().replace(",", "."));
      const correcta = Number.isFinite(num) && num === task.respuesta;
      const ayuda = await m.query(
        "SELECT 1 FROM solicitudes_ia WHERE actor_id=$1 AND created_at>=$2 AND estado IN ('pendiente','completada') LIMIT 1",
        [r.actorId, row.created_at],
      );
      const result = {
        correcta,
        solucion: task.solucion,
        ayuda: ayuda.length > 0,
        justificacion: b.justificacion,
        nota: "Se comprobó solo el resultado numérico. Justificación guardada sin calificación automática. Este caso no certifica dominio ni eficacia pedagógica.",
      };
      await m.query(
        "UPDATE comprobaciones SET respuesta=$2,justificacion=$3,resultado=$4,entregado_at=now() WHERE id=$1",
        [id, b.respuesta, b.justificacion, result],
      );
      await m.query(
        "INSERT INTO evidencias(id,actor_id,tipo,arbol_id,comprobacion_id,detalle) VALUES($1,$2,$3,$4,$5,$6)",
        [
          randomUUID(),
          r.actorId,
          correcta
            ? ayuda.length
              ? "resolvio_con_ayuda"
              : "resolvio_sin_ayuda"
            : "aplicacion_por_reforzar",
          row.arbol_id,
          id,
          { actividad_id: task.id, concepto: task.concepto, ...result },
        ],
      );
      return result;
    });
  }
  @Post("comprobaciones/:id/cancelar") async cancel(
    @Req() r: ActorRequest,
    @Param("id") id: string,
  ) {
    validate(z.string().uuid(), id);
    await this.db.query(
      "UPDATE comprobaciones SET entregado_at=now(),resultado=$3 WHERE id=$1 AND actor_id=$2 AND entregado_at IS NULL",
      [
        id,
        r.actorId,
        {
          cancelada: true,
          nota: "Volviste al modo de ayuda; no se registró un acierto independiente.",
        },
      ],
    );
    return { cancelada: true };
  }
}
@Module({ controllers: [SeguimientoController] })
export class SeguimientoModule {}
