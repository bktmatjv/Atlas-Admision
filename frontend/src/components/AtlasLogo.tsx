import { CalibraBrand, CalibraBrandSize, CalibraBrandVariant, CalibraSymbol } from "@/components/brand/CalibraBrand";
import { cn } from "@/lib/utils";

/**
 * Componente heredado de marca, ahora delegado en la identidad oficial CALIBRA.
 * Mantiene compatibilidad con cualquier llamada existente a AtlasLogo.
 */

export type AtlasLogoSize = CalibraBrandSize;
export type AtlasLogoVariant = "mark" | "full";

export interface AtlasLogoProps {
  /** `mark` solo el símbolo; `full` símbolo más la palabra */
  variant?: AtlasLogoVariant;
  size?: AtlasLogoSize;
  pensando?: boolean;
  className?: string;
}

export function AtlasLogo({
  variant = "mark",
  size = "md",
  pensando = false,
  className,
}: AtlasLogoProps) {
  if (variant === "mark") {
    return (
      <CalibraSymbol
        size={size}
        pensando={pensando}
        className={className}
      />
    );
  }

  return (
    <CalibraBrand
      variant="full"
      size={size}
      pensando={pensando}
      className={className}
    />
  );
}
