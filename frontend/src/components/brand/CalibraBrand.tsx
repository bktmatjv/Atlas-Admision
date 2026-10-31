import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Marca CALIBRA, identidad «Marcador» (rebrand del 31/10/2026).
 *
 * El isotipo es una C dibujada con segmentos de marcador de estadio: cifras ámbar sobre un
 * tablero grafito. Dice lo mismo que la app: tu preparación se lleva como un marcador, y
 * solo cuenta lo que anotas tú. Es SVG en línea: no depende de imágenes ni del tema.
 */

export type CalibraBrandSize = "xs" | "sm" | "md" | "lg" | "xl";
export type CalibraBrandVariant = "full" | "symbol" | "mark" | "lockup";

export interface CalibraBrandProps {
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
  xs: "h-5 w-5",
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

const TEXT_SIZE: Record<CalibraBrandSize, string> = {
  xs: "text-base",
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
  xl: "text-5xl",
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
      viewBox="0 0 32 32"
      aria-hidden={ariaHidden ? "true" : undefined}
      role={ariaHidden ? undefined : "img"}
      aria-label={ariaHidden ? undefined : "CALIBRA"}
      className={cn(SYMBOL_SIZE[size], "shrink-0 select-none", pensando && "animate-pulse", className)}
    >
      <rect x="0.5" y="0.5" width="31" height="31" rx="6" fill="hsl(220 13% 9%)" stroke="hsl(0 0% 100% / 0.14)" />
      {/* Segmentos de la C: superior, laterales e inferior, con el hueco de un dígito real */}
      <g fill="hsl(40 100% 58%)">
        <path d="M10.6 6.5h11.2l-1.6 2.6h-8z" />
        <path d="M9.4 7.6l2.4 2.4v4.9l-1.3 1.1-1.1-1.1z" />
        <path d="M9.4 24.4l2.4-2.4v-4.9l-1.3-1.1-1.1 1.1z" />
        <path d="M10.6 25.5h11.2l-1.6-2.6h-8z" />
      </g>
      <circle cx="22.4" cy="16" r="1.6" fill="hsl(151 62% 52%)" />
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
  if (variant === "symbol" || variant === "mark") {
    return (
      <CalibraSymbol size={size} pensando={pensando} className={cn(isotypeClassName, className)} ariaHidden={!ariaLabel} />
    );
  }
  const vertical = layout === "vertical" || variant === "lockup";
  return (
    <span
      aria-label={ariaLabel || "CALIBRA"}
      className={cn("inline-flex items-center", vertical ? "flex-col gap-3 text-center" : "gap-2.5", className)}
    >
      <CalibraSymbol size={size} pensando={pensando} className={isotypeClassName} />
      <span className={cn("flex flex-col", vertical ? "items-center" : "items-start")}>
        <span
          className={cn(
            "font-display font-extrabold uppercase leading-none tracking-[0.04em] select-none",
            TEXT_SIZE[size],
            textClassName,
          )}
        >
          Calibra
          {subtitle && <span className="ml-1.5 font-sans text-[0.55em] font-semibold normal-case tracking-normal opacity-80">{subtitle}</span>}
        </span>
        {tagline && (
          <span className={cn("mt-1 text-[0.7rem] font-semibold tracking-[0.02em] opacity-80 select-none", taglineClassName)}>
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}
