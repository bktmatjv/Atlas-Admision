import { TEMAS_SOPORTADOS, type TemaId } from "@/lib/tutor/inicio";

/** Se muestra en línea cuando la conversación libre aún no tiene tema para crear la comprobación. */
export function ElegirTema({
  onElegir,
  ocupado = false,
}: {
  onElegir: (tema: TemaId) => void;
  ocupado?: boolean;
}) {
  return (
    <div
      className="tc-banner tc-elegir-tema"
      role="group"
      aria-labelledby="tc-elegir-tema-titulo"
    >
      <strong id="tc-elegir-tema-titulo">
        ¿Sobre qué tema quieres la comprobación?
      </strong>
      <span className="tc-elegir-tema-opciones">
        {TEMAS_SOPORTADOS.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={ocupado}
            onClick={() => onElegir(t.id)}
          >
            {t.nombre}
          </button>
        ))}
      </span>
    </div>
  );
}
