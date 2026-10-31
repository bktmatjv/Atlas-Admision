/**
 * El motivo real de que una edge function falle.
 *
 * `supabase.functions.invoke` no lo pone en `error.message`. Ante un 500 devuelve un
 * `FunctionsHttpError` cuyo mensaje es siempre el mismo texto genérico —"Edge Function
 * returned a non-2xx status code"— y deja la respuesta de verdad en `error.context`, que
 * es un `Response` sin leer. El cuerpo lleva `{ error: "..." }` con la causa.
 *
 * Sin esto, el código que llama no tiene nada que contar y acaba inventándose un texto.
 * En este repo se inventaba dos veces: `throw new Error("Error al procesar")` en la cola
 * de subida, que es literalmente lo que el usuario acababa viendo. Un aviso que dice "hubo
 * un error" no permite ni arreglar el archivo ni reportar el fallo, y encima esconde que
 * el motivo estaba ahí al lado.
 */

const GENERIC = "No se pudo procesar";

/**
 * Lo que se dice cuando la función no da un motivo. Los mensajes de supabase-js («Edge Function
 * returned a non-2xx status code», «Failed to send a request…») están en inglés y no dicen nada
 * al alumno: se cambian por el siguiente paso.
 */
export const SIN_MOTIVO = "No se pudo completar. Vuelve a intentarlo en un momento.";
/** La función todavía no está desplegada (404 sin motivo): no es culpa de su conexión. */
export const SIN_SERVICIO = "Esta parte de CALIBRA todavía no está disponible. Vuelve a intentarlo más tarde.";

const DE_SUPABASE_JS = /Edge Function returned a non-2xx status code|Failed to send a request to the Edge Function|Relay Error invoking the Edge Function/i;

/** Lo que devuelve `functions.invoke` cuando la respuesta no es 2xx. */
type InvokeError = { message?: string; context?: unknown };

function isResponseLike(value: unknown): value is { json: () => Promise<unknown> } {
  return typeof (value as { json?: unknown })?.json === "function";
}

/**
 * Saca la causa de un error de `functions.invoke`.
 *
 * El cuerpo manda sobre el mensaje: el mensaje es genérico por diseño y el cuerpo es lo
 * que la función quiso decir. Si el cuerpo no se puede leer se cae al mensaje, y si
 * tampoco hay mensaje, a un texto neutro — pero nunca se devuelve vacío, porque un aviso
 * en blanco es peor que uno genérico.
 */
export async function functionErrorReason(error: unknown): Promise<string> {
  const invoke = error as InvokeError | null;

  if (isResponseLike(invoke?.context)) {
    try {
      const body = await invoke.context.json();
      const reason = (body as { error?: unknown })?.error;
      if (typeof reason === "string" && reason.trim()) return reason.trim();
    } catch {
      // El cuerpo ya se consumió o no era JSON: se sigue con el mensaje.
    }
  }

  if ((invoke?.context as { status?: unknown } | undefined)?.status === 404) return SIN_SERVICIO;

  const message = invoke?.message?.trim();
  if (message && DE_SUPABASE_JS.test(message)) return SIN_MOTIVO;
  return message ? message : GENERIC;
}
