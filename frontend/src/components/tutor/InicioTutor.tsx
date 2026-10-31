import { useRef } from "react";
import {
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import {
  INTENCIONES,
  type Intencion,
  type OpcionDeContexto,
  type TemaId,
  type TemaOrdenado,
} from "@/lib/tutor/inicio";
import { ComposerTutor, type ComposerRef } from "./ComposerTutor";
import { Ilustracion, type IdIlustracion } from "@/components/arcade/Ilustracion";
const ICONO_INTENCION: Record<Intencion["id"], IdIlustracion> = {
  duda: "conversacion",
  analizar: "diana-flecha",
  practicar: "pila-de-libros",
  grafo: "mapa-mental",
};
const ICONO_TEMA: Record<TemaId, IdIlustracion> = {
  porcentajes: "grafico-circular",
  proporciones: "balanza",
  fracciones: "fracciones",
};
type Props = {
  temas: TemaOrdenado[];
  contextos: OpcionDeContexto[];
  contextoClave: string;
  onContexto: (clave: string) => void;
  valor: string;
  onCambio: (v: string) => void;
  onEnviar: () => void;
  onIntencion: (i: Intencion) => void;
  intencionActiva: Intencion["id"] | null;
  ocupado: boolean;
  error: string | null;
  onReintentar: () => void;
};
// Pantalla inicial chat primero: sin temas, adjuntos ni acciones que el sistema no soporta.
export function InicioTutor(p: Props) {
  const compositor = useRef<ComposerRef>(null);
  const temaElegido = p.contextoClave.startsWith("tema:")
    ? p.contextoClave.slice(5)
    : null;
  return (
    <section className="tc-home" aria-labelledby="tc-titulo">
      <div className="tc-home-inner">
        <h1 id="tc-titulo">
          ¿Qué quieres <em>aprender</em> hoy?
        </h1>
        <p className="tc-home-sub">
          Conversa con tu tutor, resuelve dudas y entiende por qué fallas, no
          solo cómo resolver.
        </p>
        <ul className="tc-cards" aria-label="¿Cómo quieres empezar?">
          {INTENCIONES.map((i) => {
            return (
              <li key={i.id}>
                <button
                  type="button"
                  className="tc-card"
                  aria-pressed={p.intencionActiva === i.id}
                  disabled={p.ocupado}
                  onClick={() => {
                    p.onIntencion(i);
                    if (i.accion === "texto") compositor.current?.enfocar();
                  }}
                >
                  <Ilustracion nombre={ICONO_INTENCION[i.id]} className="tc-card-dibujo" sizes="56px" />
                  <strong>{i.titulo}</strong>
                  <span>{i.descripcion}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="tc-temas">
          <h2 className="tc-temas-title">
            <TrendingUp size={19} aria-hidden="true" />
            Temas recomendados para ti
          </h2>
          <ul className="tc-chips">
            {p.temas.map((t) => {
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    className="tc-chip"
                    aria-pressed={temaElegido === t.id}
                    disabled={p.ocupado}
                    onClick={() =>
                      p.onContexto(temaElegido === t.id ? "" : `tema:${t.id}`)
                    }
                  >
                    <Ilustracion nombre={ICONO_TEMA[t.id]} className="tc-chip-dibujo" sizes="32px" />
                    {t.nombre}
                    {t.pendiente && <small>Para revisar</small>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <ComposerTutor
          ref={compositor}
          id="tc-inicio-mensaje"
          etiqueta="Tu primer mensaje"
          valor={p.valor}
          onCambio={p.onCambio}
          onEnviar={p.onEnviar}
          ocupado={p.ocupado}
          placeholder="Cuéntame qué quieres aprender o pega un ejercicio…"
          contextos={p.contextos}
          contextoClave={p.contextoClave}
          onContexto={p.onContexto}
        />
        {p.ocupado && (
          <p role="status" className="tc-note" style={{ marginTop: 12 }}>
            Tu tutor está preparando la primera respuesta…
          </p>
        )}
        {p.error && (
          <div role="alert" className="tc-error-note">
            <TriangleAlert
              size={17}
              aria-hidden="true"
              style={{ display: "inline" }}
            />{" "}
            {p.error}{" "}
            <button
              type="button"
              className="tc-btn tc-btn--line"
              onClick={p.onReintentar}
              disabled={p.ocupado}
            >
              Reintentar
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
