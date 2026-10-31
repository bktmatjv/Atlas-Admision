import { Controller, Get, Inject, Injectable, Req } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { EntityManager } from "typeorm";
import { Database } from "../../database/database.js";
import type { ActorRequest } from "../identidad/identidad.js";
import { caminoHasta } from "./rastros.js";
import { ideaPorClave } from "./actividades.js";
import type { OpGrafo } from "../tutor/artefactos.js";
export const MAX_NODOS_AGENTE = 40;
export const MAX_ARISTAS = 120;
export const PROCEDENCIA_AGENTE = "Generado por el tutor agente; no revisado";
// Nodos que el sistema crea desde el mapa de errores curado; no cuentan como exploración del estudiante.
export const PROCEDENCIA_SISTEMA =
  "Creado por CALIBRA desde el mapa de errores curado";
export type Estado = "sin_explorar" | "explorado" | "fallo" | "aplicado";
type NodoFila = {
  id: string;
  arbol_id: string;
  padre_id: string | null;
  tipo: string;
  titulo: string;
  contenido: string;
  idea_clave: string | null;
  senal: string | null;
  procedencia: string;
  concepto: string | null;
  con_hijos: boolean;
  con_revision: boolean;
};
type RastroFila = {
  arbol_id: string;
  idea_clave: string | null;
  nodo_retorno_id: string | null;
  corregido: boolean;
};
type EvidenciaFila = {
  tipo: string;
  arbol_id: string | null;
  detalle: { idea_clave?: string | null } | null;
};
const TIPO_VISIBLE: Record<string, string> = {
  raiz: "concepto",
  aclaracion: "idea",
  subpregunta: "pregunta",
  ejemplo: "ejemplo",
  contraste: "idea",
  conexion: "idea",
  aplicacion: "ejemplo",
};
export const tipoVisible = (t: string) => TIPO_VISIBLE[t] ?? t;
// El estado SOLO sale de evidencias, rastros e interacciones: nunca de lo que escriba el modelo.
export function calcularEstado(
  n: NodoFila,
  rastros: RastroFila[],
  evidencias: EvidenciaFila[],
): { estado: Estado; evidencias: number } {
  const delNodo = rastros.filter((r) => r.nodo_retorno_id === n.id);
  const esConcepto = n.tipo === "raiz" || n.tipo === "concepto";
  const correcciones = n.idea_clave
    ? evidencias.filter(
        (e) =>
          e.tipo === "corrigio_tras_error" &&
          e.arbol_id === n.arbol_id &&
          e.detalle?.idea_clave === n.idea_clave,
      )
    : [];
  const sinAyuda = esConcepto
    ? evidencias.filter(
        (e) => e.tipo === "resolvio_sin_ayuda" && e.arbol_id === n.arbol_id,
      )
    : [];
  const total = delNodo.length + correcciones.length + sinAyuda.length;
  if (delNodo.some((r) => !r.corregido))
    return { estado: "fallo", evidencias: total };
  if (correcciones.length || sinAyuda.length)
    return { estado: "aplicado", evidencias: total };
  if (n.con_hijos || n.con_revision)
    return { estado: "explorado", evidencias: total };
  return { estado: "sin_explorar", evidencias: total };
}
@Injectable()
export class GrafoService {
  constructor(@Inject(Database) private db: Database) {}
  async obtener(actor: string) {
    const [fila] = await this.db.query<{
      foco_nodo_id: string | null;
      grafo_version: number;
    }>("SELECT foco_nodo_id,grafo_version FROM actores WHERE id=$1", [actor]);
    const nodos = await this.db.query<NodoFila>(
      `SELECT n.id,n.arbol_id,n.padre_id,n.tipo,n.titulo,n.contenido,n.idea_clave,n.senal,n.procedencia,a.concepto,
        EXISTS(SELECT 1 FROM nodos h WHERE h.padre_id=n.id AND h.procedencia NOT IN ('Generado por el tutor agente; no revisado','Creado por CALIBRA desde el mapa de errores curado')) AS con_hijos,
        EXISTS(SELECT 1 FROM revisiones_nodo r WHERE r.nodo_id=n.id AND r.por='estudiante') AS con_revision
       FROM nodos n JOIN arboles a ON a.id=n.arbol_id WHERE a.actor_id=$1
       ORDER BY a.created_at,n.profundidad,n.orden`,
      [actor],
    );
    const rastros = await this.db.query<RastroFila & { created_at: Date }>(
      `SELECT r.arbol_id,r.idea_clave,r.nodo_retorno_id,r.created_at,
        EXISTS(SELECT 1 FROM evidencias e WHERE e.arbol_id=r.arbol_id AND e.tipo='corrigio_tras_error' AND e.created_at>=r.created_at) AS corregido
       FROM rastros_error r WHERE r.actor_id=$1 ORDER BY r.created_at`,
      [actor],
    );
    const evidencias = await this.db.query<EvidenciaFila>(
      "SELECT tipo,arbol_id,detalle FROM evidencias WHERE actor_id=$1",
      [actor],
    );
    const manuales = await this.db.query<{
      id: string;
      origen: string;
      destino: string;
      tipo: string;
      creada_por: string;
    }>(
      "SELECT id,origen,destino,tipo,creada_por FROM aristas WHERE actor_id=$1 ORDER BY created_at,id",
      [actor],
    );
    const [{ n: interacciones }] = await this.db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM respuestas_bloque WHERE actor_id=$1",
      [actor],
    );
    const ultimo = [...rastros].reverse().find((r) => r.nodo_retorno_id);
    const delArbol = ultimo
      ? nodos.filter((n) => n.arbol_id === ultimo.arbol_id)
      : [];
    const foco = fila?.foco_nodo_id ?? null;
    return {
      version:
        (fila?.grafo_version ?? 0) +
        evidencias.length +
        rastros.length +
        interacciones,
      foco: foco && nodos.some((n) => n.id === foco) ? foco : null,
      camino_error: ultimo ? caminoHasta(delArbol, ultimo.nodo_retorno_id) : [],
      nodos: nodos.map((n) => {
        const e = calcularEstado(n, rastros, evidencias);
        return {
          id: n.id,
          arbol_id: n.arbol_id,
          tipo: tipoVisible(n.tipo),
          titulo: n.titulo,
          resumen: n.contenido.slice(0, 280),
          idea_clave: n.idea_clave,
          concepto: n.concepto,
          estado: e.estado,
          senal: n.senal,
          origen:
            n.procedencia.startsWith("Generado por IA") ||
            n.procedencia === PROCEDENCIA_AGENTE
              ? "ia"
              : "sistema",
          evidencias: e.evidencias,
        };
      }),
      aristas: [
        ...nodos
          .filter((n) => n.padre_id)
          .map((n) => ({
            id: `p-${n.id}`,
            origen: n.padre_id!,
            destino: n.id,
            tipo: "subtema",
            creada_por: "sistema",
          })),
        ...manuales,
      ],
    };
  }
  // Resumen compacto para el contexto del agente (S8).
  async resumen(actor: string) {
    const g = await this.obtener(actor);
    return {
      version: g.version,
      foco: g.foco,
      camino_error: g.camino_error,
      nodos: g.nodos.map((n) => ({
        id: n.id,
        tipo: n.tipo,
        titulo: n.titulo,
        idea_clave: n.idea_clave,
        estado: n.estado,
        senal: n.senal,
      })),
      aristas: g.aristas
        .filter((a) => !a.id.startsWith("p-"))
        .map((a) => ({ origen: a.origen, destino: a.destino, tipo: a.tipo })),
    };
  }
  // Aplica operaciones ya validadas dentro de la transacción del llamador.
  async aplicar(
    m: EntityManager,
    actor: string,
    arbolId: string,
    ops: OpGrafo[],
  ) {
    await m.query("SELECT id FROM arboles WHERE id=$1 FOR UPDATE", [arbolId]);
    const filas = (await m.query(
      `SELECT n.id,n.arbol_id,n.padre_id,n.profundidad FROM nodos n JOIN arboles a ON a.id=n.arbol_id WHERE a.actor_id=$1`,
      [actor],
    )) as {
      id: string;
      arbol_id: string;
      padre_id: string | null;
      profundidad: number;
    }[];
    const nodos = new Map(filas.map((f) => [f.id, f]));
    const temp = new Map<string, string>();
    const id = (r: string) => temp.get(r) ?? (nodos.has(r) ? r : null);
    const [raiz] = (await m.query(
      "SELECT id,profundidad FROM nodos WHERE arbol_id=$1 AND padre_id IS NULL",
      [arbolId],
    )) as { id: string; profundidad: number }[];
    const aplicadas: OpGrafo[] = [];
    const rechazadas: { op: string; motivo: string }[] = [];
    const arista = async (
      origen: string,
      destino: string,
      tipo: string,
      por: "ia" | "sistema",
    ) =>
      m.query(
        "INSERT INTO aristas(id,actor_id,origen,destino,tipo,creada_por) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
        [randomUUID(), actor, origen, destino, tipo, por],
      );
    for (const o of ops) {
      const no = (motivo: string) => rechazadas.push({ op: o.op, motivo });
      if (o.op === "crear_nodo") {
        const padreId = o.padre ? id(o.padre) : null;
        const padre = padreId ? nodos.get(padreId) : undefined;
        // Si el padre es de otra exploración o ya está en la profundidad máxima, cuelga de la raíz y se relaciona.
        const estructural =
          padre && padre.arbol_id === arbolId && padre.profundidad < 5
            ? padre
            : raiz;
        const [{ next }] = (await m.query(
          "SELECT coalesce(max(orden),-1)+1 AS next FROM nodos WHERE arbol_id=$1 AND padre_id=$2",
          [arbolId, estructural.id],
        )) as { next: number }[];
        const nuevo = randomUUID();
        await m.query(
          "INSERT INTO nodos(id,arbol_id,padre_id,profundidad,orden,tipo,titulo,contenido,procedencia,prompt_version,citas,idea_clave) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'[]',$11)",
          [
            nuevo,
            arbolId,
            estructural.id,
            estructural.profundidad + 1,
            next,
            o.tipo,
            o.titulo,
            o.resumen,
            PROCEDENCIA_AGENTE,
            "tutor-agente-v2",
            o.idea_clave ?? null,
          ],
        );
        nodos.set(nuevo, {
          id: nuevo,
          arbol_id: arbolId,
          padre_id: estructural.id,
          profundidad: estructural.profundidad + 1,
        });
        temp.set(o.ref_temporal, nuevo);
        if (padre && padre.id !== estructural.id)
          await arista(padre.id, nuevo, "subtema", "ia");
        aplicadas.push(o);
      } else if (o.op === "relacionar") {
        const a = id(o.origen),
          b = id(o.destino);
        if (!a || !b || a === b) {
          no("Nodo inexistente o relación consigo mismo");
          continue;
        }
        await arista(a, b, o.tipo, "ia");
        aplicadas.push(o);
      } else if (o.op === "editar_nodo") {
        const n = id(o.nodo);
        if (!n) {
          no("Nodo inexistente");
          continue;
        }
        await m.query(
          "INSERT INTO revisiones_nodo(id,nodo_id,titulo,contenido,por) SELECT $1,id,titulo,contenido,'agente' FROM nodos WHERE id=$2",
          [randomUUID(), n],
        );
        await m.query(
          "UPDATE nodos SET titulo=coalesce($2,titulo),contenido=coalesce($3,contenido) WHERE id=$1",
          [n, o.titulo ?? null, o.resumen ?? null],
        );
        aplicadas.push(o);
      } else if (o.op === "enfocar") {
        const n = id(o.nodo);
        if (!n) {
          no("Nodo inexistente");
          continue;
        }
        await m.query("UPDATE actores SET foco_nodo_id=$2 WHERE id=$1", [
          actor,
          n,
        ]);
        aplicadas.push(o);
      } else {
        const destino = id(o.en);
        const origenes = o.nodos
          .map(id)
          .filter((x) => x && x !== destino) as string[];
        if (!destino || origenes.length !== o.nodos.length - 1) {
          no("Nodo inexistente");
          continue;
        }
        const [dest] = (await m.query(
          "SELECT idea_clave FROM nodos WHERE id=$1",
          [destino],
        )) as { idea_clave: string | null }[];
        // Solo se fusionan nodos sin evidencias propias distintas, sin hijos y que no sean una raíz.
        const [bloqueo] = (await m.query(
          `SELECT n.id FROM nodos n WHERE n.id = ANY($1::uuid[]) AND (
            n.padre_id IS NULL
            OR EXISTS(SELECT 1 FROM nodos h WHERE h.padre_id=n.id)
            OR EXISTS(SELECT 1 FROM rastros_error r WHERE r.nodo_retorno_id=n.id)
            OR (n.idea_clave IS NOT NULL AND n.idea_clave IS DISTINCT FROM $2))`,
          [origenes, dest?.idea_clave ?? null],
        )) as { id: string }[];
        if (bloqueo) {
          no("Un nodo tiene evidencias propias, hijos o es una raíz");
          continue;
        }
        for (const x of origenes) {
          await m.query(
            "UPDATE aristas SET origen=$2 WHERE origen=$1 AND destino<>$2 AND NOT EXISTS (SELECT 1 FROM aristas z WHERE z.origen=$2 AND z.destino=aristas.destino AND z.tipo=aristas.tipo)",
            [x, destino],
          );
          await m.query(
            "UPDATE aristas SET destino=$2 WHERE destino=$1 AND origen<>$2 AND NOT EXISTS (SELECT 1 FROM aristas z WHERE z.destino=$2 AND z.origen=aristas.origen AND z.tipo=aristas.tipo)",
            [x, destino],
          );
          await m.query("DELETE FROM nodos WHERE id=$1", [x]);
          nodos.delete(x);
        }
        aplicadas.push(o);
      }
    }
    if (aplicadas.length)
      await m.query(
        "UPDATE actores SET grafo_version=grafo_version+1 WHERE id=$1",
        [actor],
      );
    return { aplicadas, rechazadas };
  }
  // Al registrar un rastro con idea clave, el sistema une un nodo `error` ya existente con el nodo de retorno.
  /**
   * Garantiza que la idea clave de un fallo exista en el mapa. Si el agente no la creó, el sistema la crea
   * desde el catálogo curado (bajo la raíz) junto con un nodo `error` y su arista `confusion_con`.
   * Es idempotente: reutiliza la idea y el error si ya existen. Devuelve el nodo de retorno.
   */
  async asegurarRetorno(
    m: EntityManager,
    actor: string,
    arbolId: string,
    ideaClave: string,
    respuesta: string,
  ): Promise<string | null> {
    const catalogo = ideaPorClave(ideaClave);
    if (!catalogo) return null;
    const [existente] = (await m.query(
      "SELECT id FROM nodos WHERE arbol_id=$1 AND idea_clave=$2 AND tipo<>'error' ORDER BY created_at DESC,profundidad DESC LIMIT 1",
      [arbolId, ideaClave],
    )) as { id: string }[];
    if (existente) return existente.id;
    const [raiz] = (await m.query(
      "SELECT id,profundidad FROM nodos WHERE arbol_id=$1 AND padre_id IS NULL",
      [arbolId],
    )) as { id: string; profundidad: number }[];
    if (!raiz) return null;
    const siguiente = async () =>
      (
        (await m.query(
          "SELECT coalesce(max(orden),-1)+1 AS next FROM nodos WHERE arbol_id=$1 AND padre_id=$2",
          [arbolId, raiz.id],
        )) as { next: number }[]
      )[0].next;
    const crear = async (
      tipo: "idea" | "error",
      titulo: string,
      contenido: string,
      ideaClaveNodo: string | null,
    ) => {
      const id = randomUUID();
      await m.query(
        "INSERT INTO nodos(id,arbol_id,padre_id,profundidad,orden,tipo,titulo,contenido,procedencia,prompt_version,citas,idea_clave) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'[]',$11)",
        [
          id,
          arbolId,
          raiz.id,
          raiz.profundidad + 1,
          await siguiente(),
          tipo,
          titulo,
          contenido,
          PROCEDENCIA_SISTEMA,
          "sistema-v1",
          ideaClaveNodo,
        ],
      );
      return id;
    };
    const palabras = catalogo.clave.replace(/-/g, " ");
    const idea = await crear(
      "idea",
      palabras.charAt(0).toUpperCase() + palabras.slice(1),
      catalogo.descripcion,
      ideaClave,
    );
    const texto = respuesta.trim().slice(0, 60);
    const error = await crear(
      "error",
      `Respondiste ${texto}`,
      `Tu respuesta fue ${texto}. Revisa la idea «${catalogo.descripcion}»`,
      null,
    );
    await m.query(
      "INSERT INTO aristas(id,actor_id,origen,destino,tipo,creada_por) VALUES($1,$2,$3,$4,'confusion_con','sistema') ON CONFLICT DO NOTHING",
      [randomUUID(), actor, error, idea],
    );
    await m.query(
      "UPDATE actores SET grafo_version=grafo_version+1 WHERE id=$1",
      [actor],
    );
    return idea;
  }
  async vincularConfusion(
    m: EntityManager,
    actor: string,
    ideaClave: string,
    nodoRetorno: string | null,
  ) {
    if (!nodoRetorno) return;
    await m.query(
      `INSERT INTO aristas(id,actor_id,origen,destino,tipo,creada_por)
       SELECT gen_random_uuid(),$1,e.id,$3,'confusion_con','sistema' FROM nodos e JOIN arboles a ON a.id=e.arbol_id
       WHERE a.actor_id=$1 AND e.tipo='error' AND e.idea_clave=$2 AND e.id<>$3
       ON CONFLICT DO NOTHING`,
      [actor, ideaClave, nodoRetorno],
    );
  }
  async marcarSenal(
    m: EntityManager,
    actor: string,
    arbolId: string,
    ideaClave: string,
  ) {
    await m.query(
      "UPDATE nodos SET senal='posible_confusion' WHERE id=(SELECT id FROM nodos WHERE arbol_id=$1 AND idea_clave=$2 ORDER BY created_at DESC,profundidad DESC LIMIT 1)",
      [arbolId, ideaClave],
    );
    await m.query(
      "UPDATE actores SET grafo_version=grafo_version+1 WHERE id=$1",
      [actor],
    );
  }
}
@Controller("grafo")
export class GrafoController {
  constructor(@Inject(GrafoService) private s: GrafoService) {}
  @Get() obtener(@Req() r: ActorRequest) {
    return this.s.obtener(r.actorId);
  }
}
