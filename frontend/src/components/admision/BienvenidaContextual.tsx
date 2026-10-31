import { GraduationCap, CalendarClock, Sparkles, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export type EstadoContextualEstudiante = "nuevo" | "sin_diagnostico" | "con_actividad";

interface BienvenidaContextualProps {
  estado: EstadoContextualEstudiante;
  carreraNombre: string | null;
  areaNombre: string | null;
  diasParaExamen: number | null;
  cicloExamen?: string | null;
  rachaDias?: number;
  className?: string;
}

/**
 * Bienvenida contextual que orienta al estudiante según su estado de avance:
 * 1. Nuevo: invitar a elegir carrera para calibrar pesos.
 * 2. Sin diagnóstico: enfocar en conocer su punto de partida.
 * 3. Con actividad: celebrar constancia y motivar el siguiente paso.
 */
export function BienvenidaContextual({
  estado,
  carreraNombre,
  areaNombre,
  diasParaExamen,
  cicloExamen,
  rachaDias = 0,
  className,
}: BienvenidaContextualProps) {
  return (
    <section
      aria-label="Orientación de bienvenida"
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-colors md:p-6",
        className
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>CALIBRA · Admisión San Marcos</span>
          </div>

          {estado === "nuevo" ? (
            <>
              <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                Aprende a pensar. Prepárate con rigor.
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
                Entrena con exámenes reales de la UNMSM y simulacros calibrados con el peso exacto de tu área.
                Elige tu carrera para conocer tu puntaje de corte y saber si ingresarías hoy.
              </p>
            </>
          ) : estado === "sin_diagnostico" ? (
            <>
              <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                Tu meta está fijada. Conoce tu punto de partida.
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
                Para alcanzar tu vacante necesitas medir tus fortalezas iniciales. El diagnóstico de 30 preguntas
                te dirá con precisión qué temas priorizar en tus primeras semanas.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                Continúa con tu plan de preparación
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
                Consistencia y enfoque en tus errores. Revisa tu siguiente paso recomendado para seguir
                acumulando puntos hacia tu meta.
              </p>
            </>
          )}
        </div>

        {/* Resumen de metas y badges de contexto */}
        {(carreraNombre || diasParaExamen !== null || rachaDias > 0) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
            {carreraNombre && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold text-foreground">
                <GraduationCap className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span className="truncate max-w-[200px]" title={carreraNombre}>
                  {carreraNombre}
                </span>
                {areaNombre && <span className="text-muted-foreground">({areaNombre})</span>}
              </div>
            )}

            {diasParaExamen !== null && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold text-foreground">
                <CalendarClock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>
                  {diasParaExamen === 0
                    ? "¡El examen es hoy!"
                    : diasParaExamen === 1
                    ? "El examen es mañana"
                    : `Faltan ${diasParaExamen} días`}
                </span>
                {cicloExamen && <span className="text-muted-foreground">({cicloExamen})</span>}
              </div>
            )}

            {rachaDias > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{rachaDias} {rachaDias === 1 ? "día de racha" : "días de racha"}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

