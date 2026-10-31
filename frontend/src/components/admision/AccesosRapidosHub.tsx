import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AccesosRapidosHubProps {
  cuadernoNode: ReactNode;
  progresoNode: ReactNode;
  ingresabaNode?: ReactNode;
  className?: string;
}

/**
 * Agrupa los módulos de seguimiento, retroalimentación y hábitos de estudio
 * (Cuaderno de errores, Racha/Progreso, Veredicto de corte) en una estructura visual armónica.
 */
export function AccesosRapidosHub({
  cuadernoNode,
  progresoNode,
  ingresabaNode,
  className,
}: AccesosRapidosHubProps) {
  const hasContent = Boolean(cuadernoNode || progresoNode || ingresabaNode);

  if (!hasContent) return null;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold uppercase tracking-wider text-muted-foreground">
          Tu Estado y Rendimiento
        </h2>
      </div>

      <div className="space-y-4">
        {ingresabaNode}
        {cuadernoNode}
        {progresoNode}
      </div>
    </div>
  );
}

