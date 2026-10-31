/**
 * Leer lo que escribió el alumno: texto o LaTeX → valor (y unidad). Hay DOS lectores, uno por
 * política, y cada uno se queda con el suyo hasta que se decida la política: donde difieren, cambiar
 * de lector cambiaría veredictos (docs/calidad/MOTOR-NUMERICO.md, sección 3.1: STEM llama `ilegible`
 * a «la respuesta es 20 m/s», y el Predictor la lee).
 *
 * - **Formativa (STEM):** `leerCantidad` busca el primer sitio donde lo que queda es una unidad
 *   conocida y lo de antes, un número (evaluado con `cuentas.ts`). Coma o punto decimal, miles con
 *   espacio o con varios puntos, notación científica a mano o en LaTeX.
 * - **Sumativa (Predictor):** `valorDe` evalúa una expresión con su propio analizador (fracciones,
 *   raíces, π, e, ln, potencias, superíndices, %, fracciones mixtas); `valoresEn` encuentra los
 *   valores de un texto, palabra a palabra, con lo que hay alrededor. Y los patrones de texto que
 *   delatan una duda, una negación o una comparación.
 *
 * Sacados sin cambiar nada de `numerica.ts` y de `predictor/corrector.ts` (17-10-2026).
 */
import { ErrorDeCuenta, evaluarLatex } from "@/lib/admision/motor/cuentas";
import { canonica, leerUnidad } from "@/lib/admision/motor/numeros/unidades";

// ─────────────────────────── Formativa (STEM) ───────────────────────────

const INICIO_DE_UNIDAD = /[A-Za-zµμΩ°º%]/;

function prepararNumero(t: string): string {
  let n = t
    .replace(/\{,\}/g, ",")
    // Notación científica escrita a mano: «× 10^3» → «e3».
    .replace(/\s*(?:[x×·*]|\\cdot|\\times)\s*10\s*\^\s*\{?\s*([-+−]?\d+)\s*\}?/g, (_, e: string) => `e${e.replace("−", "-")}`)
    // Miles con espacio: «1 200 000».
    .replace(/(\d)\s(?=\d{3}(?!\d))/g, "$1");
  // Miles con punto, solo si hay dos grupos o más: «1.200.000».
  if (/^\s*-?\d{1,3}(?:\.\d{3}){2,}(?!\d)/.test(n)) n = n.replace(/\./g, "");
  return n;
}

function valorDelNumero(numero: string): number | null {
  const t = numero.trim();
  if (!t || !/\d/.test(t)) return null;
  try {
    return evaluarLatex(prepararNumero(t));
  } catch (e) {
    if (e instanceof ErrorDeCuenta) return null;
    throw e;
  }
}

/** El número y la unidad de lo que escribió el alumno, o `null` si no hay un número. */
export function leerCantidad(texto: string): { valor: number; unidad: string | null } | null {
  const t = texto
    .replace(/\$/g, " ")
    .replace(/\\(?:text|mathrm)\s*\{([^{}]*)\}/g, " $1")
    .replace(/\\[,;: ]/g, " ")
    .trim();
  if (!t) return null;

  // La unidad empieza en el primer sitio donde lo que queda es una unidad y lo de antes, un número.
  for (let p = 0; p < t.length; p++) {
    if (!INICIO_DE_UNIDAD.test(t[p]) || t[p - 1] === "\\") continue;
    const unidad = canonica(t.slice(p));
    if (!leerUnidad(unidad)) continue;
    const valor = valorDelNumero(t.slice(0, p));
    if (valor !== null) return { valor, unidad };
  }
  const valor = valorDelNumero(t);
  return valor === null ? null : { valor, unidad: null };
}

// ─────────────────────────── Sumativa (Predictor) ───────────────────────────

const FRACCIONES_UNICODE: Record<string, string> = {
  "½": "(1/2)", "⅓": "(1/3)", "⅔": "(2/3)", "¼": "(1/4)", "¾": "(3/4)", "⅕": "(1/5)", "⅛": "(1/8)",
};
const SUPERINDICES: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+",
};

function preparar(texto: string): string {
  let t = texto.replace(/\$/g, " ").trim()
    .replace(/[−–—]/g, "-")
    .replace(/[½⅓⅔¼¾⅕⅛]/g, (c) => FRACCIONES_UNICODE[c])
    // Una tira de superíndices es UN exponente: «10²³» es 10^23, no 10^2^3 (sonda del 17-10).
    .replace(/[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (s) => `^(${[...s].map((c) => SUPERINDICES[c]).join("")})`)
    .replace(/\\left|\\right/g, "")
    .replace(/\\(?:cdot|times)/g, "*")
    .replace(/\\[dt]frac/g, "\\frac");
  for (let i = 0; i < 6; i++) {
    const antes = t;
    t = t.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "(($1)/($2))")
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)")
      .replace(/\^\s*\{([^{}]*)\}/g, "^($1)");
    if (t === antes) break;
  }
  return t
    .replace(/\\pi\b/g, "π")
    .replace(/\\(ln|log|sin|cos|tan|sen)\b/g, "$1")
    .replace(/[{}]/g, (c) => (c === "{" ? "(" : ")"))
    .replace(/[×·⋅]/g, "*")
    .replace(/(\d+(?:[.,]\d+)?)\s*%/g, "($1/100)")
    .replace(/\b(\d{1,3})((?: \d{3})+)\b(?![.,/\d])/g, (_, a: string, b: string) => a + b.replace(/ /g, ""))
    .replace(/\b(\d+)\s+(\d+)\s*\/\s*(\d+)\b/g, "($1+$2/$3)")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/(\d)\s*[xX]\s*(?=\d)/g, "$1*")
    .toLowerCase();
}

type Ficha = { n: number } | { c: string };

function fichas(t: string): Ficha[] | null {
  const re = /\s*(?:(\d+(?:\.\d+)?(?:e[+-]?\d+)?)|(π|e|√|ln|log|sqrt|sen|sin|cos|tan)(?![a-z])|([-+*/^()]))/y;
  const salida: Ficha[] = [];
  let i = 0;
  while (i < t.length) {
    if (/^\s*$/.test(t.slice(i))) break;
    re.lastIndex = i;
    const m = re.exec(t);
    if (!m) return null;
    salida.push(m[1] !== undefined ? { n: Number(m[1]) } : { c: m[2] ?? m[3] });
    i = re.lastIndex;
  }
  return salida;
}

const FUNCIONES: Record<string, (x: number) => number> = {
  ln: Math.log, log: Math.log10, sqrt: Math.sqrt, "√": Math.sqrt,
  sen: Math.sin, sin: Math.sin, cos: Math.cos, tan: Math.tan,
};

/** Evalúa una expresión numérica. null si tiene variables, palabras o no es una sola expresión. */
export function valorDe(texto: string): number | null {
  const fs = fichas(preparar(texto));
  if (!fs || !fs.length) return null;
  let i = 0;
  const ver = () => fs[i];
  const es = (c: string) => { const f = fs[i]; return !!f && "c" in f && f.c === c; };
  const empiezaFactor = () => {
    const f = fs[i];
    return !!f && "c" in f && (f.c === "(" || f.c === "π" || f.c === "e" || f.c in FUNCIONES);
  };

  function primario(): number {
    const f = ver();
    if (!f) throw 0;
    i++;
    if ("n" in f) return f.n;
    if (f.c === "π") return Math.PI;
    if (f.c === "e") return Math.E;
    if (f.c === "(") {
      const v = suma();
      if (!es(")")) throw 0;
      i++;
      return v;
    }
    if (f.c in FUNCIONES) return FUNCIONES[f.c](potencia());
    throw 0;
  }
  function potencia(): number {
    const base = primario();
    if (es("^")) { i++; return base ** unario(); }
    return base;
  }
  function unario(): number {
    if (es("-")) { i++; return -unario(); }
    if (es("+")) { i++; return unario(); }
    return potencia();
  }
  function producto(): number {
    let v = unario();
    let trasDividir = false;
    for (;;) {
      if (es("*")) { i++; v *= unario(); trasDividir = false; }
      else if (es("/")) { i++; v /= unario(); trasDividir = true; }
      // «2π», «3e^4», «2(x)»: multiplicar sin signo, pero nunca dos números seguidos («1 2 3»).
      // Tras una división es ambiguo: «1/2π» ¿es π/2 o 1/(2π)? No se lee (sonda del 17-10).
      else if (empiezaFactor()) { if (trasDividir) throw 0; v *= potencia(); }
      else return v;
    }
  }
  function suma(): number {
    let v = producto();
    for (;;) {
      if (es("+")) { i++; v += producto(); }
      else if (es("-")) { i++; v -= producto(); }
      else return v;
    }
  }
  try {
    const v = suma();
    return i === fs.length && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/* ───────────────────────── Valores con su unidad ───────────────────────── */

export interface Valor {
  /** En qué palabra empieza: un valor que no está al principio del lado derecho («x + 2») no es la clave. */
  inicio: number;
  /** La primera palabra tras el valor y su unidad. */
  fin: number;
  /** Las palabras del texto en que se leyó, para ver qué queda alrededor del valor. */
  palabras: string[];
  valores: number[]; // a veces dos lecturas: «1.000» es 1 o 1000
  unidad: string | null;
  decimales: number | null; // si es un número escrito tal cual, cuántos decimales tiene
  cifras: number;
  /** «1,500»: coma de miles o decimal, no se sabe (en Perú se usan las dos). */
  ambiguo?: boolean;
  /** Lo escribió con «%»: «50 %» es 0,5, pero si la clave dice «50» quizá quiso decir eso. */
  porcentaje?: boolean;
}

const PALABRAS_QUE_NO_SON_UNIDAD = new Set(["de", "y", "o", "en", "es", "el", "la", "a", "al", "del", "que", "por"]);
const pareceUnidad = (t: string) =>
  // Sin pasar a minúsculas: «A» (amperio) es una unidad; «a», una preposición (ronda 5).
  t.length <= 8 && /^[a-zμ°ωå%][a-z0-9μ°ωå/²³^·.-]*$/i.test(t) && !PALABRAS_QUE_NO_SON_UNIDAD.has(t);

export function precision(texto: string): { decimales: number | null; cifras: number } {
  const m = texto.trim().match(/^-?(\d+)(?:[.,](\d+))?$/);
  if (!m) return { decimales: null, cifras: 99 };
  const digitos = (m[1] + (m[2] ?? "")).replace(/^0+/, "");
  return { decimales: m[2]?.length ?? 0, cifras: digitos.length };
}

/** Los valores que aparecen en un texto, de izquierda a derecha, cada uno con su unidad si la lleva. */
export function valoresEn(texto: string): Valor[] {
  const palabras = texto.split(/\s+/).map((p) => p.replace(/[.,;:!?]+$/, "")).filter(Boolean);
  const salida: Valor[] = [];
  let j = 0;
  while (j < palabras.length) {
    let hasta = -1;
    let valor: number | null = null;
    for (let k = palabras.length; k > j; k--) {
      valor = valorDe(palabras.slice(j, k).join(" "));
      if (valor !== null) { hasta = k; break; }
    }
    if (hasta === -1) { j++; continue; }
    const escrito = palabras.slice(j, hasta).join(" ");
    const valores = [valor!];
    if (/^\d{1,3}(\.\d{3})+$/.test(escrito)) valores.push(Number(escrito.replace(/\./g, "")));
    const siguiente = palabras[hasta];
    const unidad = siguiente && pareceUnidad(siguiente) ? siguiente : null;
    salida.push({
      inicio: j, fin: hasta + (unidad ? 1 : 0), palabras, valores, unidad, ...precision(escrito),
      ambiguo: /^[1-9]\d{0,2}(,\d{3})+$/.test(escrito),
      porcentaje: escrito.includes("%"),
    });
    j = hasta + (unidad ? 1 : 0);
  }
  return salida;
}

/** Fórmulas químicas (N2, NH3, CO2): sus subíndices no son resultados. */
export const sinFormulas = (t: string) => t.replace(/\b[A-Z][A-Za-z]*\d[A-Za-z\d]*\b/g, " ");
export const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const NEGACION = /\bno\b|\bni\b|\bnunca\b|≠|!=|\\neq?\b|descart/i;
// Con la bandera `u` y límites de letra propios: `\b` no ve la «ó» (no es ASCII) y la dejaba pasar.
// La «u» solo como conjunción entre dos igualdades («x = -4 u x = 4»): sola es una unidad (u³).
// También «or», «∧», `\lor`, `\wedge` y «|» (ronda 3).
export const DUDA = /(?<![\p{L}\d])(o|ó|or|pero|puede\s+ser|creo|quiz[aá]s?|tal\s+vez)(?![\p{L}\d])|(?<![\p{L}\d])u\s+(?=\p{L}[\p{L}\d]*\s*=)|∨|∧|\\vee|\\lor|\\wedge|\||\s\/\s*(?=\p{L})/iu;
// Una desigualdad o un «aproximadamente» no es el resultado: «x ≥ 2» no es «2» (ronda 3).
// Y dicha con palabras: «mayor que 4», «al menos 4», «casi 4» (ronda 4).
export const COMPARACION = /[<>≤≥≈~]|\\(?:le|ge|leq|geq|lt|gt|approx|sim)(?![a-z])|(?<![\p{L}\d])(mayor|menor|m[aá]s\s+de|menos\s+de|al\s+menos|como\s+m[ií]nimo|como\s+m[aá]ximo|m[aá]ximo|m[ií]nimo|hasta|casi|cerca\s+de|aproximadamente|aprox)(?![\p{L}\d])/iu;
