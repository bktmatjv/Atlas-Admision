/**
 * Qué renderizador necesita un texto, de más barato a más caro:
 *
 * - `plano`: ni una marca de markdown. Se pinta como un párrafo, sin bajar nada.
 * - `markdown`: listas, negritas, títulos… pero sin fórmulas. Basta react-markdown.
 * - `formulas`: lleva una fórmula de verdad (`formulas.ts`), no un `$` de dinero. Hace falta KaTeX.
 *
 * Ante la duda se sube de nivel: confundir markdown con texto plano dejaría asteriscos a la
 * vista, y lo contrario solo cuesta una descarga.
 */
import { tieneFormula } from "./formulas";

export type TipoDeTexto = "plano" | "markdown" | "formulas";

/** Caracteres con los que empieza cualquier marca de CommonMark en línea o de bloque. */
const MARCA_EN_LINEA = /[*_`#>|[\]\\<&~=]/;
/** Listas, código indentado y saltos de línea (que react-markdown une o parte en párrafos). */
const MARCA_DE_BLOQUE = /\n|^\s*([-+]|\d+[.)])\s|^( {4}|\t)/;

export function tipoDeTexto(contenido: string): TipoDeTexto {
  // Solo una fórmula de verdad: el `$` del dinero (`formulas.ts`) se queda en markdown, que
  // es donde va a parar ya escapado.
  if (tieneFormula(contenido)) return "formulas";
  if (contenido.includes("$")) return "markdown";
  if (MARCA_EN_LINEA.test(contenido) || MARCA_DE_BLOQUE.test(contenido)) return "markdown";
  return "plano";
}
