import { useState, useId, type KeyboardEvent } from "react";
import { FileText, Sliders, History, ChevronDown } from "lucide-react";
import type { AreaDeAdmision } from "@/integrations/supabase/admision";
import { AREAS_DEL_EXAMEN } from "@/lib/admision/areas";
import { CURSOS } from "@/lib/admision/temario";
import { cn } from "@/lib/utils";

const AREAS = AREAS_DEL_EXAMEN;
const CURSOS_DE_PRACTICA = CURSOS.filter((c) => c.id !== "actitudinal");

interface ExamenItem {
  id: string;
  ciclo: string;
  area: string;
}

interface ExploracionEntrenamientoProps {
  area: AreaDeAdmision;
  onAreaChange: (a: AreaDeAdmision) => void;
  examenes: ExamenItem[];
  examenId: string;
  onExamenIdChange: (id: string) => void;
  cronometrado: boolean;
  onCronometradoChange: (v: boolean) => void;
  curso: string;
  onCursoChange: (c: string) => void;
  tema: string;
  onTemaChange: (t: string) => void;
  n: number;
  onNChange: (n: number) => void;
  verSoluciones: boolean;
  onVerSolucionesChange: (v: boolean) => void;
  armando: string | null;
  onEmpezar: (clave: string, payload: Record<string, unknown>) => void;
  esSimulacroPasoRecomendado?: boolean;
  className?: string;
}

type Modalidad = "simulacro" | "practica" | "real";

/**
 * Modalidades de Entrenamiento Colapsables:
 * Muestra inicialmente tarjetas de acceso rápido compactas (título, ícono y descripción).
 * Los formularios correspondientes solo se despliegan tras la interacción del usuario.
 */
export function ExploracionEntrenamiento({
  area,
  onAreaChange,
  examenes,
  examenId,
  onExamenIdChange,
  cronometrado,
  onCronometradoChange,
  curso,
  onCursoChange,
  tema,
  onTemaChange,
  n,
  onNChange,
  verSoluciones,
  onVerSolucionesChange,
  armando,
  onEmpezar,
  esSimulacroPasoRecomendado = false,
  className,
}: ExploracionEntrenamientoProps) {
  const [modalidadAbierta, setModalidadAbierta] = useState<Modalidad | null>(null);

  const idSimArea = useId();
  const idSimCrono = useId();
  const idPracCurso = useId();
  const idPracTema = useId();
  const idPracN = useId();
  const idPracSol = useId();
  const idRealExamen = useId();

  const temasDelCurso = CURSOS.find((c) => c.id === curso)?.temas ?? [];

  const alternar = (m: Modalidad) => {
    setModalidadAbierta((actual) => (actual === m ? null : m));
  };

  const handleKeyDown = (e: KeyboardEvent, m: Modalidad) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      alternar(m);
    }
  };

  const campo = "mt-1.5 block min-h-11 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary";
  const tarjetaColapsable = "px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5";
  const botonSecundario = "inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99] disabled:opacity-60";
  const botonPrimario = "inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99] disabled:opacity-60";

  return (
    <section aria-labelledby="t-modalidades-titulo" className={cn("space-y-3", className)}>
      <div className="space-y-1">
        <h2 id="t-modalidades-titulo" className="font-display text-[1.75rem] font-extrabold uppercase leading-none tracking-[0.01em] text-foreground">
          Entrena a tu ritmo
        </h2>
        <p className="text-sm text-muted-foreground">
          Toca una modalidad para elegir sus opciones.
        </p>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
        {/* 1. Tarjeta Colapsable: Simulacro nuevo */}
        <div className={tarjetaColapsable}>
          <div
            role="button"
            tabIndex={0}
            aria-expanded={modalidadAbierta === "simulacro"}
            aria-controls="panel-simulacro"
            onClick={() => alternar("simulacro")}
            onKeyDown={(e) => handleKeyDown(e, "simulacro")}
            className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 py-1 select-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center text-primary"
              >
                <Sliders className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="font-extrabold text-foreground text-sm sm:text-base">Simulacro a tu medida</h3>
                <p className="text-sm text-muted-foreground">
                  Elige el área y si va con reloj; preguntas que aún no viste
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 min-h-[44px]">
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center text-muted-foreground transition-transform duration-200",
                  modalidadAbierta === "simulacro" && "rotate-180 text-primary"
                )}
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
          </div>

          {modalidadAbierta === "simulacro" && (
            <div
              id="panel-simulacro"
              className="mt-4 border-t border-border/60 pt-4 space-y-3.5 animate-in fade-in-50 duration-200"
            >
              <div>
                <label htmlFor={idSimArea} className="block text-sm font-semibold text-foreground">
                  Área del examen
                </label>
                <select
                  id={idSimArea}
                  className={campo}
                  value={area}
                  onChange={(e) => onAreaChange(e.target.value as AreaDeAdmision)}
                >
                  {AREAS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <label htmlFor={idSimCrono} className="flex min-h-11 items-center gap-2.5 text-sm font-semibold text-foreground cursor-pointer">
                <input
                  id={idSimCrono}
                  type="checkbox"
                  checked={cronometrado}
                  onChange={(e) => onCronometradoChange(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span>Con tiempo oficial de examen</span>
              </label>

              <button
                type="button"
                className={esSimulacroPasoRecomendado ? botonPrimario : botonSecundario}
                disabled={armando !== null}
                onClick={() =>
                  onEmpezar("simulacro", {
                    modo: "simulacro",
                    area,
                    tipo: cronometrado ? "cronometrado" : "practica",
                  })
                }
              >
                {armando === "simulacro" ? "Preparando…" : "Empezar simulacro"}
              </button>
            </div>
          )}
        </div>

        {/* 2. Tarjeta Colapsable: Practicar curso o tema */}
        <div className={tarjetaColapsable}>
          <div
            role="button"
            tabIndex={0}
            aria-expanded={modalidadAbierta === "practica"}
            aria-controls="panel-practica"
            onClick={() => alternar("practica")}
            onKeyDown={(e) => handleKeyDown(e, "practica")}
            className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 py-1 select-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center text-primary"
              >
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="font-extrabold text-foreground text-sm sm:text-base">Practicar curso o tema</h3>
                <p className="text-sm text-muted-foreground">
                  Práctica sin reloj con solución explicada inmediata
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 min-h-[44px]">
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center text-muted-foreground transition-transform duration-200",
                  modalidadAbierta === "practica" && "rotate-180 text-primary"
                )}
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
          </div>

          {modalidadAbierta === "practica" && (
            <div
              id="panel-practica"
              className="mt-4 border-t border-border/60 pt-4 space-y-3.5 animate-in fade-in-50 duration-200"
            >
              <div>
                <label htmlFor={idPracCurso} className="block text-sm font-semibold text-foreground">
                  Curso
                </label>
                <select
                  id={idPracCurso}
                  className={campo}
                  value={curso}
                  onChange={(e) => {
                    onCursoChange(e.target.value);
                    onTemaChange("");
                  }}
                >
                  {CURSOS_DE_PRACTICA.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={idPracTema} className="block text-sm font-semibold text-foreground">
                  Tema específico
                </label>
                <select
                  id={idPracTema}
                  className={campo}
                  value={tema}
                  onChange={(e) => onTemaChange(e.target.value)}
                >
                  <option value="">Todo el curso</option>
                  {temasDelCurso.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={idPracN} className="block text-sm font-semibold text-foreground">
                  Número de preguntas
                </label>
                <input
                  id={idPracN}
                  type="number"
                  min={1}
                  max={50}
                  value={n}
                  onChange={(e) => onNChange(Number(e.target.value) || 10)}
                  className={campo}
                />
              </div>

              <label htmlFor={idPracSol} className="flex min-h-11 items-center gap-2.5 text-sm font-semibold text-foreground cursor-pointer">
                <input
                  id={idPracSol}
                  type="checkbox"
                  checked={verSoluciones}
                  onChange={(e) => onVerSolucionesChange(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span>Ver solución tras cada respuesta</span>
              </label>

              <button
                type="button"
                className={botonSecundario}
                disabled={armando !== null}
                onClick={() =>
                  onEmpezar("practica", {
                    modo: "practica",
                    area,
                    curso,
                    ...(tema ? { tema } : {}),
                    n,
                    ver_soluciones: verSoluciones,
                  })
                }
              >
                {armando === "practica" ? "Preparando…" : "Empezar práctica"}
              </button>
            </div>
          )}
        </div>

        {/* 3. Tarjeta Colapsable: Examen real */}
        <div className={tarjetaColapsable}>
          <div
            role="button"
            tabIndex={0}
            aria-expanded={modalidadAbierta === "real"}
            aria-controls="panel-real"
            onClick={() => alternar("real")}
            onKeyDown={(e) => handleKeyDown(e, "real")}
            className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 py-1 select-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center text-primary"
              >
                <History className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="font-extrabold text-foreground text-sm sm:text-base">Examen real histórico</h3>
                <p className="text-sm text-muted-foreground">
                  Un examen pasado completo tal cual fue tomado
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 min-h-[44px]">
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center text-muted-foreground transition-transform duration-200",
                  modalidadAbierta === "real" && "rotate-180 text-primary"
                )}
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
          </div>

          {modalidadAbierta === "real" && (
            <div
              id="panel-real"
              className="mt-4 border-t border-border/60 pt-4 space-y-3.5 animate-in fade-in-50 duration-200"
            >
              <div>
                <label htmlFor={idRealExamen} className="block text-sm font-semibold text-foreground">
                  Seleccionar examen oficial
                </label>
                <select
                  id={idRealExamen}
                  className={campo}
                  value={examenId}
                  onChange={(e) => onExamenIdChange(e.target.value)}
                >
                  <option value="">Elige uno del banco</option>
                  {examenes.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.ciclo} · {AREAS.find((a) => a.id === x.area)?.nombre ?? x.area}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className={botonSecundario}
                disabled={!examenId || armando !== null}
                onClick={() =>
                  onEmpezar("real", {
                    modo: "real",
                    examen_id: examenId,
                    tipo: "cronometrado",
                  })
                }
              >
                {armando === "real" ? "Preparando…" : "Empezar examen"}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
