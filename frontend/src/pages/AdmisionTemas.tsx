import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Dumbbell } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/system/PageHeader";
import { ThemeToggle } from "@/components/system/ThemeToggle";
import { admision, type AreaDeAdmision } from '@/integrations/api/admision';
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { useDatosDeSanMarcos, usePerfilDeAdmision } from "@/hooks/useAdmisionDatos";
import { usePracticarAdmision } from "@/hooks/usePracticarAdmision";
import { AREAS_DEL_EXAMEN } from "@/lib/admision/areas";
import { areaDelExamen } from "@/lib/admision/buscar-escuela";
import { agruparTemas, PROCESOS_MINIMOS, type Categoria } from "@/lib/admision/temas";
import { cn } from "@/lib/utils";

const ROTULO: Record<Categoria, string> = { siempre: "Siempre viene", "a-veces": "A veces", "rara-vez": "Rara vez", nunca: "No vino" };
const tarjeta = "min-w-0 space-y-3 rounded-2xl border border-border bg-card p-5";

/**
 * `/admision/temas`: los temas que más vienen en el examen de tu área, contados en los exámenes reales del
 * banco de Atlas (tramo 3 de Audix). Cada tema se practica desde aquí.
 */
export default function AdmisionTemas() {
  const userId = useAuthUserId();
  const perfil = usePerfilDeAdmision(userId);
  const datos = useDatosDeSanMarcos(!!userId);
  const [area, setArea] = useState<AreaDeAdmision>("A");
  const [verTodos, setVerTodos] = useState<Record<string, boolean>>({});
  const { armando, error, practicar } = usePracticarAdmision(area);

  useEffect(() => { document.title = "Temas que más vienen | Atlas"; }, []);
  const escuela = datos.data?.carreras.find((c) => c.id === perfil.data?.carrera_id) ?? null;
  const suArea = escuela ? areaDelExamen(escuela) : null;
  useEffect(() => { if (suArea) setArea(suArea); }, [suArea]);

  const consulta = useQuery({
    queryKey: ["admision-temas-frecuentes", area],
    enabled: !!userId,
    retry: false,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error: e } = await admision.temas(area);
      if (e) throw e;
      return agruparTemas(data ?? []);
    },
  });
  const r = consulta.data;
  const nombreDelArea = AREAS_DEL_EXAMEN.find((a) => a.id === area)?.nombre ?? area;

  return (
    <ResponsiveLayout>
      <main className="min-w-0 flex-1 p-4 pb-24 md:p-6 lg:p-8 lg:pb-8">
        <div className="mx-auto max-w-5xl space-y-5">
          <PageHeader breadcrumb={["Atlas", "Admisión", "Temas"]} title="Temas que más vienen" actions={<ThemeToggle />} />
          <Link to="/admision" className="text-sm font-semibold text-primary hover:underline">← Volver a Admisión</Link>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="block text-sm font-semibold">Área
              <select className="mt-1 block min-h-11 rounded-lg border border-border bg-background px-3 text-sm" value={area} onChange={(e) => setArea(e.target.value as AreaDeAdmision)}>
                {AREAS_DEL_EXAMEN.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </label>
            {r && r.procesos > 0 && (
              <p className="text-sm text-muted-foreground">Contado en {r.procesos} {r.procesos === 1 ? "examen real" : "exámenes reales"} de San Marcos del área {nombreDelArea} (banco de Atlas).</p>
            )}
          </div>

          {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}
          {consulta.isLoading && <p role="status" className="text-sm text-muted-foreground">Contando los temas…</p>}
          {consulta.isError && <p className="text-sm text-muted-foreground">Todavía no podemos contar los temas. Mientras tanto, practica por curso desde Admisión.</p>}
          {r && r.procesos === 0 && <p className="text-sm text-muted-foreground">Aún no hay exámenes reales de esta área en el banco. Prueba con otra área o practica por curso.</p>}
          {r && r.procesos > 0 && r.procesos < PROCESOS_MINIMOS && (
            <p role="note" className="rounded-xl border border-border bg-muted/40 p-3 text-sm">Con {r.procesos} {r.procesos === 1 ? "examen" : "exámenes"}, tómalo como orientación: no alcanza para decir qué viene siempre.</p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {r?.cursos.map((c) => {
              const vinieron = c.temas.filter((t) => t.categoria !== "nunca");
              const nunca = c.temas.length - vinieron.length;
              const lista = verTodos[c.curso] ? c.temas : vinieron;
              return (
                <section key={c.curso} aria-label={c.nombre} className={tarjeta}>
                  <h2 className="text-lg font-extrabold text-foreground">{c.nombre} <span className="text-sm font-semibold text-muted-foreground">· {c.preguntas} preguntas</span></h2>
                  <ul className="divide-y divide-border">
                    {lista.map((t) => (
                      <li key={t.tema} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold text-foreground">{t.nombre}</span>
                          <span className="block text-muted-foreground">
                            {t.procesos ? `En ${t.procesos} de ${r.procesos} exámenes · ${t.porProceso.toLocaleString("es")} por examen` : "No vino en estos exámenes"}
                          </span>
                        </span>
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", t.categoria === "siempre" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                          {ROTULO[t.categoria]}
                        </span>
                        {c.curso !== "actitudinal" && t.procesos > 0 && (
                          <button
                            type="button"
                            disabled={armando !== null}
                            onClick={() => void practicar(`${c.curso}/${t.tema}`, { curso: c.curso, tema: t.tema })}
                            className="flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 font-semibold text-primary hover:bg-muted disabled:opacity-60"
                            aria-label={`Practicar ${t.nombre}`}
                          >
                            <Dumbbell className="h-4 w-4" aria-hidden /> {armando === `${c.curso}/${t.tema}` ? "Preparando…" : "Practicar"}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {nunca > 0 && (
                    <button type="button" onClick={() => setVerTodos((v) => ({ ...v, [c.curso]: !v[c.curso] }))} className="min-h-11 text-sm font-semibold text-primary hover:underline">
                      {verTodos[c.curso] ? "Ocultar los que no vinieron" : `Ver ${nunca} ${nunca === 1 ? "tema que no vino" : "temas que no vinieron"}`}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </main>
    </ResponsiveLayout>
  );
}
