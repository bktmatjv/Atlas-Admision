import { Link } from "react-router-dom";
import { Compass, PlayCircle, Award, ArrowRight } from "lucide-react";
import type { SiguientePaso } from "@/lib/admision/siguiente-paso";
import type { AreaDeAdmision } from "@/integrations/supabase/admision";
import { cn } from "@/lib/utils";

const NOMBRE_DEL_MODO: Record<string, string> = {
  diagnostico: "diagnóstico",
  simulacro: "simulacro",
  real: "examen",
  repaso: "repaso",
  practica: "práctica",
};

interface AccionRecomendadaHeroProps {
  paso: SiguientePaso;
  area: AreaDeAdmision;
  areaNombre: string;
  armando: string | null;
  onEmpezar: (clave: string, payload: Record<string, unknown>) => void;
  className?: string;
}

/**
 * Tarjeta Hero con la acción principal pedagógica recomendada.
 * Garantiza un único foco de acción principal (botón primario) en la vista superior.
 */
export function AccionRecomendadaHero({
  paso,
  area,
  areaNombre,
  armando,
  onEmpezar,
  className,
}: AccionRecomendadaHeroProps) {
  if (paso.tipo === "continuar") {
    return (
      <section
        aria-labelledby="hero-continuar-titulo"
        className={cn(
          "relative rounded-2xl border-2 border-primary/50 bg-card p-5 shadow-sm transition-all md:p-6",
          className
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <span
              aria-hidden="true"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
            >
              <PlayCircle className="h-6 w-6" />
            </span>
            <div className="min-w-0 space-y-1">
              <span className="inline-block text-xs font-bold uppercase tracking-wider text-primary">
                Tienes un intento en curso
              </span>
              <h2
                id="hero-continuar-titulo"
                className="text-lg font-extrabold text-foreground sm:text-xl"
              >
                Retoma tu {NOMBRE_DEL_MODO[paso.modo] ?? "simulacro"}
              </h2>
              <p className="max-w-xl text-sm text-muted-foreground leading-relaxed">
                Termínalo antes de empezar otra actividad para que tu puntaje cuente en tu progreso y en
                el cálculo de «¿Ingresabas?».
              </p>
            </div>
          </div>

          <Link
            to={`/admision/intento/${paso.intentoId}`}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99]"
          >
            <span>Seguir donde lo dejaste</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }

  if (paso.tipo === "diagnostico") {
    return (
      <section
        aria-labelledby="hero-diagnostico-titulo"
        className={cn(
          "relative rounded-2xl border-2 border-primary/50 bg-card p-5 shadow-sm transition-all md:p-6",
          className
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <span
              aria-hidden="true"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
            >
              <Compass className="h-6 w-6" />
            </span>
            <div className="min-w-0 space-y-1">
              <span className="inline-block text-xs font-bold uppercase tracking-wider text-primary">
                Primer paso recomendado
              </span>
              <h2
                id="hero-diagnostico-titulo"
                className="text-lg font-extrabold text-foreground sm:text-xl"
              >
                Diagnóstico de partida · 30 preguntas en 30 minutos
              </h2>
              <p className="max-w-xl text-sm text-muted-foreground leading-relaxed">
                Calibrado con el peso de cada curso para {areaNombre}. Al terminar conocerás tu puntaje
                estimado, si ingresarías hoy a tu carrera y qué temas reforzar.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={armando !== null}
            onClick={() => onEmpezar("diagnostico", { modo: "diagnostico", area })}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60 active:scale-[0.99]"
          >
            <span>{armando === "diagnostico" ? "Preparando…" : "Empezar diagnóstico"}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="hero-simulacro-titulo"
      className={cn(
        "relative rounded-2xl border-2 border-primary/50 bg-card p-5 shadow-sm transition-all md:p-6",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
          >
            <Award className="h-6 w-6" />
          </span>
          <div className="min-w-0 space-y-1">
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-primary">
              Entrenamiento recomendado
            </span>
            <h2
              id="hero-simulacro-titulo"
              className="text-lg font-extrabold text-foreground sm:text-xl"
            >
              Simulacro oficial nuevo · {areaNombre}
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground leading-relaxed">
              Preguntas de exámenes reales con el molde exacto de San Marcos. El sistema prioriza las
              preguntas que aún no has respondido.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={armando !== null}
          onClick={() =>
            onEmpezar("simulacro", { modo: "simulacro", area, tipo: "cronometrado" })
          }
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60 active:scale-[0.99]"
        >
          <span>{armando === "simulacro" ? "Preparando…" : "Empezar simulacro"}</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

