import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MessageCircle, NotebookPen, Timer } from "lucide-react";
import { admision, type AreaDeAdmision } from "@/integrations/api/admision";
import { usePracticarAdmision } from "@/hooks/usePracticarAdmision";
import { diaDeLima, resumenDelCuaderno } from "@/lib/admision/motor/admision-leitner";
import { cn } from "@/lib/utils";

const celda =
  "group flex min-h-[7.5rem] flex-col gap-1.5 px-5 py-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

function Contenido({ icono, titulo, estado, accion }: { icono: ReactNode; titulo: string; estado: string; accion: string | null }) {
  return (
    <>
      <span className="flex items-center gap-2.5 text-primary">
        {icono}
        <span className="font-semibold text-foreground">{titulo}</span>
      </span>
      <span className="text-sm text-muted-foreground">{estado}</span>
      {accion && (
        <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-bold text-primary">
          {accion}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      )}
    </>
  );
}

/**
 * Las tres jugadas del Inicio, con el mismo peso: un simulacro, el repaso de errores y el tutor.
 * El repaso sale apagado mientras no haya preguntas que repasar hoy: no se inventa una tarea.
 */
export function AccesosInicio({
  userId,
  area,
  armando,
  onSimulacro,
}: {
  userId: string | null;
  area: AreaDeAdmision;
  armando: string | null;
  onSimulacro: () => void;
}) {
  const repaso = usePracticarAdmision(area);
  const cuaderno = useQuery({
    queryKey: ["admision-cuaderno", userId],
    enabled: !!userId,
    retry: false,
    queryFn: async () => {
      const { data, error: e } = await admision.errores();
      if (e) throw e;
      return data ?? [];
    },
  });
  const r = cuaderno.isSuccess ? resumenDelCuaderno(cuaderno.data, diaDeLima(new Date())) : null;
  const tocan = r ? Math.min(r.hoy, 20) : 0;
  const estadoRepaso = !r
    ? "Aquí vuelven las preguntas que falles."
    : r.total === 0
      ? "Aún no hay errores: aparecen cuando fallas en un simulacro o práctica."
      : r.hoy > 0
        ? `Hoy te ${r.hoy === 1 ? "toca 1 pregunta" : `tocan ${r.hoy} preguntas`}, a los 1, 3 y 7 días de fallarlas.`
        : "Hoy no te toca ninguna. Vuelven a los 1, 3 y 7 días.";

  return (
    <section aria-label="Qué hacer ahora" className="space-y-2">
      <div className="grid overflow-hidden rounded-[10px] border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0 divide-y divide-border">
        <button type="button" onClick={onSimulacro} disabled={armando !== null} className={cn(celda, "hover:bg-muted/50 disabled:cursor-wait")}>
          <Contenido
            icono={<Timer className="h-5 w-5" aria-hidden="true" />}
            titulo="Simulacro"
            estado="Examen completo de tu área, con reloj, como el día real."
            accion={armando === "simulacro" ? "Preparando…" : "Empezar"}
          />
        </button>
        {tocan > 0 ? (
          <button
            type="button"
            disabled={repaso.armando !== null}
            onClick={() => void repaso.practicar("repaso", { modo: "repaso", n: tocan })}
            className={cn(celda, "hover:bg-muted/50 disabled:cursor-wait")}
          >
            <Contenido
              icono={<NotebookPen className="h-5 w-5" aria-hidden="true" />}
              titulo="Repasar errores"
              estado={estadoRepaso}
              accion={repaso.armando === "repaso" ? "Preparando…" : `Repasar ${tocan}`}
            />
          </button>
        ) : (
          <div className={cn(celda, "opacity-75")} aria-disabled="true">
            <Contenido icono={<NotebookPen className="h-5 w-5" aria-hidden="true" />} titulo="Repasar errores" estado={estadoRepaso} accion={null} />
          </div>
        )}
        <Link to="/tutor" className={cn(celda, "hover:bg-muted/50")}>
          <Contenido
            icono={<MessageCircle className="h-5 w-5" aria-hidden="true" />}
            titulo="Tutor"
            estado="¿Fallaste una pregunta? Te ayuda a ver dónde se rompió tu razonamiento."
            accion="Conversar"
          />
        </Link>
      </div>
      {repaso.error && (
        <p role="alert" className="text-sm text-destructive">
          {repaso.error}
        </p>
      )}
    </section>
  );
}
