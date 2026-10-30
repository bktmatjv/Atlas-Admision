import { lazy, type ComponentType } from "react";

const RELOAD_FLAG = "chunk-reload-attempt";

/** sessionStorage puede lanzar (modo privado de Safari viejo, almacenamiento bloqueado). */
function leerMarca(): string | null {
  try {
    return sessionStorage.getItem(RELOAD_FLAG);
  } catch {
    return null;
  }
}

function marcarRecarga() {
  try {
    sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    // Sin almacenamiento no hay marca: como mucho se recarga una vez por fallo.
  }
}

function borrarMarca() {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    // Igual que arriba: sin almacenamiento no hay nada que borrar.
  }
}

/** Un módulo llegó bien: la próxima vez que falte uno se puede volver a recargar. */
export function olvidarRecarga() {
  borrarMarca();
}

/**
 * Recarga la página UNA vez por sesión de pestaña. Devuelve `false` si ya se hizo, para
 * que quien llama deje subir el error en vez de entrar en un bucle de recargas.
 */
export function recargarUnaVez(): boolean {
  if (leerMarca() === "1") return false;
  marcarRecarga();
  window.location.reload();
  return true;
}

/**
 * React.lazy con reintento automático.
 * Tras un deploy, los chunks con hash antiguo dejan de existir y el import()
 * falla silenciosamente -> Suspense queda colgado mostrando el loader para siempre.
 * Aquí reintentamos una vez y, si sigue fallando, recargamos la página una sola vez.
 */
/**
 * `never` como props es la restricción MÁS permisiva que se puede escribir aquí:
 * por contravarianza, un componente que pide `{id: string}` encaja en
 * `ComponentType<never>`, mientras que `ComponentType<unknown>` dejaría fuera a
 * cualquiera que pida props. Es lo que hacía `any`, dicho sin `any`.
 */
export function lazyWithRetry<T extends ComponentType<never>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      olvidarRecarga();
      return mod;
    } catch {
      // Segundo intento (fallo de red puntual)
      try {
        const mod = await factory();
        olvidarRecarga();
        return mod;
      } catch (retryError) {
        if (recargarUnaVez()) {
          // Devolvemos una promesa que nunca resuelve: la página se está recargando
          return new Promise<{ default: T }>(() => {});
        }
        console.error("Error cargando el módulo:", retryError);
        throw retryError;
      }
    }
  });
}
