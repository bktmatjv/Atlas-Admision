import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { Link } from "react-router-dom";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import {
  ESTADO_COLOR,
  ESTADO_GLIFO,
  ESTADO_TEXTO,
  TIPO_ARISTA_TEXTO,
  aristasCamino,
  descripcionNodo,
  jerarquia,
  radioNodo,
  type Estado,
  type Grafo,
  type NodoArbol,
  type NodoGrafo,
} from "@/lib/tutor/grafo";
// La librería de canvas es pesada: solo se descarga cuando se muestra el mapa en pantallas anchas.
const ForceGraph2D = lazyWithRetry(
  () => import("react-force-graph-2d"),
) as unknown as ComponentType<Record<string, unknown>>;
type Props = {
  grafo: Grafo;
  seleccionado: string | null;
  onSeleccionar: (id: string) => void;
};
type NodoVis = NodoGrafo & { x?: number; y?: number };
function useEsMovil() {
  const consulta = "(max-width: 767px)";
  const [movil, setMovil] = useState(
    () => typeof window !== "undefined" && window.matchMedia(consulta).matches,
  );
  useEffect(() => {
    const m = window.matchMedia(consulta);
    const cambio = () => setMovil(m.matches);
    m.addEventListener("change", cambio);
    return () => m.removeEventListener("change", cambio);
  }, []);
  return movil;
}
function Fila({
  n,
  elegido,
  alElegir,
  enCamino,
}: {
  n: NodoArbol;
  elegido: string | null;
  alElegir: (id: string) => void;
  enCamino: Set<string>;
}) {
  const nodo = n.nodo;
  return (
    <li>
      <button
        type="button"
        aria-pressed={elegido === nodo.id}
        onClick={() => alElegir(nodo.id)}
        style={{ marginLeft: `${n.profundidad * 16}px` }}
        className={`flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
          elegido === nodo.id
            ? "border-primary bg-primary/10"
            : "border-border bg-background hover:bg-muted"
        }`}
      >
        <span
          aria-hidden
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: ESTADO_COLOR[nodo.estado] }}
        >
          {ESTADO_GLIFO[nodo.estado]}
        </span>
        <span className="flex-1">
          <span className="font-semibold">{nodo.titulo}</span>
          <span className="block text-xs text-muted-foreground">
            {ESTADO_TEXTO[nodo.estado]}
            {nodo.senal ? " · posible confusión (provisional)" : ""}
            {enCamino.has(nodo.id) ? " · en el camino del error" : ""}
          </span>
        </span>
      </button>
      {n.hijos.length > 0 && (
        <ul className="mt-1 space-y-1">
          {n.hijos.map((h) => (
            <Fila
              key={h.nodo.id}
              n={h}
              elegido={elegido}
              alElegir={alElegir}
              enCamino={enCamino}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
function ListaJerarquica({ grafo, seleccionado, onSeleccionar }: Props) {
  const arbol = useMemo(() => jerarquia(grafo), [grafo]);
  const enCamino = useMemo(() => new Set(grafo.camino_error), [grafo]);
  return (
    <ul className="space-y-1" aria-label="Nodos del mapa de comprensión">
      {arbol.map((n) => (
        <Fila
          key={n.nodo.id}
          n={n}
          elegido={seleccionado}
          alElegir={onSeleccionar}
          enCamino={enCamino}
        />
      ))}
    </ul>
  );
}
function Detalle({ grafo, id }: { grafo: Grafo; id: string | null }) {
  const n = grafo.nodos.find((x) => x.id === id);
  if (!n)
    return (
      <p className="text-sm text-muted-foreground">
        Elige un nodo para ver su resumen.
      </p>
    );
  const relaciones = grafo.aristas
    .filter(
      (a) =>
        a.id.startsWith("p-") === false &&
        (a.origen === n.id || a.destino === n.id),
    )
    .map((a) => {
      const otro = grafo.nodos.find(
        (x) => x.id === (a.origen === n.id ? a.destino : a.origen),
      );
      return otro
        ? `${a.origen === n.id ? "" : "← "}${TIPO_ARISTA_TEXTO[a.tipo] ?? a.tipo}: ${otro.titulo}`
        : null;
    })
    .filter(Boolean);
  return (
    <article
      className="space-y-2 rounded-xl border border-border bg-background p-4"
      aria-live="polite"
    >
      <h3 className="font-bold">{n.titulo}</h3>
      <p className="text-xs font-semibold">
        {ESTADO_GLIFO[n.estado]} {ESTADO_TEXTO[n.estado]} · {n.evidencias}{" "}
        {n.evidencias === 1 ? "evidencia" : "evidencias"}
      </p>
      {n.senal && (
        <p className="text-xs">
          Me parece que aquí podría haber una confusión. Es una lectura
          provisional: no cambia tu estado.
        </p>
      )}
      <p className="text-sm">{n.resumen}</p>
      {relaciones.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-muted-foreground">
          {relaciones.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      <Link
        className="text-sm font-semibold text-primary underline"
        to={`/aprender/${n.arbol_id}`}
      >
        Abrir esta exploración
      </Link>
    </article>
  );
}
function Leyenda() {
  return (
    <ul
      className="flex flex-wrap gap-x-4 gap-y-1 text-xs"
      aria-label="Leyenda de estados"
    >
      {(Object.keys(ESTADO_TEXTO) as Estado[]).map((e) => (
        <li key={e} className="flex items-center gap-1">
          <span
            aria-hidden
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: ESTADO_COLOR[e] }}
          >
            {ESTADO_GLIFO[e]}
          </span>
          {ESTADO_TEXTO[e]}
        </li>
      ))}
      <li>Borde punteado: posible confusión (provisional)</li>
      <li>Tamaño: evidencias</li>
    </ul>
  );
}
function MapaCanvas({ grafo, seleccionado, onSeleccionar }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(480);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const o = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    o.observe(el);
    return () => o.disconnect();
  }, []);
  const datos = useMemo(() => {
    const ids = new Set(grafo.nodos.map((n) => n.id));
    return {
      nodes: grafo.nodos.map((n) => ({ ...n })),
      links: grafo.aristas
        .filter((a) => ids.has(a.origen) && ids.has(a.destino))
        .map((a) => ({ source: a.origen, target: a.destino, tipo: a.tipo })),
    };
  }, [grafo]);
  const camino = useMemo(() => aristasCamino(grafo.camino_error), [grafo]);
  const nodosCamino = useMemo(() => new Set(grafo.camino_error), [grafo]);
  const pintar = (
    nodo: NodoVis,
    ctx: CanvasRenderingContext2D,
    escala: number,
  ) => {
    const r = radioNodo(nodo.evidencias);
    const x = nodo.x ?? 0,
      y = nodo.y ?? 0;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = ESTADO_COLOR[nodo.estado];
    ctx.fill();
    ctx.lineWidth =
      nodo.id === seleccionado ? 3 : nodosCamino.has(nodo.id) ? 2.5 : 1.5;
    ctx.strokeStyle = nodosCamino.has(nodo.id)
      ? "#dc2626"
      : nodo.id === seleccionado
        ? "#111827"
        : "#ffffff";
    if (nodo.senal) {
      ctx.setLineDash([3, 2]);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2.5;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.max(8, r)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ESTADO_GLIFO[nodo.estado], x, y);
    if (escala > 1.1 || nodo.id === seleccionado) {
      ctx.fillStyle = "#111827";
      ctx.font = `${11 / escala}px sans-serif`;
      ctx.fillText(nodo.titulo.slice(0, 28), x, y + r + 8 / escala);
    }
  };
  return (
    <div
      ref={caja}
      role="img"
      aria-label="Mapa visual de comprensión. Para recorrerlo con el teclado usa la lista de nodos."
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <Suspense fallback={<p className="p-4 text-sm">Preparando el mapa…</p>}>
        <ForceGraph2D
          graphData={datos}
          width={ancho}
          height={380}
          cooldownTicks={80}
          nodeLabel={(n: NodoVis) => descripcionNodo(n)}
          nodeCanvasObject={pintar}
          nodePointerAreaPaint={(
            n: NodoVis,
            color: string,
            ctx: CanvasRenderingContext2D,
          ) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(
              n.x ?? 0,
              n.y ?? 0,
              radioNodo(n.evidencias) + 3,
              0,
              2 * Math.PI,
            );
            ctx.fill();
          }}
          linkColor={(l: { source: { id: string }; target: { id: string } }) =>
            camino.has(`${l.source.id}>${l.target.id}`) ? "#dc2626" : "#cbd5e1"
          }
          linkWidth={(l: { source: { id: string }; target: { id: string } }) =>
            camino.has(`${l.source.id}>${l.target.id}`) ? 3 : 1
          }
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          onNodeClick={(n: NodoVis) => onSeleccionar(n.id)}
        />
      </Suspense>
    </div>
  );
}
export function GrafoComprension(props: Props) {
  const movil = useEsMovil();
  const { grafo, seleccionado } = props;
  if (grafo.nodos.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Tu mapa aparecerá aquí a medida que conversemos y explores ideas.
      </p>
    );
  return (
    <div className="space-y-3">
      <Leyenda />
      {!movil && <MapaCanvas {...props} />}
      <Detalle grafo={grafo} id={seleccionado} />
      <details open={movil}>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
          {movil ? "Mapa en lista" : "Ver los nodos como lista (teclado)"}
        </summary>
        <ListaJerarquica {...props} />
      </details>
    </div>
  );
}
export default GrafoComprension;
