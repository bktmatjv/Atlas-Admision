/**
 * Los formatos de práctica de las áreas de cálculo: respuesta numérica y procedimiento.
 *
 * Hermano de `formatos-parse.ts`, con su misma regla —lo dudoso se descarta, no se arregla—
 * y una más: **la cuenta la hace el código, no el modelo** (`cuentas.ts`). Un item numérico
 * cuyo planteamiento no da la respuesta que el modelo escribió no se guarda; un procedimiento
 * con un paso que no cuadra, tampoco. Es lo que más se le reprocha a un resolvedor con IA:
 * que en un problema largo se equivoque con toda seguridad.
 *
 * Cada descarte vuelve con su motivo, y `generate-items` los cuenta (`secciones_descartes`).
 *
 * Puro y sin red, para vitest.
 */
import { comprobarCuenta, evaluarLatex } from "@/lib/admision/motor/cuentas";
import { leerCantidad } from "@/lib/admision/motor/numerica";
import { validarGrafica, type Grafica } from "@/lib/admision/motor/grafica";

export const FORMATOS_STEM = ["numerica", "procedimiento", "lectura_de_grafica"] as const;
export type FormatoStem = (typeof FORMATOS_STEM)[number];

export function esFormatoStem(tipo: string): tipo is FormatoStem {
  return (FORMATOS_STEM as readonly string[]).includes(tipo);
}

export interface PayloadNumerico {
  valor: number;
  unidad: string | null;
  tolerancia: number;
  /** La expresión, solo con números, que da `valor`. Comprobada al generar. */
  planteamiento: string;
}

export interface PasoResuelto {
  /** La cuenta del paso, en LaTeX: «x = \frac{8}{2} = 4». */
  cuenta: string;
  /** Por qué se hace: lo que el alumno tiene que entender, no la cuenta otra vez. */
  porque: string;
}

export type PayloadStem = PayloadNumerico | { pasos: PasoResuelto[] };

export type ResultadoStem =
  | { question: string; options: PayloadStem | string[]; correct_answer: string; figura?: Grafica }
  | { descarte: MotivoDeDescarte };

export type MotivoDeDescarte =
  | "forma"
  | "sin_datos"
  | "sin_planteamiento"
  | "dato_inventado"
  | "cuenta_no_cuadra"
  | "unidad_desconocida"
  | "paso_no_cuadra"
  | "sin_grafica";

/** El error relativo que se admite por defecto: un 1 %, el redondeo de cualquier calculadora. */
export const TOLERANCIA_POR_DEFECTO = 0.01;

/**
 * Los números que un planteamiento puede usar sin que estén en el enunciado: los pequeños
 * (exponentes, mitades, dobles), las conversiones de siempre y las constantes de colegio.
 */
export const NUMEROS_SIN_ENUNCIADO = new Set([0, 1, 2, 3, 4, 10, 100, 1000, 60, 3600, 3.6, 9.8, 9.81, 273, 273.15, 0.5, 180, 360]);

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Los números escritos en un texto o en LaTeX, con coma o punto decimal. */
export function numerosDe(t: string): number[] {
  return (t.replace(/\{,\}/g, ",").match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(",", ".")));
}

/** El número como lo escribe un alumno peruano: coma decimal. */
export function numeroEnEspanol(v: number): string {
  return String(Number(v.toPrecision(12))).replace(".", ",");
}

function numerica(c: Record<string, unknown>): ResultadoStem {
  const question = texto(c.question);
  if (!question) return { descarte: "forma" };
  if (!/\d/.test(question)) return { descarte: "sin_datos" };

  // La respuesta, como número o como texto («2,5», «5 m/s»).
  const crudaUnidad = texto(c.unit ?? c.unidad);
  const leida = typeof c.answer === "number"
    ? { valor: c.answer, unidad: null }
    : leerCantidad(texto(c.answer ?? c.correctAnswer));
  if (!leida || !Number.isFinite(leida.valor)) return { descarte: "forma" };
  const unidad = crudaUnidad || leida.unidad || null;
  if (unidad && leerCantidad(`1 ${unidad}`)?.unidad == null) return { descarte: "unidad_desconocida" };

  const planteamiento = texto(c.planteamiento);
  if (!planteamiento) return { descarte: "sin_planteamiento" };
  try {
    evaluarLatex(planteamiento);
  } catch {
    return { descarte: "sin_planteamiento" };
  }

  const delEnunciado = numerosDe(question);
  const inventado = numerosDe(planteamiento).find(
    (n) => !NUMEROS_SIN_ENUNCIADO.has(n) && !delEnunciado.some((m) => Math.abs(m - n) <= 1e-9 * Math.max(1, Math.abs(n))),
  );
  if (inventado !== undefined) return { descarte: "dato_inventado" };

  if (comprobarCuenta(`${planteamiento} = ${String(leida.valor)}`).estado !== "cuadra") {
    return { descarte: "cuenta_no_cuadra" };
  }

  const tolerancia = typeof c.tolerance === "number" && c.tolerance > 0 && c.tolerance <= 0.1
    ? c.tolerance
    : TOLERANCIA_POR_DEFECTO;
  return {
    question,
    options: { valor: leida.valor, unidad, tolerancia, planteamiento },
    correct_answer: unidad ? `${numeroEnEspanol(leida.valor)} ${unidad}` : numeroEnEspanol(leida.valor),
  };
}

function procedimiento(c: Record<string, unknown>): ResultadoStem {
  const question = texto(c.question);
  const answer = texto(c.answer ?? c.correctAnswer);
  if (!question || !answer || !Array.isArray(c.steps)) return { descarte: "forma" };
  const pasos = c.steps.map((p) => {
    const paso = (typeof p === "object" && p !== null ? p : {}) as Record<string, unknown>;
    return { cuenta: texto(paso.cuenta), porque: texto(paso.porque) };
  });
  if (pasos.length < 2 || pasos.length > 8 || pasos.some((p) => !p.cuenta || !p.porque)) return { descarte: "forma" };
  if (pasos.some((p) => comprobarCuenta(p.cuenta).estado === "no_cuadra")) return { descarte: "paso_no_cuadra" };
  return { question, options: { pasos }, correct_answer: answer };
}

/** Una pregunta de opción múltiple sobre una gráfica generada: la figura se valida entera. */
function lecturaDeGrafica(c: Record<string, unknown>): ResultadoStem {
  const { grafica } = validarGrafica(c.figura);
  if (!grafica) return { descarte: "sin_grafica" };
  const question = texto(c.question);
  const correcta = texto(c.correctAnswer ?? c.correct_answer);
  const opciones = Array.isArray(c.options) ? c.options.map(texto).filter((o) => o.length > 0) : [];
  if (!question || !correcta || opciones.length < 3 || opciones.length > 5) return { descarte: "forma" };
  if (new Set(opciones).size !== opciones.length || !opciones.includes(correcta)) return { descarte: "forma" };
  return { question, options: opciones, correct_answer: correcta, figura: grafica };
}

/** El item, o el motivo por el que no se guarda. */
export function formatearStem(c: Record<string, unknown>, tipo: FormatoStem): ResultadoStem {
  if (tipo === "numerica") return numerica(c);
  if (tipo === "procedimiento") return procedimiento(c);
  return lecturaDeGrafica(c);
}
