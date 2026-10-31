import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { admision, type AreaDeAdmision } from '@/integrations/api/admision';
import { useDatosDeSanMarcos, usePerfilDeAdmision } from "@/hooks/useAdmisionDatos";
import { puntajeParaIngresaba, type IntentoParaIngresaba } from "@/lib/admision/diagnostico";
import { percentil } from "@/lib/admision/progreso";
import { areaDelExamen } from "@/lib/admision/buscar-escuela";
import { soloDeSuArea } from "@/lib/admision/ingresaba-del-area";
import { diaDeLima } from "@/lib/admision/motor/admision-leitner";

const fmt = (x: number) => x.toLocaleString("es", { maximumFractionDigits: 3 });

export interface IntentoDelProgreso extends IntentoParaIngresaba { area: AreaDeAdmision; created_at: string }

/**
 * «Tu progreso» (tramo 6 de Audix): tus puntajes frente al último
 * ingresante de tu escuela y el percentil frente a quienes de verdad postularon (OCA, solo conteos).
 */
export function Progreso({ userId, intentos }: { userId: string | null; intentos: IntentoDelProgreso[] }) {
  const perfil = usePerfilDeAdmision(userId);
  const datos = useDatosDeSanMarcos(!!userId);
  const carreraId = perfil.data?.carrera_id ?? null;
  const hoy = diaDeLima(new Date());

  const entregados = intentos.filter((i) => i.estado === "entregado");
  const escuela = datos.data?.carreras.find((c) => c.id === carreraId) ?? null;
  // Los puntajes se comparan con su escuela: un simulacro de otra área no cuenta .
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

  return (
    <section aria-labelledby="progreso-titulo" className="min-w-0 space-y-3 p-5">
      <h2 id="progreso-titulo" className="text-lg font-extrabold text-foreground">Tu progreso</h2>
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
