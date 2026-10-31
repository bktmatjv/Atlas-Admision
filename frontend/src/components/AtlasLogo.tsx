import { cn } from "@/lib/utils";

/**
 * Marca de Atlas.
 *
 * El símbolo es un globo cuyas líneas de latitud tienen longitudes distintas, de modo
 * que se lee a la vez como esfera y como onda de audio. Es SVG y hereda `currentColor`,
 * así que funciona sobre fondo claro y oscuro sin duplicar assets ni pedir un PNG por tema.
 */

export type AtlasLogoSize = "xs" | "sm" | "md" | "lg";
export type AtlasLogoVariant = "mark" | "full";

interface AtlasLogoProps {
  /** `mark` solo el símbolo; `full` símbolo más la palabra */
  variant?: AtlasLogoVariant;
  size?: AtlasLogoSize;
  /**
   * Las latitudes laten como una onda mientras el modelo redacta.
   *
   * Es la marca haciendo lo que su dibujo ya dice —esfera y onda a la vez— en lugar de
   * unos puntos genéricos. La animación vive en `index.css` (`.atlas-pensando`).
   */
  pensando?: boolean;
  className?: string;
}

const MARK_SIZE: Record<AtlasLogoSize, string> = {
  xs: "h-4 w-4",
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-10 w-10",
};

const WORD_SIZE: Record<AtlasLogoSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export function AtlasLogo({ variant = "mark", size = "md", pensando = false, className }: AtlasLogoProps) {
  const mark = (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn(MARK_SIZE[size], "shrink-0 text-primary", pensando && "atlas-pensando", variant === "mark" && className)}
    >
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.25" />
      {/* Latitudes de longitud desigual: esfera y onda a la vez */}
      <g stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
        <line className="atlas-latitud" x1="9" y1="10.5" x2="23" y2="10.5" />
        <line className="atlas-latitud" x1="6.5" y1="16" x2="25.5" y2="16" />
        <line className="atlas-latitud" x1="11" y1="21.5" x2="21" y2="21.5" />
      </g>
    </svg>
  );

  if (variant === "mark") return mark;

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {mark}
      <span className={cn("font-extrabold tracking-tight leading-none", WORD_SIZE[size])}>
        Atlas
      </span>
    </span>
  );
}
