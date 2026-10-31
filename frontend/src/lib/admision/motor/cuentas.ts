/**
 * Las cuentas, comprobadas con código y no con el modelo.
 *
 * Es la queja número uno contra los resolvedores con IA: en un problema largo, el modelo
 * escribe «100/20 = 4» con la misma seguridad que «= 5». Aquí cada igualdad numérica de una
 * solución se vuelve a calcular, y la que no cuadra se descarta o se rehace.
 *
 * Por qué un evaluador propio y no una librería (decisión del 13-10-2026):
 * - mathjs pesa ~170 KB min+gz y las edge functions solo importan por URL (no hay `npm:` ni
 *   import map en el repo): cada arranque en frío lo descargaría y compilaría.
 * - Nerdamer hace álgebra simbólica, que aquí no hace falta: lo que se comprueba son
 *   resultados numéricos, con las variables que el problema da.
 * - Lo que se necesita —aritmética, potencias, raíces, trigonometría en grados o radianes,
 *   logaritmos, factorial, porcentaje, producto implícito y el LaTeX que escriben los modelos—
 *   cabe en este fichero, sin dependencias, y el cliente lo reutiliza tal cual
 *   (lo reexporta `src/lib/stem/numerica.ts`).
 */

export class ErrorDeCuenta extends Error {}

export type Variables = Readonly<Record<string, number>>;

// ---------------------------------------------------------------------------------------------
// LaTeX → expresión
// ---------------------------------------------------------------------------------------------

const GRIEGAS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", theta: "θ",
  lambda: "λ", mu: "μ", nu: "ν", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", varphi: "φ",
  omega: "ω", Delta: "Δ", Omega: "Ω", Sigma: "Σ", Theta: "Θ", Phi: "Φ", Gamma: "Γ",
};

/** El contenido de las llaves que abren en `i` (que debe ser `{`) y dónde acaban. */
function grupo(t: string, i: number): { dentro: string; fin: number } {
  if (t[i] !== "{") {
    // `\frac12`: un solo carácter hace de argumento.
    return { dentro: t[i] ?? "", fin: i + 1 };
  }
  let prof = 0;
  for (let j = i; j < t.length; j++) {
    if (t[j] === "{") prof++;
    else if (t[j] === "}" && --prof === 0) return { dentro: t.slice(i + 1, j), fin: j + 1 };
  }
  throw new ErrorDeCuenta("Llaves sin cerrar");
}

function saltarEspacios(t: string, i: number): number {
  while (t[i] === " ") i++;
  return i;
}

/**
 * El LaTeX de una fórmula, en la sintaxis de `evaluar`. Sin `$`, sin unidades (`\text{m/s}`),
 * con `\frac`, `\sqrt`, `\cdot`, la coma decimal (`9{,}8`) y los grados (`30^\circ`).
 */
export function latexAExpresion(latex: string): string {
  let t = latex
    .replace(/\$/g, " ")
    .replace(/\\(?:text|mathrm|operatorname|mbox)\s*\{[^{}]*\}/g, " ")
    .replace(/\\(?:left|right|displaystyle|textstyle|mathbf|mathit|big|Big|bigg|Bigg)(?![a-zA-Z])/g, " ")
    .replace(/\\[,;:! ]|\\quad|\\qquad|~/g, " ")
    .replace(/\{,\}/g, ".")
    .replace(/\^\s*\{?\s*\\circ\s*\}?|°/g, "°")
    .replace(/\\(?:cdot|times|ast)(?![a-zA-Z])|[×·∙*]/g, "*")
    .replace(/\\div(?![a-zA-Z])|÷/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/\\%/g, "%")
    .replace(/\\pi(?![a-zA-Z])/g, " pi ")
    .replace(/\\(sin|cos|tan|arcsin|arccos|arctan|ln|log|exp|sqrt)(?![a-zA-Z])/g, (_, f: string) =>
      f === "sqrt" ? "\\sqrt" : ` ${f.replace(/^arc/, "a")} `,
    )
    .replace(/\\([a-zA-Z]+)/g, (todo, nombre: string) => (GRIEGAS[nombre] ? GRIEGAS[nombre] : todo));

  // \frac{a}{b}, \dfrac, \tfrac y \sqrt[n]{x}, de dentro afuera: se repite hasta que no quede.
  for (let vueltas = 0; vueltas < 50; vueltas++) {
    const fr = t.search(/\\[dt]?frac/);
    const rz = t.search(/\\sqrt/);
    if (fr < 0 && rz < 0) break;
    if (fr >= 0 && (rz < 0 || fr < rz)) {
      const inicio = fr;
      let i = t.indexOf("frac", fr) + 4;
      i = saltarEspacios(t, i);
      const a = grupo(t, i);
      const b = grupo(t, saltarEspacios(t, a.fin));
      t = `${t.slice(0, inicio)}((${a.dentro})/(${b.dentro}))${t.slice(b.fin)}`;
    } else {
      const inicio = rz;
      let i = saltarEspacios(t, rz + 5);
      let indice: string | null = null;
      if (t[i] === "[") {
        const cierre = t.indexOf("]", i);
        if (cierre < 0) throw new ErrorDeCuenta("Raíz sin cerrar");
        indice = t.slice(i + 1, cierre);
        i = saltarEspacios(t, cierre + 1);
      }
      const r = grupo(t, i);
      t = indice === null
        ? `${t.slice(0, inicio)}sqrt(${r.dentro})${t.slice(r.fin)}`
        : `${t.slice(0, inicio)}((${r.dentro})^(1/(${indice})))${t.slice(r.fin)}`;
    }
  }

  if (/\\[a-zA-Z]/.test(t)) {
    throw new ErrorDeCuenta(`Orden de LaTeX que no sé calcular: ${t.match(/\\[a-zA-Z]+/)?.[0]}`);
  }
  return t.replace(/\{/g, "(").replace(/\}/g, ")");
}

// ---------------------------------------------------------------------------------------------
// Evaluador: precedencia clásica, producto implícito, potencias a la derecha.
// ---------------------------------------------------------------------------------------------

type Token =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "fn"; v: string }
  | { t: "op"; v: string };

const FUNCIONES: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  abs: Math.abs,
};
/** De más largo a más corto, para que «asin» no se lea como «a·sin». */
const NOMBRES = [...Object.keys(FUNCIONES), "pi"].sort((a, b) => b.length - a.length);

const LETRA = /[A-Za-zα-ωΑ-Ω]/;

function trocear(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (/\s/.test(c)) { i++; continue; }

    if (/[\d.]/.test(c)) {
      let j = i;
      while (j < expr.length && /\d/.test(expr[j])) j++;
      // Coma o punto decimal, siempre entre cifras.
      if ((expr[j] === "." || expr[j] === ",") && /\d/.test(expr[j + 1] ?? "")) {
        j++;
        while (j < expr.length && /\d/.test(expr[j])) j++;
      } else if (expr[j] === "." && j === i) {
        throw new ErrorDeCuenta("Número mal escrito");
      }
      // Notación científica: 1.2e3, 6E-5. Una «e» suelta tras un número es la constante.
      const exp = expr.slice(j).match(/^[eE][+-]?\d+/);
      if (exp) j += exp[0].length;
      const v = Number(expr.slice(i, j).replace(",", "."));
      if (!Number.isFinite(v)) throw new ErrorDeCuenta("Número mal escrito");
      tokens.push({ t: "num", v });
      i = j;
      continue;
    }

    if (LETRA.test(c)) {
      const nombre = NOMBRES.find((n) => expr.startsWith(n, i) && !/[A-Za-z]/.test(expr[i + n.length] ?? ""))
        ?? NOMBRES.find((n) => n !== "pi" ? false : expr.startsWith(n, i));
      if (nombre) {
        tokens.push(nombre === "pi" ? { t: "id", v: "pi" } : { t: "fn", v: nombre });
        i += nombre.length;
        continue;
      }
      // Una letra es una variable; con su subíndice, `v_0` o `v_{max}`. «Δx» es UNA variable,
      // no Δ por x: si no, «Δx / Δt» se leería Δ·x/Δ·t.
      let id = c;
      i++;
      if (c === "Δ") {
        const j = saltarEspacios(expr, i);
        if (LETRA.test(expr[j] ?? "") && expr[j] !== "Δ") {
          id += expr[j];
          i = j + 1;
        }
      }
      if (expr[i] === "_") {
        if (expr[i + 1] === "(") {
          const cierre = expr.indexOf(")", i);
          if (cierre < 0) throw new ErrorDeCuenta("Subíndice sin cerrar");
          id += `_${expr.slice(i + 2, cierre).trim()}`;
          i = cierre + 1;
        } else if (/[A-Za-z0-9]/.test(expr[i + 1] ?? "")) {
          id += `_${expr[i + 1]}`;
          i += 2;
        }
      }
      tokens.push({ t: "id", v: id });
      continue;
    }

    if ("+-*/^()|!%°".includes(c)) {
      tokens.push({ t: "op", v: c });
      i++;
      continue;
    }
    throw new ErrorDeCuenta(`Símbolo que no sé calcular: «${c}»`);
  }
  return tokens;
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) throw new ErrorDeCuenta("Factorial fuera de rango");
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}

class Lector {
  private i = 0;
  // Sin «parameter properties»: Node las rechaza al quitar los tipos, y los scripts
  // (`scripts/stem/probar-con-ia.mjs`) cargan este fichero sin transpilar.
  private readonly tokens: Token[];
  private readonly vars: Variables;
  constructor(tokens: Token[], vars: Variables) {
    this.tokens = tokens;
    this.vars = vars;
  }

  leer(): number {
    const v = this.suma();
    if (this.i < this.tokens.length) throw new ErrorDeCuenta("Sobra algo al final de la expresión");
    return v;
  }

  private mira(): Token | undefined {
    return this.tokens[this.i];
  }
  private esOp(v: string): boolean {
    const t = this.mira();
    return t?.t === "op" && t.v === v;
  }

  private suma(): number {
    let v = this.producto();
    while (this.esOp("+") || this.esOp("-")) {
      const op = (this.tokens[this.i++] as { v: string }).v;
      const d = this.producto();
      v = op === "+" ? v + d : v - d;
    }
    return v;
  }

  /** ¿Empieza aquí un factor, para un producto implícito («2x», «2(3)», «(a)(b)»)? */
  private empiezaFactor(): boolean {
    const t = this.mira();
    if (!t) return false;
    if (t.t !== "op") return true;
    return t.v === "(";
  }

  private producto(): number {
    let v = this.unario();
    for (;;) {
      if (this.esOp("*") || this.esOp("/")) {
        const op = (this.tokens[this.i++] as { v: string }).v;
        const d = this.unario();
        if (op === "/") {
          if (d === 0) throw new ErrorDeCuenta("División entre cero");
          v = v / d;
        } else v = v * d;
      } else if (this.empiezaFactor()) {
        v = v * this.potencia();
      } else return v;
    }
  }

  private unario(): number {
    if (this.esOp("-")) { this.i++; return -this.unario(); }
    if (this.esOp("+")) { this.i++; return this.unario(); }
    return this.potencia();
  }

  private potencia(): number {
    const base = this.posfijo();
    if (this.esOp("^")) {
      this.i++;
      const exp = this.unario();
      const v = Math.pow(base, exp);
      if (!Number.isFinite(v)) throw new ErrorDeCuenta("La potencia no da un número");
      return v;
    }
    return base;
  }

  private posfijo(): number {
    let v = this.primario();
    for (;;) {
      if (this.esOp("!")) { this.i++; v = factorial(v); }
      else if (this.esOp("%")) { this.i++; v = v / 100; }
      else if (this.esOp("°")) { this.i++; v = (v * Math.PI) / 180; }
      else return v;
    }
  }

  private primario(): number {
    const t = this.tokens[this.i++];
    if (!t) throw new ErrorDeCuenta("La expresión acaba antes de tiempo");
    if (t.t === "num") return t.v;
    if (t.t === "id") {
      if (t.v in this.vars) return this.vars[t.v];
      if (t.v === "pi") return Math.PI;
      if (t.v === "e") return Math.E;
      throw new ErrorDeCuenta(`No sé cuánto vale «${t.v}»`);
    }
    if (t.t === "fn") {
      const arg = this.esOp("(") ? this.primario() : this.potencia();
      const v = FUNCIONES[t.v](arg);
      if (!Number.isFinite(v)) throw new ErrorDeCuenta(`${t.v} fuera de su dominio`);
      return v;
    }
    if (t.v === "(") {
      const v = this.suma();
      if (!this.esOp(")")) throw new ErrorDeCuenta("Paréntesis sin cerrar");
      this.i++;
      return v;
    }
    if (t.v === "|") {
      const v = this.suma();
      if (!this.esOp("|")) throw new ErrorDeCuenta("Valor absoluto sin cerrar");
      this.i++;
      return Math.abs(v);
    }
    throw new ErrorDeCuenta(`No esperaba «${t.v}»`);
  }
}

/** El valor de una expresión («2x + 3», «sqrt(2)», «sin(30°)»). Lanza `ErrorDeCuenta` si no se puede. */
export function evaluar(expresion: string, variables: Variables = {}): number {
  const v = new Lector(trocear(expresion), variables).leer();
  if (!Number.isFinite(v)) throw new ErrorDeCuenta("No da un número");
  return v;
}

/** `evaluar` sobre LaTeX. */
export function evaluarLatex(latex: string, variables: Variables = {}): number {
  return evaluar(latexAExpresion(latex), variables);
}

// ---------------------------------------------------------------------------------------------
// Comprobar una cuenta escrita: «\frac{100}{20} = 5»
// ---------------------------------------------------------------------------------------------

export type ResultadoDeCuenta =
  | { estado: "cuadra" }
  | { estado: "sin_numeros" }
  | { estado: "no_cuadra"; tramo: string; esperado: number; escrito: number };

/** Relaciones que parten una cadena en cuentas independientes. */
const IMPLICA = /\\(?:Rightarrow|implies|to|Longrightarrow|therefore)(?![a-zA-Z])|⇒|→|∴/;
/** Comparaciones: con ellas no hay igualdad que comprobar. */
const COMPARA = /\\(?:le|ge|leq|geq|neq|ne|lt|gt|pm|mp)(?![a-zA-Z])|[<>≤≥≠±]/;
const IGUAL = /(=|\\approx(?![a-zA-Z])|≈)/;

/** Cuántos decimales escribe un lado que es un número a secas («3,33» → 2). `null` si no lo es. */
function decimalesEscritos(lado: string): number | null {
  const limpio = latexAExpresion(lado).replace(/\s/g, "");
  const m = limpio.match(/^-?\d+(?:[.,](\d+))?$/);
  if (!m) return null;
  return m[1]?.length ?? 0;
}

function igualan(esperado: number, escrito: number, lado: string, aproximado: boolean): boolean {
  const diferencia = Math.abs(esperado - escrito);
  const escala = Math.max(Math.abs(esperado), Math.abs(escrito), 1e-12);
  if (diferencia <= 1e-9 * escala) return true;
  if (aproximado && diferencia <= 0.01 * escala) return true;
  // Quien escribe «3,33» redondea: vale si el error cabe en medio último decimal.
  const decimales = decimalesEscritos(lado);
  if (decimales !== null && decimales > 0 && diferencia <= 0.5 * 10 ** -decimales + 1e-12) return true;
  return false;
}

/**
 * Si una cuenta escrita en LaTeX cuadra. Cada lado de cada `=` que se pueda calcular (con las
 * `variables` del problema, si las hay) tiene que valer lo mismo que el anterior calculable.
 * Los lados con letras desconocidas no cuentan; si quedan menos de dos lados con número, no
 * hay cuenta que comprobar (`sin_numeros`), que NO es un fallo.
 */
export function comprobarCuenta(latex: string, variables: Variables = {}): ResultadoDeCuenta {
  let comprobadas = 0;
  for (const cadena of latex.replace(/\$/g, " ").split(IMPLICA)) {
    if (COMPARA.test(cadena)) continue;
    const partes = cadena.split(IGUAL);
    // [lado, relación, lado, relación, lado…]
    let anterior: { valor: number; texto: string } | null = null;
    let aproximado = false;
    for (let k = 0; k < partes.length; k += 2) {
      const lado = partes[k].trim();
      if (k > 0) aproximado = aproximado || partes[k - 1] !== "=";
      let valor: number | null = null;
      try {
        valor = lado ? evaluarLatex(lado, variables) : null;
      } catch {
        valor = null;
      }
      if (valor === null) continue;
      if (anterior) {
        comprobadas++;
        if (!igualan(anterior.valor, valor, lado, aproximado)) {
          return { estado: "no_cuadra", tramo: `${anterior.texto} = ${lado}`, esperado: anterior.valor, escrito: valor };
        }
      }
      anterior = { valor, texto: lado };
      aproximado = false;
    }
  }
  return comprobadas > 0 ? { estado: "cuadra" } : { estado: "sin_numeros" };
}
