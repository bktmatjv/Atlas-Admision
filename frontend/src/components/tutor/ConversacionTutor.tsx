import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Lightbulb,
  TriangleAlert,
} from "lucide-react";
import { MathMarkdown } from "@/components/shared/MathMarkdown";
import { Ilustracion } from "@/components/arcade/Ilustracion";
import { ApiError } from "@/integrations/api/client";
import type { Bloque, Conversacion } from "@/lib/tutor/chat";
import type { Grafo, NodoGrafo } from "@/lib/tutor/grafo";
import { esArtefactoGrande, type Evidencia } from "@/lib/tutor/wow";
import { ArtefactoCompacto } from "./PanelArtefactos";
import { CaminoComprension, MomentosComprension } from "./CaminoComprension";
import { PasosAgente } from "./PasosAgente";
import {
  ComprobacionTutor,
  type ComprobacionActiva,
  type ResultadoComprobacion,
} from "./ComprobacionTutor";
import { BloqueView } from "./Bloques";
import { ComposerTutor } from "./ComposerTutor";
import { TutorAvatar } from "./TutorAvatar";
type Props = {
  conv: Conversacion;
  cargando: boolean;
  pensando: boolean;
  // Mensaje en vuelo: se muestra al instante, antes de que el servidor responda.
  pendiente: string | null;
  error: Error | null;
  onReintentar: () => void;
  borrador: string;
  onBorrador: (v: string) => void;
  onEnviar: (texto: string) => void;
  activa: { arbol_id: string } | null;
  comprobacion?: ComprobacionActiva | null;
  onActualizarComprobacion?: (resultado?: ResultadoComprobacion) => void;
  grafo?: Grafo;
  nodo?: NodoGrafo;
  evidencias?: Evidencia[];
  onAbrirArtefacto?: (bloque: Bloque) => void;
  artefactoActivo?: string;
  onRespuestaBloque?: () => void;
  demo?: boolean;
  ocupado: boolean;
  temaActual: string;
  onComprobar: () => void;
};
const esLimite = (e: Error) =>
  e instanceof ApiError && (e.status === 429 || e.status === 503);
export function ConversacionTutor(p: Props) {
  const log = useRef<HTMLDivElement>(null);
  const { mensajes } = p.conv;
  const conocidos = useRef<Set<string> | null>(null);
  const [nuevos, setNuevos] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (p.cargando) return;
    const siguientes = new Set(mensajes.map((m) => m.id));
    setNuevos(
      new Set(
        conocidos.current
          ? mensajes
              .filter((m) => !conocidos.current!.has(m.id))
              .map((m) => m.id)
          : [],
      ),
    );
    conocidos.current = siguientes;
  }, [mensajes, p.cargando]);
  const ultimaEvidenciaId = p.evidencias?.[0]?.id;
  // La última respuesta queda visible: al llegar un mensaje o empezar a pensar, baja al final.
  useEffect(() => {
    const el = log.current;
    if (!el) return;
    const reducido = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollTo?.({
      top: el.scrollHeight,
      behavior: reducido ? "auto" : "smooth",
    });
  }, [mensajes.length, p.pensando, p.pendiente, ultimaEvidenciaId]);
  const libre = !p.ocupado && !p.activa;
  const acciones = [
    {
      id: "analizar",
      icono: "lupa" as const,
      texto: "Analizar error",
      accion: () =>
        p.onEnviar(
          "Ayúdame a analizar mi error y el razonamiento que compartí, sin asumir causas que no puedas observar.",
        ),
    },
    {
      id: "explicar",
      icono: "libro" as const,
      texto: "Explicar concepto",
      accion: () =>
        p.onEnviar(`Explícame ${p.temaActual} de una forma más sencilla.`),
    },
    {
      id: "comprobar",
      icono: "diana-flecha" as const,
      texto: "Dame una comprobación",
      accion: p.onComprobar,
    },
  ];
  return (
    <section className="tc-chat" aria-label="Conversación con el tutor">
      {p.nodo && (
        <CaminoComprension nodo={p.nodo} evidencias={p.evidencias ?? []} />
      )}
      {p.onActualizarComprobacion && (
        <ComprobacionTutor
          activa={p.comprobacion ?? null}
          onActualizar={p.onActualizarComprobacion}
        />
      )}
      {p.activa && !p.comprobacion && (
        <p className="tc-banner" role="status">
          <Lightbulb size={18} aria-hidden="true" />
          <span>
            <strong>Comprobación en curso: sin ayudas del tutor.</strong> No
            resolverá ni confirmará su resultado y no habrá prácticas.
          </span>
          <Link to={`/aprender/${p.activa.arbol_id}`}>
            Ir a la comprobación{" "}
            <ArrowRight size={14} style={{ display: "inline" }} />
          </Link>
        </p>
      )}
      {p.error && (
        <div className="tc-banner tc-banner--error" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <span>
            <strong>
              {esLimite(p.error)
                ? "El tutor no pudo responder ahora."
                : "No se pudo completar la acción."}
            </strong>{" "}
            {p.error.message}
            {p.borrador || p.pendiente
              ? " Tu mensaje quedó guardado: puedes reintentar."
              : ""}
          </span>
          <button type="button" onClick={p.onReintentar} disabled={p.pensando}>
            Reintentar
          </button>
        </div>
      )}
      <div
        ref={log}
        className="tc-log"
        role="log"
        aria-live="polite"
        aria-label="Mensajes de la charla"
      >
        {p.cargando && (
          <p role="status" className="tc-note">
            Cargando tu conversación…
          </p>
        )}
        {!p.cargando && mensajes.length === 0 && !p.pendiente && (
          <div className="tc-empty">
            <strong>Tu espacio para preguntar</strong>
            <span>
              Cuéntame qué quieres entender y cómo pensaste tu ejercicio.
            </span>
          </div>
        )}
        {mensajes.map((m) => (
          <div
            key={m.id}
            className={`tc-msg tc-msg--${m.rol}${nuevos.has(m.id) ? " tw-msg--nuevo" : ""}`}
          >
            {m.rol === "tutor" ? (
              <TutorAvatar
                small
                estado={
                  p.nodo?.estado === "fallo"
                    ? "atento"
                    : p.nodo?.estado === "aplicado"
                      ? "celebrando"
                      : "reposo"
                }
              />
            ) : (
              <span className="tc-me" aria-hidden="true">
                Tú
              </span>
            )}
            <div className="tc-msg-body">
              {m.rol === "tutor" && (
                <PasosAgente
                  pasos={m.pasos}
                  nuevo={nuevos.has(m.id)}
                  demo={p.demo}
                />
              )}
              <div className="tc-bubble">
                <span className="tc-who">
                  {m.rol === "tutor" ? "Tu tutor CALIBRA" : "Tú"}
                </span>
                {m.rol === "tutor" ? (
                  <MathMarkdown content={m.texto} />
                ) : (
                  m.texto
                )}
              </div>
              {m.degradado && (
                <p className="tc-note" role="status">
                  Respondí solo con texto esta vez: no pude preparar ejercicios
                  ni cambios en el mapa.
                </p>
              )}
              {m.rol === "tutor" &&
                m.bloques.map((b, i) => (
                  <div
                    key={b.id}
                    className={`tw-pieza${i === 0 ? " tw-pieza--principal" : ""}`}
                    style={{
                      animationDelay: `${(i + 1) * 100 * (p.demo ? 1.25 : 1)}ms`,
                    }}
                  >
                    {p.onAbrirArtefacto && esArtefactoGrande(b) ? (
                      <ArtefactoCompacto
                        bloque={b}
                        activo={p.artefactoActivo === b.id}
                        onAbrir={() => p.onAbrirArtefacto!(b)}
                      />
                    ) : (
                      <BloqueView
                        bloque={b}
                        arbolId={p.conv.arbol_id}
                        comprobando={!!p.activa}
                        alResponder={(t) => {
                          p.onRespuestaBloque?.();
                          if (t) p.onEnviar(t);
                        }}
                        onComprobar={p.onComprobar}
                      />
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
        <MomentosComprension
          grafo={p.grafo}
          evidencias={p.evidencias}
          arbolId={p.conv.arbol_id}
        />
        {p.pendiente && (
          <div className="tc-msg tc-msg--estudiante">
            <span className="tc-me" aria-hidden="true">
              Tú
            </span>
            <div className="tc-msg-body">
              <div className="tc-bubble">
                <span className="tc-who">Tú</span>
                {p.pendiente}
              </div>
            </div>
          </div>
        )}
        {p.pensando && (
          <div className="tc-msg">
            <TutorAvatar small estado="pensando" />
            <p role="status" className="tc-thinking">
              <span />
              <span />
              <span />
              <span className="sr-only">El tutor está pensando…</span>
            </p>
          </div>
        )}
      </div>
      <div className="tc-actions" role="group" aria-label="Acciones rápidas">
        {acciones.map((a) => (
          <button
            key={a.id}
            type="button"
            className="tc-chip"
            disabled={!libre}
            onClick={a.accion}
          >
            <Ilustracion nombre={a.icono} className="tc-chip-dibujo" sizes="32px" />
            {a.texto}
          </button>
        ))}
      </div>
      <ComposerTutor
        id="tc-mensaje"
        etiqueta="Tu mensaje"
        valor={p.borrador}
        onCambio={p.onBorrador}
        onEnviar={() => p.onEnviar(p.borrador.trim())}
        ocupado={p.ocupado}
        placeholder="Escribe tu mensaje…"
      />
    </section>
  );
}
