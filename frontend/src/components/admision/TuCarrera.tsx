import { useId, useMemo, useState } from "react";
import { GraduationCap, Search } from "lucide-react";
import { useDatosDeSanMarcos, usePerfilDeAdmision } from "@/hooks/useAdmisionDatos";
import { areaDelExamen, buscarEscuelas } from "@/lib/admision/buscar-escuela";

const AREA: Record<string, string> = {
  A: "Área A · Ciencias de la Salud", B: "Área B · Ciencias Básicas", C: "Área C · Ingenierías",
  D: "Área D · Ciencias Económicas y de la Gestión", E: "Área E · Humanidades y Ciencias Jurídicas y Sociales",
};

/**
 * La escuela de San Marcos a la que postula el alumno: con ella, «¿Ingresaba?» sabe contra quién
 * compararlo y la portada elige el área del simulacro. Se pide aquí y no en un onboarding nuevo; si ya
 * la dijo en el onboarding de Atlas, viene rellena (20261015120000).
 *
 * Si las tablas aún no existen (migración sin aplicar), no sale.
 */
export function TuCarrera({ userId, titulo = "Tu carrera" }: { userId: string | null; titulo?: string }) {
  const datos = useDatosDeSanMarcos(!!userId);
  const perfil = usePerfilDeAdmision(userId);
  const [editando, setEditando] = useState(false);
  const [consulta, setConsulta] = useState("");
  const idCampo = useId();

  const carreras = useMemo(() => datos.data?.carreras ?? [], [datos.data]);
  const actual = carreras.find((c) => c.id === perfil.data?.carrera_id) ?? null;
  const otraUniversidad = perfil.data && perfil.data.universidad !== "unmsm";
  const resultados = useMemo(() => buscarEscuelas(carreras, consulta, 8), [carreras, consulta]);

  if (!userId || datos.isError || perfil.isError) return null;
  if (datos.isLoading || perfil.isLoading) return <div className="h-24 animate-pulse rounded-2xl border border-border bg-card" aria-hidden />;

  const elegir = (universidad: string, carrera_id: string | null) => {
    perfil.guardar.mutate({ universidad, carrera_id }, { onSuccess: () => { setEditando(false); setConsulta(""); } });
  };

  const buscando = editando || (!actual && !otraUniversidad);

  return (
    <section aria-labelledby={`${idCampo}-titulo`} className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-muted">
          <GraduationCap className="h-5 w-5 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${idCampo}-titulo`} className="text-lg font-extrabold text-foreground">{titulo}</h2>
          {!buscando && actual && (
            <p className="text-sm text-muted-foreground">
              Postulas a <strong className="text-foreground">{actual.nombre}</strong> · {areaDelExamen(actual) === "medicina" ? "examen de Medicina Humana" : AREA[actual.area]}
            </p>
          )}
          {!buscando && otraUniversidad && (
            <p className="text-sm text-muted-foreground">Postulas a otra universidad. Los simulacros de CALIBRA siguen el examen de San Marcos.</p>
          )}
          {buscando && <p className="text-sm text-muted-foreground">Elige tu carrera y te decimos si con tu puntaje ingresabas.</p>}
        </div>
        {!buscando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="min-h-11 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Cambiar
          </button>
        )}
      </div>

      {buscando && (
        <div className="space-y-2">
          <label htmlFor={idCampo} className="block text-sm font-semibold">¿A qué carrera de San Marcos postulas?</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id={idCampo}
              type="search"
              autoComplete="off"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Por ejemplo: medicina, ing sistemas, derecho"
              className="block min-h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {consulta.trim() !== "" && (
            resultados.length ? (
              <ul aria-label="Carreras que coinciden" className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {resultados.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={perfil.guardar.isPending}
                      onClick={() => elegir("unmsm", c.id)}
                      className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset disabled:opacity-60"
                    >
                      <span className="font-semibold text-foreground">{c.nombre}</span>
                      <span className="shrink-0 text-muted-foreground">Área {c.area}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No hay ninguna carrera con ese nombre. Prueba con una sola palabra.</p>
            )
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <button
              type="button"
              onClick={() => elegir("otra", null)}
              className="min-h-11 font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md px-1"
            >
              No postulo a San Marcos
            </button>
            {editando && (
              <button
                type="button"
                onClick={() => { setEditando(false); setConsulta(""); }}
                className="min-h-11 font-semibold text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md px-1"
              >
                Cancelar
              </button>
            )}
          </div>
          {perfil.guardar.isError && <p role="alert" className="text-sm text-destructive">No se pudo guardar. Revisa tu conexión y vuelve a elegir.</p>}
        </div>
      )}
    </section>
  );
}
