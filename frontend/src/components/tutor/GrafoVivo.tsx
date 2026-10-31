import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph, {
  type ForceGraphMethods,
  type LinkObject,
  type NodeObject,
} from "react-force-graph-2d";
import {
  ESTADO_COLOR,
  ESTADO_GLIFO,
  radioNodo,
  type Grafo,
  type NodoGrafo,
} from "@/lib/tutor/grafo";
import type { PlanRetro } from "@/lib/tutor/wow";
type Nodo = NodoGrafo & { x: number; y: number; fx: number; fy: number };
type Enlace = { id: string; tipo: string };
/** Canvas diferido. Posiciones fijas: sin simulación continua ni mutaciones sobre datos de React Query.
 * APIs verificadas en react-force-graph README: emitParticle, centerAt, zoom y autoPauseRedraw. */
export default function GrafoVivo({
  grafo,
  seleccionado,
  onSeleccionar,
  plan,
  reproduccion,
  demo = false,
  reducido,
}: {
  grafo: Grafo;
  seleccionado: string | null;
  onSeleccionar: (id: string) => void;
  plan: PlanRetro | null;
  reproduccion: number;
  demo?: boolean;
  reducido: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const ref = useRef<ForceGraphMethods<Nodo, Enlace>>();
  const [width, setWidth] = useState(400);
  const anchoActual = useRef(width);
  anchoActual.current = width;
  const [animando, setAnimando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const comienzo = useRef(0);
  const anterior = useRef<PlanRetro | null>(plan);
  const ejecutada = useRef(0);
  const factor = demo ? 1.25 : 1;
  const [tinta, setTinta] = useState({
    texto: "#f3e8db",
    error: "#f18a8a",
    borde: "#746775",
  });
  const data = useMemo(
    () => ({
      nodes: grafo.nodos.map((n, i) => {
        const ring = Math.floor((i - 1) / 8) + 1;
        const angulo =
          (((i - 1) % 8) * Math.PI) / 4 - Math.PI / 2 + ring * 0.15;
        const x = i === 0 ? 0 : Math.cos(angulo) * ring * 180;
        const y = i === 0 ? 0 : Math.sin(angulo) * ring * 160;
        return { ...n, x, y, fx: x, fy: y };
      }),
      links: grafo.aristas
        .filter(
          (a) =>
            grafo.nodos.some((n) => n.id === a.origen) &&
            grafo.nodos.some((n) => n.id === a.destino),
        )
        .map((a) => {
          const t = plan?.tramos.find((t) => t.arista === a.id);
          return {
            id: a.id,
            tipo: a.tipo,
            source: t?.desde ?? a.origen,
            target: t?.hasta ?? a.destino,
          };
        }),
    }),
    [grafo, plan],
  );
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(100, entry.contentRect.width)),
    );
    observer.observe(root.current);
    const refresh = () => {
      const css = getComputedStyle(root.current!);
      setTinta({
        texto: css.color,
        error: `hsl(${css.getPropertyValue("--tc-no")})`,
        borde: `hsl(${css.getPropertyValue("--muted-foreground")} / .4)`,
      });
    };
    refresh();
    const theme = new MutationObserver(refresh);
    const layout = root.current.closest(".tutor-layout");
    if (layout)
      theme.observe(layout, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ["class"],
      });
    return () => {
      observer.disconnect();
      theme.disconnect();
    };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => ref.current?.zoomToFit(0, 55), 50);
    return () => window.clearTimeout(timer);
  }, [data, width]);
  useEffect(() => {
    if (anterior.current && !plan && !reducido) {
      comienzo.current = performance.now();
      setApagando(true);
      const timer = window.setTimeout(() => {
        setApagando(false);
        anterior.current = null;
      }, 250 * factor);
      return () => window.clearTimeout(timer);
    }
    anterior.current = plan;
  }, [plan, reducido, factor]);
  useEffect(() => {
    if (!plan || !reproduccion) return;
    const llegada = () => {
      const n = data.nodes.find((n) => n.id === plan.retorno);
      if (n) {
        ref.current?.centerAt(n.x, n.y, reducido ? 0 : 300 * factor);
        ref.current?.zoom(
          Math.max(0.8, Math.min(1.25, anchoActual.current / 420)),
          reducido ? 0 : 300 * factor,
        );
      }
    };
    if (reducido) {
      ejecutada.current = reproduccion;
      setAnimando(false);
      llegada();
      return;
    }
    if (ejecutada.current === reproduccion) return;
    ejecutada.current = reproduccion;
    comienzo.current = performance.now();
    setAnimando(true);
    const timers: number[] = [];
    for (const tramo of plan.tramos) {
      const link = data.links.find((a) => a.id === tramo.arista);
      if (link)
        for (let i = 0; i < 3; i++)
          timers.push(
            window.setTimeout(
              () => ref.current?.emitParticle(link),
              (tramo.inicio + i * 45) * factor,
            ),
          );
    }
    timers.push(window.setTimeout(llegada, plan.llegada * factor));
    timers.push(
      window.setTimeout(() => setAnimando(false), plan.total * factor),
    );
    return () => {
      timers.forEach(window.clearTimeout);
      setAnimando(false);
    };
  }, [reproduccion, plan, reducido, data, factor]);
  const enCamino = (id: string) =>
    (plan ?? (apagando ? anterior.current : null))?.tramos.some(
      (t) => t.arista === id,
    );
  const dibujar = (n: NodeObject<Nodo>, ctx: CanvasRenderingContext2D) => {
    const r = 15 + radioNodo(n.evidencias);
    const t = (performance.now() - comienzo.current) / factor;
    const pulso =
      animando &&
      plan &&
      ((t < plan.destello && n.id === plan.origen) ||
        (t >= plan.llegada && n.id === plan.retorno));
    const color = ESTADO_COLOR[n.estado];
    ctx.save();
    if (pulso) {
      const p = t < 400 ? t / 400 : Math.min(1, (t - 1300) / 500);
      ctx.globalAlpha = (1 - p) * 0.6;
      ctx.fillStyle = tinta.error;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + p * 32, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r + 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = n.id === seleccionado ? tinta.texto : color;
    ctx.lineWidth = n.id === seleccionado ? 2 : 1;
    if (n.senal) ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(n.x, n.y, r + 5, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `bold ${demo ? 23 : 20}px system-ui`;
    ctx.fillStyle = n.estado === "sin_explorar" ? "#172033" : "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ESTADO_GLIFO[n.estado], n.x, n.y);
    ctx.fillStyle = tinta.texto;
    ctx.font = `${demo ? 13.8 : 12}px system-ui`;
    const palabras = n.titulo.split(/\s+/);
    const lineas: string[] = [];
    let linea = "";
    for (const p of palabras) {
      if (ctx.measureText(`${linea} ${p}`).width > 135 && linea) {
        lineas.push(linea);
        linea = p;
      } else linea = `${linea} ${p}`.trim();
    }
    lineas.push(linea);
    lineas
      .slice(0, 3)
      .forEach((l, i) => ctx.fillText(l, n.x, n.y + r + 20 + i * 15));
    if (plan?.retorno === n.id && (!animando || t >= plan.llegada)) {
      ctx.fillStyle = tinta.error;
      ctx.font = "bold 12px system-ui";
      ctx.fillText("↩ Volver aquí", n.x, n.y - r - 17);
    }
    ctx.restore();
  };
  return (
    <div
      className="tw-grafo-vivo"
      ref={root}
      role="img"
      aria-label="Grafo de comprensión. Usa «Ver como lista» para seleccionar todas las ideas con teclado."
      data-animando={animando}
    >
      <ForceGraph<Nodo, Enlace>
        ref={ref}
        graphData={data}
        width={width}
        height={370}
        backgroundColor="transparent"
        cooldownTicks={0}
        warmupTicks={0}
        enableNodeDrag={false}
        autoPauseRedraw={!animando && !apagando}
        nodeCanvasObject={dibujar}
        nodeLabel={() => ""}
        nodeVal={(n) => (15 + radioNodo(n.evidencias)) ** 2 / 16}
        nodePointerAreaPaint={(n, color, ctx, escala) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, Math.max(26, 22 / escala), 0, Math.PI * 2);
          ctx.fill();
        }}
        onNodeClick={(n) => onSeleccionar(n.id)}
        linkLabel={() => ""}
        linkColor={(a) =>
          enCamino(a.id)
            ? apagando
              ? `color-mix(in srgb, ${tinta.error} ${Math.max(0, 100 - ((performance.now() - comienzo.current) / (250 * factor)) * 100)}%, ${tinta.borde})`
              : tinta.error
            : tinta.borde
        }
        linkWidth={(a) => (enCamino(a.id) ? 2.5 : 1)}
        linkDirectionalArrowLength={(a) => (enCamino(a.id) ? 5 : 0)}
        linkDirectionalParticles={0}
        linkDirectionalParticleWidth={5}
        linkDirectionalParticleColor={tinta.error}
        linkDirectionalParticleSpeed={(a) =>
          1 /
          ((Math.max(
            1,
            plan?.tramos.find((t) => t.arista === a.id)?.duracion ?? 900,
          ) *
            factor) /
            (1000 / 60))
        }
        linkDirectionalParticleCanvasObject={(x, y, a, ctx) => {
          const link = a as LinkObject<Nodo, Enlace>;
          const source = link.source as NodeObject<Nodo>,
            target = link.target as NodeObject<Nodo>;
          const angle = Math.atan2(target.y - source.y, target.x - source.x);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          const grad = ctx.createLinearGradient(-22, 0, 3, 0);
          grad.addColorStop(0, "transparent");
          grad.addColorStop(1, tinta.error);
          ctx.fillStyle = grad;
          ctx.fillRect(-22, -2, 25, 4);
          ctx.restore();
        }}
      />
    </div>
  );
}
