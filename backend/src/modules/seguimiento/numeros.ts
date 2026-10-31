// Normalización de respuestas numéricas y evaluador aritmético propio (sin eval ni Function).
export type NumeroLeido = { legible: true; valor: number } | { legible: false };
const NUM = String.raw`\d+(?:[.,]\d+)?`;
const ENTERO_O_DECIMAL = new RegExp(`^-?${NUM}$`);
const FRACCION = new RegExp(`^(-?${NUM})/(${NUM})$`);
const aNumero = (t: string) => Number(t.replace(",", "."));
// Quita la moneda inicial («S/») y una unidad final conocida (%, cm, ml, litros).
export function normalizarNumero(texto: string): NumeroLeido {
  let t = texto.trim().toLowerCase();
  t = t.replace(/^s\/\.?\s*/, "");
  t = t.replace(/\s*(%|cm|ml|litros?)$/, "").trim();
  if (ENTERO_O_DECIMAL.test(t)) return { legible: true, valor: aNumero(t) };
  const f = FRACCION.exec(t);
  if (f) {
    const den = aNumero(f[2]);
    if (den !== 0) return { legible: true, valor: aNumero(f[1]) / den };
  }
  return { legible: false };
}
// Tolerancia relativa de 1e-9 (con piso absoluto para valores cercanos a cero).
export const igualesNumeros = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const MAX_LARGO = 200;
const MAX_PROFUNDIDAD = 20;
type Token = { t: "num"; v: number } | { t: "op"; v: string };
function tokenizar(texto: string): Token[] | null {
  const s = texto.toLowerCase().replace(/s\/\.?/g, "");
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const n = new RegExp(`^${NUM}`).exec(s.slice(i));
    if (n) {
      out.push({ t: "num", v: aNumero(n[0]) });
      i += n[0].length;
      continue;
    }
    if ("+-*/×÷()%".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
      continue;
    }
    // La única palabra admitida es «de» («20% de 120»).
    if (
      /^de(?![a-zñ])/.test(s.slice(i)) &&
      (i === 0 || !/[a-zñ]/.test(s[i - 1]))
    ) {
      out.push({ t: "op", v: "de" });
      i += 2;
      continue;
    }
    return null;
  }
  return out;
}
export function evaluarExpresion(texto: string): number | null {
  if (texto.length === 0 || texto.length > MAX_LARGO) return null;
  const tokens = tokenizar(texto);
  if (!tokens?.length) return null;
  let p = 0;
  const peek = () => tokens[p];
  const esOp = (...v: string[]) => {
    const k = peek();
    return k?.t === "op" && v.includes(k.v);
  };
  const FALLO = Symbol("fallo");
  const expr = (prof: number): number => {
    if (prof > MAX_PROFUNDIDAD) throw FALLO;
    let v = term(prof);
    while (esOp("+", "-")) {
      const op = (tokens[p++] as { v: string }).v;
      const r = term(prof);
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  const term = (prof: number): number => {
    let v = unary(prof);
    while (esOp("*", "×", "/", "÷", "de")) {
      const op = (tokens[p++] as { v: string }).v;
      const r = unary(prof);
      if (op === "/" || op === "÷") {
        if (r === 0) throw FALLO;
        v /= r;
      } else v *= r;
    }
    return v;
  };
  const unary = (prof: number): number => {
    if (esOp("-")) {
      p++;
      return -unary(prof);
    }
    let v = primary(prof);
    while (esOp("%")) {
      p++;
      v /= 100;
    }
    return v;
  };
  const primary = (prof: number): number => {
    const k = tokens[p++];
    if (k?.t === "num") return k.v;
    if (k?.t === "op" && k.v === "(") {
      const v = expr(prof + 1);
      if (!esOp(")")) throw FALLO;
      p++;
      return v;
    }
    throw FALLO;
  };
  try {
    const v = expr(0);
    return p === tokens.length && Number.isFinite(v) ? v : null;
  } catch (e) {
    if (e === FALLO) return null;
    throw e;
  }
}
// «120 - 24 = 96»: todos los lados separados por «=» deben valer lo mismo.
export function verificarIgualdad(
  texto: string,
): { valida: true } | { valida: false; motivo: string } {
  const lados = texto.split("=");
  if (lados.length < 2) return { valida: false, motivo: "No es una igualdad." };
  const valores = lados.map((l) => evaluarExpresion(l));
  if (valores.some((v) => v === null))
    return { valida: false, motivo: "No se pudo leer una de las expresiones." };
  const [primero, ...resto] = valores as number[];
  return resto.every((v) => igualesNumeros(primero, v))
    ? { valida: true }
    : { valida: false, motivo: "La igualdad no se cumple." };
}
