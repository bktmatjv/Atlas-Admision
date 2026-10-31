import type { Consulta } from "@/integrations/local/consulta";
import { supabase } from "./client";
import type { CarreraUnmsm, DistribucionUnmsm, ItemDelDia, ProcesoUnmsm, ResultadoUnmsm } from "@/lib/admision/datos-unmsm";

/**
 * Tipos de las tablas y funciones del examen de admisión (migraciones 20261004170000 y
 * 20261004180000). Mismo criterio provisional que `exams.ts`: hasta que se regeneren los tipos.
 */

export type AreaDeAdmision = "A" | "B" | "C" | "D" | "E" | "medicina";

export type ExamenDeAdmision = {
  id: string; universidad: string; ciclo: string; area: AreaDeAdmision; fecha: string | null;
  n_preguntas: number; opciones_por_pregunta: number; created_at: string;
};

export type InformeDeIntento = {
  puntaje: number; maximo: number; aciertos: number; errores: number; blancos: number; anuladas?: number;
  /** `puntos` desde la integración de Audix (admision-entregar la guarda por curso). */
  porCurso: Record<string, { aciertos: number; errores: number; blancos: number; puntos?: number }>;
};

export type IntentoDeAdmision = {
  id: string; user_id: string; modo: "real" | "simulacro" | "repaso" | "diagnostico"; tipo: "cronometrado" | "practica"; area: AreaDeAdmision;
  examen_id: string | null; filtro: { curso: string; tema?: string } | null; preguntas: string[]; ver_soluciones: boolean;
  started_at: string; duration_minutes: number | null; estado: "en_curso" | "entregado" | "abandonado"; entregado_at: string | null;
  puntaje: number | null; informe: InformeDeIntento | null; created_at: string;
};

export type RespuestaDeAdmision = {
  intento_id: string; pregunta_id: string; opcion: string | null; marcada: boolean; segundos: number;
  revelada: boolean; correcta: boolean | null; updated_at: string;
  /** De 20261015130000: 1 dudo, 2 más o menos, 3 seguro. Opcional. */
  confianza?: number | null;
};

/** Lo que devuelve `admision_preguntas_del_intento`: la clave y la solución, solo entregado. */
export type PreguntaDelIntento = {
  pregunta_id: string; orden: number; numero: number | null; enunciado: string; opciones: Record<string, string>;
  graficos: string[]; texto_id: string | null; texto_etiqueta: string | null; texto_cuerpo: string | null;
  curso: string | null; tema: string | null; clave: string | null; solucion: string | null;
};

/** De 20261015120000: la universidad y la escuela a la que postula el alumno. */
export type PerfilDeAdmision = {
  user_id: string; universidad: string; carrera_id: string | null; horas_semana: number | null;
  origen: "alumno" | "onboarding"; updated_at: string;
};

type Tablas = {
  admision_examenes: ExamenDeAdmision;
  admision_intentos: IntentoDeAdmision;
  admision_respuestas: RespuestaDeAdmision;
  admision_carreras: CarreraUnmsm;
  admision_procesos: ProcesoUnmsm;
  admision_resultados: ResultadoUnmsm;
  admision_perfil: PerfilDeAdmision;
  admision_errores: { user_id: string; pregunta_id: string; caja: 1 | 2 | 3; proxima: string; veces: number; repasos: number; dominada: boolean; agregada_en: string; updated_at: string };
  admision_dia_examen: ItemDelDia;
  admision_distribuciones: DistribucionUnmsm;
};

/** El cliente con las tablas tipadas, como `SupabaseClient<AdmisionDatabase>` en Atlas, sobre los datos locales. */
export const admisionDb = {
  from: <K extends keyof Tablas>(tabla: K) => supabase.from<Tablas[K]>(tabla) as Consulta<Tablas[K]>,
  rpc: supabase.rpc,
};

export const BUCKET_DE_GRAFICOS = "admision-graficos";
