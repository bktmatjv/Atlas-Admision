/**
 * Las dos políticas de corrección numérica de CALIBRA, cada una EXACTAMENTE como se corregía antes de
 * sacarlas aquí (17-10-2026). Cuál vale para qué es una decisión de producto pendiente (🔑 Axel,
 * docs/calidad/MOTOR-NUMERICO.md, sección 4); hasta entonces nada cambia de veredicto, y
 * `numeros/caracterizacion.test.ts` lo vigila sobre ~580 respuestas.
 *
 * - **Formativa (STEM: sendero y ejercicios):** `corregirFormativa`. Perdona el 1 % (o la tolerancia
 *   de la pregunta), supone la unidad del enunciado si falta y da una pista con el siguiente paso.
 * - **Sumativa (Predictor: el examen simulado):** `corregirSumativa`. Solo «correcta» si lo escrito ES
 *   la clave, en su unidad y a su precisión; ante la duda, «dudosa» y decide la IA con la rúbrica.
 *   Nunca «incorrecta» sin mirar lo que no se sabe leer.
 */
import {
  COMPARACION, DUDA, NEGACION, leerCantidad, precision, sinFormulas, sinTildes, valorDe, valoresEn, type Valor,
} from "@/lib/admision/motor/numeros/leer";
import { factorDeUnidad, igualDimension, leerUnidad, type Dimension } from "@/lib/admision/motor/numeros/unidades";

// ═══════════════════════════ Formativa (STEM) ═══════════════════════════

export interface RespuestaNumerica {
  valor: number;
  /** La unidad del enunciado, como se enseña: «m/s», «°C», «%». `null` si no tiene. */
  unidad: string | null;
  /** Error relativo admitido: 0,01 es un 1 %. Con un resultado 0, absoluto. */
  tolerancia: number;
}

export type CorreccionNumerica =
  | { correcta: true }
  | { correcta: false; motivo: "ilegible" | "unidad" | "valor"; pista: string };


/** En unidades del SI, con el desplazamiento del °C. `null` si la unidad no se conoce. */
function aSI(valor: number, unidad: string | null): { si: number; dim: Dimension } | null {
  if (unidad === null) return { si: valor, dim: {} };
  const u = leerUnidad(unidad);
  if (!u) return null;
  return { si: valor * u.factor + (u.desplazamiento ?? 0), dim: u.dim };
}

function cerca(a: number, b: number, tolerancia: number): boolean {
  if (b === 0) return Math.abs(a) <= tolerancia;
  return Math.abs(a - b) <= tolerancia * Math.abs(b) + 1e-12;
}

/** Corrige una respuesta numérica. Las pistas dicen el siguiente paso, no el diagnóstico. */
export function corregirFormativa(respuesta: string, esperado: RespuestaNumerica): CorreccionNumerica {
  const leida = leerCantidad(respuesta);
  if (!leida) {
    return { correcta: false, motivo: "ilegible", pista: "Escribe el número y, si quieres, su unidad: por ejemplo «20 m/s»." };
  }

  // Sin unidad, va en la del enunciado. Un «%» contra una proporción sin unidad, se convierte.
  const unidadDelAlumno = leida.unidad ?? esperado.unidad;
  let alumno: { si: number; dim: Dimension } | null;
  let objetivo: { si: number; dim: Dimension } | null;
  if (esperado.unidad === null) {
    alumno = { si: leida.unidad === "%" ? leida.valor / 100 : leida.valor, dim: {} };
    objetivo = { si: esperado.valor, dim: {} };
  } else {
    alumno = aSI(leida.valor, unidadDelAlumno);
    objetivo = aSI(esperado.valor, esperado.unidad);
    if (!alumno || !objetivo || !igualDimension(alumno.dim, objetivo.dim)) {
      return {
        correcta: false,
        motivo: "unidad",
        pista: `Esa unidad no mide lo mismo que la respuesta: exprésala en ${esperado.unidad}.`,
      };
    }
  }

  if (cerca(alumno.si, objetivo.si, esperado.tolerancia)) return { correcta: true };

  const a = alumno.si;
  const b = objetivo.si;
  if (b !== 0 && cerca(-a, b, esperado.tolerancia)) {
    return { correcta: false, motivo: "valor", pista: "Revisa el signo: el tamaño está bien, el sentido no." };
  }
  if (a !== 0 && b !== 0) {
    const k = Math.log10(Math.abs(a / b));
    if (Math.round(k) !== 0 && Math.abs(k - Math.round(k)) < 0.01) {
      return { correcta: false, motivo: "valor", pista: "Revisa la conversión de unidades o dónde pusiste la coma decimal." };
    }
  }
  return {
    correcta: false,
    motivo: "valor",
    pista: "Rehaz la cuenta desde el planteamiento: escribe la fórmula con los datos antes de operar.",
  };
}

// ═══════════════════════════ Sumativa (Predictor) ═══════════════════════════

export type Veredicto = "correcta" | "incorrecta" | "dudosa";

/** Lo que la política sumativa usa de una clave del Predictor (`predictor/corrector.ts`, `Clave`). */
export interface ClaveNumerica {
  /** El texto de la respuesta: «a = 2 m/s²; T = 24 N», «3/4», «12,5 %». */
  clave: string;
  /** El valor de la clave si tiene uno solo (lo pone quien genera la pregunta). */
  valorNumerico?: number | null;
}

interface Esperado {
  /** El valor escrito de la clave; con un %, también como porcentaje («20 %» vale 0,2 y vale 20). */
  valores: number[];
  unidad: string | null;
  /** Si la clave es un decimal escrito tal cual («12,5», «4»), cuántos decimales tiene: es exacta. */
  decimales: number | null;
  /**
   * El `valorNumerico` de quien generó la pregunta cuando es más preciso que la clave escrita
   * («9,90» por 9,8995): la clave es un redondeo, y vale lo que redondea a este valor.
   */
  preciso: number | null;
}

type Cercania = "exacta" | "cerca" | "lejos";

/**
 * Qué tan cerca está lo del alumno de lo esperado, medido EN SU UNIDAD y A SU PRECISIÓN: un
 * «correcta» local exige que lo que escribió sea el valor de la clave; lo que solo queda cerca lo
 * decide la IA con la rúbrica. Cuatro rondas de la puerta de calidad encontraron falsos positivos
 * en cada tolerancia que se abrió (redondeo del alumno, ±½ en claves enteras, el 0,5 %, la
 * tolerancia aplicada tras convertir la unidad), así que aquí no hay ninguna holgura libre:
 *
 * - igual, salvo error de coma flotante: exacta;
 * - clave exacta («4», «12,5»): solo su valor (con ceros de más); a menos de media unidad de su
 *   último decimal, cerca. Si `valorNumerico` es más preciso y la clave es su redondeo, también
 *   vale lo que redondea a él escrito con al menos los decimales de la clave;
 * - clave inexacta (1/3, π/2, 3×10^8, %): vale si el alumno escribió un decimal tal cual, con al
 *   menos dos cifras, que es el valor de la clave redondeado a SUS decimales (0,33 por 1/3; 66,4 por
 *   200/3, no); a menos de un 5 %, cerca.
 */
function cercania(a: number, esperado: Esperado, v: Pick<Valor, "decimales" | "cifras">, factor: number): Cercania {
  // Todo en la unidad del alumno: la clave se pasa a ella, no al revés.
  const enSuUnidad = (b: number) => b / factor;
  // Solo relativa: con un `+ 1e-12` absoluto, por debajo de 10⁻¹² (la carga del electrón, h, mₑ)
  // cualquier valor era «igual» (ronda 5). Y la clave 0 pide 0. Con 1e-9, 13! = 6227020800 aceptaba
  // 6227020805 (sonda del 17-10): 1e-12 sigue cubriendo el error de coma flotante (~1e-16).
  const igual = (b: number) => (b === 0 ? a === 0 : Math.abs(a - b) <= Math.abs(b) * 1e-12);
  const objetivos = [...esperado.valores, ...(esperado.preciso !== null ? [esperado.preciso] : [])].map(enSuUnidad);
  if (objetivos.some(igual)) return "exacta";
  const redondeaA = (b: number) => v.decimales !== null && igual(Math.round(b * 10 ** v.decimales) / 10 ** v.decimales);
  const d = esperado.decimales;
  if (d === null) {
    const b = enSuUnidad(esperado.valores[0]);
    if (b === 0) return "lejos";
    if (v.cifras >= 2 && esperado.valores.map(enSuUnidad).some(redondeaA)) return "exacta";
    return esperado.valores.map(enSuUnidad).some((x) => Math.abs(a - x) <= Math.abs(x) * 0.05) ? "cerca" : "lejos";
  }
  // Los decimales de la clave, contados en la unidad del alumno (1,5 m con d = 1 son 150 cm, d = −1).
  const dEnSuUnidad = d + Math.round(Math.log10(factor));
  if (esperado.preciso !== null && v.decimales !== null && v.decimales >= dEnSuUnidad && redondeaA(enSuUnidad(esperado.preciso))) return "exacta";
  const b = enSuUnidad(esperado.valores[0]);
  return Math.abs(a - b) <= 0.5 * 10 ** -dEnSuUnidad + 1e-12 ? "cerca" : "lejos";
}

// Palabras que, delante de un número, lo cambian: «menos 3», «raíz de 4», «el doble de 3».
const TRANSFORMAN = new Set([
  "menos", "mas", "raiz", "doble", "triple", "mitad", "tercio", "cuarto", "cuadrado", "cubo", "de", "del", "por",
  "entre", "inverso", "opuesto", "logaritmo", "log", "ln", "sen", "seno", "cos", "coseno", "tan", "sqrt", "ciento", "elevado",
]);
// Y las que lo niegan o lo ponen en duda: «excepto 4», «negativo 4», «tampoco 4» (puerta, ronda 6).
const NIEGAN = new Set([
  "excepto", "salvo", "menos", "negativo", "negativa", "diferente", "distinto", "falso", "falsa", "reciproco", "tampoco",
  "jamas", "nada", "ninguno", "ninguna", "nunca", "veces", "dos", "tres", "casi",
]);
// Lo que puede ir delante sin cambiar el número: una lista blanca (puerta, ronda 6)…
const ENTRADILLAS = new Set(["la", "el", "los", "las", "respuesta", "rpta", "resultado", "res", "r", "entonces", "luego", "y"]);
// …o una frase que acaba en un verbo de resultado: «el límite es 3/4», «el limitante es N2 y salen 102 g».
const VERBOS = new Set(["es", "son", "da", "dan", "sale", "salen", "resulta", "queda", "vale", "mide", "obtengo", "obtiene"]);

const normPalabra = (p: string) => sinTildes(p).toLowerCase();

/**
 * Lo que rodea al valor y no es una entradilla: «x + 3», «3a», «5 al cuadrado», «raíz de 4», «menos 3»,
 * «excepto 4». Con algo así el número no es el resultado, o no se sabe leer: decide la IA (sonda del
 * 17-10; ronda 6). Detrás del valor y su unidad no vale nada.
 */
const sobraAlrededor = (v: Pick<Valor, "inicio" | "fin" | "palabras">) => {
  if (v.palabras.slice(v.fin).length > 0) return true;
  const delante = v.palabras.slice(0, v.inicio).map(normPalabra);
  if (!delante.length) return false;
  if (delante.some((p) => TRANSFORMAN.has(p) || NIEGAN.has(p) || !/^\p{L}+$/u.test(p))) return true;
  return !(delante.every((p) => ENTRADILLAS.has(p)) || VERBOS.has(delante[delante.length - 1]));
};

function comparar(delAlumno: Omit<Valor, "inicio" | "fin" | "palabras">, esperado: Esperado): Veredicto {
  // Una unidad que la clave no tiene («3 cm» por «x = 3») no se da por buena sin mirar.
  if (delAlumno.unidad && !esperado.unidad) return "dudosa";
  // Y al revés: sin la unidad que la clave pide («x = 3» por «3 cm»), tampoco.
  if (!delAlumno.unidad && esperado.unidad) return "dudosa";
  // «1,500»: ¿mil quinientos o uno coma cinco? Que lo decida la IA (ronda 4).
  if (delAlumno.ambiguo) return "dudosa";
  const factor = factorDeUnidad(delAlumno.unidad, esperado.unidad);
  if (factor === null) return "dudosa";
  const cercanias = delAlumno.valores.map((x) => cercania(x, esperado, delAlumno, factor));
  if (cercanias.includes("exacta")) return "correcta";
  // «50 %» por «50»: quizá quiso decir eso, quizá no (0,5). Que lo decida la IA (ronda 5).
  if (delAlumno.porcentaje && delAlumno.valores.some((x) => cercania(x * 100, esperado, delAlumno, factor) === "exacta")) return "dudosa";
  return cercanias.includes("cerca") ? "dudosa" : "incorrecta";
}

/* ───────────────────────── La clave en partes ───────────────────────── */

interface Parte {
  etiqueta: string | null;
  texto: string;
  valor: { valor: number; unidad: string | null; decimales: number | null } | null;
  /** Lo que la clave dice tras el valor y su unidad: «hacia la izquierda» en «3 m/s hacia la izquierda». */
  resto?: string;
}

function partir(texto: string, separadores: RegExp): Parte[] {
  return texto.split(separadores).map((s) => s.trim()).filter(Boolean).map((s) => {
    const igual = s.lastIndexOf("=");
    const etiqueta = igual > 0 ? s.slice(0, igual).trim() : null;
    const lado = sinFormulas(igual > 0 ? s.slice(igual + 1) : s);
    const v = valoresEn(lado)[0];
    return {
      etiqueta, texto: s, valor: v && v.inicio === 0 ? { valor: v.valores[0], unidad: v.unidad, decimales: v.decimales } : null,
      resto: v && v.inicio === 0 ? v.palabras.slice(v.fin).join(" ") : undefined,
    };
  });
}

/** Lo que se espera de una parte de la clave; con un %, su valor como fracción y como porcentaje. */
function esperadoDe(parte: NonNullable<Parte["valor"]>, texto: string, valorNumerico?: number | null): Esperado {
  if (texto.includes("%")) {
    // «12,5 %» escrito tal cual es exacto: pide 12,5 (o 0,125), no su redondeo a 13 (sonda del 17-10).
    // Solo es inexacto si `valorNumerico` dice que la clave redondea otra cosa (1/3 → «33,3 %»).
    const m = texto.match(/(\d+)(?:[.,](\d+))?\s*%/);
    const coincide = valorNumerico == null || [parte.valor, parte.valor * 100].some((x) => Math.abs(x - valorNumerico) <= Math.abs(x) * 1e-12);
    const decimales = m && coincide ? (m[2]?.length ?? 0) + 2 : null;
    return { valores: [parte.valor, parte.valor * 100], unidad: parte.unidad, decimales, preciso: null };
  }
  // «1.500 J» (o «1,500 J») con `valorNumerico` 1500: el punto o la coma era de miles, no decimal
  // (ronda 4; la coma, sonda del 17-10).
  const miles = texto.match(/\d{1,3}(?:[.,]\d{3})+(?![\d,.])/)?.[0];
  if (miles && valorNumerico != null && Math.abs(Number(miles.replace(/[.,]/g, "")) - valorNumerico) < 1e-9) {
    return { valores: [valorNumerico], unidad: parte.unidad, decimales: 0, preciso: null };
  }
  const distinto = valorNumerico != null && Math.abs(valorNumerico - parte.valor) > 1e-12;
  const d = parte.decimales;
  if (d === null) {
    // Clave inexacta («1/3»): su valor escrito y el que guardó quien generó la pregunta.
    return { valores: distinto ? [parte.valor, valorNumerico!] : [parte.valor], unidad: parte.unidad, decimales: null, preciso: null };
  }
  // Clave exacta: `valorNumerico` solo cuenta si la clave es su redondeo («9,90» por 9,8995). Si no
  // redondea a la clave, es un error de quien la generó y no abre ninguna puerta.
  const esRedondeo = distinto && Math.abs(valorNumerico! - parte.valor) <= 0.5 * 10 ** -d + 1e-12;
  return { valores: [parte.valor], unidad: parte.unidad, decimales: d, preciso: esRedondeo ? valorNumerico! : null };
}

/** Lo que va antes del primer «=»: «x» en «x = 2 + 2 = 4». */
const etiquetaDe = (s: string) => {
  const i = s.indexOf("=");
  // Sin pasar a minúsculas: «Y» no es «y» (puerta, ronda 6; lo mismo que se quitó de `normSimbolo`).
  const e = i > 0 ? sinTildes(s.slice(0, i)).replace(/[\s$]/g, "") : "";
  return e || null;
};

const SEPARA_LA_CLAVE = /;|\s+y\s+|,\s*(?=[^\d\s,()=]{1,4}\s*=)/;
// La coma pegada solo separa si sigue otra igualdad («x=-4,x=4»): «2,5» es un decimal.
const SEPARA_LA_RESPUESTA = /;|,\s+|,(?=\s*\p{L}[\p{L}\d]*\s*=)|\s+y\s+/u;

// Sin pasar a minúsculas (MPa no es mPa, Mg no es mg) y sin pegar dos números separados por un
// espacio («1 1/2» no es «11/2»): el atajo simbólico daba esos falsos positivos (ronda 5).
const normSimbolo = (t: string) =>
  sinTildes(t.split("≈")[0]).replace(/\\pi/g, "π").replace(/[−–]/g, "-")
    // «2·10^3» no es «210^3»: un producto entre cifras queda marcado, como el espacio (sonda del 17-10).
    .replace(/(\d)\s*(?:[*·×]|\\cdot|\\times)\s*(?=\d)/g, "$1×")
    .replace(/(\d)\s+(?=\d)/g, "$1_").replace(/[\s$*·]|\\cdot/g, "");

function igualSimbolica(respuesta: string, clave: string): boolean {
  // Los lados derechos solo valen si la clave es de una sola parte: «λ = 1 y λ = 9» no es «9».
  const unaParte = clave.split("≈")[0].split(SEPARA_LA_CLAVE).filter((x) => x.trim()).length === 1;
  const lineas = respuesta.split("\n").map((l) => l.trim()).filter(Boolean);
  const r = normSimbolo(lineas[lineas.length - 1] ?? "");
  const c = normSimbolo(clave);
  if (!r || !c) return false;
  const derecha = (s: string) => s.slice(s.lastIndexOf("=") + 1);
  if (r === c) return true;
  // «y = 3» no es «x = 3»: si los dos nombran la variable, tiene que ser la misma.
  const [er, ec] = [etiquetaDe(r), etiquetaDe(c)];
  if (er && ec && er !== ec) return false;
  // «x = -4 y x = 4»: con dos resultados, el lado derecho del último no es la respuesta.
  const variasEnLaUltima = (lineas[lineas.length - 1] ?? "").split(SEPARA_LA_RESPUESTA).filter((s) => s.trim()).length > 1;
  // «x = 4 = 2» por «x = 2»: con más igualdades que la clave, lo de en medio también cuenta (sonda del 17-10).
  const iguales = (s: string) => s.split("=").length - 1;
  if (iguales(r) > Math.max(iguales(c), 1)) return false;
  return unaParte && !variasEnLaUltima && (c.includes("=") || r.includes("=")) && derecha(c).length > 0 && derecha(r) === derecha(c);
}

const VACIAS = new Set(["de", "la", "el", "los", "las", "y", "en", "es", "un", "una", "del", "al", "que"]);
const palabras = (t: string) => sinTildes(t).toLowerCase().split(/[^a-z0-9ñ]+/).filter((p) => p.length >= 2 && !VACIAS.has(p));

/* ───────────────────────── Numéricas ───────────────────────── */

/**
 * Lo que se escribe en un celular, a la forma que se sabe leer:
 *
 * - «x=2.5» → «x = 2.5»: con el «=» pegado, la línea era una sola palabra;
 * - «pi» → «π»: en el teclado no hay π;
 * - «2.5m/s» → «2.5 m/s»: la unidad pegada escondía el número (ronda 5). La notación científica
 *   («3e8», «6.02e23») no se toca.
 */
const separar = (t: string) => t
  .replace(/\s*=\s*/g, " = ")
  .replace(/(?<![\p{L}\\])pi(?![\p{L}])/giu, "π")
  .replace(/(\d)(?![eE][-+]?\d)(?=[a-zA-Zμ°Ωå%])/g, "$1 ");

export function corregirSumativa(clave: ClaveNumerica, respuesta: string): Veredicto {
  const t = separar(respuesta);
  if (NEGACION.test(t) || DUDA.test(t) || COMPARACION.test(t)) return "dudosa";
  // «4?», «¿4?», «4!»: una pregunta o una exclamación no es la respuesta limpia (puerta, ronda 6).
  if (/[?¿!¡]/.test(t)) return "dudosa";
  // «sen(30)»: ¿grados o radianes? Que lo decida la IA (sonda del 17-10).
  if (/(?<![\p{L}])(sen|sin|cos|tan|tg|cot|sec|csc)(?![\p{L}])/iu.test(t)) return "dudosa";
  // «-4\n4»: dos resultados sueltos y distintos, cada uno en su línea, es cubrirse (antes del atajo
  // simbólico, que solo mira la última línea).
  const sueltos = new Set(t.split("\n").map((l) => valorDe(l)).filter((x): x is number => x !== null).map((x) => x.toPrecision(12)));
  if (sueltos.size > 1) return "dudosa";
  // «x = -4\nx = 4»: la misma variable con dos valores en líneas distintas, también.
  const porVariable = new Map<string, Set<string>>();
  for (const l of t.split("\n")) {
    const e = etiquetaDe(l);
    const v = e ? valorDe(l.slice(l.lastIndexOf("=") + 1)) : null;
    if (e && v !== null) porVariable.set(e, (porVariable.get(e) ?? new Set()).add(v.toPrecision(12)));
  }
  if ([...porVariable.values()].some((s) => s.size > 1)) return "dudosa";
  if (igualSimbolica(t, clave.clave)) return "correcta";
  const largo = t.length >= 40 || t.split("\n").filter((l) => l.trim()).length >= 3;
  const siFalla = (v: Veredicto): Veredicto => (v === "incorrecta" && largo ? "dudosa" : v);

  const partes = partir(separar(clave.clave.split("≈")[0]), SEPARA_LA_CLAVE);
  const numericas = partes.filter((p) => p.valor);
  const cualitativas = partes.filter((p) => !p.valor && !valoresEn(sinFormulas(p.texto)).length && !p.texto.includes("="));
  const simbolica = partes.length !== numericas.length + cualitativas.length || !numericas.length;
  if (simbolica) return "dudosa";
  const delAlumno = new Set(palabras(t));
  if (cualitativas.some((q) => palabras(q.texto).some((p) => !delAlumno.has(p)))) return "dudosa";
  // Y lo cualitativo pegado al número: «3 m/s hacia la izquierda» no es «3 m/s» (sonda del 17-10).
  if (numericas.some((q) => q.resto && palabras(q.resto).length > 0)) return "dudosa";

  // Una línea cuenta si se lee algún valor en ella: «−½», «e²» o «π/2» no llevan dígitos sueltos.
  const esTupla = (l: string) => /\([^()]*\d[^()]*,[^()]*\)/.test(l);
  const lineas = t.split("\n").map((l) => l.trim()).filter((l) => esTupla(l) || valoresEn(sinFormulas(l)).length > 0);
  // Ningún número que se sepa leer («300.000.000», «dos coma cinco»): no se da por malo sin mirar.
  if (!lineas.length) return "dudosa";

  if (numericas.length === 1) {
    const esperado = esperadoDe(numericas[0].valor!, numericas[0].texto, clave.valorNumerico);
    const resultadoDe = (linea: string): Veredicto | null => {
      const l = sinFormulas(linea);
      // «x = 4 = 2»: un paso intermedio que vale otra cosa no es una cuenta, es cubrirse (sonda del 17-10).
      // «x = 2 + 2 = 4» sí: cada paso vale lo mismo.
      const pasos = l.split("=").slice(1).map((s) => valorDe(s)).filter((x): x is number => x !== null);
      if (pasos.some((x) => Math.abs(x - pasos[pasos.length - 1]) > Math.abs(x) * 1e-12)) return "dudosa";
      const tramo = l.includes("=") ? l.slice(l.lastIndexOf("=") + 1) : l;
      const valores = valoresEn(tramo);
      if (valores.length !== 1) return valores.length ? "dudosa" : null;
      if (sobraAlrededor(valores[0])) return "dudosa";
      return comparar(valores[0], esperado);
    };
    const ultima = lineas[lineas.length - 1];
    // «x = -4 y x = 4»: dos resultados en la última línea es cubrirse, no responder.
    if (ultima.split(SEPARA_LA_RESPUESTA).filter((s) => valoresEn(sinFormulas(s)).length > 0).length > 1) return "dudosa";
    // «y = 3» por «x = 3»: otra variable, aunque el número case.
    const [ea, ec] = [etiquetaDe(ultima), etiquetaDe(numericas[0].texto)];
    if (ea && ec && ea !== ec && !["resultado", "respuesta"].includes(ea.toLowerCase())) return "dudosa";
    const veredicto = resultadoDe(ultima);
    if (veredicto === null) return "dudosa";
    // El resultado bien escrito antes y una comprobación al final: que lo mire la IA.
    if (veredicto === "incorrecta" && lineas.slice(0, -1).some((l) => resultadoDe(l) === "correcta")) return "dudosa";
    return siFalla(veredicto);
  }

  // Varias partes: como tupla «(1,2,3)» o como «a = …; T = …».
  const k = numericas.length;
  const zona = lineas.slice(-k).join("; ");
  const tupla = zona.match(/\(([^()]*,[^()]*)\)/);
  const delA: Parte[] = tupla
    ? tupla[1].split(/[,;]/).map((s) => {
      const v = valorDe(s);
      return { etiqueta: null, texto: s, valor: v === null ? null : { valor: v, unidad: null, decimales: precision(s).decimales } };
    })
    : partir(sinFormulas(zona), SEPARA_LA_RESPUESTA);
  const conValor = delA.filter((p) => p.valor);
  // Con varias partes, lo que sobra tras el valor también cuenta: «a = 4 + x; b = 2» (puerta, ronda 6).
  if (!tupla && conValor.some((p) => p.resto)) return "dudosa";
  // «x = 2,3» por «x = 2 y x = 3»: ¿las dos raíces o un decimal? A la IA (sonda del 17-10).
  if (conValor.length < k && /\d,\d/.test(zona)) return "dudosa";
  if (conValor.length < k) return siFalla("incorrecta");
  if (conValor.length > k) return "dudosa";

  const norm = (e: string | null) => (e ? sinTildes(e).toLowerCase().replace(/\s/g, "") : null);
  const etiquetasClave = numericas.map((p) => norm(p.etiqueta));
  const etiquetasAlumno = conValor.map((p) => norm(p.etiqueta));
  const porEtiqueta = etiquetasClave.every((e) => e) && new Set(etiquetasClave).size === k
    && etiquetasAlumno.every((e) => e && etiquetasClave.includes(e));
  // Las raíces de una ecuación («x = 2 y x = 3»): la misma variable en todas, el orden no importa
  // («x = 3 y x = 2» también vale; sonda del 17-10). Se emparejan de menor a mayor.
  const raices = etiquetasClave.every((e) => e && e === etiquetasClave[0]) && etiquetasAlumno.every((e) => e === etiquetasClave[0]);
  const porValor = (xs: Parte[]) => [...xs].sort((a, b) => a.valor!.valor - b.valor!.valor);
  const [clavesEnOrden, suyasEnOrden] = raices ? [porValor(numericas), porValor(conValor)] : [numericas, conValor];
  // Por orden, cada variable del alumno tiene que ser la de la clave (o la misma con subíndice: λ1 por λ):
  // «x = 2 y y = 3» no es «x = 2 y x = 3» (sonda del 17-10).
  const mismaVariable = (suya: string | null, de: string | null) => !suya || !de || suya === de || new RegExp(`^${de.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\d₀-₉_]+$`, "u").test(suya);
  if (!porEtiqueta && !raices && conValor.some((p, i) => !mismaVariable(etiquetasAlumno[i], etiquetasClave[i]))) return "dudosa";
  const veredictos = clavesEnOrden.map((esperada, i) => {
    const suya = porEtiqueta ? conValor[etiquetasAlumno.indexOf(etiquetasClave[i])] : suyasEnOrden[i];
    const v = suya.valor!;
    return comparar({ valores: [v.valor], unidad: v.unidad, ...precision(String(v.valor)) }, esperadoDe(esperada.valor!, esperada.texto));
  });
  if (veredictos.every((x) => x === "correcta")) return "correcta";
  if (veredictos.includes("incorrecta")) return siFalla("incorrecta");
  return "dudosa";
}
