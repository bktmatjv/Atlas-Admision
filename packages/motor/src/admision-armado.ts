import { type AreaExamen, moldeDe } from "./admision-molde";

/** Lo mínimo de una pregunta publicada para armar (sin enunciado, clave ni solución). */
export interface PreguntaParaArmar {
  id: string; examen_id: string; numero: number | null;
  curso: string | null; tema: string | null; texto_id: string | null;
}

export function duracionMinutos(n: number): number {
  return Math.max(1, Math.ceil((180 * n) / 100));
}

export function armarReal(preguntas: PreguntaParaArmar[], examenId: string): string[] {
  return preguntas.filter((p) => p.examen_id === examenId && p.numero !== null)
    .sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0)).map((p) => p.id);
}

/** Mezcla con el azar dado (Fisher–Yates), sin tocar la entrada. */
function barajar<T>(xs: T[], azar: () => number): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Orden de preferencia (spec §3): no vistas al azar, luego vistas de la más antigua a la más reciente. */
function porPreferencia<T>(xs: T[], vistaDe: (x: T) => string | undefined, azar: () => number): T[] {
  const nuevas = barajar(xs.filter((x) => vistaDe(x) === undefined), azar);
  const vistas = xs.filter((x) => vistaDe(x) !== undefined).sort((a, b) => vistaDe(a)!.localeCompare(vistaDe(b)!));
  return [...nuevas, ...vistas];
}

/** Llena `cupo` con preguntas sueltas y lecturas enteras (una lectura nunca se parte). */
function llenar(candidatas: PreguntaParaArmar[], cupo: number, vistas: Map<string, string>, azar: () => number): string[] {
  // Cada lectura es un bloque; cada suelta, un bloque de uno. Un bloque se ve si se vio alguna de sus preguntas.
  const bloques = new Map<string, PreguntaParaArmar[]>();
  for (const p of candidatas) {
    const k = p.texto_id ? `t:${p.texto_id}` : `p:${p.id}`;
    bloques.set(k, [...(bloques.get(k) ?? []), p]);
  }
  const vistaDelBloque = (b: PreguntaParaArmar[]) =>
    b.map((p) => vistas.get(p.id)).filter((v): v is string => v !== undefined).sort().at(-1);
  // Primero las lecturas y después las sueltas: si entran antes las sueltas, el hueco puede quedar en
  // 9 sin ninguna lectura que quepa. Dentro de cada grupo, por preferencia.
  const todos = [...bloques.values()];
  const orden = [
    ...porPreferencia(todos.filter((b) => b.length > 1), vistaDelBloque, azar),
    ...porPreferencia(todos.filter((b) => b.length === 1), vistaDelBloque, azar),
  ];
  const out: string[] = [];
  for (const b of orden) {
    if (out.length + b.length > cupo) continue;
    out.push(...[...b].sort((x, y) => (x.numero ?? 0) - (y.numero ?? 0)).map((p) => p.id));
    if (out.length === cupo) break;
  }
  return out;
}

export function armarSimulacro(
  preguntas: PreguntaParaArmar[], area: AreaExamen, vistas: Map<string, string>, azar: () => number,
): string[] {
  return moldeDe(area).flatMap(({ curso, preguntas: cupo }) =>
    llenar(preguntas.filter((p) => p.curso === curso), cupo, vistas, azar));
}

export function armarPractica(
  preguntas: PreguntaParaArmar[], filtro: { curso: string; tema?: string }, n: number,
  vistas: Map<string, string>, azar: () => number,
): string[] {
  const delCurso = preguntas.filter((p) => p.curso === filtro.curso);
  // Si alguna pregunta de una lectura es del tema, entra la lectura entera: nunca media lectura.
  const lecturasDelTema = new Set(delCurso.filter((p) => p.texto_id && p.tema === filtro.tema).map((p) => p.texto_id));
  const candidatas = delCurso.filter((p) => !filtro.tema || p.tema === filtro.tema || (p.texto_id && lecturasDelTema.has(p.texto_id)));
  return llenar(candidatas, n, vistas, azar);
}

/* ─────────────── El diagnóstico (tramo 5 de Audix) ─────────────── */

export const PREGUNTAS_DIAGNOSTICO = 30;
export const MINUTOS_DIAGNOSTICO = 30;

/**
 * Cuántas preguntas de cada curso lleva el diagnóstico: al menos una por curso del molde y el resto en
 * proporción a su peso en el examen del área (método del mayor resto). De Audix (src/diagnostico).
 */
export function cuotasDiagnostico(area: AreaExamen, total = PREGUNTAS_DIAGNOSTICO): Record<string, number> {
  const molde = moldeDe(area);
  const suma = molde.reduce((s, h) => s + h.preguntas, 0);
  const resto = total - molde.length;
  const exactas = molde.map((h) => ({ curso: h.curso, x: (h.preguntas / suma) * resto }));
  const cuotas: Record<string, number> = Object.fromEntries(exactas.map((e) => [e.curso, 1 + Math.floor(e.x)]));
  let faltan = total - Object.values(cuotas).reduce((s, n) => s + n, 0);
  for (const e of [...exactas].sort((a, b) => (b.x - Math.floor(b.x)) - (a.x - Math.floor(a.x)) || a.curso.localeCompare(b.curso))) {
    if (faltan-- <= 0) break;
    cuotas[e.curso]++;
  }
  return cuotas;
}

/**
 * El diagnóstico: las cuotas de cada curso con las mismas preferencias que el simulacro (no vistas primero,
 * lecturas enteras). Sin la parte adaptativa de Audix: el intento fija sus preguntas al crearse y el banco
 * casi no tiene dificultades distintas (piloto: el 80 % sale con dificultad 2).
 */
export function armarDiagnostico(preguntas: PreguntaParaArmar[], area: AreaExamen, vistas: Map<string, string>, azar: () => number): string[] {
  return Object.entries(cuotasDiagnostico(area)).flatMap(([curso, cupo]) =>
    llenar(preguntas.filter((p) => p.curso === curso), cupo, vistas, azar));
}
