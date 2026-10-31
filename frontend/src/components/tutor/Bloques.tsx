import { useState } from "react";
import { Link } from "react-router-dom";
import { post, ApiError } from "@/integrations/api/client";
import {
  formatearOpcion,
  textoParaEnviar,
  tituloAccesible,
  type Bloque,
  type RespuestaBloque,
} from "@/lib/tutor/chat";
import { VisualView } from "./Visual";
const caja = "rounded-xl border border-border bg-background p-4 space-y-3";
const boton =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50";
const secundario =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50";
type Props = {
  bloque: Bloque;
  arbolId: string;
  // Lo que cambia tras responder: el grafo (señales) y las interacciones.
  alResponder: (respuesta?: string) => void;
  comprobando: boolean;
  onComprobar: () => void;
};
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
function Resultado({
  res,
  error,
}: {
  res: RespuestaBloque | null;
  error: string | null;
}) {
  return (
    <div aria-live="polite" className="space-y-1 text-sm">
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {res?.correcta === true && (
        <p className="font-semibold">Correcto. {res.solucion ?? ""}</p>
      )}
      {res?.correcta === false && (
        <p>
          <span className="font-semibold">Todavía no. </span>
          {res.descripcion
            ? `Revisa esta idea: ${res.descripcion}`
            : "Revisa tu cálculo e inténtalo de nuevo."}
        </p>
      )}
      {res?.mensaje && <p className="font-semibold">{res.mensaje}</p>}
      {res?.guardada && !res.mensaje && (
        <p>Guardamos tu respuesta en la charla.</p>
      )}
      {res && <p className="text-xs text-muted-foreground">{res.nota}</p>}
    </div>
  );
}
function TextoLibre({
  id,
  etiqueta,
  rapidas,
  alResponder,
}: {
  id: string;
  etiqueta: string;
  rapidas?: string[];
  alResponder: (respuesta?: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const { res, error, enviando, enviar } = useRespuesta(id, alResponder, true);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const t = textoParaEnviar(texto);
        if (t) void enviar(t);
      }}
    >
      {rapidas && rapidas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rapidas.map((r) => (
            <button
              key={r}
              type="button"
              className={secundario}
              disabled={enviando}
              onClick={() => void enviar(r)}
            >
              {r}
            </button>
          ))}
        </div>
      )}
      <label className="block text-sm font-semibold">
        {etiqueta}
        <textarea
          value={texto}
          maxLength={2000}
          onChange={(e) => setTexto(e.target.value)}
          className="mt-2 min-h-20 w-full rounded-lg border bg-background p-3 font-normal"
        />
      </label>
      <button className={boton} disabled={enviando || !textoParaEnviar(texto)}>
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
}: {
  id: string;
  enunciado: string;
  opciones: number[];
  alResponder: (respuesta?: string) => void;
}) {
  const [elegida, setElegida] = useState<number | null>(null);
  const { res, error, enviando, enviar } = useRespuesta(id, alResponder);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (elegida !== null) void enviar(String(elegida));
      }}
    >
      <p>{enunciado}</p>
      <fieldset className="space-y-2">
        <legend className="sr-only">Opciones de respuesta</legend>
        {opciones.map((o) => (
          <label
            key={o}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3"
          >
            <input
              type="radio"
              name={`op-${id}`}
              checked={elegida === o}
              onChange={() => setElegida(o)}
            />
            {formatearOpcion(o)}
          </label>
        ))}
      </fieldset>
      <button className={boton} disabled={enviando || elegida === null}>
        Comprobar en la charla
      </button>
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
    <div className="space-y-3">
      <ol className="list-decimal space-y-2 pl-5">
        {pasos.slice(0, visibles).map((p, i) => (
          <li key={i}>
            {p.texto}
            {p.cuenta && (
              <code className="ml-2 rounded bg-muted px-2 py-0.5 text-sm">
                {p.cuenta}
              </code>
            )}
          </li>
        ))}
      </ol>
      {visibles < pasos.length && (
        <button
          className={secundario}
          onClick={() => setVisibles(visibles + 1)}
        >
          Mostrar el siguiente paso ({visibles} de {pasos.length})
        </button>
      )}
      <TextoLibre
        id={id}
        etiqueta="Tu intento con otro ejemplo (opcional)"
        alResponder={alResponder}
      />
    </div>
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
        <section
          className={caja}
          aria-label={tituloAccesible("pregunta_socratica")}
        >
          <p className="font-semibold">{b.texto}</p>
          <TextoLibre
            id={b.id}
            etiqueta="Tu respuesta"
            rapidas={b.respuestas_rapidas}
            alResponder={alResponder}
          />
        </section>
      );
    case "contraste":
      return (
        <section className={caja} aria-label={tituloAccesible("contraste")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <h4 className="text-sm font-bold">Lo que hiciste</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {b.tuyo.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold">Lo correcto</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {b.correcto.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      );
    case "razonamiento_anotado":
      return (
        <section
          className={caja}
          aria-label={tituloAccesible("razonamiento_anotado")}
        >
          <ol className="space-y-2">
            {b.pasos.map((p, i) => (
              <li key={i} className="rounded-lg border border-border p-3">
                <p className="text-xs italic text-muted-foreground">
                  Escribiste: «{p.cita}»
                </p>
                <p>
                  <span className="mr-2 rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
                    {p.estado === "ok" ? "Bien" : "Para revisar"}
                  </span>
                  {p.texto}
                </p>
              </li>
            ))}
          </ol>
        </section>
      );
    case "prediccion":
      return (
        <section className={caja} aria-label={tituloAccesible("prediccion")}>
          <p className="font-semibold">{b.pregunta}</p>
          <Opciones
            id={b.id}
            enunciado={b.enunciado}
            opciones={b.opciones}
            alResponder={alResponder}
          />
        </section>
      );
    case "practica":
      return (
        <section className={caja} aria-label={tituloAccesible("practica")}>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Práctica generada y verificada por CALIBRA
          </p>
          {b.historia && <p>{b.historia}</p>}
          <Opciones
            id={b.id}
            enunciado={b.enunciado}
            opciones={b.opciones}
            alResponder={alResponder}
          />
        </section>
      );
    case "ejemplo_paso_a_paso":
      return (
        <section
          className={caja}
          aria-label={tituloAccesible("ejemplo_paso_a_paso")}
        >
          <PasoAPaso id={b.id} pasos={b.pasos} alResponder={alResponder} />
        </section>
      );
    case "visual":
      return (
        <section className={caja} aria-label={tituloAccesible("visual")}>
          <VisualView v={b} />
        </section>
      );
    case "en_tus_palabras":
      return (
        <section
          className={caja}
          aria-label={tituloAccesible("en_tus_palabras")}
        >
          <p className="font-semibold">{b.consigna}</p>
          <TextoLibre
            id={b.id}
            etiqueta="Con tus palabras"
            alResponder={alResponder}
          />
        </section>
      );
    case "invitacion_comprobar":
      return (
        <section
          className={caja}
          aria-label={tituloAccesible("invitacion_comprobar")}
        >
          <p>{b.texto}</p>
          {comprobando ? (
            <Link className={boton} to={`/aprender/${arbolId}`}>
              Ir a mi comprobación
            </Link>
          ) : (
            <button className={boton} onClick={onComprobar}>
              Empezar comprobación sin ayudas
            </button>
          )}
        </section>
      );
    case "cita":
      return (
        <section className={caja} aria-label={tituloAccesible("cita")}>
          <p className="text-sm">Fragmento de tu material.</p>
          <Link
            className={secundario}
            to={`/aprender?fragmento=${b.fragmento_id}`}
          >
            Ver el original
          </Link>
        </section>
      );
  }
}
