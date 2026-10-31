import { Link } from "react-router-dom";
import { ChevronRight, Clock, Award } from "lucide-react";
import { AREAS_DEL_EXAMEN } from "@/lib/admision/areas";
import { CURSOS } from "@/lib/admision/temario";
import { cn } from "@/lib/utils";

interface IntentoHistorialItem {
  id: string;
  modo: string;
  tipo?: string;
  area: string;
  filtro?: { curso?: string; tema?: string } | null;
  estado: string;
  puntaje: number | null;
  informe?: { maximo?: number } | null;
  created_at: string;
}

interface HistorialIntentosProps {
  intentos: IntentoHistorialItem[];
  className?: string;
}

const AREAS = AREAS_DEL_EXAMEN;

function obtenerNombreModo(i: IntentoHistorialItem): string {
  if (i.modo === "real") return "Examen real";
  if (i.modo === "repaso") return "Repaso del cuaderno";
  if (i.modo === "diagnostico") return "Diagnóstico de partida";
  if (i.filtro?.curso) {
    const cursoNombre = CURSOS.find((c) => c.id === i.filtro?.curso)?.nombre ?? i.filtro.curso;
    return `Práctica · ${cursoNombre}`;
  }
  return "Simulacro completo";
}

export function HistorialIntentos({ intentos, className }: HistorialIntentosProps) {
  return (
    <section aria-labelledby="t-historial" className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h2 id="t-historial" className="text-base font-extrabold uppercase tracking-wider text-muted-foreground">
          Tus Intentos y Evaluaciones
        </h2>
        {intentos.length > 0 && (
          <span className="text-xs font-semibold text-muted-foreground">
            {intentos.length} {intentos.length === 1 ? "intento registrado" : "intentos registrados"}
          </span>
        )}
      </div>

      {intentos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
          <p className="font-semibold text-foreground">Todavía no has realizado ninguna evaluación</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tus diagnósticos, simulacros y prácticas aparecerán aquí con su puntaje detallado.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {intentos.map((i) => {
            const nombreModo = obtenerNombreModo(i);
            const nombreArea = AREAS.find((a) => a.id === i.area)?.nombre ?? i.area;
            const enCurso = i.estado === "en_curso";
            const fechaStr = new Date(i.created_at).toLocaleDateString("es-PE", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });

            return (
              <li key={i.id}>
                <Link
                  to={`/admision/intento/${i.id}`}
                  className="group flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/70 sm:px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold text-foreground text-sm sm:text-base">
                        {nombreModo}
                      </span>
                      <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
                      <span className="text-xs font-medium text-muted-foreground hidden sm:inline truncate max-w-[150px]">
                        {nombreArea}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="sm:hidden font-medium truncate max-w-[120px]">{nombreArea} ·</span>
                      <span>{fechaStr}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {enCurso ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                        <Clock className="h-3 w-3 animate-pulse" aria-hidden="true" />
                        <span>En curso</span>
                      </span>
                    ) : i.estado === "abandonado" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                        <span>Abandonado</span>
                      </span>
                    ) : (
                      <div className="text-right">
                        <span className="block font-extrabold text-sm text-foreground tabular-nums sm:text-base">
                          {(i.puntaje ?? 0).toLocaleString("es", { maximumFractionDigits: 3 })}
                          <span className="text-xs font-normal text-muted-foreground ml-1">
                            / {i.informe?.maximo ?? "2000"}
                          </span>
                        </span>
                      </div>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

