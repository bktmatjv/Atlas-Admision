/**
 * El markdown del modelo, arreglado antes de pintarlo.
 *
 * Gemini, sobre todo cuando no piensa (`reasoning_effort` bajo), a veces escribe bien el
 * contenido y mal la forma, y la forma rota se ve:
 * - **Una tabla entera en una sola línea**: «| a | b | | :--- | :--- | | 1 | 2 |». react-markdown
 *   no la reconoce y el alumno ve barras y guiones (respuesta real del 14-10-2026).
 * - **Una tabla pegada al párrafo** sin línea en blanco: tampoco es una tabla para markdown.
 * - **Comillas invertidas dobladas**: «`` `systemd` ``» se pinta como código CON las comillas
 *   a la vista.
 *
 * Solo se arregla lo que es inequívoco: una tabla «rota» cuyas celdas no cuadran con su fila
 * separadora se deja tal cual. Los bloques de código no se tocan.
 */

const CELDA_SEPARADORA = /^:?-{3,}:?$/;

/** Las celdas de una fila «| a | b |», o `null` si la línea no es una fila. */
function celdas(linea: string): string[] | null {
  const t = linea.trim();
  if (!t.startsWith("|") || !t.endsWith("|") || t.length < 3) return null;
  return t.slice(1, -1).split("|").map((c) => c.trim());
}

const esSeparadora = (linea: string) => {
  const c = celdas(linea);
  return c !== null && c.length > 0 && c.every((x) => CELDA_SEPARADORA.test(x));
};

/**
 * Una tabla escrita en una línea, en sus filas. Las filas van separadas por una celda vacía
 * («| |»), y la fila separadora dice cuántas columnas tiene: todo tiene que cuadrar con eso.
 */
function tablaEnFilas(linea: string): string[] | null {
  if (!linea.includes("| |")) return null;
  const c = celdas(linea);
  if (!c) return null;
  const inicio = c.findIndex((x) => CELDA_SEPARADORA.test(x));
  if (inicio <= 0) return null;
  let columnas = 0;
  while (inicio + columnas < c.length && CELDA_SEPARADORA.test(c[inicio + columnas])) columnas++;
  // La cabecera, una celda vacía y la separadora: la separadora empieza en la fila 2.
  if (inicio !== columnas + 1 || c[columnas] !== "") return null;
  if ((c.length + 1) % (columnas + 1) !== 0) return null;
  const filas: string[] = [];
  for (let i = 0; i < c.length; i += columnas + 1) {
    const fila = c.slice(i, i + columnas);
    if (fila.length !== columnas) return null;
    if (i + columnas < c.length && c[i + columnas] !== "") return null;
    filas.push(`| ${fila.join(" | ")} |`);
  }
  return filas.length >= 3 ? filas : null;
}

/** Comillas invertidas dobladas alrededor de un código sin comillas dentro. */
function comillasLimpias(linea: string): string {
  return linea
    .replace(/``\s*`([^`]+)`\s*``/g, "`$1`")
    .replace(/``([^`\s](?:[^`]*[^`\s])?)``/g, "`$1`");
}

export function repararMarkdown(texto: string): string {
  if (!texto.includes("|") && !texto.includes("``")) return texto;
  const salida: string[] = [];
  let enCodigo = false;
  const lineas = texto.split("\n");
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    if (/^\s*```/.test(linea)) {
      enCodigo = !enCodigo;
      salida.push(linea);
      continue;
    }
    if (enCodigo) {
      salida.push(linea);
      continue;
    }

    const filas = tablaEnFilas(linea);
    const tabla = filas ?? (celdas(linea) && esSeparadora(lineas[i + 1] ?? "") ? [linea] : null);
    if (tabla) {
      // Markdown solo ve la tabla si va precedida de una línea en blanco.
      const anterior = salida[salida.length - 1];
      if (anterior !== undefined && anterior.trim() !== "" && !celdas(anterior)) salida.push("");
      salida.push(...(filas ?? [linea]));
      continue;
    }
    salida.push(comillasLimpias(linea));
  }
  return salida.join("\n");
}
