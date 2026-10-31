// Efecto de escritura del tutor: solo revela un texto que ya llegó completo y validado.
// No simula pasos ni pensamiento del modelo; únicamente cuida cómo se lee.

const DURACION_MIN_MS = 700;
const DURACION_MAX_MS = 3600;
const MS_POR_CARACTER = 9;

/** Duración total de la revelación: proporcional al largo, pero nunca más de unos segundos. */
export function duracionEscritura(largo: number, demo = false) {
  const base = Math.min(
    DURACION_MAX_MS,
    Math.max(DURACION_MIN_MS, largo * MS_POR_CARACTER),
  );
  return Math.round(base * (demo ? 1.25 : 1));
}

/** Cuántos caracteres deben verse tras `transcurrido` ms (0 a `largo`). */
export function caracteresVisibles(
  largo: number,
  transcurrido: number,
  duracion: number,
) {
  if (duracion <= 0 || transcurrido >= duracion) return largo;
  return Math.max(0, Math.min(largo, Math.floor((largo * transcurrido) / duracion)));
}

const cuenta = (texto: string, marca: string) => {
  let n = 0;
  for (let i = texto.indexOf(marca); i !== -1; i = texto.indexOf(marca, i + marca.length))
    n++;
  return n;
};
// `$` de fórmulas, no los escapados con barra.
const dolares = (texto: string) => (texto.match(/(?<!\\)\$/g) ?? []).length;

/**
 * Prefijo del texto con como mucho `n` caracteres que no deja a medias una fórmula, un énfasis ni
 * un código: si el corte cae dentro de uno, se amplía hasta cerrarlo. Corta en límite de palabra.
 */
export function prefijoSeguro(texto: string, n: number) {
  if (n >= texto.length) return texto;
  if (n <= 0) return "";
  let fin = n;
  // Límite de palabra: no partir una palabra por la mitad.
  while (fin < texto.length && !/\s/.test(texto[fin - 1] ?? " ") && !/\s/.test(texto[fin] ?? " ")) fin++;
  const cerrar = (marca: string, impar: (p: string) => boolean) => {
    if (!impar(texto.slice(0, fin))) return;
    const siguiente = texto.indexOf(marca, fin);
    fin = siguiente === -1 ? texto.length : siguiente + marca.length;
  };
  // Dos pasadas bastan: cerrar una marca puede dejar otra abierta.
  for (let i = 0; i < 2; i++) {
    cerrar("$", (p) => dolares(p) % 2 === 1);
    cerrar("`", (p) => cuenta(p, "`") % 2 === 1);
    cerrar("**", (p) => cuenta(p, "**") % 2 === 1);
  }
  return texto.slice(0, fin);
}

/** Mensaje honesto según cuánto lleva esperando; no simula pasos que no ocurrieron. */
export function mensajeDeEspera(segundos: number) {
  if (segundos >= 12)
    return "Esto está tardando más de lo normal. Puedes seguir esperando o reintentar si falla.";
  if (segundos >= 5) return "Sigo preparando tu respuesta…";
  return "El tutor está pensando…";
}
