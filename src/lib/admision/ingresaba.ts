/**
 * «¿Ingresaba?»: un puntaje frente al último ingresante de una escuela, proceso por proceso. Traído de
 * Audix Admisión (src/ingresaba) y adaptado a las tablas de Atlas (`admision_resultados`, …).
 */
import type { AreaUnmsm, CarreraUnmsm, ProcesoUnmsm, ResultadoUnmsm } from "./datos-unmsm";
import { FORMULA_UNMSM, cumpleRequisitoGeneral, preguntasParaSubir, redondear3 } from "./formula";

export interface VeredictoProceso {
  ciclo: string;
  /** null si el proceso no publica al último ingresante de la escuela. */
  ingresaba: boolean | null;
  empate: boolean;
  /** puntaje − último ingresante (negativo = te faltó). */
  diferencia: number | null;
  /** Correctas más (en lugar de blancos) que hacían falta; 0 si alcanzaba. */
  preguntasQueFaltan: number | null;
  cumpleRequisitoGeneral: boolean;
  vacantes: number | null;
  ingresantes: number;
  postulantes: number;
  /** Postulantes por vacante (o por ingresante si no hay vacantes publicadas). */
  postulantesPorVacante: number | null;
  ultimoIngresante: number | null;
  maximo: number | null;
  verificado: boolean;
  fuente: string;
}

export function evaluarProceso(puntaje: number, r: ResultadoUnmsm): VeredictoProceso {
  const general = cumpleRequisitoGeneral(puntaje);
  const ultimo = r.ultimo_ingresante;
  const diferencia = ultimo === null ? null : redondear3(puntaje - ultimo);
  const empate = diferencia === 0;
  const alcanzaUltimo = diferencia === null ? null : diferencia > 0 || (empate && FORMULA_UNMSM.empateIngresanTodos);
  const ingresaba = alcanzaUltimo === null ? null : alcanzaUltimo && general;
  // Lo que falta es lo que exige la condición más dura: el último ingresante o el puntaje positivo.
  const EPS = 0.001;
  const faltan = diferencia === null ? null : Math.max(
    alcanzaUltimo ? 0 : preguntasParaSubir(-diferencia + (FORMULA_UNMSM.empateIngresanTodos ? 0 : EPS)),
    general ? 0 : preguntasParaSubir(FORMULA_UNMSM.puntajeMinimoGeneral - puntaje + EPS),
  );
  const divisor = r.vacantes ?? r.ingresantes;
  return {
    ciclo: r.ciclo, ingresaba, empate, diferencia, preguntasQueFaltan: faltan, cumpleRequisitoGeneral: general,
    vacantes: r.vacantes, ingresantes: r.ingresantes, postulantes: r.postulantes,
    postulantesPorVacante: divisor > 0 ? Math.round((r.postulantes / divisor) * 10) / 10 : null,
    ultimoIngresante: ultimo, maximo: r.maximo, verificado: r.verificado, fuente: r.fuente,
  };
}

export interface VeredictoCarrera {
  carreraId: string;
  /** Del proceso más reciente al más antiguo. */
  procesos: VeredictoProceso[];
  veces: number;
  conDato: number;
  sinDatos: boolean;
}

const fechaDe = (procesos: ProcesoUnmsm[]) => (ciclo: string) => procesos.find((p) => p.ciclo === ciclo)?.fecha_examen ?? ciclo;

export function evaluarCarrera(puntaje: number, carreraId: string, resultados: ResultadoUnmsm[], procesos: ProcesoUnmsm[]): VeredictoCarrera {
  const fecha = fechaDe(procesos);
  const lista = resultados.filter((r) => r.carrera_id === carreraId)
    .sort((a, b) => fecha(b.ciclo).localeCompare(fecha(a.ciclo)))
    .map((r) => evaluarProceso(puntaje, r));
  const conDato = lista.filter((v) => v.ingresaba !== null);
  return { carreraId, procesos: lista, veces: conDato.filter((v) => v.ingresaba).length, conDato: conDato.length, sinDatos: conDato.length === 0 };
}

export interface Alternativa { carrera: CarreraUnmsm; ciclo: string; ultimo: number; margen: number; postulantesPorVacante: number | null }

/** Escuelas del mismo área a las que el puntaje alcanzaba en su proceso más reciente, de la más exigente a la menos. */
export function carrerasAlternativas(
  puntaje: number, area: AreaUnmsm, carreras: CarreraUnmsm[], resultados: ResultadoUnmsm[], procesos: ProcesoUnmsm[],
  excluir: string[] = [], limite = 6,
): Alternativa[] {
  if (!cumpleRequisitoGeneral(puntaje)) return [];
  const fecha = fechaDe(procesos);
  const out: Alternativa[] = [];
  for (const c of carreras) {
    if (c.area !== area || excluir.includes(c.id)) continue;
    const reciente = resultados.filter((r) => r.carrera_id === c.id && r.ultimo_ingresante !== null)
      .sort((a, b) => fecha(b.ciclo).localeCompare(fecha(a.ciclo)))[0];
    if (!reciente) continue;
    const v = evaluarProceso(puntaje, reciente);
    if (v.ingresaba) out.push({ carrera: c, ciclo: reciente.ciclo, ultimo: reciente.ultimo_ingresante!, margen: v.diferencia!, postulantesPorVacante: v.postulantesPorVacante });
  }
  return out.sort((a, b) => b.ultimo - a.ultimo).slice(0, limite);
}

/** Lo mínimo de un intento para saber si su puntaje se puede comparar con el de un examen real. */
export interface IntentoComparable {
  estado: string; modo: string; filtro: unknown; puntaje: number | null; informe: { maximo: number } | null;
}

/** Por debajo de 50 preguntas válidas (1000 puntos posibles), proyectar a 100 sería inventar. */
const MAXIMO_MINIMO = 1000;

/**
 * El puntaje de un intento listo para compararlo con los resultados de San Marcos. Solo sirven los
 * exámenes y simulacros completos y entregados; si tuvo menos de 100 preguntas válidas (un examen
 * real con preguntas descartadas), se proyecta a 2000 y se avisa. La práctica no cuenta.
 */
export function puntajeComparable(i: IntentoComparable): { puntaje: number; proyectado: boolean } | null {
  if (i.estado !== "entregado" || i.filtro || (i.modo !== "real" && i.modo !== "simulacro")) return null;
  const maximo = i.informe?.maximo ?? 0;
  if (i.puntaje === null || maximo < MAXIMO_MINIMO) return null;
  if (maximo >= FORMULA_UNMSM.maximo) return { puntaje: i.puntaje, proyectado: false };
  return { puntaje: redondear3((i.puntaje * FORMULA_UNMSM.maximo) / maximo), proyectado: true };
}
