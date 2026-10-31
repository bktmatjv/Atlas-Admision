// supabase/functions/_shared/formatos-parse.ts
import { normalizar } from "@/lib/admision/motor/mapa-parse";

/**
 * Validar los formatos de práctica que no son ni V/F ni opción múltiple ni desarrollo.
 *
 * Hermano de `items-parse.ts`, y con su misma regla: lo dudoso se descarta, no se arregla a
 * medias. Aquí la regla aprieta más, porque estos formatos tienen piezas que el modelo puede
 * inventarse sin que se note: una frase «del material» que no está en el material, un
 * concepto que suena al tema y no aparece, un orden que nadie escribió.
 *
 * Puro y sin red, para vitest.
 */

export const FORMATOS_NUEVOS = ["completar", "varias_correctas", "relacionar", "ordenar"] as const;
export type FormatoNuevo = (typeof FORMATOS_NUEVOS)[number];

export function esFormatoNuevo(tipo: string): tipo is FormatoNuevo {
  return (FORMATOS_NUEVOS as readonly string[]).includes(tipo);
}

/** El hueco de «completar». El modelo escribe tres, cuatro o cinco guiones: se fija en cuatro. */
export const HUECO = "____";

export type PayloadDeFormato =
  | { opciones: string[]; correctas: string[] }
  | { pares: { concepto: string; descripcion: string }[] }
  | { pasos: string[] };

export interface Formateado {
  question: string;
  options: string[] | PayloadDeFormato;
  correct_answer: string;
}

/** Un paso de «ordenar» más largo que esto no es un paso: es un párrafo. */
const LARGO_MAXIMO_DE_PASO = 160;

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Los textos de una lista, o `null` si alguno viene vacío o no es texto: un hueco no se corrige. */
function listaEntera(valor: unknown): string[] | null {
  if (!Array.isArray(valor)) return null;
  const textos = valor.map(texto);
  return textos.every((t) => t.length > 0) ? textos : null;
}

function sinRepetir(textos: readonly string[]): boolean {
  return new Set(textos.map(normalizar)).size === textos.length;
}

/** Si `aguja` aparece en `pajar` como secuencia de palabras completas, sin tildes ni mayúsculas. */
function contiene(pajar: string, aguja: string): boolean {
  const a = normalizar(aguja);
  if (!a) return false;
  return ` ${normalizar(pajar)} `.includes(` ${a} `);
}

/**
 * Si las `agujas` aparecen en `pajar` en ese orden, cada una después de la anterior, con la
 * misma búsqueda por palabras completas que `contiene`. Voraz: cada paso se busca desde donde
 * acabó el anterior.
 */
function contieneEnOrden(pajar: string, agujas: readonly string[]): boolean {
  const p = ` ${normalizar(pajar)} `;
  let desde = 0;
  for (const aguja of agujas) {
    const a = normalizar(aguja);
    if (!a) return false;
    const en = p.indexOf(` ${a} `, desde);
    if (en < 0) return false;
    // El espacio de cierre puede ser el de apertura del paso siguiente.
    desde = en + a.length + 1;
  }
  return true;
}

function completar(c: Record<string, unknown>, fragmento: number | null, textos: readonly string[]): Formateado | null {
  const question = texto(c.question).replace(/_{3,}/g, HUECO);
  const correcta = texto(c.correctAnswer ?? c.correct_answer);
  const opciones = listaEntera(c.options);
  if (!question || !correcta || !opciones) return null;
  if (question.split(HUECO).length !== 2) return null;
  if (opciones.length < 3 || opciones.length > 5 || !sinRepetir(opciones)) return null;
  if (!opciones.includes(correcta)) return null;
  // La frase ES la cita: sin fragmento no hay contra qué comprobarla, y una frase «del
  // material» que no está en el material es justo lo que este formato promete no hacer.
  if (fragmento === null) return null;
  // Con función y no con texto: un `$&` o un `$'` en la respuesta se expandiría.
  if (!contiene(textos[fragmento - 1] ?? "", question.replace(HUECO, () => correcta))) return null;
  return { question, options: opciones, correct_answer: correcta };
}

function variasCorrectas(c: Record<string, unknown>): Formateado | null {
  const question = texto(c.question);
  const opciones = listaEntera(c.options);
  const correctas = listaEntera(c.correctAnswers ?? c.correct_answers);
  if (!question || !opciones || !correctas) return null;
  if (opciones.length < 4 || opciones.length > 5 || !sinRepetir(opciones)) return null;
  // Una sola correcta es opción múltiple; todas correctas no distingue nada.
  if (correctas.length < 2 || correctas.length > opciones.length - 1 || !sinRepetir(correctas)) return null;
  if (!correctas.every((x) => opciones.includes(x))) return null;
  return { question, options: { opciones, correctas }, correct_answer: correctas.join(" · ") };
}

function relacionar(c: Record<string, unknown>, textos: readonly string[]): Formateado | null {
  const question = texto(c.question);
  if (!question || !Array.isArray(c.pairs)) return null;
  const pares = c.pairs.map((p) => {
    const par = (typeof p === "object" && p !== null ? p : {}) as Record<string, unknown>;
    return { concepto: texto(par.concepto), descripcion: texto(par.descripcion) };
  });
  // Un par roto tumba el ejercicio entero: emparejar con una pieza que falta no se puede corregir.
  if (pares.some((p) => !p.concepto || !p.descripcion)) return null;
  if (pares.length < 3 || pares.length > 5) return null;
  if (!sinRepetir(pares.map((p) => p.concepto)) || !sinRepetir(pares.map((p) => p.descripcion))) return null;
  // Vocabulario cerrado, como el mapa: el concepto tiene que estar en el material.
  const todo = textos.join(" ");
  if (!pares.every((p) => contiene(todo, p.concepto))) return null;
  return {
    question,
    options: { pares },
    correct_answer: pares.map((p) => `${p.concepto} → ${p.descripcion}`).join(" · "),
  };
}

function ordenar(c: Record<string, unknown>, textos: readonly string[]): Formateado | null {
  const question = texto(c.question);
  const pasos = listaEntera(c.steps);
  if (!question || !pasos) return null;
  if (pasos.length < 3 || pasos.length > 6 || !sinRepetir(pasos)) return null;
  if (pasos.some((p) => p.length > LARGO_MAXIMO_DE_PASO)) return null;
  // Cada paso copiado del material, y en el orden en que el material los cuenta: un paso
  // inventado, o un orden que nadie escribió, enseña algo que no está. Una cronología
  // contada al revés también se descarta.
  if (!contieneEnOrden(textos.join(" "), pasos)) return null;
  return {
    question,
    options: { pasos },
    correct_answer: pasos.map((p, i) => `${i + 1}. ${p}`).join(" · "),
  };
}

/** La pregunta, sus opciones y su solución, o `null` si el formato no se cumple entero. */
export function formatear(
  c: Record<string, unknown>,
  tipo: FormatoNuevo,
  fragmento: number | null,
  textos: readonly string[],
): Formateado | null {
  if (tipo === "completar") return completar(c, fragmento, textos);
  if (tipo === "varias_correctas") return variasCorrectas(c);
  if (tipo === "relacionar") return relacionar(c, textos);
  return ordenar(c, textos);
}
