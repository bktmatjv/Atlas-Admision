import { Link } from "react-router-dom";
import { History, MessageCircle, SquarePen } from "lucide-react";
import {
  agruparPorFecha,
  etiquetaTema,
  type ItemHistorial,
} from "@/lib/tutor/historial";
type Props = {
  items?: ItemHistorial[];
  activoId?: string;
  cargando?: boolean;
  error?: string | null;
  onReintentar?: () => void;
  // Para cerrar la hoja en pantallas chicas tras elegir.
  onElegir?: () => void;
  acople?: boolean;
  ahora?: Date;
};
// Solo lo que el backend soporta: listar y abrir. No hay renombrar ni borrar.
export function HistorialPanel({
  items,
  activoId,
  cargando,
  error,
  onReintentar,
  onElegir,
  acople,
  ahora,
}: Props) {
  const grupos = agruparPorFecha(items ?? [], ahora);
  return (
    <aside
      className={`tc-hist${acople ? " tc-hist--docked" : ""}`}
      aria-label="Historial de conversaciones"
    >
      <header className="tc-hist-head">
        <History size={20} aria-hidden="true" />
        <h2>Historial</h2>
        <Link
          to="/tutor"
          className="tc-icon-btn"
          aria-label="Nueva conversación"
          title="Nueva conversación"
          onClick={onElegir}
        >
          <SquarePen size={19} />
        </Link>
      </header>
      <div className="tc-hist-body">
        {cargando && (
          <p className="tc-hist-empty" role="status">
            Cargando tus conversaciones…
          </p>
        )}
        {error && (
          <p className="tc-hist-empty" role="alert">
            {error}{" "}
            {onReintentar && (
              <button
                type="button"
                className="tc-btn tc-btn--line"
                onClick={onReintentar}
              >
                Reintentar
              </button>
            )}
          </p>
        )}
        {!cargando && !error && grupos.length === 0 && (
          <p className="tc-hist-empty">
            Todavía no hay conversaciones. Empieza una y aparecerá aquí.
          </p>
        )}
        {grupos.map((g) => (
          <section key={g.etiqueta} className="tc-hist-group">
            <h3>{g.etiqueta}</h3>
            <ul>
              {g.items.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/tutor/${c.id}`}
                    className="tc-hist-item"
                    aria-current={c.id === activoId ? "page" : undefined}
                    onClick={onElegir}
                  >
                    <MessageCircle size={18} aria-hidden="true" />
                    <span>
                      <strong title={c.titulo}>{c.titulo}</strong>
                      <small>{etiquetaTema(c.concepto)}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
