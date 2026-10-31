import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Paperclip, Send } from "lucide-react";
import { MAX_RESPUESTA, teclaEnvia } from "@/lib/tutor/chat";
import type { OpcionDeContexto } from "@/lib/tutor/inicio";
type Props = {
  id: string;
  valor: string;
  onCambio: (v: string) => void;
  onEnviar: () => void;
  ocupado?: boolean;
  deshabilitado?: boolean;
  placeholder: string;
  etiqueta: string;
  // Selector de contexto (solo en la pantalla inicial).
  contextos?: OpcionDeContexto[];
  contextoClave?: string;
  onContexto?: (clave: string) => void;
};
export type ComposerRef = { enfocar: () => void };
// Compositor: Enter envía, Shift+Enter hace salto de línea.
export const ComposerTutor = forwardRef<ComposerRef, Props>(
  function ComposerTutor(p, ref) {
    const area = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => ({ enfocar: () => area.current?.focus() }));
    useEffect(() => {
      const el = area.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
    }, [p.valor]);
    const puede = !p.ocupado && !p.deshabilitado && p.valor.trim().length > 0;
    return (
      <form
        className="tc-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (puede) {
            p.onEnviar();
            // Tras enviar con el botón, el cursor sigue en el campo para escribir la siguiente idea.
            area.current?.focus();
          }
        }}
      >
        <label className="sr-only" htmlFor={p.id}>
          {p.etiqueta}
        </label>
        <textarea
          ref={area}
          id={p.id}
          rows={1}
          value={p.valor}
          maxLength={MAX_RESPUESTA}
          disabled={p.deshabilitado}
          placeholder={p.placeholder}
          onChange={(e) => p.onCambio(e.target.value)}
          onKeyDown={(e) => {
            if (!teclaEnvia(e.nativeEvent)) return;
            e.preventDefault();
            if (puede) p.onEnviar();
          }}
        />
        <div className="tc-composer-bar">
          <Link
            to="/cursos"
            className="tc-icon-btn"
            aria-label="Adjuntar material: ir a Mis cursos"
            title="Adjuntar material: ir a Mis cursos"
          >
            <Paperclip size={20} />
          </Link>
          {p.contextos && (
            <label className="tc-context">
              <BookOpen size={18} aria-hidden="true" />
              <span className="sr-only">Contexto de la conversación</span>
              <select
                value={p.contextoClave ?? ""}
                onChange={(e) => p.onContexto?.(e.target.value)}
              >
                <option value="">Sin contexto: conversación libre</option>
                {p.contextos.map((c) => (
                  <option key={c.clave} value={c.clave}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="tc-hint">Enter envía · Shift+Enter, salto de línea</p>
          <button
            type="submit"
            className="tc-send"
            disabled={!puede}
            aria-label="Enviar mensaje"
          >
            <Send size={19} aria-hidden="true" />
            <span className="sr-only">Enviar</span>
          </button>
        </div>
        {p.valor.length > MAX_RESPUESTA - 200 && (
          <p className="tc-count">
            {p.valor.length} / {MAX_RESPUESTA} caracteres
          </p>
        )}
      </form>
    );
  },
);
