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
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Database } from "../../database/database.js";
import { validate } from "../../http.js";
import type { ActorRequest } from "../identidad/identidad.js";
import { ACTIVIDADES, buscarError } from "./actividades.js";
import { construirRastro, nivelPorFallos } from "./rastros.js";
import { GrafoController, GrafoService } from "./grafo.js";
import { clavesExpuestas } from "./expuestas.js";
import {
  claveInstancia,
  generarNoExpuesta,
  instanciaDesdeClave,
} from "./plantillas.js";
import { igualesNumeros, normalizarNumero } from "./numeros.js";
const ORIGEN_SQL =
  "CASE WHEN actividad_id LIKE '%:%' THEN 'plantilla' ELSE 'curada' END AS origen";
// Actividad curada (por id) o instancia de plantilla (por clave), con la misma interfaz de corrección.
function resolverActividad(actividadId: string) {
  const curada = ACTIVIDADES.find((a) => a.id === actividadId);
  if (curada)
    return {
      id: curada.id,
      concepto: curada.concepto,
      respuesta: curada.respuesta,
      solucion: curada.solucion,
      origen: "curada" as const,
      plantilla: null,
      parametros: null,
      ideaDeError: (n: number) => buscarError(curada, n)?.idea_clave ?? null,
    };
  const i = instanciaDesdeClave(actividadId);
  if (!i) return null;
  return {
    id: actividadId,
    concepto: i.concepto,
    respuesta: i.respuesta,
    solucion: `La respuesta correcta es ${i.respuesta}.`,
    origen: "plantilla" as const,
    plantilla: i.plantilla,
    parametros: i.parametros,
    ideaDeError: (n: number) =>
      i.distractores.find((d) => igualesNumeros(d.valor, n))?.idea_clave ??
      null,
  };
}
@Controller()
export class SeguimientoController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(GrafoService) private grafo: GrafoService,
  ) {}
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
        `SELECT id,enunciado,${ORIGEN_SQL} FROM comprobaciones WHERE actor_id=$1 AND entregado_at IS NULL`,
        [r.actorId],
      );
      if (active.length) return active[0];
      const exposed = await clavesExpuestas(this.db, r.actorId, m);
      // Primero las actividades curadas; solo si se agotan, una instancia de plantilla.
      const curada = ACTIVIDADES.find(
        (a) => a.concepto === tree.concepto && !exposed.has(a.id),
      );
      const instancia = curada
        ? null
        : generarNoExpuesta(
            tree.concepto ?? "",
            Math.floor(Math.random() * 1_000_000),
            (k) => exposed.has(k),
          );
      if (!curada && !instancia)
        throw new ConflictException(
          "No hay otra actividad revisada disponible para este concepto. Puedes seguir explorando y practicando.",
        );
      const id = randomUUID();
      const actividadId = curada ? curada.id : claveInstancia(instancia!);
      const enunciado = curada ? curada.enunciado : instancia!.enunciado_base;
      await m.query(
        "INSERT INTO comprobaciones(id,actor_id,arbol_id,actividad_id,version,concepto,enunciado) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          r.actorId,
          arbol_id,
          actividadId,
          curada ? "v1" : "plantilla-v1",
          curada ? curada.concepto : instancia!.concepto,
          enunciado,
        ],
      );
      return {
        id,
        enunciado,
        origen: curada ? "curada" : "plantilla",
        nota: "Sin ayudas de CALIBRA durante este intento. No detectamos ayuda externa; tu justificación no se calificará automáticamente.",
      };
    });
  }
  @Get("comprobaciones/activa") async active(@Req() r: ActorRequest) {
    return (
      (
        await this.db.query(
          `SELECT id,enunciado,arbol_id,${ORIGEN_SQL} FROM comprobaciones WHERE actor_id=$1 AND entregado_at IS NULL`,
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
      const task = resolverActividad(row.actividad_id);
      if (!task) throw new NotFoundException("Actividad no encontrada.");
      const leido = normalizarNumero(b.respuesta);
      // Un valor no interpretable no es un fallo: la comprobación sigue abierta.
      if (!leido.legible)
        throw new BadRequestException(
          "No pude leer tu respuesta como número. Escribe solo el número (por ejemplo 96, 25% o 3/8).",
        );
      const num = leido.valor;
      const correcta = igualesNumeros(num, task.respuesta);
      const ayuda = await m.query(
        "SELECT 1 FROM solicitudes_ia WHERE actor_id=$1 AND created_at>=$2 AND estado IN ('pendiente','completada') LIMIT 1",
        [r.actorId, row.created_at],
      );
      let rastro: ReturnType<typeof construirRastro> | null = null;
      let ideaDeCorreccion: string | null = null;
      let corrige = false;
      if (!correcta) {
        // Retropropagación determinista: la IA no decide la idea clave ni el nodo.
        const idea = task.ideaDeError(num);
        const [{ n }] = idea
          ? await m.query(
              "SELECT count(*)::int AS n FROM rastros_error WHERE arbol_id=$1 AND idea_clave=$2",
              [row.arbol_id, idea],
            )
          : [{ n: 0 }];
        const [nodo] = idea
          ? await m.query(
              "SELECT id FROM nodos WHERE arbol_id=$1 AND idea_clave=$2 ORDER BY created_at DESC,profundidad DESC LIMIT 1",
              [row.arbol_id, idea],
            )
          : [];
        const fila = {
          actividad_id: task.id,
          respuesta: b.respuesta,
          idea_clave: idea,
          nodo_retorno_id: (nodo?.id as string | undefined) ?? null,
          nivel_ayuda: nivelPorFallos(n),
        };
        rastro = construirRastro(fila);
        await m.query(
          "INSERT INTO rastros_error(id,actor_id,arbol_id,comprobacion_id,respuesta,idea_clave,nodo_retorno_id,nivel_ayuda,origen,plantilla,parametros) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
          [
            randomUUID(),
            r.actorId,
            row.arbol_id,
            id,
            b.respuesta,
            idea,
            fila.nodo_retorno_id,
            fila.nivel_ayuda,
            task.origen,
            task.plantilla,
            task.parametros,
          ],
        );
        if (idea)
          await this.grafo.vincularConfusion(
            m,
            r.actorId,
            idea,
            fila.nodo_retorno_id,
          );
      } else if (!ayuda.length) {
        // Solo el último fallo aún no corregido cuenta: una corrección no se registra dos veces.
        const [ultimo] = await m.query(
          "SELECT r.idea_clave FROM rastros_error r WHERE r.arbol_id=$1 AND NOT EXISTS (SELECT 1 FROM evidencias e WHERE e.arbol_id=r.arbol_id AND e.tipo='corrigio_tras_error' AND e.created_at>=r.created_at) ORDER BY r.created_at DESC LIMIT 1",
          [row.arbol_id],
        );
        if (ultimo) ideaDeCorreccion = ultimo.idea_clave ?? null;
        corrige = Boolean(ultimo);
      }
      const result = {
        correcta,
        solucion: task.solucion,
        origen: task.origen,
        ayuda: ayuda.length > 0,
        justificacion: b.justificacion,
        rastro,
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
          {
            actividad_id: task.id,
            concepto: task.concepto,
            ...(task.plantilla
              ? { plantilla: task.plantilla, parametros: task.parametros }
              : {}),
            ...result,
          },
        ],
      );
      if (corrige)
        await m.query(
          "INSERT INTO evidencias(id,actor_id,tipo,arbol_id,comprobacion_id,detalle) VALUES($1,$2,$3,$4,$5,$6)",
          [
            randomUUID(),
            r.actorId,
            "corrigio_tras_error",
            row.arbol_id,
            id,
            {
              actividad_id: task.id,
              concepto: task.concepto,
              origen: task.origen,
              ...(task.plantilla
                ? { plantilla: task.plantilla, parametros: task.parametros }
                : {}),
              idea_clave: ideaDeCorreccion,
            },
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
@Module({
  controllers: [SeguimientoController, GrafoController],
  providers: [GrafoService],
  exports: [GrafoService],
})
export class SeguimientoModule {}
