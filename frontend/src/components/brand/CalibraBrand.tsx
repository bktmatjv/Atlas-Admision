import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Identidad visual oficial de CALIBRA.
 *
 * El isotipo se compone de:
 * 1. Letra C geométrica (CALIBRA).
 * 2. Círculo central (Enfoque / razonamiento).
 * 3. Indicador diagonal a 45° (Progreso / aprendizaje).
 *
 * Reconstruido en SVG vectorial plano, reactivo a `currentColor` y a la clase `.dark`
 * para garantizar contraste perfecto en modo claro y oscuro sin saltos ni recargas.
 */

export type CalibraBrandSize = "xs" | "sm" | "md" | "lg" | "xl";
export type CalibraBrandVariant = "full" | "symbol" | "mark";

export interface CalibraBrandProps {
  /**
   * `full`: isotipo + texto CALIBRA.
   * `symbol` o `mark`: solo el isotipo geométrico.
   */
  variant?: CalibraBrandVariant;
  size?: CalibraBrandSize;
  layout?: "horizontal" | "vertical";
  subtitle?: ReactNode;
  tagline?: string;
  pensando?: boolean;
  className?: string;
  isotypeClassName?: string;
  textClassName?: string;
  taglineClassName?: string;
  "aria-label"?: string;
}

const SYMBOL_SIZE: Record<CalibraBrandSize, string> = {
  xs: "h-4 w-4",
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-11 w-11",
  xl: "h-14 w-14",
};

const TEXT_SIZE: Record<CalibraBrandSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
};

export function CalibraSymbol({
  size = "md",
  pensando = false,
  className,
  ariaHidden = true,
}: {
  size?: CalibraBrandSize;
  pensando?: boolean;
  className?: string;
  ariaHidden?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden={ariaHidden ? "true" : undefined}
      role={ariaHidden ? undefined : "img"}
      className={cn(
        SYMBOL_SIZE[size],
        "shrink-0 text-primary transition-colors",
        pensando && "animate-pulse",
        className
      )}
    >
      {/* Pliegue superior: Carmesí secundario con opacidad armónica */}
      <path
        d="M 80.64 24.29 A 40 40 0 0 0 10.61 56.95 L 26.75 40.81 A 25 25 0 0 1 69.15 33.93 Z"
        fill="currentColor"
        opacity="0.75"
      />
      {/* Cuerpo inferior: Carmesí principal */}
      <path
        d="M 26.75 40.81 L 10.61 56.95 A 40 40 0 0 0 80.64 75.71 L 69.15 66.07 A 25 25 0 0 1 26.75 40.81 Z"
        fill="currentColor"
      />
      {/* Centro: Enfoque / Razonamiento */}
      <circle cx="50" cy="50" r="9.5" fill="currentColor" />
      {/* Indicador diagonal a 45°: Progreso / Aprendizaje */}
      <line
        x1="50"
        y1="50"
        x2="74.5"
        y2="29.5"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CalibraBrand({
  variant = "full",
  size = "md",
  layout = "horizontal",
  subtitle,
  tagline,
  pensando = false,
  className,
  isotypeClassName,
  textClassName,
  taglineClassName,
  "aria-label": ariaLabel,
}: CalibraBrandProps) {
  const isOnlySymbol = variant === "symbol" || variant === "mark";

  if (isOnlySymbol) {
    return (
      <CalibraSymbol
        size={size}
        pensando={pensando}
        className={cn(isotypeClassName, className)}
        ariaHidden={!ariaLabel}
      />
    );
  }

  const isVertical = layout === "vertical";

  return (
    <div
      role="banner"
      aria-label={ariaLabel || (typeof subtitle === "string" ? `CALIBRA ${subtitle}` : "CALIBRA")}
      className={cn(
        "inline-flex items-center",
        isVertical ? "flex-col gap-2 text-center" : "gap-2.5",
        className
      )}
    >
      <CalibraSymbol
        size={size}
        pensando={pensando}
        className={isotypeClassName}
        ariaHidden
      />
      <div className={cn("flex flex-col", isVertical ? "items-center" : "items-start")}>
        <span
          className={cn(
            "font-extrabold tracking-wider leading-none select-none text-foreground",
            TEXT_SIZE[size],
            textClassName
          )}
        >
          CALIBRA
          {subtitle && (
            <span className="ml-1.5 font-semibold text-primary">{subtitle}</span>
          )}
        </span>
        {tagline && (
          <span
            className={cn(
              "mt-1 text-[0.65em] font-medium tracking-normal text-muted-foreground select-none",
              taglineClassName
            )}
          >
            {tagline}
          </span>
        )}
      </div>
    </div>
  );
}

