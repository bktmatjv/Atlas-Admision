import type { SiguientePaso } from "@/lib/admision/siguiente-paso";
import type { AreaDeAdmision } from "@/integrations/supabase/admision";
import { AccionRecomendadaHero } from "@/components/admision/AccionRecomendadaHero";
import { TuCarrera } from "@/components/admision/TuCarrera";
import { cn } from "@/lib/utils";

export interface MainActionHeroProps {
  paso: SiguientePaso;
  carreraId: string | null | undefined;
  userId: string | null;
  area: AreaDeAdmision;
  areaNombre: string;
  armando: string | null;
  onEmpezar: (clave: string, payload: Record<string, unknown>) => void;
  className?: string;
}

/**
 * Acción Principal Condicional (Hero):
 * Implementa una jerarquía estricta para garantizar un único "siguiente paso" claro sin competencia visual:
 * - Prioridad 1 (Intento en curso): Renderiza únicamente la tarjeta "Retoma tu simulacro / intento".
 * - Prioridad 2 (Sin configurar): Si no hay intentos y la carrera no está configurada, renderiza "Tu carrera" como acción principal.
 * - Prioridad 3 (Configurado y listo): Renderiza la acción pedagógica recomendada (Diagnóstico o Simulacro nuevo).
 */
export function MainActionHero({
  paso,
  carreraId,
  userId,
  area,
  areaNombre,
  armando,
  onEmpezar,
  className,
}: MainActionHeroProps) {
  // Prioridad 1 (Intento en curso): Únicamente retomar el simulacro/intento pendiente
  if (paso.tipo === "continuar") {
    return (
      <div className={cn("transition-all", className)}>
        <AccionRecomendadaHero
          paso={paso}
          area={area}
          areaNombre={areaNombre}
          armando={armando}
          onEmpezar={onEmpezar}
        />
      </div>
    );
  }

  // Prioridad 2 (Sin configurar): La acción principal es elegir carrera
  if (!carreraId) {
    return (
      <div className={cn("transition-all", className)}>
        <TuCarrera userId={userId} titulo="Busca tu carrera" />
      </div>
    );
  }

  // Prioridad 3 (Diagnóstico pendiente): Medir nivel inicial con 30 preguntas
  if (paso.tipo === "diagnostico") {
    return (
      <div className={cn("transition-all", className)}>
        <AccionRecomendadaHero
          paso={paso}
          area={area}
          areaNombre={areaNombre}
          armando={armando}
          onEmpezar={onEmpezar}
        />
      </div>
    );
  }

  // Con carrera y diagnóstico completo, las modalidades de entrenamiento colapsables de abajo
  // son el canal directo para continuar practicando sin redundancia visual.
  return null;
}

