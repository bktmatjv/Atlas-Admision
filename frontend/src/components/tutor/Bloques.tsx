import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CircleCheck,
  CircleX,
  Eye,
  FileText,
  Lightbulb,
  MessageCircleQuestion,
  PenLine,
  Scale,
  Search,
  Shapes,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { MathMarkdown } from "@/components/shared/MathMarkdown";
import { post, ApiError } from "@/integrations/api/client";
import {
  formatearOpcion,
  textoParaEnviar,
  tituloAccesible,
  type Bloque,
  type RespuestaBloque,
  type TipoBloque,
} from "@/lib/tutor/chat";
import { primeraDivergencia } from "@/lib/tutor/visual";
import { VisualView } from "./Visual";
import "./tutor-bloques.css";
type Props = {
  bloque: Bloque;
  arbolId: string;
  // Lo que cambia tras responder: el grafo (señales) y, si es texto libre, la charla.
  alResponder: (respuesta?: string) => void;
  comprobando: boolean;
  onComprobar: () => void;
};
const ICONOS: Record<TipoBloque, typeof Search> = {
  pregunta_socratica: MessageCircleQuestion,
  contraste: Scale,
  razonamiento_anotado: Search,
  prediccion: Eye,
  ejemplo_paso_a_paso: Lightbulb,
  visual: Shapes,
  practica: Sparkles,
  en_tus_palabras: PenLine,
  invitacion_comprobar: Target,
  cita: FileText,
};
const TITULOS_VISIBLES: Record<TipoBloque, string> = {
  pregunta_socratica: "Para pensar",
  contraste: "Tu razonamiento vs. el correcto",
  razonamiento_anotado: "La evidencia en tus pasos",
  prediccion: "Predice antes de ver",
  ejemplo_paso_a_paso: "Una idea, paso a paso",
  visual: "Visual matemático",
  practica: "Ahora, intenta aplicarlo",
  en_tus_palabras: "En tus palabras",
  invitacion_comprobar: "Ponte a prueba",
  cita: "Fuente",
};
function Tarjeta({
  tipo,
  etiqueta,
  children,
}: {
  tipo: TipoBloque;
  etiqueta?: ReactNode;
  children: ReactNode;
}) {
  const Icono = ICONOS[tipo];
  return (
    <section className={`tb tb--${tipo}`} aria-label={tituloAccesible(tipo)}>
      <header className="tb-head">
        <span className="tb-icono" aria-hidden="true">
          <Icono size={19} />
        </span>
        <h4>{TITULOS_VISIBLES[tipo]}</h4>
        {etiqueta && <span className="tb-tag">{etiqueta}</span>}
      </header>
      <div className="tb-body">{children}</div>
    </section>
  );
}
function useRespuesta(
  id: string,
  alResponder: (respuesta?: string) => void,
  reenviar = false,
) {
  const [res, setRes] = useState<RespuestaBloque | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(respuesta: string) {
    setEnviando(true);
    setError(null);
    try {
      setRes(
        await post<RespuestaBloque>(`/bloques/${id}/respuesta`, { respuesta }),
      );
      // El texto libre sigue en la charla: el tutor recibe lo que respondió el estudiante.
      alResponder(reenviar ? respuesta : undefined);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "No se pudo enviar tu respuesta.",
      );
    } finally {
      setEnviando(false);
    }
  }
  return { res, error, enviando, enviar };
}
// Lo verificado por el sistema y la lectura provisional se ven distintos.
function Resultado({
  res,
  error,
}: {
  res: RespuestaBloque | null;
  error: string | null;
}) {
  return (
    <div aria-live="polite" className="tb-resultados">
      {error && (
        <p role="alert" className="tb-res tb-res--error">
          {error}
        </p>
      )}
      {res?.correcta === true && (
        <p className="tb-res tb-res--ok tb-reveal">
          <CircleCheck size={19} aria-hidden="true" />
          <span>
            <strong>Verificado por CALIBRA: correcto.</strong>{" "}
            {res.solucion ?? ""}
          </span>
        </p>
      )}
      {res?.correcta === false && (
        <p className="tb-res tb-res--no tb-reveal">
          <CircleX size={19} aria-hidden="true" />
          <span>
            <strong>Verificado por CALIBRA: todavía no.</strong>{" "}
            {res.descripcion
              ? `Revisa esta idea: ${res.descripcion}`
              : "Revisa tu cálculo e inténtalo de nuevo."}
          </span>
        </p>
      )}
      {res?.mensaje && (
        <p className="tb-res tb-res--lectura tb-reveal">
          <Eye size={19} aria-hidden="true" />
          <span>
            <strong>Lectura provisional</strong>
            {res.mensaje}
          </span>
        </p>
      )}
      {res?.guardada && !res.mensaje && (
        <p className="tb-res tb-reveal">
          <span>Guardamos tu respuesta en la charla.</span>
        </p>
      )}
      {res && <p className="tb-nota">{res.nota}</p>}
    </div>
  );
}
function TextoLibre({
  id,
  etiqueta,
  rapidas,
  alResponder,
  grande = false,
}: {
  id: string;
  etiqueta: string;
  rapidas?: string[];
  alResponder: (respuesta?: string) => void;
  grande?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const { res, error, enviando, enviar } = useRespuesta(id, alResponder, true);
  return (
    <form
      className="tb-form"
      onSubmit={(e) => {
        e.preventDefault();
        const t = textoParaEnviar(texto);
        if (t) void enviar(t);
      }}
    >
      {rapidas && rapidas.length > 0 && (
        <div
          className="tb-rapidas"
          role="group"
          aria-label="Respuestas rápidas"
        >
          {rapidas.map((r) => (
            <button
              key={r}
              type="button"
              className="tb-chip"
              disabled={enviando}
              onClick={() => void enviar(r)}
            >
              {r}
            </button>
          ))}
        </div>
      )}
      <label className="tb-label">
        {etiqueta}
        <textarea
          value={texto}
          rows={grande ? 5 : 3}
          maxLength={2000}
          onChange={(e) => setTexto(e.target.value)}
          className="tb-textarea"
        />
      </label>
      <button className="tb-btn" disabled={enviando || !textoParaEnviar(texto)}>
        Enviar mi respuesta
      </button>
      <Resultado res={res} error={error} />
    </form>
  );
}
function Opciones({
  id,
  enunciado,
  opciones,
  alResponder,
  inmediata = false,
}: {
  id: string;
  enunciado: string;
  opciones: number[];
  alResponder: (respuesta?: string) => void;
  // Elegir una opción la envía al instante (predicción); si no, se confirma con un botón.
  inmediata?: boolean;
}) {
  const [elegida, setElegida] = useState<number | null>(null);
  const { res, error, enviando, enviar } = useRespuesta(id, alResponder);
  return (
    <form
      className="tb-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (elegida !== null) void enviar(String(elegida));
      }}
    >
      <p className="tb-enunciado">{enunciado}</p>
      <fieldset className="tb-opciones">
        <legend className="sr-only">Opciones de respuesta</legend>
        {opciones.map((o) => (
          <label
            key={o}
            className={`tb-opcion${elegida === o ? " tb-opcion--on" : ""}`}
          >
            <input
              type="radio"
              name={`op-${id}`}
              checked={elegida === o}
              disabled={enviando}
              onChange={() => {
                setElegida(o);
                if (inmediata) void enviar(String(o));
              }}
            />
            <span>{formatearOpcion(o)}</span>
          </label>
        ))}
      </fieldset>
      {!inmediata && (
        <button className="tb-btn" disabled={enviando || elegida === null}>
          Comprobar en la charla
        </button>
      )}
      <Resultado res={res} error={error} />
    </form>
  );
}
function PasoAPaso({
  id,
  pasos,
  alResponder,
}: {
  id: string;
  pasos: { texto: string; cuenta?: string }[];
  alResponder: (respuesta?: string) => void;
}) {
  const [visibles, setVisibles] = useState(1);
  return (
    <div className="tb-form">
      <ol className="tb-pasos">
        {pasos.slice(0, visibles).map((p, i) => (
          <li key={i} className="tb-reveal">
            <span className="tb-paso-n" aria-hidden="true">
              {i + 1}
            </span>
            <span>
              {p.texto}
              {p.cuenta && <code className="tb-cuenta">{p.cuenta}</code>}
            </span>
          </li>
        ))}
      </ol>
      {visibles < pasos.length ? (
        <button
          type="button"
          className="tb-btn tb-btn--suave"
          onClick={() => setVisibles(visibles + 1)}
        >
          ¿Cuál sería el siguiente? ({visibles} de {pasos.length})
        </button>
      ) : (
        <p className="tb-nota">Ya viste todos los pasos.</p>
      )}
      <TextoLibre
        id={id}
        etiqueta="Tu intento con otro ejemplo (opcional)"
        alResponder={alResponder}
      />
    </div>
  );
}
function Contraste({ tuyo, correcto }: { tuyo: string[]; correcto: string[] }) {
  const aqui = primeraDivergencia(tuyo, correcto);
  const n = Math.max(tuyo.length, correcto.length);
  return (
    <table className="tb-contraste">
      <thead>
        <tr>
          <th scope="col">Lo que hiciste</th>
          <th scope="col">Lo correcto</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: n }, (_, i) => (
          <tr key={i} className={i === aqui ? "tb-diverge" : undefined}>
            <td>
              {i === aqui && (
                <span className="tb-tag tb-tag--alerta">Aquí se separan</span>
              )}
              {tuyo[i] !== undefined && <MathMarkdown content={tuyo[i]} />}
            </td>
            <td>
              {correcto[i] !== undefined && (
                <MathMarkdown content={correcto[i]} />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
export function BloqueView({
  bloque: b,
  arbolId,
  alResponder,
  comprobando,
  onComprobar,
}: Props) {
  switch (b.tipo) {
    case "pregunta_socratica":
      return (
        <Tarjeta tipo="pregunta_socratica">
          <p className="tb-pregunta">{b.texto}</p>
          <TextoLibre
            id={b.id}
            etiqueta="O escribe tu propia respuesta"
            rapidas={b.respuestas_rapidas}
            alResponder={alResponder}
          />
        </Tarjeta>
      );
    case "contraste":
      return (
        <Tarjeta tipo="contraste">
          <Contraste tuyo={b.tuyo} correcto={b.correcto} />
        </Tarjeta>
      );
    case "razonamiento_anotado":
      return (
        <Tarjeta tipo="razonamiento_anotado">
          <ol className="tb-anotado">
            {b.pasos.map((p, i) => (
              <li
                key={i}
                className={p.estado === "ok" ? "tb-paso-ok" : "tb-paso-revisar"}
              >
                <span className="tb-marca">
                  {p.estado === "ok" ? (
                    <CircleCheck size={18} aria-hidden="true" />
                  ) : (
                    <CircleX size={18} aria-hidden="true" />
                  )}
                  {p.estado === "ok" ? "Bien" : "Para revisar"}
                </span>
                <blockquote>Escribiste: «{p.cita}»</blockquote>
                <p>{p.texto}</p>
              </li>
            ))}
          </ol>
        </Tarjeta>
      );
    case "prediccion":
      return (
        <Tarjeta tipo="prediccion">
          <p className="tb-pregunta">{b.pregunta}</p>
          <Opciones
            id={b.id}
            enunciado={b.enunciado}
            opciones={b.opciones}
            alResponder={alResponder}
            inmediata
          />
        </Tarjeta>
      );
    case "practica":
      return (
        <Tarjeta
          tipo="practica"
          etiqueta={
            <>
              <ShieldCheck size={14} aria-hidden="true" /> Verificada por
              CALIBRA
            </>
          }
        >
          {b.historia && <p className="tb-historia">{b.historia}</p>}
          <Opciones
            id={b.id}
            enunciado={b.enunciado}
            opciones={b.opciones}
            alResponder={alResponder}
          />
        </Tarjeta>
      );
    case "ejemplo_paso_a_paso":
      return (
        <Tarjeta tipo="ejemplo_paso_a_paso">
          <PasoAPaso id={b.id} pasos={b.pasos} alResponder={alResponder} />
        </Tarjeta>
      );
    case "visual":
      return (
        <Tarjeta tipo="visual" etiqueta="Cuentas verificadas">
          <VisualView v={b} />
        </Tarjeta>
      );
    case "en_tus_palabras":
      return (
        <Tarjeta tipo="en_tus_palabras">
          <p className="tb-pregunta">{b.consigna}</p>
          <TextoLibre
            id={b.id}
            etiqueta="Con tus palabras"
            alResponder={alResponder}
            grande
          />
        </Tarjeta>
      );
    case "invitacion_comprobar":
      return (
        <Tarjeta tipo="invitacion_comprobar">
          <p className="tb-pregunta">{b.texto}</p>
          {comprobando ? (
            <Link className="tb-btn tb-btn--cta" to={`/aprender/${arbolId}`}>
              Ir a mi comprobación <ArrowRight size={17} aria-hidden="true" />
            </Link>
          ) : (
            <button className="tb-btn tb-btn--cta" onClick={onComprobar}>
              Empezar comprobación sin ayudas{" "}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          )}
        </Tarjeta>
      );
    case "cita":
      return (
        <Tarjeta tipo="cita">
          <p className="tb-cita">
            <strong>{b.documento ?? "Fragmento de tu material"}</strong>
            {b.pagina ? ` · pág. ${b.pagina}` : ""}
          </p>
          <Link
            className="tb-btn tb-btn--suave"
            to={`/aprender?fragmento=${b.fragmento_id}`}
          >
            Ver el original
          </Link>
        </Tarjeta>
      );
  }
}
