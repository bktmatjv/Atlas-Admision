import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import { admision, type AreaDeAdmision } from '@/integrations/api/admision';
import { useDatosDeSanMarcos, usePerfilDeAdmision } from "@/hooks/useAdmisionDatos";
import { puntajeParaIngresaba, type IntentoParaIngresaba } from "@/lib/admision/diagnostico";
import { percentil, racha } from "@/lib/admision/progreso";
import { areaDelExamen } from "@/lib/admision/buscar-escuela";
import { soloDeSuArea } from "@/lib/admision/ingresaba-del-area";
import { diaDeLima } from "@/lib/admision/motor/admision-leitner";

const fmt = (x: number) => x.toLocaleString("es", { maximumFractionDigits: 3 });
const DIAS = ["L", "M", "M", "J", "V", "S", "D"];

export interface IntentoDelProgreso extends IntentoParaIngresaba { area: AreaDeAdmision; created_at: string }

/**
 * «Tu progreso» (tramo 6 de Audix): la racha de días con algo entregado, tus puntajes frente al último
 * ingresante de tu escuela y el percentil frente a quienes de verdad postularon (OCA, solo conteos).
 */
export function Progreso({ userId, intentos }: { userId: string | null; intentos: IntentoDelProgreso[] }) {
  const perfil = usePerfilDeAdmision(userId);
  const datos = useDatosDeSanMarcos(!!userId);
  const carreraId = perfil.data?.carrera_id ?? null;
  const hoy = diaDeLima(new Date());

  const entregados = intentos.filter((i) => i.estado === "entregado");
  const r = racha(entregados.map((i) => i.created_at), hoy);
  const escuela = datos.data?.carreras.find((c) => c.id === carreraId) ?? null;
  // Los puntajes se comparan con su escuela: un simulacro de otra área no cuenta (la racha, sí).
  const areaDeSuEscuela = escuela ? areaDelExamen(escuela) : null;
  const serie = useMemo(() => soloDeSuArea(entregados, areaDeSuEscuela)
    .map((i) => ({ fecha: i.created_at, c: puntajeParaIngresaba(i, i.area) }))
    .filter((x) => x.c !== null)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((x) => ({ fecha: x.fecha, puntaje: x.c!.puntaje, estimado: x.c!.aviso !== null })), [entregados, areaDeSuEscuela]);

  const reciente = datos.data?.resultados.filter((x) => x.carrera_id === carreraId && x.ultimo_ingresante !== null)
    .sort((a, b) => b.ciclo.localeCompare(a.ciclo, "es", { numeric: true }))[0] ?? null;
  const distribucion = useQuery({
    queryKey: ["admision-distribucion", carreraId, reciente?.ciclo],
    enabled: !!carreraId && !!reciente,
    retry: false,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await admision.unmsm();
      if (error) throw error;
      return data?.distribuciones.find(x => x.carrera_id === carreraId && x.ciclo === reciente!.ciclo) ?? null;
    },
  });

  if (!userId || entregados.length === 0) return null;
  const ultimo = serie.at(-1) ?? null;
  const pct = ultimo && distribucion.data ? percentil({ ...distribucion.data, desde: Number(distribucion.data.desde), ancho: Number(distribucion.data.ancho) }, ultimo.puntaje) : null;
  // Los días de la semana de los últimos 7, terminando hoy.
  const etiquetas = r.ultimos7.map((_, i) => DIAS[(new Date(`${hoy}T12:00:00`).getDay() + 6 - (6 - i)) % 7]);

  return (
    <section aria-labelledby="progreso-titulo" className="min-w-0 space-y-3 rounded-2xl border border-border bg-card p-5">
      <h2 id="progreso-titulo" className="text-lg font-extrabold text-foreground">Tu progreso</h2>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-foreground">
          <Flame className="h-4 w-4 text-primary" aria-hidden />
          {r.actual ? `${r.actual} ${r.actual === 1 ? "día seguido" : "días seguidos"}` : "Hoy puedes empezar una racha"}
        </span>
        <ol className="flex gap-1" aria-label="Los últimos 7 días">
          {r.ultimos7.map((activo, i) => (
            <li key={i} title={activo ? "Estudiaste" : "Sin estudiar"} className={`grid h-7 w-7 place-items-center rounded-md text-xs font-semibold ${activo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              <span aria-hidden>{etiquetas[i]}</span><span className="sr-only">{activo ? "estudiaste" : "sin estudiar"}</span>
            </li>
          ))}
        </ol>
        {r.mejor > r.actual && <span className="text-muted-foreground">Tu mejor racha: {r.mejor} días.</span>}
      </div>
      {serie.length > 0 && (
        <p className="text-sm">
          Tus puntajes: <span className="tabular-nums">{serie.map((s) => `${fmt(s.puntaje)}${s.estimado ? "*" : ""}`).join(" → ")}</span>
          {reciente && escuela && <> · último ingresante de {escuela.nombre} en {reciente.ciclo}: <strong className="tabular-nums">{fmt(reciente.ultimo_ingresante!)}</strong></>}
          {serie.some((s) => s.estimado) && <span className="block text-xs text-muted-foreground">* estimado (diagnóstico o examen con preguntas anuladas).</span>}
        </p>
      )}
      {pct !== null && ultimo && escuela && reciente && (
        <p className="text-sm">
          Con {fmt(ultimo.puntaje)} superabas al <strong>{fmt(pct)} %</strong> de quienes rindieron el examen para {escuela.nombre} en {reciente.ciclo}
          <span className="text-muted-foreground"> (dato oficial de la OCA, solo conteos por tramo).</span>
        </p>
      )}
    </section>
  );
}
