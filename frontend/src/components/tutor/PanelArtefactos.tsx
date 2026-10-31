import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  nombreTransicion,
  transicionArtefacto,
} from "@/lib/tutor/transiciones";
import { ArrowUpRight, Maximize2, Minimize2, Network, X } from "lucide-react";
import type { Bloque } from "@/lib/tutor/chat";
import { tituloAccesible } from "@/lib/tutor/chat";
import { limitarAnchoPanel } from "@/lib/tutor/wow";

export function ArtefactoCompacto({
  bloque,
  activo,
  onAbrir,
}: {
  bloque: Bloque;
  activo: boolean;
  onAbrir: () => void;
}) {
  return (
    <button
      id={`abrir-${bloque.id}`}
      type="button"
      className={`tw-compacto tw-compacto--${bloque.tipo}`}
      onClick={onAbrir}
      aria-label={`Abrir ${tituloAccesible(bloque.tipo)} en el panel`}
      aria-expanded={activo}
      style={{ viewTransitionName: "none" }}
    >
      <span className="tw-compacto-icono">
        <ArrowUpRight size={22} />
      </span>
      <span>
        <small>
          {bloque.tipo === "visual"
            ? "CUENTAS VERIFICADAS"
            : "EXPLORAR EL RAZONAMIENTO"}
        </small>
        <strong>{tituloAccesible(bloque.tipo)}</strong>
        <span>{activo ? "Abierto en tu espacio" : "Abrir en tu espacio"}</span>
      </span>
      <ArrowUpRight size={18} aria-hidden="true" />
    </button>
  );
}
export function PanelArtefactos({
  ancho,
  onAncho,
  activo,
  onActivo,
  bloques,
  onCerrarTab,
  onCerrar,
  grafo,
  children,
}: {
  ancho: number;
  onAncho: (n: number) => void;
  activo: string;
  onActivo: (id: string) => void;
  bloques: Bloque[];
  onCerrarTab: (id: string) => void;
  onCerrar: () => void;
  grafo: ReactNode;
  children: ReactNode;
}) {
  const [maximo, setMaximo] = useState(false);
  const [altura, setAltura] = useState<"media" | "completa">("media");
  const inicio = useRef<number | null>(null);
  const panel = useRef<HTMLElement>(null);
  const uid = useId();
  const tabs = [
    { id: "grafo", titulo: "Grafo de comprensión" },
    ...bloques.map((b) => ({ id: b.id, titulo: tituloAccesible(b.tipo) })),
  ];
  useEffect(() => {
    panel.current
      ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activo]);
  return (
    <>
      <div
        className="tw-divisor"
        role="separator"
        tabIndex={0}
        aria-label="Ancho del panel de artefactos"
        aria-orientation="vertical"
        aria-valuemin={30}
        aria-valuemax={68}
        aria-valuenow={Math.round(ancho)}
        aria-controls={`${uid}-panel`}
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            onAncho(
              e.key === "Home"
                ? 30
                : e.key === "End"
                  ? 68
                  : limitarAnchoPanel(ancho + (e.key === "ArrowLeft" ? 2 : -2)),
            );
          }
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const r = e.currentTarget.parentElement!.getBoundingClientRect();
          onAncho(limitarAnchoPanel(((r.right - e.clientX) / r.width) * 100));
        }}
        onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
      >
        <span />
      </div>
      <aside
        id={`${uid}-panel`}
        ref={panel}
        className={`tw-panel${maximo ? " tw-panel--maximo" : ""} tw-panel--${altura}`}
        aria-label="Tu espacio de comprensión"
        onKeyDown={(e) => {
          if (e.key === "Escape") onCerrar();
        }}
      >
        <div
          className="tw-sheet-handle"
          role="slider"
          tabIndex={0}
          aria-label="Altura del panel móvil"
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={2}
          aria-valuenow={altura === "completa" ? 2 : 1}
          aria-valuetext={altura === "completa" ? "Completa" : "Media"}
          onKeyDown={(e) => {
            if (["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              if (
                e.key === "Home" ||
                (e.key === "ArrowDown" && altura === "media")
              )
                onCerrar();
              else setAltura(e.key === "ArrowDown" ? "media" : "completa");
            }
          }}
          onPointerDown={(e) => {
            inicio.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (inicio.current === null) return;
            panel.current?.style.setProperty(
              "--sheet-drag",
              `${Math.max(-180, Math.min(260, e.clientY - inicio.current))}px`,
            );
          }}
          onPointerUp={(e) => {
            const delta = e.clientY - (inicio.current ?? e.clientY);
            inicio.current = null;
            panel.current?.style.removeProperty("--sheet-drag");
            if (delta > 100 && altura === "media") onCerrar();
            else if (delta > 60) setAltura("media");
            else if (delta < -40) setAltura("completa");
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            inicio.current = null;
            panel.current?.style.removeProperty("--sheet-drag");
          }}
        >
          <span />
          <small>Desliza o usa ↑ ↓</small>
        </div>
        <header className="tw-panel-header">
          <div>
            <span className="tw-eyebrow">CONECTA LAS IDEAS</span>
            <h2>Tu espacio de comprensión</h2>
          </div>
          <button
            type="button"
            className="tc-icon-btn tw-maximo"
            aria-label={maximo ? "Restaurar panel" : "Maximizar panel"}
            onClick={() => setMaximo((v) => !v)}
          >
            {maximo ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
          <button
            type="button"
            className="tc-icon-btn"
            aria-label="Cerrar panel"
            onClick={onCerrar}
          >
            <X size={19} />
          </button>
        </header>
        <div
          className="tw-tabs"
          role="tablist"
          aria-label="Artefactos abiertos"
        >
          {tabs.map((t, i) => (
            <div className="tw-tab-wrap" key={t.id}>
              <button
                type="button"
                role="tab"
                id={`${uid}-tab-${t.id}`}
                aria-selected={activo === t.id}
                aria-controls={`${uid}-contenido`}
                tabIndex={activo === t.id ? 0 : -1}
                onClick={() => transicionArtefacto(() => onActivo(t.id))}
                onKeyDown={(e) => {
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                  ) {
                    e.preventDefault();
                    const next =
                      e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? tabs.length - 1
                          : (i +
                              (e.key === "ArrowRight" ? 1 : tabs.length - 1)) %
                            tabs.length;
                    onActivo(tabs[next].id);
                    document
                      .getElementById(`${uid}-tab-${tabs[next].id}`)
                      ?.focus();
                  }
                }}
              >
                {t.id === "grafo" && <Network size={15} aria-hidden="true" />}
                {t.titulo}
              </button>
              {t.id !== "grafo" && (
                <button
                  type="button"
                  className="tw-tab-close"
                  aria-label={`Cerrar ${t.titulo}`}
                  onClick={() => transicionArtefacto(() => onCerrarTab(t.id))}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`${uid}-contenido`}
          aria-labelledby={`${uid}-tab-${activo}`}
          tabIndex={0}
          className="tw-panel-body"
          style={{
            viewTransitionName:
              activo === "grafo" ? "none" : nombreTransicion(activo),
          }}
        >
          {activo === "grafo" ? grafo : children}
        </div>
        <footer className="tw-panel-footer">
          <span>La IA propone. El sistema verifica.</span>
          <span>Leer ≠ aplicar</span>
        </footer>
      </aside>
    </>
  );
}
