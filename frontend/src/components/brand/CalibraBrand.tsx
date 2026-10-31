import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Identidad visual oficial de CALIBRA — "Aprende a pensar".
 *
 * Simbología oficial (Propuesta A):
 * - Letra C dividida en 4 piezas de rompecabezas interconectadas (desafío, articulación conceptual).
 * - Núcleo central con aguja y destello de 3 rayos (enfoque, razonamiento, insight cognitivo).
 *
 * Implementación:
 * - Modo Claro: Activos oficiales con paleta carmesí (#941F3D / #B83A56) sobre fondo crema (#F7F1E8).
 * - Modo Oscuro: Activos oficiales con paleta coral/carmesí luminoso (#E56B83 / #B83A56) sobre fondo oscuro (#211B20).
 * - Cero parpadeos: Renderizado mediante pares de imágenes sincronizadas con la clase `.dark` de Tailwind / next-themes.
 */

export type CalibraBrandSize = "xs" | "sm" | "md" | "lg" | "xl";
export type CalibraBrandVariant = "full" | "symbol" | "mark" | "lockup";

export interface CalibraBrandProps {
  /**
   * `full`: isotipo + texto CALIBRA (layout horizontal o vertical).
   * `symbol` o `mark`: solo el isotipo oficial.
   * `lockup`: imagen completa del logo vertical oficial.
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
  xs: "h-5 w-5",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

const LOCKUP_SIZE: Record<CalibraBrandSize, string> = {
  xs: "h-12 w-auto",
  sm: "h-16 w-auto",
  md: "h-20 w-auto",
  lg: "h-28 w-auto",
  xl: "h-36 w-auto",
};

const TEXT_SIZE: Record<CalibraBrandSize, string> = {
  xs: "text-xs",
  sm: "text-sm sm:text-base",
  md: "text-base sm:text-lg",
  lg: "text-lg sm:text-xl",
  xl: "text-2xl sm:text-3xl",
};

/**
 * Isotipo oficial CALIBRA (Letra C en rompecabezas + Destello cognitivo central).
 * Utiliza los assets optimizados en /brand/calibra-symbol-light.png y /brand/calibra-symbol-dark.png.
 */
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
    <div
      aria-hidden={ariaHidden ? "true" : undefined}
      role={ariaHidden ? undefined : "img"}
      className={cn(
        SYMBOL_SIZE[size],
        "relative shrink-0 select-none",
        pensando && "animate-pulse",
        className
      )}
    >
      {/* Variante oficial Modo Claro: Carmesí sobre fondo claro */}
      <img
        src="/brand/calibra-symbol-light.png"
        alt="Isotipo CALIBRA"
        className="h-full w-full object-contain dark:hidden"
        loading="eager"
        decoding="async"
      />
      {/* Variante oficial Modo Oscuro: Carmesí luminoso sobre fondo oscuro */}
      <img
        src="/brand/calibra-symbol-dark.png"
        alt="Isotipo CALIBRA"
        className="hidden h-full w-full object-contain dark:block"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}

/**
 * Componente principal de Marca CALIBRA.
 * Soporta cabeceras, pies de página, pantallas de bienvenida y variantes horizontales/verticales.
 */
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

  // Lockup vertical completo con imagen oficial integrada
  if (variant === "lockup") {
    return (
      <div
        role="banner"
        aria-label={ariaLabel || "CALIBRA · Aprende a pensar"}
        className={cn("inline-flex flex-col items-center select-none", className)}
      >
        <img
          src="/brand/calibra-logo-light.png"
          alt="CALIBRA"
          className={cn(LOCKUP_SIZE[size], "object-contain dark:hidden")}
          loading="eager"
        />
        <img
          src="/brand/calibra-logo-dark.png"
          alt="CALIBRA"
          className={cn(LOCKUP_SIZE[size], "hidden object-contain dark:block")}
          loading="eager"
        />
      </div>
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
            "font-black tracking-[0.14em] leading-none select-none text-foreground",
            TEXT_SIZE[size],
            textClassName
          )}
        >
          CALIBRA
          {subtitle && (
            <span className="ml-1.5 font-semibold tracking-normal text-primary">{subtitle}</span>
          )}
        </span>
        {tagline && (
          <span
            className={cn(
              "mt-1 text-[0.62em] font-extrabold uppercase tracking-[0.2em] text-primary/90 select-none",
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
