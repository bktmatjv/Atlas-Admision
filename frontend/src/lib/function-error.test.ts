import { describe, it, expect } from "vitest";
import { functionErrorReason, SIN_MOTIVO, SIN_SERVICIO } from "./function-error";

/** Un `FunctionsHttpError` como el que devuelve supabase-js: mensaje genérico y cuerpo. */
const httpError = (body: unknown, message = "Edge Function returned a non-2xx status code") => ({
  message,
  context: { json: async () => body },
});

describe("functionErrorReason", () => {
  it("prefiere el cuerpo al mensaje, porque el mensaje es genérico por diseño", async () => {
    const error = httpError({ error: "OpenAI embedding error: insufficient_quota" });
    expect(await functionErrorReason(error)).toBe("OpenAI embedding error: insufficient_quota");
  });

  it("recorta el motivo", async () => {
    expect(await functionErrorReason(httpError({ error: "  Material not found  " })))
      .toBe("Material not found");
  });

  it("cae al mensaje si el cuerpo no lleva `error`", async () => {
    expect(await functionErrorReason(httpError({ ok: false }, "Fallo de red")))
      .toBe("Fallo de red");
  });

  it("cae al mensaje si el cuerpo no es JSON", async () => {
    const error = {
      message: "Edge Function returned a non-2xx status code",
      context: { json: async () => { throw new SyntaxError("Unexpected token"); } },
    };
    expect(await functionErrorReason(error)).toBe(SIN_MOTIVO);
  });

  it("ignora un `error` que no sea texto", async () => {
    // Una función podría devolver `{ error: { code: 500 } }`; eso no se le puede leer a nadie.
    expect(await functionErrorReason(httpError({ error: { code: 500 } }, "Genérico")))
      .toBe("Genérico");
  });

  it("ignora un `error` vacío en vez de mostrar un aviso en blanco", async () => {
    expect(await functionErrorReason(httpError({ error: "   " }, "Genérico"))).toBe("Genérico");
  });

  it("funciona con un Error normal, sin contexto", async () => {
    expect(await functionErrorReason(new Error("Se cayó la red"))).toBe("Se cayó la red");
  });

  it("nunca devuelve vacío, ni sin error ni sin mensaje", async () => {
    expect(await functionErrorReason(null)).toBe("No se pudo procesar");
    expect(await functionErrorReason(undefined)).toBe("No se pudo procesar");
    expect(await functionErrorReason({})).toBe("No se pudo procesar");
    expect(await functionErrorReason({ message: "   " })).toBe("No se pudo procesar");
  });

  it("aguanta un contexto que no es una respuesta", async () => {
    expect(await functionErrorReason({ message: "Algo", context: "texto suelto" })).toBe("Algo");
  });
});

describe("functionErrorReason: nada en inglés para el alumno", () => {
  it("una función que aún no está desplegada (404 sin motivo) dice que todavía no está disponible", async () => {
    const error = { message: "Edge Function returned a non-2xx status code", context: { status: 404, json: async () => ({ code: "NOT_FOUND", message: "Requested function was not found" }) } };
    expect(await functionErrorReason(error)).toBe(SIN_SERVICIO);
  });

  it("los mensajes genéricos de supabase-js salen en español", async () => {
    for (const m of [
      "Edge Function returned a non-2xx status code",
      "Failed to send a request to the Edge Function",
      "Relay Error invoking the Edge Function",
    ]) expect(await functionErrorReason({ message: m }), m).toBe(SIN_MOTIVO);
  });

  it("y un motivo de verdad de la función se sigue enseñando", async () => {
    expect(await functionErrorReason({ message: "Edge Function returned a non-2xx status code", context: { status: 404, json: async () => ({ error: "Examen no encontrado" }) } }))
      .toBe("Examen no encontrado");
  });
});
