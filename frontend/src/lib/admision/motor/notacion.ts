/**
 * Cómo se escriben las fórmulas en TODO lo que genera o contesta Calibra.
 *
 * El cliente pinta `$…$` y `$$…$$` con KaTeX (`src/lib/markdown/formulas.ts`, que también
 * convierte `\(…\)` por si acaso). Si un prompt no lo pide, el modelo escribe «x^2/3» o
 * «raiz de 2» en texto plano y el alumno de ciencias lee jeroglíficos. Por eso la regla vive
 * aquí, una sola vez, y `notacion.test.ts` vigila que cada función la incluya.
 */

const COMUN = `Toda expresión matemática, química o física va en LaTeX:
- En línea, entre un solo signo de dólar: $x^2 + 3x - 4 = 0$, $\\frac{a}{b}$, $\\sqrt{2}$, $v = 12\\,\\text{m/s}$, $\\text{H}_2\\text{O}$.
- Aparte, para la expresión que importa, entre dos: $$F = m \\cdot a$$
- Nunca \\( \\) ni \\[ \\], nunca bloques de código para una fórmula, y nunca la fórmula a medias en texto plano («x^2/3», «raiz de 2»).
- Las unidades, dentro de la fórmula con \\text{}: $9{,}8\\,\\text{m/s}^2$.
- El dinero NO lleva $: escribe «S/ 5» o «5 dólares».
- Lo que no es una expresión (un año, un número suelto en una frase) va en texto normal.`;

/** Para respuestas en texto libre (markdown). */
export const REGLA_DE_NOTACION = `NOTACIÓN
${COMUN}`;

/**
 * Para respuestas en JSON. En un string de JSON la barra invertida se escapa: `\frac` sin doblar
 * llega a `JSON.parse` como un salto de página seguido de «rac». Ver `repararLatexEnJson`.
 */
export const REGLA_DE_NOTACION_EN_JSON = `NOTACIÓN
${COMUN}
- Estás escribiendo JSON: dentro de cada string, la barra invertida va DOBLE. Escribe "$\\\\frac{a}{b}$", "$\\\\sqrt{2}$", "$\\\\times$".`;

/**
 * Las órdenes de LaTeX que `JSON.parse` destroza cuando el modelo no dobla la barra: `\f`, `\t`,
 * `\b`, `\r` y `\n` son escapes válidos de JSON, así que el texto llega «bien» y roto.
 */
const ROTAS: Array<[RegExp, string]> = [
  [/\f(?=[a-zA-Z])/g, "\\f"],
  [/\t(?=[a-zA-Z])/g, "\\t"],
  // El retroceso es justo el carácter de control que hay que buscar.
  // eslint-disable-next-line no-control-regex
  [/\x08(?=[a-zA-Z])/g, "\\b"],
  [/\r(?=[a-zA-Z])/g, "\\r"],
  [
    /\n(?=(?:eq|e|u|abla|otin|ot|i|eg|leq|geq|mid|parallel|sim|cong|exists|subseteq|supseteq|ewline)(?![a-zA-Z]))/g,
    "\\n",
  ],
];

const FORMULA = /\$\$[\s\S]*?\$\$|\$[^$]*\$/g;

/**
 * Fuera de una fórmula, solo lo inequívoco: un salto de página o un retroceso nunca son texto
 * de verdad, y un tabulador o un retorno seguidos de una orden conocida tampoco. Un campo que
 * es LaTeX entero sin dólares —el `planteamiento` de un item numérico— se arregla así.
 */
const ROTAS_FUERA: Array<[RegExp, string]> = [
  [/\f(?=[a-zA-Z])/g, "\\f"],
  // eslint-disable-next-line no-control-regex
  [/\x08(?=[a-zA-Z])/g, "\\b"],
  [/\t(?=(?:imes|heta|au|ext|an|ilde|op|riangle|o)(?![a-zA-Z]))/g, "\\t"],
  [/\r(?=(?:ho|ightarrow|ight|angle|m)(?![a-zA-Z]))/g, "\\r"],
];

const aplicar = (reglas: Array<[RegExp, string]>) => (t: string) => reglas.reduce((f, [roto, orden]) => f.replace(roto, orden), t);

/** Devuelve las órdenes de LaTeX que un JSON mal escapado convirtió en caracteres de control. */
export function repararLatexEnJson(texto: string): string {
  // eslint-disable-next-line no-control-regex
  if (!/[\f\t\r\n\x08]/.test(texto)) return texto;
  const fuera = aplicar(ROTAS_FUERA);
  if (!texto.includes("$")) return fuera(texto);
  // Dentro de una fórmula también el `\n` de `\neq` o `\nu`; fuera, un salto de línea es eso.
  let salida = "";
  let ultimo = 0;
  for (const m of texto.matchAll(FORMULA)) {
    const inicio = m.index ?? 0;
    salida += fuera(texto.slice(ultimo, inicio)) + aplicar(ROTAS)(m[0]);
    ultimo = inicio + m[0].length;
  }
  return salida + fuera(texto.slice(ultimo));
}

/** `repararLatexEnJson` sobre cada string de un valor recién salido de `JSON.parse`. */
export function repararCadenas<T>(valor: T): T {
  if (typeof valor === "string") return repararLatexEnJson(valor) as T;
  if (Array.isArray(valor)) return valor.map((v) => repararCadenas(v)) as T;
  if (valor !== null && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, repararCadenas(v)])) as T;
  }
  return valor;
}
