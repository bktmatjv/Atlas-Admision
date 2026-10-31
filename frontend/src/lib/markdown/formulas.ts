/**
 * Las fórmulas de un texto, antes de que nadie las pinte.
 *
 * Los modelos escriben LaTeX de tres maneras: `$…$`, `$$…$$` y la de LaTeX puro, `\(…\)` y
 * `\[…\]`. remark-math solo entiende las dos primeras, así que aquí se pasan las otras a esas.
 *
 * Y el `$` no siempre es una fórmula: «cuesta $5 y $10» o «US$ 20» son dinero, y remark-math
 * los pintaría como una fórmula rota («5 y »). Se sigue la regla de pandoc: un `$` abre una
 * fórmula si le sigue algo que no es un espacio, y la cierra el SIGUIENTE `$` si le precede
 * algo que no es un espacio y no le sigue una cifra. El `$` que no forma pareja se escapa
 * (`\$`), que markdown pinta como un `$` normal.
 *
 * El código (```…``` y `…`) no se toca: un `$HOME` no es ni dinero ni una fórmula.
 */

export type TrozoDeTexto =
  | { tipo: "texto"; valor: string }
  | { tipo: "formula"; valor: string; bloque: boolean };

/** Bloques y tramos de código, que se copian tal cual. */
const CODIGO = /```[\s\S]*?(?:```|$)|`[^`\n]*`/g;

function delimitadoresDeLatex(prosa: string): string {
  return prosa
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, f: string) => `$$${f}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, f: string) => `$${f}$`);
}

/** Lo que va delante del `$` en una moneda: «US$», «MX$», «R$», «NT$». */
const PREFIJO_DE_MONEDA = /(?:^|[^\p{L}])(?:US|MX|CA|AU|NZ|HK|NT|AR|CL|CO|UY|R|S)$/u;

const esEspacio =(c: string | undefined) => c === undefined || /\s/.test(c);
const esCifra = (c: string | undefined) => c !== undefined && /\d/.test(c);
const esLetraOCifra = (c: string | undefined) => c !== undefined && /[\p{L}\d]/u.test(c);

/** ¿Hay un `$` sin escapar en la posición `i`? */
function dolarEn(t: string, i: number): boolean {
  if (t[i] !== "$") return false;
  let barras = 0;
  for (let j = i - 1; j >= 0 && t[j] === "\\"; j--) barras++;
  return barras % 2 === 0;
}

/**
 * Parte la prosa (sin código, con los delimitadores ya pasados a `$`) en texto y fórmulas.
 * En los trozos de texto, el `$` de dinero sale escapado, como lo quiere markdown.
 */
function trocearProsa(t: string): TrozoDeTexto[] {
  const trozos: TrozoDeTexto[] = [];
  let texto = "";
  const soltarTexto = () => {
    if (texto) trozos.push({ tipo: "texto", valor: texto });
    texto = "";
  };

  let i = 0;
  while (i < t.length) {
    if (!dolarEn(t, i)) {
      texto += t[i];
      i++;
      continue;
    }

    // `$$…$$`: una fórmula aparte.
    if (t[i + 1] === "$") {
      const cierre = t.indexOf("$$", i + 2);
      if (cierre > i + 2) {
        soltarTexto();
        trozos.push({ tipo: "formula", valor: t.slice(i + 2, cierre), bloque: true });
        i = cierre + 2;
        continue;
      }
      texto += "\\$\\$";
      i += 2;
      continue;
    }

    // `$…$`: abre si le sigue algo y no va pegado a una palabra («US$»).
    const abre = !esEspacio(t[i + 1]) && !esLetraOCifra(t[i - 1]);
    if (abre) {
      let j = i + 1;
      while (j < t.length && !dolarEn(t, j) && !(t[j] === "\n" && t[j + 1] === "\n")) j++;
      // «$5 y US$ 20»: el `$` de una moneda («US$», «MX$», «R$») no cierra nada.
      const esMoneda = PREFIJO_DE_MONEDA.test(t.slice(Math.max(0, j - 4), j));
      const cierraBien =
        j < t.length && dolarEn(t, j) && t[j + 1] !== "$" && !esEspacio(t[j - 1]) && !esCifra(t[j + 1]) && !esMoneda;
      if (cierraBien) {
        soltarTexto();
        trozos.push({ tipo: "formula", valor: t.slice(i + 1, j), bloque: false });
        i = j + 1;
        continue;
      }
    }
    texto += "\\$";
    i++;
  }
  soltarTexto();
  return trozos;
}

/** El texto en trozos de prosa y de código, en orden. */
function separarCodigo(texto: string): Array<{ codigo: boolean; valor: string }> {
  const partes: Array<{ codigo: boolean; valor: string }> = [];
  let ultimo = 0;
  for (const m of texto.matchAll(CODIGO)) {
    const inicio = m.index ?? 0;
    if (inicio > ultimo) partes.push({ codigo: false, valor: texto.slice(ultimo, inicio) });
    partes.push({ codigo: true, valor: m[0] });
    ultimo = inicio + m[0].length;
  }
  if (ultimo < texto.length) partes.push({ codigo: false, valor: texto.slice(ultimo) });
  return partes;
}

/** El texto con las fórmulas en `$…$`/`$$…$$` y el `$` de dinero escapado. */
export function normalizarFormulas(texto: string): string {
  if (!texto.includes("$") && !texto.includes("\\(") && !texto.includes("\\[")) return texto;
  return separarCodigo(texto)
    .map((p) =>
      p.codigo
        ? p.valor
        : trocearProsa(delimitadoresDeLatex(p.valor))
            .map((t) => (t.tipo === "texto" ? t.valor : t.bloque ? `$$${t.valor}$$` : `$${t.valor}$`))
            .join(""),
    )
    .join("");
}

/** ¿Trae el texto alguna fórmula de verdad? Si no, no hace falta bajar KaTeX. */
export function tieneFormula(texto: string): boolean {
  return trocearFormulas(texto).some((t) => t.tipo === "formula");
}

/**
 * El texto en trozos para pintarlo sin markdown (opciones, mensajes del alumno…): los de
 * texto llevan el `$` tal cual, sin escapar. El código no se distingue: se queda en el texto.
 */
export function trocearFormulas(texto: string): TrozoDeTexto[] {
  if (!texto.includes("$") && !texto.includes("\\(") && !texto.includes("\\[")) {
    return texto ? [{ tipo: "texto", valor: texto }] : [];
  }
  const trozos: TrozoDeTexto[] = [];
  for (const p of separarCodigo(texto)) {
    const propios: TrozoDeTexto[] = p.codigo
      ? [{ tipo: "texto", valor: p.valor }]
      : trocearProsa(delimitadoresDeLatex(p.valor)).map((t) =>
          t.tipo === "texto" ? { tipo: "texto", valor: t.valor.replace(/\\\$/g, "$") } : t,
        );
    for (const t of propios) {
      const anterior = trozos[trozos.length - 1];
      if (t.tipo === "texto" && anterior?.tipo === "texto") anterior.valor += t.valor;
      else trozos.push(t);
    }
  }
  return trozos;
}
