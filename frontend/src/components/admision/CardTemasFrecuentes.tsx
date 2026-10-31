import { Link } from "react-router-dom";
import { TrendingUp, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardTemasFrecuentesProps {
  className?: string;
}

/**
 * Tarjeta de la barra lateral para explorar los temas más frecuentes en San Marcos.
 * Proporciona acceso directo al análisis estadístico de preguntas oficiales (/admision/temas).
 */
export function CardTemasFrecuentes({ className }: CardTemasFrecuentesProps) {
  return (
    <section
      aria-labelledby="t-temas-frecuentes-sidebar"
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/40",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
        >
          <TrendingUp className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h2
            id="t-temas-frecuentes-sidebar"
            className="text-base font-extrabold text-foreground leading-snug"
          >
            Temas que más vienen
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Frecuencia oficial calculada pregunta por pregunta en los exámenes reales de tu área.
          </p>
        </div>
      </div>

      <div className="mt-4 pt-2">
        <Link
          to="/admision/temas"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-xs font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99]"
        >
          <span>Ver análisis por temas</span>
          <ArrowRight className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

