import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, ShieldCheck, Undo2 } from "lucide-react";
import { api, post } from "@/integrations/api/client";
import { MathMarkdown } from "@/components/shared/MathMarkdown";
import type { Rastro } from "@/lib/tutor/wow";
export type ComprobacionActiva = {
  id: string;
  arbol_id: string;
  enunciado: string;
  origen?: string;
};
export type ResultadoComprobacion = {
  correcta: boolean;
  ayuda: boolean;
  solucion: string;
  nota: string;
  rastro: Rastro | null;
};
export function ComprobacionTutor({
  activa,
  onActualizar,
}: {
  activa: ComprobacionActiva | null;
  onActualizar: (
    resultado?: ResultadoComprobacion,
    comprobacionId?: string,
  ) => void;
}) {
  const [respuesta, setRespuesta] = useState("");
  const [justificacion, setJustificacion] = useState("");
  const [resultado, setResultado] = useState<ResultadoComprobacion | null>(
    null,
  );
  const enviar = useMutation({
    mutationFn: () =>
      api<ResultadoComprobacion>(`/comprobaciones/${activa!.id}/respuesta`, {
        method: "PUT",
        body: JSON.stringify({ respuesta, justificacion }),
      }),
    onSuccess: (r) => {
      setResultado(r);
      setRespuesta("");
      setJustificacion("");
      onActualizar(r, activa!.id);
    },
  });
  const cancelar = useMutation({
    mutationFn: () => post(`/comprobaciones/${activa!.id}/cancelar`, {}),
    onSuccess: () => {
      setResultado(null);
      onActualizar();
    },
  });
  const ocupado = enviar.isPending || cancelar.isPending;
  if (!activa)
    return resultado ? (
      <div
        className={`tw-comprobacion-result tw-comprobacion-result--${resultado.correcta ? "ok" : "no"}`}
        role="status"
        aria-live="polite"
      >
        <strong>
          {resultado.correcta ? (
            <>
              <Check size={19} /> Resultado correcto
              {resultado.ayuda ? " con ayuda" : " sin ayudas de CALIBRA"}.
            </>
          ) : (
            "Todavía no. El error nos da un punto de partida."
          )}
        </strong>
        {resultado.rastro?.idea_clave ? (
          <p>
            Tu error apunta a:{" "}
            {resultado.rastro.descripcion ?? resultado.rastro.idea_clave}
            {resultado.rastro.nodo_retorno_id
              ? " Mira el recorrido en tu grafo."
              : " Aún no hay un nodo de retorno en tu mapa: no se inventará un recorrido."}
          </p>
        ) : (
          !resultado.correcta && (
            <p>
              No hay evidencia suficiente para señalar una idea. Cuéntame un
              paso de tu razonamiento.
            </p>
          )
        )}
        <small>
          Se comprobó el resultado numérico, no el dominio del tema.
        </small>
        <button
          className="tc-icon-btn"
          aria-label="Cerrar resultado de comprobación"
          onClick={() => setResultado(null)}
        >
          ×
        </button>
      </div>
    ) : null;
  return (
    <section className="tw-comprobacion" aria-label="Comprobación sin ayudas">
      <header>
        <ShieldCheck size={18} />
        <strong>Ahora, por tu cuenta</strong>
        <span>Sin ayudas de CALIBRA</span>
      </header>
      <MathMarkdown content={activa.enunciado} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (respuesta.trim()) enviar.mutate();
        }}
      >
        <label>
          Tu resultado
          <input
            autoComplete="off"
            inputMode="decimal"
            maxLength={200}
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            required
            disabled={ocupado}
          />
        </label>
        <label>
          ¿Cómo lo pensaste?{" "}
          <small>(opcional; no se califica automáticamente)</small>
          <textarea
            rows={2}
            maxLength={3000}
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
            disabled={ocupado}
          />
        </label>
        <div>
          <button
            type="submit"
            className="tc-btn"
            disabled={ocupado || !respuesta.trim()}
          >
            {enviar.isPending ? "Verificando…" : "Comprobar mi resultado"}
          </button>
          <button
            type="button"
            className="tc-btn tc-btn--line"
            disabled={ocupado}
            onClick={() => cancelar.mutate()}
          >
            <Undo2 size={16} />
            Volver a las ayudas
          </button>
        </div>
        {(enviar.error || cancelar.error) && (
          <p role="alert">{(enviar.error ?? cancelar.error)?.message}</p>
        )}
      </form>
    </section>
  );
}
