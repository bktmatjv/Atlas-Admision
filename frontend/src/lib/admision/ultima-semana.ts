/**
 * La última semana (tramo 6 de Audix): el día de SU examen (Medicina Humana tiene jornada propia), la
 * cuenta atrás y el plan de los últimos días. Traído de Audix (src/ultima-semana), con los enlaces de Atlas.
 */
import type { AreaUnmsm, ProcesoUnmsm } from "./datos-unmsm";
import { sumarDias } from "@/lib/admision/motor/admision-leitner";

export interface SuJornada { ciclo: string; fecha: string; detalle: string | null; verificado: boolean; fuente: string }

/** Su jornada más próxima, de hoy en adelante (el mismo día cuenta). `null` si no se conoce ninguna. */
export function jornadaDe(procesos: ProcesoUnmsm[], area: AreaUnmsm | "medicina", hoy: string): SuJornada | null {
  const esSuya = (j: ProcesoUnmsm["jornadas"][number]) => {
    const soloMedicina = /solo medicina/i.test(j.detalle ?? "");
    if (area === "medicina") return j.areas.includes("A") && soloMedicina;
    return j.areas.includes(area) && !soloMedicina;
  };
  const candidatas = procesos.flatMap((p) => p.jornadas.filter(esSuya).map((j) => ({
    ciclo: p.ciclo, fecha: j.fecha, detalle: j.detalle ?? null, verificado: p.verificado, fuente: p.fuente,
  }))).filter((j) => j.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return candidatas[0] ?? null;
}

export function diasHasta(hoy: string, fecha: string): number {
  const [a, b] = [hoy, fecha].map((d) => { const [y, m, x] = d.split("-").map(Number); return Date.UTC(y, m - 1, x); });
  return Math.round((b - a) / 86_400_000);
}

/** El modo de última semana: de 7 días antes al mismo día del examen. */
export const enUltimaSemana = (dias: number) => dias >= 0 && dias <= 7;

export interface Actividad { tipo: "temas" | "errores" | "simulacro" | "descanso" | "checklist" | "examen"; titulo: string; detalle: string; enlace: string }
export interface DiaFinal { fecha: string; diasAlExamen: number; actividades: Actividad[] }

/**
 * De hoy al examen: temas que más vienen y cuaderno de errores; un simulacro completo entre 5 y 3 días
 * antes (para tener tiempo de corregir); el día anterior, repaso ligero, preparar todo y descansar; y el día
 * del examen, la lista. Ningún tema nuevo en los últimos días.
 */
export function planUltimaSemana(hoy: string, fechaExamen: string, erroresPendientes: number): DiaFinal[] {
  const total = diasHasta(hoy, fechaExamen);
  if (!enUltimaSemana(total)) return [];
  const diaDelSimulacro = total >= 3 ? Math.min(total, 5) : null;
  const dias: DiaFinal[] = [];
  for (let d = total; d >= 0; d--) {
    const actividades: Actividad[] = [];
    if (d === 0) {
      actividades.push({ tipo: "examen", titulo: "Hoy es tu examen", detalle: "Desayuna, llega temprano y confía en lo que practicaste.", enlace: "#el-dia-del-examen" });
      actividades.push({ tipo: "checklist", titulo: "Repasa la lista del día", detalle: "Documentos, lápiz y nada de celular en el aula.", enlace: "#el-dia-del-examen" });
    } else if (d === 1) {
      actividades.push({ tipo: "errores", titulo: "Repaso ligero del cuaderno de errores", detalle: "Solo lo que ya entiendes: nada de temas nuevos.", enlace: "/admision" });
      actividades.push({ tipo: "checklist", titulo: "Deja todo listo para mañana", detalle: "Imprime el carné, revisa tu local y alista lo que llevas.", enlace: "#el-dia-del-examen" });
      actividades.push({ tipo: "descanso", titulo: "Duerme temprano", detalle: "Dormir bien suma más que estudiar de amanecida.", enlace: "#el-dia-del-examen" });
    } else if (d === diaDelSimulacro) {
      actividades.push({ tipo: "simulacro", titulo: "Un simulacro completo, con el tiempo del examen", detalle: "A la hora del examen real. Después, revisa lo que fallaste.", enlace: "/admision" });
    } else {
      actividades.push({ tipo: "temas", titulo: "Los temas que siempre vienen", detalle: "Practica los de los cursos que más pesan en tu área.", enlace: "/admision/temas" });
      actividades.push({ tipo: "errores", titulo: "Tu cuaderno de errores", detalle: erroresPendientes ? `Tienes ${erroresPendientes} por repasar.` : "Al día: repasa las que más te costaron.", enlace: "/admision" });
    }
    dias.push({ fecha: sumarDias(fechaExamen, -d), diasAlExamen: d, actividades });
  }
  return dias;
}
