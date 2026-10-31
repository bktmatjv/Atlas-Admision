/**
 * Validar el mapa que devuelve el modelo, antes de escribirlo.
 *
 * Puro y sin red, para que se pueda probar con vitest: `vitest.config.ts` incluye
 * `supabase/functions/_shared` justo para esto. Hermano de `items-parse.ts` y con su misma
 * regla: lo dudoso se descarta, no se arregla a medias.
 *
 * Las dos ataduras del spec, que son lo que hace el mapa auditable:
 *
 * - **Vocabulario cerrado.** Un concepto entra solo si su término aparece literalmente en un
 *   trozo de la página que cita. Sin mayúsculas ni tildes, pero la secuencia exacta de
 *   palabras. Un concepto que no se pueda encontrar por búsqueda de texto en el material es
 *   una invención del modelo, por plausible que suene.
 * - **Cita obligatoria.** Cada concepto guarda la página de la que sale. Sin página, fuera:
 *   no habría a dónde bajar al hacer clic en el nodo.
 *
 * `descartes` cuenta cuánto se tiró y por qué. El spec pide medir cuántos temas se quedan sin
 * mapa antes de dar el bloque por bueno; ese número sale de aquí.
 */

export const TIPOS_DE_RELACION = [
  "es-parte-de",
  "requiere",
  "causa",
  "ejemplo-de",
  "se-opone-a",
  "se-relaciona-con",
] as const;
export type TipoDeRelacion = (typeof TIPOS_DE_RELACION)[number];
const TIPOS: ReadonlySet<string> = new Set(TIPOS_DE_RELACION);

/** Un mapa de cuarenta nodos no se lee. Es un dictamen, y por eso tiene nombre. */
export const TOPE_DE_CONCEPTOS = 12;

/** Con menos que esto no hay nada que dibujar: la condición del spec es "dos conceptos con relación". */
export const MINIMO_DE_CONCEPTOS = 2;

export interface TrozoParaMapa {
  id: string;
  material_id: string;
  page_number: number | null;
  content: string;
}

export interface ConceptoValidado {
  termino: string;
  termino_normalizado: string;
  material_id: string;
  page_number: number;
}

/** `desde` y `hasta` son términos normalizados; la función las traduce a ids al insertar. */
export interface RelacionValidada {
  desde: string;
  hasta: string;
  tipo: TipoDeRelacion;
}

export interface MapaValidado {
  conceptos: ConceptoValidado[];
  relaciones: RelacionValidada[];
  descartes: Record<string, number>;
}

const ORDENES_DE_FORMA =
  /\\(?:left|right|displaystyle|textstyle|text|mathrm|mathbf|mathit|operatorname|big|Big|bigg|Bigg)(?![a-zA-Z])/g;

/**
 * Sin mayúsculas, sin tildes, espacios colapsados. Es la forma en que se compara y se
 * deduplica. La misma función vive en `src/lib/leccion/frase-literal.ts` para el cliente:
 * `tsconfig.app.json` no incluye `supabase/`, así que no se puede importar de aquí. Si cambia
 * una, cambian las dos.
 */
export function normalizar(texto: string): string {
  return texto
    // Las órdenes de LaTeX que solo dan forma (`\left(`, `\text{masa}`) no son contenido: una
    // cita de `$(a+b)^2$` tiene que casar con un material que escribió `$\left(a+b\right)^2$`.
    .replace(ORDENES_DE_FORMA, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // La puntuación se vuelve espacio: "auditoría interna." tiene que casar con "auditoría
    // interna", y la búsqueda es por secuencia de palabras rodeada de espacios.
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function entero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 1 ? valor : null;
}

/** El primer objeto JSON del texto. El modelo lo envuelve en prosa y en vallas de código. */
function objetoCrudo(bruto: string): { conceptos: unknown[]; relaciones: unknown[] } {
  const match = bruto.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("La respuesta del modelo no contiene ningun objeto JSON");
  let parseado: unknown;
  try {
    parseado = JSON.parse(match[0]);
  } catch {
    throw new Error("El objeto de la respuesta del modelo no es JSON valido");
  }
  if (typeof parseado !== "object" || parseado === null) {
    throw new Error("La respuesta del modelo no es un objeto");
  }
  const o = parseado as Record<string, unknown>;
  return {
    conceptos: Array.isArray(o.conceptos) ? o.conceptos : [],
    relaciones: Array.isArray(o.relaciones) ? o.relaciones : [],
  };
}

export function parsearMapa(bruto: string, trozos: TrozoParaMapa[]): MapaValidado {
  const { conceptos: crudos, relaciones: relacionesCrudas } = objetoCrudo(bruto);
  const descartes: Record<string, number> = {};
  const contar = (motivo: string) => { descartes[motivo] = (descartes[motivo] ?? 0) + 1; };

  // El texto normalizado de cada (material, página), para buscar términos de una pasada.
  const textoPorPagina = new Map<string, string>();
  for (const trozo of trozos) {
    if (trozo.page_number === null) continue;
    const clave = `${trozo.material_id}#${trozo.page_number}`;
    textoPorPagina.set(clave, `${textoPorPagina.get(clave) ?? ""} ${normalizar(trozo.content)}`);
  }

  const conceptos: ConceptoValidado[] = [];
  const vistos = new Set<string>();
  for (const crudo of crudos) {
    if (typeof crudo !== "object" || crudo === null) { contar("malformado"); continue; }
    const c = crudo as Record<string, unknown>;
    const termino = texto(c.termino);
    const pagina = entero(c.pagina ?? c.page_number);
    const material_id = texto(c.material_id);
    if (!termino) { contar("sin-termino"); continue; }
    if (pagina === null) { contar("sin-pagina"); continue; }
    const termino_normalizado = normalizar(termino);
    if (vistos.has(termino_normalizado)) { contar("duplicado"); continue; }
    // La búsqueda literal: la secuencia de palabras entera, dentro del texto de esa página.
    // Se rodea de espacios para que "riesgo" no case dentro de "riesgos".
    const pagina_texto = textoPorPagina.get(`${material_id}#${pagina}`);
    if (!pagina_texto || !` ${pagina_texto} `.includes(` ${termino_normalizado} `)) {
      contar("sin-frase-literal");
      continue;
    }
    if (conceptos.length >= TOPE_DE_CONCEPTOS) { contar("tope"); continue; }
    vistos.add(termino_normalizado);
    conceptos.push({ termino, termino_normalizado, material_id, page_number: pagina });
  }

  const relaciones: RelacionValidada[] = [];
  const relacionesVistas = new Set<string>();
  for (const cruda of relacionesCrudas) {
    if (typeof cruda !== "object" || cruda === null) { contar("malformado"); continue; }
    const r = cruda as Record<string, unknown>;
    const desde = normalizar(texto(r.desde));
    const hasta = normalizar(texto(r.hasta));
    const tipo = texto(r.tipo);
    if (!TIPOS.has(tipo)) { contar("tipo-desconocido"); continue; }
    if (desde === hasta) { contar("autorreferencia"); continue; }
    if (!vistos.has(desde) || !vistos.has(hasta)) { contar("relacion-colgante"); continue; }
    const clave = `${desde}>${hasta}>${tipo}`;
    if (relacionesVistas.has(clave)) { contar("duplicado"); continue; }
    relacionesVistas.add(clave);
    relaciones.push({ desde, hasta, tipo: tipo as TipoDeRelacion });
  }

  // El umbral del spec: preferimos un mapa ausente a uno inventado o a un nodo solo.
  if (conceptos.length < MINIMO_DE_CONCEPTOS || relaciones.length === 0) {
    contar("umbral");
    return { conceptos: [], relaciones: [], descartes };
  }
  return { conceptos, relaciones, descartes };
}
