/**
 * Validar y normalizar los items que devuelve el modelo, antes de escribirlos.
 *
 * Puro y sin red, para que se pueda probar con vitest: `vitest.config.ts` incluye
 * `supabase/functions/_shared` justo para esto.
 *
 * Parsear y confiar es el defecto que la ola de seguridad de E3 cerró, y aquí duele más
 * que en ningún otro sitio: un item con la respuesta correcta fuera de sus opciones hace
 * que el alumno acierte, el sistema lo cuente como fallo y su dominio baje por un error
 * del modelo. Un item dudoso se descarta; no se arregla a medias.
 */

import { esFormatoNuevo, formatear, type PayloadDeFormato } from "@/lib/admision/motor/formatos-parse";
import { repararCadenas } from "@/lib/admision/motor/notacion";
import { esFormatoStem, formatearStem, type PayloadStem } from "@/lib/admision/motor/formatos-stem";

export type TipoDeItem =
  | "verdadero_falso"
  | "opcion_multiple"
  | "examen"
  | "completar"
  | "varias_correctas"
  | "relacionar"
  | "ordenar"
  | "mapa"
  | "numerica"
  | "procedimiento"
  | "lectura_de_grafica";

export type Dificultad = "basic" | "intermediate" | "advanced";

export interface ItemGenerado {
  question: string;
  /**
   * `opcion_multiple` y `completar`: la lista de opciones. `verdadero_falso` y `examen`:
   * `null`. Los formatos con estructura llevan aquí todo lo que hace falta para corregir
   * (ver `formatos-parse.ts`).
   */
  options: string[] | PayloadDeFormato | PayloadStem | null;
  correct_answer: string;
  explanation: string;
  difficulty: Dificultad;
  /**
   * El fragmento del material del que sale el item, **numerado desde 1** igual que la lista
   * que se le enseñó al modelo. `null` si no citó ninguno o citó uno que no existe.
   *
   * Es un número y no una página porque el modelo no ve la base de datos: ve `[F1]`, `[F2]`…
   * y devuelve cuál usó. Traducirlo a `material_id` y página lo hace quien tiene la lista
   * delante, y así el modelo no puede inventarse una página que no se le enseñó.
   */
  fragmento: number | null;
  /** La gráfica de `lectura_de_grafica`, ya validada (`grafica.ts`). Los demás no la llevan. */
  figura?: unknown;
}

const DIFICULTADES: ReadonlySet<string> = new Set(["basic", "intermediate", "advanced"]);
const VERDADERO = "verdadero";
const FALSO = "falso";
/** Lo que el modelo escribe cuando quiere decir cada cara, en los dos idiomas que usa. */
const SINONIMOS: Record<string, string> = {
  verdadero: VERDADERO,
  verdad: VERDADERO,
  cierto: VERDADERO,
  true: VERDADERO,
  v: VERDADERO,
  falso: FALSO,
  false: FALSO,
  f: FALSO,
};
/** Mínimo de opciones para que elegir signifique algo. */
const MINIMO_OPCIONES = 2;

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** El primer array JSON del texto. El modelo lo envuelve en prosa y en vallas de código. */
function arrayCrudo(bruto: string): unknown[] {
  const match = bruto.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("La respuesta del modelo no contiene ningun array JSON");
  let parseado: unknown;
  try {
    parseado = JSON.parse(match[0]);
  } catch {
    throw new Error("El array de la respuesta del modelo no es JSON valido");
  }
  if (!Array.isArray(parseado)) throw new Error("La respuesta del modelo no es un array");
  return repararCadenas(parseado);
}

/**
 * El fragmento citado, si señala a uno de los que se le enseñaron. Si no, `null`.
 *
 * Una cita fuera de rango NO tumba el item: una pregunta sin cita se puede contestar, y una
 * pregunta con una cita a una página que no existe es peor que ninguna. Es la misma
 * disciplina que el resto del módulo —lo dudoso se descarta, no se arregla a medias—,
 * aplicada al campo y no a la fila, porque aquí sí hay una fila que salvar.
 */
function fragmentoCitado(valor: unknown, cuantosFragmentos: number): number | null {
  const n = typeof valor === "number"
    ? valor
    : typeof valor === "string"
    ? numeroDeEtiqueta(valor)
    : NaN;
  if (!Number.isInteger(n)) return null;
  if (n < 1 || n > cuantosFragmentos) return null;
  return n;
}

/**
 * La etiqueta del fragmento, tal y como el modelo la escribe de verdad.
 *
 * Se le enseña el material como `[F3 · página 7]`, así que piensa en «F3» y no en «3»: en
 * producción devolvía la cita con su etiqueta y el validador, que solo aceptaba el entero
 * pelado, tiraba TODAS las citas. Leer la etiqueta no afloja nada — el número que sale de
 * aquí se sigue validando contra la lista que se le enseñó, que es lo único que impide una
 * cita inventada.
 *
 * `(?!\.\d)` descarta «2.5»: un decimal no es ningún fragmento, y quedarse con el 2 sería
 * elegir la cita por él. Una página suelta —«página 7»— tampoco entra: no empieza por
 * número ni por etiqueta, y leer ese 7 como el fragmento 7 sería citar con un número que
 * significa otra cosa.
 */
const ETIQUETA_DE_FRAGMENTO = /^\[?\s*(?:fragmento\s*)?f?\s*(\d+)(?!\.\d)/i;

function numeroDeEtiqueta(valor: string): number {
  const encontrado = ETIQUETA_DE_FRAGMENTO.exec(valor.trim());
  return encontrado ? Number(encontrado[1]) : NaN;
}

/** `null` si el item no se puede presentar completo y con su respuesta bien puesta. */
function normalizar(
  crudo: unknown,
  tipo: TipoDeItem,
  cuantosFragmentos: number,
  textos: readonly string[],
  descartes: Record<string, number> = {},
): ItemGenerado | null {
  if (typeof crudo !== "object" || crudo === null) return null;
  const c = crudo as Record<string, unknown>;

  const explanation = texto(c.explanation);
  if (!explanation) return null;
  const bruta = texto(c.difficulty).toLowerCase();
  const difficulty = (DIFICULTADES.has(bruta) ? bruta : "intermediate") as Dificultad;
  const fragmento = fragmentoCitado(c.fragmento, cuantosFragmentos);

  // Los de cálculo se comprueban con código (`formatos-stem.ts`), y su descarte se cuenta.
  if (esFormatoStem(tipo)) {
    const hecho = formatearStem(c, tipo);
    if ("descarte" in hecho) {
      descartes[hecho.descarte] = (descartes[hecho.descarte] ?? 0) + 1;
      return null;
    }
    return { ...hecho, explanation, difficulty, fragmento };
  }

  // Los formatos nuevos traen su respuesta con otra forma (una lista, unos pares, unos
  // pasos), así que no pasan por el `correctAnswer` de abajo.
  if (esFormatoNuevo(tipo)) {
    const hecho = formatear(c, tipo, fragmento, textos);
    return hecho ? { ...hecho, explanation, difficulty, fragmento } : null;
  }
  // El mapa no sale del modelo: lo construye `mapa-item.ts`. Si llega aquí, es un error.
  if (tipo === "mapa") return null;

  const question = texto(c.question);
  const correcta = texto(c.correctAnswer ?? c.correct_answer);
  if (!question || !correcta) return null;

  if (tipo === "verdadero_falso") {
    const cara = SINONIMOS[correcta.toLowerCase()];
    if (!cara) return null;
    return { question, options: null, correct_answer: cara, explanation, difficulty, fragmento };
  }

  if (tipo === "examen") {
    // Preguntas abiertas: las evalúa `evaluate-answer`, así que no hay lista que validar.
    return { question, options: null, correct_answer: correcta, explanation, difficulty, fragmento };
  }

  const options = Array.isArray(c.options) ? c.options.map(texto).filter((o) => o.length > 0) : [];
  if (options.length < MINIMO_OPCIONES) return null;
  // La comprobación que de verdad protege el dominio del alumno.
  if (!options.includes(correcta)) return null;
  return { question, options, correct_answer: correcta, explanation, difficulty, fragmento };
}

/**
 * Los items válidos de la respuesta del modelo, en su orden.
 *
 * Lanza si no queda ninguno: escribir cero items dejaría el nodo abrible y vacío, y el
 * alumno vería una parada que no se puede jugar sin ninguna explicación. Es mejor un error
 * que se reintenta que un nodo roto y cacheado para siempre.
 */
export function parsearItems(
  bruto: string,
  tipo: TipoDeItem,
  /**
   * Cuántos fragmentos de material se le numeraron al modelo. Sin esto ninguna cita vale:
   * el número que devuelva no se refiere a nada que se le haya enseñado.
   */
  cuantosFragmentos = 0,
  opciones: {
    /**
     * El texto de cada fragmento, en el orden en que se numeró: `textos[0]` es [F1]. Lo
     * necesitan los formatos que se comprueban contra el material (completar, relacionar,
     * ordenar).
     */
    textos?: readonly string[];
    /**
     * Devolver `[]` en vez de lanzar cuando no queda ninguno. Solo para los formatos
     * opcionales, como «ordenar», cuyo modelo devuelve `[]` cuando el material no tiene
     * ninguna secuencia: ahí cero no es un fallo, es la respuesta.
     */
    permitirVacio?: boolean;
    /** Si se pasa, cuenta aquí por qué se descartó cada item de cálculo (`secciones_descartes`). */
    descartes?: Record<string, number>;
  } = {},
): ItemGenerado[] {
  const textos = opciones.textos ?? [];
  const items = arrayCrudo(bruto)
    .map((crudo) => normalizar(crudo, tipo, cuantosFragmentos, textos, opciones.descartes))
    .filter((item): item is ItemGenerado => item !== null);
  if (items.length === 0 && !opciones.permitirVacio) throw new Error("Ningun item de la respuesta del modelo era valido");
  return items;
}
