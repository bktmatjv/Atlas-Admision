/**
 * Una opción en LaTeX como texto que se puede leer: para el nombre accesible de la opción. En cuanto KaTeX
 * la pinta, la letra va oculta y el `<math>` no entra en el nombre del botón, así que sin esto el lector de
 * pantalla anuncia «botón de opción» sin decir cuál. No es un intérprete de LaTeX: cubre lo que trae el
 * banco (fracciones, raíces, griegas, flechas, grados) y lo demás pierde la barra, pero no desaparece.
 */
const SIMBOLOS: Record<string, string> = {
  pi: "π", alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", theta: "θ", lambda: "λ", mu: "μ",
  sigma: "σ", phi: "φ", omega: "ω", ell: "ℓ", infty: "∞",
  circ: "°", degree: "°", cdot: "·", times: "×", div: "÷", pm: "±", mid: "|", parallel: "∥",
  rightarrow: "→", to: "→", leftarrow: "←", leftrightarrow: "↔", Rightarrow: "⇒", implies: "⇒", iff: "⇔",
  wedge: "∧", vee: "∨", neg: "¬", sim: "~", approx: "≈", equiv: "≡", perp: "⊥", angle: "∠",
  neq: "≠", ne: "≠", leq: "≤", le: "≤", geq: "≥", ge: "≥", cap: "∩", cup: "∪", in: "∈", subset: "⊂",
};

/** Una cifra, una letra o un símbolo: va sin paréntesis tras √ o en una fracción. */
const SIMPLE = /^(\d+([.,]\d+)?|\p{L}|[π°∞])$/u;
const envolver = (s: string) => (SIMPLE.test(s.trim()) ? s.trim() : `(${s.trim()})`);

export function textoLegible(s: string): string {
  let t = s
    .replace(/\$/g, "")
    .replace(/\\(left|right)(?![a-zA-Z])/g, "")
    .replace(/\\[a-zA-Z]+/g, (m) => SIMBOLOS[m.slice(1)] ?? m)
    .replace(/\\[,;!]|\\quad(?![a-zA-Z])/g, " ")
    .replace(/\\(?:text|mathrm)\s*\{([^{}]*)\}/g, "$1");
  // De dentro afuera: primero las que no llevan llaves dentro (\frac{\sqrt{3}}{2}).
  for (let antes = ""; antes !== t; ) {
    antes = t;
    t = t
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, (_, x: string) => `√${envolver(x)}`)
      .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, n: string, d: string) => {
        const num = /^√\S+$/.test(n.trim()) ? n.trim() : envolver(n);
        return `${num}/${envolver(d)}`;
      });
  }
  return t
    .replace(/\\([a-zA-Z]+)/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/\^°/g, "°")
    .replace(/\s+/g, " ")
    .trim();
}
