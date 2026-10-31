/**
 * El diagnóstico (tramo 5 de Audix): 30 preguntas que se proyectan al examen completo del área. Traído de
 * Audix (`estimarExamen`, src/scoring): cada curso con su acierto en el diagnóstico (o el global si no tuvo
 * preguntas de él) por las preguntas que trae en el examen real, y un rango de ±1 desviación.
 */
import { moldeDe, type AreaExamen } from "@/lib/admision/motor/admision-molde";
import { FORMULA_UNMSM, puntosDe, redondear3 } from "./formula";
import { puntajeComparable, type IntentoComparable } from "./ingresaba";

type Conteo = { aciertos: number; errores: number; blancos: number };
const fmt = (x: number) => x.toLocaleString("es", { maximumFractionDigits: 0 });

export function proyectarAlExamen(porCurso: Record<string, Conteo>, area: AreaExamen) {
  const global = Object.values(porCurso).reduce((s, c) => ({ aciertos: s.aciertos + c.aciertos, errores: s.errores + c.errores, blancos: s.blancos + c.blancos }), { aciertos: 0, errores: 0, blancos: 0 });
  const muestra = global.aciertos + global.errores + global.blancos;
  const tasas = (c: Conteo) => {
    const n = c.aciertos + c.errores + c.blancos;
    return n === 0 ? { pa: 0, pe: 0, pb: 1 } : { pa: c.aciertos / n, pe: c.errores / n, pb: c.blancos / n };
  };
  let estimado = 0, varianza = 0, minimo = 0, maximo = 0;
  const out: Record<string, number> = {};
  for (const { curso, preguntas } of moldeDe(area)) {
    const c = porCurso[curso];
    const observadas = c ? c.aciertos + c.errores + c.blancos : 0;
    const { pa, pe, pb } = tasas(observadas ? c : global);
    const v = puntosDe(curso);
    const media = pa * v.acierto + pe * v.error + pb * v.blanco;
    const segundo = pa * v.acierto ** 2 + pe * v.error ** 2 + pb * v.blanco ** 2;
    const varPregunta = Math.max(0, segundo - media ** 2);
    // Más incertidumbre cuanto menos se observó del curso.
    varianza += preguntas * varPregunta + (preguntas ** 2 * varPregunta) / Math.max(1, observadas || muestra);
    estimado += preguntas * media;
    minimo += preguntas * v.error;
    maximo += preguntas * v.acierto;
    out[curso] = redondear3(preguntas * media);
  }
  const de = Math.sqrt(varianza);
  return {
    estimado: redondear3(estimado),
    minimo: redondear3(Math.max(minimo, estimado - de)),
    maximo: redondear3(Math.min(maximo, estimado + de)),
    muestra,
    porCurso: out,
  };
}

export interface IntentoParaIngresaba extends IntentoComparable {
  informe: { maximo: number; porCurso?: Record<string, Conteo> } | null;
}

/**
 * El puntaje con el que comparar un intento en «¿Ingresaba?» y, si no es el de un examen de 100, el aviso
 * que lo dice. Un diagnóstico vale como estimación; una práctica o un repaso, no.
 */
export function puntajeParaIngresaba(i: IntentoParaIngresaba, area: AreaExamen): { puntaje: number; aviso: string | null } | null {
  if (i.modo === "diagnostico") {
    if (i.estado !== "entregado" || !i.informe?.porCurso) return null;
    const p = proyectarAlExamen(i.informe.porCurso, area);
    if (!p.muestra) return null;
    return { puntaje: p.estimado, aviso: `Es una estimación: tu diagnóstico tuvo ${p.muestra} preguntas y lo proyectamos al examen de 100 (entre ${fmt(p.minimo)} y ${fmt(p.maximo)}). Un simulacro completo lo afina.` };
  }
  const c = puntajeComparable(i);
  if (!c) return null;
  return { puntaje: c.puntaje, aviso: c.proyectado ? `Este examen tuvo menos de 100 preguntas válidas: tu puntaje está proyectado a ${FORMULA_UNMSM.maximo}.` : null };
}
