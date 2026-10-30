import { useQuery } from "@tanstack/react-query";
import { NotebookPen } from "lucide-react";
import { admision, type AreaDeAdmision } from '@/integrations/api/admision';
import { usePracticarAdmision } from "@/hooks/usePracticarAdmision";
import { diaDeLima, resumenDelCuaderno } from "@/lib/admision/motor/admision-leitner";

const fecha = (dia: string) => new Date(`${dia}T12:00:00`).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });

/**
 * El cuaderno de errores (tramo 4 de Audix): lo que falló vuelve a los 1, 3 y 7 días hasta dominarlo. Lo
 * lleva el servidor al entregar; aquí, el resumen y «Repasar ahora». Sin la tabla todavía, no sale.
 */
export function CuadernoDeErrores({ userId, area }: { userId: string | null; area: AreaDeAdmision }) {
  const { armando, error, practicar } = usePracticarAdmision(area);
  const consulta = useQuery({
    queryKey: ["admision-cuaderno", userId],
    enabled: !!userId,
    retry: false,
    queryFn: async () => {
      const { data, error: e } = await admision.errores();
      if (e) throw e;
      return data ?? [];
    },
  });
  if (!userId || !consulta.isSuccess) return null;
  const r = resumenDelCuaderno(consulta.data, diaDeLima(new Date()));

  return (
    <section aria-labelledby="cuaderno-titulo" className="min-w-0 space-y-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-muted">
          <NotebookPen className="h-5 w-5 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="cuaderno-titulo" className="text-lg font-extrabold text-foreground">Tu cuaderno de errores</h2>
          <p className="text-sm text-muted-foreground">
            {r.total === 0
              ? "Aquí vuelven las preguntas que falles, a los 1, 3 y 7 días, para volver a practicarlas. Haz un simulacro para empezar."
              : r.hoy > 0
                ? `Hoy te tocan ${r.hoy} ${r.hoy === 1 ? "pregunta" : "preguntas"}. Repásalas mientras las tienes frescas.`
                : r.proxima
                  ? `Hoy no te toca ninguna. La próxima vuelve el ${fecha(r.proxima)}.`
                  : "Completaste los repasos pendientes. Las nuevas que falles entrarán aquí."}
          </p>
        </div>
        {r.hoy > 0 && (
          <button
            type="button"
            disabled={armando !== null}
            onClick={() => void practicar("repaso", { modo: "repaso", n: Math.min(r.hoy, 20) })}
            className="min-h-11 basis-full rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60 sm:basis-auto"
          >
            {armando === "repaso" ? "Preparando…" : `Repasar ahora (${Math.min(r.hoy, 20)})`}
          </button>
        )}
      </div>
      {r.total > 0 && (
        <ul className="flex flex-wrap gap-2 text-sm" aria-label="Cómo va tu cuaderno">
          <li className="rounded-full bg-muted px-3 py-1">Caja 1 (mañana): {r.porCaja[1]}</li>
          <li className="rounded-full bg-muted px-3 py-1">Caja 2 (3 días): {r.porCaja[2]}</li>
          <li className="rounded-full bg-muted px-3 py-1">Caja 3 (7 días): {r.porCaja[3]}</li>
          <li className="rounded-full bg-muted px-3 py-1">Repasos completados: {r.dominadas}</li>
        </ul>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
