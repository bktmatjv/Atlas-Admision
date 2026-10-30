import type { ReactNode } from "react";

/**
 * La cabecera de toda pantalla del producto.
 *
 * Existe porque hoy cada página inventa la suya: `Dashboard` con un saludo y una insignia
 * flotando a la derecha, `History` con una tarjeta en gradiente y dos manchas
 * difuminadas, `Transcribe` con una barra pegajosa. Tres estructuras distintas para lo
 * mismo, y ninguna reutilizable.
 *
 * El recuento va junto al título y no en una insignia: es un dato del título, no una
 * etiqueta de estado.
 */

export interface Crumb {
  label: string;
  onClick: () => void;
}

interface PageHeaderProps {
  breadcrumb?: (string | Crumb)[];
  title: string;
  count?: number;
  actions?: ReactNode;
  /**
   * La línea que va debajo del título.
   *
   * Va DENTRO de la cabecera y no suelta en la página: puesta fuera cae por debajo del filete
   * divisorio y queda huérfana, separada del título al que acompaña.
   *
   * Admite marca y no solo texto porque hay líneas que son un estado y no una frase: la de
   * audio es «● Transcripción lista · 1.169 palabras», con su punto de color. Servida como
   * cadena habría que escribir el estado en palabras y perder el color, o sacar la línea
   * fuera de la cabecera y dejarla huérfana, que es justo lo que este componente vino a
   * arreglar.
   */
  subtitle?: ReactNode;
  /**
   * `hero` agranda el título y quita el filete. Es para una portada —el Inicio—, donde el
   * título es lo primero que se lee y no el rótulo de una herramienta. El resto de pantallas
   * usa `default` y no cambian.
   */
  size?: "default" | "hero";
}

export function PageHeader({
  breadcrumb,
  title,
  count,
  actions,
  subtitle,
  size = "default",
}: PageHeaderProps) {
  const esPortada = size === "hero";

  return (
    <header
      className={
        esPortada
          ? "flex flex-wrap items-start gap-x-2.5 gap-y-3"
          : "flex flex-wrap items-end gap-x-2.5 gap-y-3 pb-1"
      }
    >
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="text-meta text-muted-foreground mb-1" aria-label="Ruta">
            {breadcrumb.map((crumb, i) => {
              const label = typeof crumb === "string" ? crumb : crumb.label;
              const isLast = i === breadcrumb.length - 1;
              const clickable = typeof crumb !== "string" && !isLast;
              return (
                // La clave lleva la posición: las migas son una lista posicional y dos niveles
                // pueden compartir etiqueta —un curso y una clase con el mismo nombre—, lo que
                // con `key={label}` daría claves duplicadas entre hermanos.
                <span key={`${i}-${label}`}>
                  {i > 0 && <span className="mx-1.5 opacity-50">/</span>}
                  {clickable ? (
                    <button
                      type="button"
                      onClick={(crumb as Crumb).onClick}
                      className="hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring rounded-sm"
                    >
                      {label}
                    </button>
                  ) : (
                    <span className={isLast ? "text-foreground font-medium" : undefined}>{label}</span>
                  )}
                </span>
              );
            })}
          </nav>
        )}
        <div className="flex items-baseline gap-2.5">
          <h1
            className={
              esPortada
                ? "font-display text-[1.9rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-balance [overflow-wrap:anywhere] sm:text-[2.5rem]"
                : "font-display text-[1.65rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-balance [overflow-wrap:anywhere] sm:text-[2.1rem]"
            }
          >
            {title}
          </h1>
          {typeof count === "number" && (
            <span className="shrink-0 self-center rounded-full bg-[hsl(var(--arc-azul-claro))] px-3 py-1 text-sm font-bold tabular-nums text-[hsl(var(--arc-azul-texto))]">
              {count.toLocaleString("es")}
            </span>
          )}
        </div>
        {subtitle && (
          // `div` y no `p`: el subtítulo puede traer marca, y un `<p>` con un `<div>` dentro
          // es HTML inválido que el navegador reabre por su cuenta, partiendo la línea en dos.
          <div
            className={`text-base text-muted-foreground ${
              esPortada ? "mt-1 [@media(max-height:820px)]:hidden" : "mt-0.5"
            }`}
          >
            {subtitle}
          </div>
        )}
      </div>
      {actions && (
        <div className={`ml-auto flex items-center gap-2 shrink-0 ${esPortada ? "pt-1" : ""}`}>
          {actions}
        </div>
      )}
    </header>
  );
}
