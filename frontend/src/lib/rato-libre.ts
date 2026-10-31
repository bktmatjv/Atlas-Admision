/**
 * Ejecuta `cb` en el siguiente rato libre del hilo principal, o a los `timeout` ms como
 * tarde. Es lo que usan las pantallas con sesión para precargar un chunk diferido
 * (`import()`) sin competir con su primer pintado: en un móvil de gama media, evaluar
 * 80 KB de JS a la vez que se monta la pantalla se nota; un momento después, no.
 *
 * Safari no tiene `requestIdleCallback`: allí va a un `setTimeout` corto. Fuera del
 * navegador (el pre-renderizado) no hace nada. Devuelve con qué cancelarlo.
 */
export function enUnRatoLibre(cb: () => void, timeout = 1500): () => void {
  if (typeof window === "undefined") return () => {};
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(cb, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(cb, 200);
  return () => window.clearTimeout(id);
}
