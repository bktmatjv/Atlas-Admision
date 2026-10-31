import { lazy, Suspense, useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Circle,
  Info,
  List,
  Network,
  TriangleAlert,
} from "lucide-react";
import { MathMarkdown } from "@/components/shared/MathMarkdown";
import {
  ESTADO_COLOR,
  ESTADO_GLIFO,
  ESTADO_TEXTO,
  TIPO_ARISTA_TEXTO,
  aristasCamino,
  descripcionNodo,
  jerarquia,
  radioNodo,
  textoEstado,
  type Estado,
  type Grafo,
  type NodoArbol,
} from "@/lib/tutor/grafo";
import { buscarNodos, disponerMapa } from "@/lib/tutor/presentacion";
import { pluralizar } from "@/lib/tutor/chat";

import type { PlanRetro } from "@/lib/tutor/wow";
import { useMovimientoReducido } from "@/lib/tutor/useMovimientoReducido";
const GrafoVivo = lazy(() => import("./GrafoVivo"));
type Props = {
  grafo: Grafo;
  seleccionado: string | null;
  onSeleccionar: (id: string) => void;
  busqueda?: string;
  plan?: PlanRetro | null;
  eventoRetro?: boolean;
  onConsumirRetro?: () => void;
  demo?: boolean;
};
function Fila({ n, props }: { n: NodoArbol; props: Props }) {
  return (
    <li>
      <button
        type="button"
        className="tutor-map-list-node"
        aria-pressed={props.seleccionado === n.nodo.id}
        onClick={() => props.onSeleccionar(n.nodo.id)}
        style={{ paddingLeft: 12 + Math.min(n.profundidad, 5) * 14 }}
      >
        <span
          className="tutor-state-dot"
          style={{ background: ESTADO_COLOR[n.nodo.estado] }}
          aria-hidden="true"
        >
          {ESTADO_GLIFO[n.nodo.estado]}
        </span>
        <span>
          <strong>{n.nodo.titulo}</strong>
          <small>
            {textoEstado(n.nodo)}
            {props.grafo.foco === n.nodo.id ? " · en foco del tutor" : ""}
          </small>
        </span>
      </button>
      {n.hijos.length > 0 && (
        <ul>
          {n.hijos.map((h) => (
            <Fila key={h.nodo.id} n={h} props={props} />
          ))}
        </ul>
      )}
    </li>
  );
}
function Mapa({ grafo, seleccionado, onSeleccionar }: Props) {
  const id = useId().replace(/:/g, "");
  const layout = useMemo(
    () => disponerMapa(grafo, seleccionado),
    [grafo, seleccionado],
  );
  const pendiente = grafo.camino_error.some((id) =>
    grafo.nodos.some((n) => n.id === id && n.estado === "fallo"),
  );
  const camino = aristasCamino(pendiente ? grafo.camino_error : []);
  return (
    <div className="tutor-map-drawing">
      <svg
        viewBox="0 0 480 480"
        role="group"
        aria-label="Mapa interactivo de ideas; también disponible como lista"
      >
        <defs>
          <marker
            id={`${id}-arrow`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#b9c8d8" />
          </marker>
        </defs>
        {layout.aristas.map((a) => {
          const source = layout.nodos.find((n) => n.id === a.origen)!,
            target = layout.nodos.find((n) => n.id === a.destino)!;
          const distance =
            Math.hypot(target.x - source.x, target.y - source.y) || 1;
          const margin = target.central ? 38 : 31;
          const x2 = target.x - ((target.x - source.x) / distance) * margin,
            y2 = target.y - ((target.y - source.y) / distance) * margin;
          return (
            <path
              key={a.id}
              d={`M ${source.x} ${source.y} Q ${(source.x + x2) / 2 + 12} ${(source.y + y2) / 2 - 8} ${x2} ${y2}`}
              fill="none"
              stroke={
                camino.has(`${a.origen}>${a.destino}`) ? "#d74656" : "#bccddb"
              }
              strokeWidth="1.4"
              markerEnd={`url(#${id}-arrow)`}
            />
          );
        })}
        {layout.nodos.map((n) => {
          const r = (n.central ? 27 : 21) + (radioNodo(n.evidencias) - 6) * 0.8;
          const color = ESTADO_COLOR[n.estado];
          return (
            <g
              key={n.id}
              role="button"
              tabIndex={0}
              aria-label={descripcionNodo(n)}
              aria-pressed={seleccionado === n.id}
              onClick={() => onSeleccionar(n.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSeleccionar(n.id);
                }
              }}
              className="tutor-map-node"
              style={{ "--node-color": color } as React.CSSProperties}
            >
              <title>{descripcionNodo(n)}</title>
              <circle
                className="tutor-node-halo"
                cx={n.x}
                cy={n.y}
                r={r + 11}
                fill={color}
                opacity=".1"
              />
              <circle
                className="tutor-node-focus"
                cx={n.x}
                cy={n.y}
                r={r + 15}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                opacity=".25"
              />
              <circle
                cx={n.x}
                cy={n.y + 2}
                r={r + 3}
                fill={color}
                opacity=".12"
              />
              <circle
                cx={n.x}
                cy={n.y}
                r={r}
                fill={color}
                stroke="white"
                strokeWidth="3"
              />
              <circle
                cx={n.x}
                cy={n.y}
                r={r - 7}
                fill="none"
                stroke="white"
                strokeOpacity=".18"
              />
              {grafo.foco === n.id && (
                <circle
                  className="tc-foco-ring"
                  cx={n.x}
                  cy={n.y}
                  r={r + 11}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
              )}
              {n.senal && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r + 7}
                  fill="none"
                  stroke="#b07618"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />
              )}
              <text
                x={n.x}
                y={n.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill={n.estado === "sin_explorar" ? "#172033" : "white"}
                fontSize={n.central ? 27 : 21}
                fontWeight="600"
                aria-hidden="true"
              >
                {ESTADO_GLIFO[n.estado]}
              </text>
              <foreignObject
                x={n.x - 69}
                y={n.y + r + 12}
                width="138"
                height="65"
              >
                <div
                  className={`tutor-map-label${n.central ? " tutor-map-label--central" : ""}`}
                >
                  {n.titulo}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
      {layout.omitidos > 0 && (
        <p className="tutor-map-scope">
          Vista de relaciones cercanas ·{" "}
          {pluralizar(
            layout.omitidos,
            "idea más disponible",
            "ideas más disponibles",
          )}{" "}
          en la lista.
        </p>
      )}
    </div>
  );
}
function Detalle({ grafo, seleccionado }: Props) {
  const [tab, setTab] = useState("resumen");
  const tabsId = useId();
  const n =
    grafo.nodos.find((n) => n.id === seleccionado) ??
    grafo.nodos.find((n) => n.id === grafo.foco) ??
    grafo.nodos[0];
  useEffect(() => setTab("resumen"), [n?.id]);
  if (!n) return null;
  const relaciones = grafo.aristas
    .filter((a) => a.origen === n.id || a.destino === n.id)
    .map((a) => ({
      tipo: TIPO_ARISTA_TEXTO[a.tipo] ?? a.tipo,
      nodo: grafo.nodos.find(
        (x) => x.id === (a.origen === n.id ? a.destino : a.origen),
      ),
    }))
    .filter((a) => a.nodo);
  const tabs = [
    { id: "resumen", nombre: "Resumen" },
    { id: "evidencia", nombre: "Evidencia" },
    { id: "ejercicios", nombre: "Ejercicios" },
  ];
  return (
    <article
      className="tutor-node-detail"
      aria-label="Detalle de la idea seleccionada"
    >
      <header>
        <span
          className="tutor-detail-orb"
          style={
            { "--node-color": ESTADO_COLOR[n.estado] } as React.CSSProperties
          }
          aria-hidden="true"
        >
          {ESTADO_GLIFO[n.estado]}
        </span>
        <h3>{n.titulo}</h3>
        {grafo.foco === n.id && (
          <span className="tc-foco-badge">En foco del tutor</span>
        )}
      </header>
      <div
        className="tutor-detail-tabs"
        role="tablist"
        aria-label="Información de la idea"
      >
        {tabs.map((t, i) => (
          <button
            role="tab"
            type="button"
            id={`${tabsId}-${t.id}`}
            aria-controls={`${tabsId}-panel`}
            aria-selected={tab === t.id}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? 2
                      : (i + (e.key === "ArrowRight" ? 1 : 2)) % 3;
                setTab(tabs[next].id);
                document.getElementById(`${tabsId}-${tabs[next].id}`)?.focus();
              }
            }}
            key={t.id}
          >
            {t.nombre}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${tabsId}-panel`}
        aria-labelledby={`${tabsId}-${tab}`}
        tabIndex={0}
        className="tutor-detail-content"
      >
        {tab === "resumen" && (
          <>
            <MathMarkdown content={n.resumen} />
            <p className="tutor-detail-note">Procedencia: {n.origen}</p>
            {n.senal && (
              <p className="tutor-provisional">
                <TriangleAlert size={15} />
                Posible confusión: es una lectura provisional, no un
                diagnóstico.
              </p>
            )}
            {relaciones.length > 0 && (
              <div className="tutor-related">
                <h4>Se conecta con</h4>
                <ul>
                  {relaciones.slice(0, 3).map((r, i) => (
                    <li key={i}>
                      {r.tipo}: {r.nodo!.titulo}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {tab === "evidencia" && (
          <>
            <h4>¿Qué permite observar?</h4>
            <p>
              <strong>{n.evidencias}</strong>{" "}
              {n.evidencias === 1
                ? "registro vinculado"
                : "registros vinculados"}{" "}
              a esta idea.
            </p>
            <p>
              El estado se calcula en el servidor a partir de tus actividades y
              revisiones; no lo decide la IA.
            </p>
            <p className="tutor-detail-note">
              Leer una explicación o abrir un nodo no demuestra que sepas
              aplicarlo sin ayuda. Tampoco este estado certifica dominio.
            </p>
          </>
        )}
        {tab === "ejercicios" && (
          <>
            <h4>De entender a aplicar</h4>
            <p>
              Abre esta exploración para practicar o solicitar una comprobación
              disponible del concepto.
            </p>
            <p className="tutor-detail-note">
              Las comprobaciones sin ayuda son distintas de practicar acompañado
              por el tutor.
            </p>
            <Link
              className="tutor-button tutor-button--secondary"
              to={`/aprender/${n.arbol_id}`}
            >
              Ver la exploración <ArrowRight size={16} />
            </Link>
          </>
        )}
      </div>
      <div className="tutor-node-state">
        <h4>Tu estado</h4>
        <span className={`tutor-state-pill tutor-state-pill--${n.estado}`}>
          {n.estado === "aplicado" ? <Check size={14} /> : <Circle size={12} />}{" "}
          {textoEstado(n)}
        </span>
        <small>
          {n.evidencias}{" "}
          {n.evidencias === 1 ? "registro asociado" : "registros asociados"} ·
          sin porcentaje de comprensión
        </small>
      </div>
      <Link
        className="tutor-button tutor-explore-button"
        to={`/aprender/${n.arbol_id}`}
      >
        Explorar este tema <ArrowRight size={17} />
      </Link>
    </article>
  );
}
export function GrafoComprension(props: Props) {
  const [lista, setLista] = useState(false);
  const [reproduccion, setReproduccion] = useState(0);
  const reducido = useMovimientoReducido();
  const { eventoRetro, plan, onConsumirRetro } = props;
  useEffect(() => {
    if (eventoRetro && plan) {
      setLista(false);
      setReproduccion((v) => v + 1);
      onConsumirRetro?.();
    }
  }, [eventoRetro, plan, onConsumirRetro]);
  const found = buscarNodos(props.grafo.nodos, props.busqueda ?? "");
  const buscando = Boolean(props.busqueda?.trim());
  return (
    <div className="tutor-map">
      {props.plan && (
        <div className="tw-retro" aria-live="polite">
          <span className="tw-eyebrow">EL ERROR ES INFORMACIÓN</span>
          <strong>Tu error apunta a: {props.plan.titulo}</strong>
          <span>↩ Volver aquí · una idea concreta para revisar</span>
          <button
            type="button"
            className="tc-btn tc-btn--line"
            onClick={() => {
              setLista(false);
              setReproduccion((v) => v + 1);
            }}
          >
            Ver cómo viajó el error
          </button>
        </div>
      )}
      <div className="tutor-map-tools">
        <ul className="tutor-map-legend" aria-label="Leyenda de estados">
          {(Object.keys(ESTADO_TEXTO) as Estado[]).map((e) => (
            <li key={e}>
              <span style={{ background: ESTADO_COLOR[e] }} />
              {ESTADO_TEXTO[e]}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="tutor-button tutor-button--quiet"
          aria-pressed={lista}
          onClick={() => setLista(!lista)}
        >
          {lista ? <Network size={16} /> : <List size={16} />}{" "}
          {lista ? "Ver como mapa" : "Ver como lista"}
        </button>
      </div>
      <details className="tutor-map-help">
        <summary>
          <Info size={14} />
          Tamaño: registros de evidencia
        </summary>
        <p>
          Los nodos crecen con los registros asociados, no con un porcentaje de
          aprendizaje. Un borde punteado señala una posible confusión, aún
          provisional. La lista ofrece todas las ideas y funciona con teclado.
        </p>
      </details>
      {!props.grafo.nodos.length ? (
        <div className="tutor-map-empty">
          <Network size={46} strokeWidth={1} />
          <h3>Una buena pregunta abre un camino.</h3>
          <p>
            Cuando explores una idea con el tutor, aparecerá aquí. Sus
            conexiones se construyen con tu conversación; sus estados, con lo
            que haces.
          </p>
        </div>
      ) : (
        <div
          className={`tutor-map-workspace${lista || buscando ? " tutor-map-workspace--list" : ""}`}
        >
          <div className="tutor-map-surface">
            {lista || buscando ? (
              <div className="tutor-map-list" aria-label="Mapa en lista">
                {buscando ? (
                  <>
                    <p className="tutor-search-count">
                      {found.length}{" "}
                      {found.length === 1
                        ? "idea encontrada"
                        : "ideas encontradas"}
                    </p>
                    <ul>
                      {found.map((n) => (
                        <Fila
                          key={n.id}
                          n={{ nodo: n, hijos: [], profundidad: 0 }}
                          props={props}
                        />
                      ))}
                    </ul>
                  </>
                ) : (
                  <ul aria-label="Nodos del mapa de comprensión">
                    {jerarquia(props.grafo).map((n) => (
                      <Fila key={n.nodo.id} n={n} props={props} />
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <Suspense fallback={<Mapa {...props} />}>
                <GrafoVivo
                  grafo={props.grafo}
                  seleccionado={props.seleccionado}
                  onSeleccionar={props.onSeleccionar}
                  plan={props.plan ?? null}
                  reproduccion={reproduccion}
                  reducido={reducido}
                  demo={props.demo}
                />
              </Suspense>
            )}
          </div>
          <Detalle {...props} />
        </div>
      )}
    </div>
  );
}
export default GrafoComprension;
