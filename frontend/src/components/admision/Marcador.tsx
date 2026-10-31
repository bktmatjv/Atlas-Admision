import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock } from "lucide-react";
import type { DatosDeSanMarcos } from "@/hooks/useAdmisionDatos";
import { evaluarCarrera } from "@/lib/admision/ingresaba";
import { cn } from "@/lib/utils";

// "es": coma decimal, como la OCA (1 469,125).
const fmt = (x: number) => x.toLocaleString("es", { maximumFractionDigits: 3 });

/**
 * Cifras de marcador: cada dígito es una tira 0–9 que rueda hasta su valor. Es el único momento
 * de movimiento de la portada; con movimiento reducido la tira llega quieta.
 */
export function CifrasMarcador({ valor, className }: { valor: string; className?: string }) {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setListo(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <span className={cn("inline-flex font-display font-extrabold tabular-nums leading-none", className)} aria-label={valor} role="img">
      {[...valor].map((c, i) => {
        if (!/\d/.test(c)) return <span key={i} aria-hidden="true">{c}</span>;
        const d = Number(c);
        return (
          <span key={i} aria-hidden="true" className="relative inline-block h-[1em] overflow-hidden">
            <span
              className="flex flex-col transition-transform [transition-duration:900ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
              style={{ transform: `translateY(-${listo ? d : 0}em)`, transitionDelay: `${i * 70}ms` }}
            >
              {Array.from({ length: 10 }, (_, n) => (
                <span key={n} className="h-[1em]">{n}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

interface MarcadorProps {
  carreraId: string | null | undefined;
  carreraNombre: string | null;
  areaNombre: string;
  datos: DatosDeSanMarcos | undefined;
  /** Último puntaje comparable con su carrera (examen o simulacro completo de su área). */
  puntaje: number | null;
  diasParaExamen: number | null;
  cicloExamen?: string | null;
  /** Se conserva en la interfaz por compatibilidad; el marcador no muestra rachas. */
  rachaDias?: number;
  accion: { texto: string; onClick: () => void; cargando?: boolean } | null;
}

/**
 * El marcador de la portada: carrera, último puntaje en cifras de estadio, el último ingresante
 * contra el que se compara y lo que falta. Todas las cifras vienen del sistema; si no hay un
 * intento comparable no se inventa un número, se dice qué hacer para tenerlo.
 */
export function Marcador({
  carreraId,
  carreraNombre,
  areaNombre,
  datos,
  puntaje,
  diasParaExamen,
  cicloExamen,
  accion,
}: MarcadorProps) {
  const veredicto = carreraId && datos && puntaje !== null ? evaluarCarrera(puntaje, carreraId, datos.resultados, datos.procesos) : null;
  const reciente = veredicto?.procesos.find((p) => p.ingresaba !== null) ?? null;

  let titular: string;
  let detalle: string | null = null;
  if (!carreraId) {
    titular = "Elige tu carrera y empieza a sumar";
    detalle = "Con tu carrera sabremos contra qué puntaje juegas.";
  } else if (puntaje === null) {
    titular = "Aún no hay puntaje en el marcador";
    detalle = "Un diagnóstico o simulacro completo de tu área pone tu primera cifra.";
  } else if (!reciente) {
    titular = "Sin último ingresante publicado para comparar";
  } else if (reciente.ingresaba) {
    titular = reciente.empate ? `Empatas con el último ingresante de ${reciente.ciclo}` : `Ingresabas en ${reciente.ciclo}`;
    detalle = reciente.empate ? "En San Marcos los empatados ingresan todos." : `Por ${fmt(reciente.diferencia ?? 0)} puntos. Repite un simulacro para confirmarlo.`;
  } else {
    const f = reciente.preguntasQueFaltan ?? 0;
    titular = `Te ${f === 1 ? "falta" : "faltan"} ${f} ${f === 1 ? "pregunta" : "preguntas"}`;
    detalle = `Para alcanzar al último ingresante de ${reciente.ciclo}.`;
  }

  return (
    <section aria-label="Tu marcador" className="overflow-hidden rounded-[10px] bg-grafito text-white dark:bg-grafito-2 dark:ring-1 dark:ring-white/10">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-white/10 px-5 py-3 md:px-7">
        <p className="min-w-0 truncate text-sm font-semibold text-white/85">
          {carreraNombre ?? "Sin carrera elegida"}
          <span className="text-white/50"> · {areaNombre}</span>
        </p>
        <div className="flex items-center gap-4 text-sm text-white/70">
          {diasParaExamen !== null && diasParaExamen >= 0 && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 text-ambar" aria-hidden="true" />
              {diasParaExamen === 0 ? "Examen hoy" : `${diasParaExamen} ${diasParaExamen === 1 ? "día" : "días"} para el examen`}
              {cicloExamen ? <span className="text-white/45">({cicloExamen})</span> : null}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 px-5 py-6 md:grid-cols-[auto_1fr] md:items-center md:gap-10 md:px-7 md:py-8">
        <div className="flex items-end gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/55">Tu puntaje</p>
            {puntaje !== null ? (
              <CifrasMarcador valor={fmt(puntaje)} className="mt-1 text-[clamp(3.5rem,11vw,6rem)] text-ambar" />
            ) : (
              <p className="mt-2 flex gap-1.5" role="img" aria-label="Sin puntaje todavía">
                {/* Celdas apagadas del tablero: esperan una cifra, no la inventan */}
                {[0, 1, 2, 3].map((n) => (
                  <span key={n} className="block h-[clamp(3.5rem,11vw,6rem)] w-[clamp(2rem,6vw,3.4rem)] rounded-[4px] border border-white/15 bg-white/[0.04]" />
                ))}
              </p>
            )}
          </div>
          {reciente?.ultimoIngresante != null && (
            <div className="pb-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/55">Último ingresante</p>
              <p className="mt-1 font-display text-4xl font-bold leading-none tabular-nums text-white/90">{fmt(reciente.ultimoIngresante)}</p>
            </div>
          )}
        </div>

        <div className="space-y-4 md:border-l md:border-white/10 md:pl-10">
          <div className="space-y-1">
            <h1 className="font-display text-[1.9rem] font-extrabold uppercase text-white leading-[1.02] tracking-[0.01em] text-balance md:text-[2.4rem]">
              {titular}
            </h1>
            {detalle && <p className="max-w-prose text-[0.9375rem] leading-relaxed text-white/70">{detalle}</p>}
          </div>
          {accion && (
            <button
              type="button"
              onClick={accion.onClick}
              disabled={accion.cargando}
              className="group inline-flex min-h-12 items-center gap-2 rounded-md bg-ambar px-6 text-base font-bold text-grafito transition-[transform,background-color] duration-150 hover:bg-[hsl(40_100%_64%)] active:scale-[0.98] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ambar"
            >
              {accion.cargando ? "Preparando…" : accion.texto}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
