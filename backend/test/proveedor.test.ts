import { describe, it, expect, afterEach } from "vitest";
import {
  ErrorProveedor,
  ProveedorFake,
  ProveedorGroq,
  Proveedores,
  aMensajesOpenAI,
  type EntradaIA,
} from "../src/modules/tutor/proveedor";
import { settings } from "../src/config";
const respuesta = (cuerpo: unknown, estado = 200) =>
  new Response(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json" },
  });
const entrada: EntradaIA = {
  sistema: "Sistema de prueba",
  mensajes: [{ rol: "user", texto: "Hola" }],
  herramientas: [
    {
      nombre: "resultado",
      descripcion: "Resultado",
      parametros: { properties: { a: { type: "string" } } },
    },
  ],
  forzar: "resultado",
};
const groq = (f: typeof fetch, timeoutMs?: number) =>
  new ProveedorGroq({
    apiKey: "clave-de-prueba",
    model: "modelo-x",
    fetch: f,
    timeoutMs,
  });
describe("adaptador Groq (fetch simulado)", () => {
  it("envía el formato OpenAI y devuelve el texto", async () => {
    let visto: { url: string; init: RequestInit } | undefined;
    const f = (async (url: string, init: RequestInit) => {
      visto = { url, init };
      return respuesta({
        choices: [{ message: { content: "Hola, soy el tutor" } }],
      });
    }) as unknown as typeof fetch;
    const r = await groq(f).completar({
      sistema: "S",
      mensajes: [{ rol: "user", texto: "Hola" }],
    });
    expect(r).toEqual({ texto: "Hola, soy el tutor", llamadas: [] });
    expect(visto!.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    const h = visto!.init.headers as Record<string, string>;
    expect(h.Authorization).toBe("Bearer clave-de-prueba");
    const cuerpo = JSON.parse(visto!.init.body as string);
    expect(cuerpo.model).toBe("modelo-x");
    expect(cuerpo.messages[0]).toEqual({ role: "system", content: "S" });
    expect(cuerpo.tools).toBeUndefined();
  });
  it("traduce herramientas y tool_calls", async () => {
    let cuerpo: Record<string, unknown> = {};
    const f = (async (_u: string, init: RequestInit) => {
      cuerpo = JSON.parse(init.body as string);
      return respuesta({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: { name: "resultado", arguments: '{"a":"x"}' },
                },
              ],
            },
          },
        ],
      });
    }) as unknown as typeof fetch;
    const r = await groq(f).completar(entrada);
    expect(r.llamadas).toEqual([
      { id: "call_1", nombre: "resultado", argumentos: { a: "x" } },
    ]);
    expect(cuerpo.tool_choice).toEqual({
      type: "function",
      function: { name: "resultado" },
    });
    expect(
      (cuerpo.tools as { function: { name: string } }[])[0].function.name,
    ).toBe("resultado");
  });
  it("reenvía llamadas previas y resultados de herramientas", () => {
    const m = aMensajesOpenAI({
      sistema: "S",
      mensajes: [
        { rol: "user", texto: "u" },
        {
          rol: "assistant",
          texto: null,
          llamadas: [{ id: "c1", nombre: "leer_grafo", argumentos: {} }],
        },
        { rol: "tool", llamada_id: "c1", nombre: "leer_grafo", texto: "{}" },
      ],
    });
    expect(m[2]).toMatchObject({
      role: "assistant",
      tool_calls: [
        { id: "c1", function: { name: "leer_grafo", arguments: "{}" } },
      ],
    });
    expect(m[3]).toEqual({ role: "tool", tool_call_id: "c1", content: "{}" });
  });
  it("rechaza argumentos de herramienta que no son JSON", async () => {
    const f = (async () =>
      respuesta({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: "c",
                  function: { name: "resultado", arguments: "{no es json" },
                },
              ],
            },
          },
        ],
      })) as unknown as typeof fetch;
    await expect(groq(f).completar(entrada)).rejects.toMatchObject({
      codigo: "respuesta_invalida",
    });
  });
  it("rechaza un cuerpo que no es JSON", async () => {
    const f = (async () =>
      respuesta("<html>caído</html>")) as unknown as typeof fetch;
    const e = await groq(f)
      .completar(entrada)
      .catch((x) => x);
    expect(e).toBeInstanceOf(ErrorProveedor);
    expect(e.codigo).toBe("respuesta_invalida");
  });
  it("traduce HTTP 429 a un error de límite comprensible", async () => {
    const f = (async () =>
      respuesta(
        { error: { message: "rate limit" } },
        429,
      )) as unknown as typeof fetch;
    const e = await groq(f)
      .completar(entrada)
      .catch((x) => x);
    expect(e.codigo).toBe("limite");
    expect(e.estado).toBe(429);
    expect(e.message).toMatch(/límite de uso/);
  });
  it("traduce otros HTTP de error sin inventar respuesta", async () => {
    const f = (async () => respuesta({}, 500)) as unknown as typeof fetch;
    await expect(groq(f).completar(entrada)).rejects.toMatchObject({
      codigo: "http",
      estado: 500,
    });
  });
  it("corta por timeout", async () => {
    const f = ((_u: string, init: RequestInit) =>
      new Promise((_ok, no) => {
        init.signal!.addEventListener("abort", () => no(init.signal!.reason));
      })) as unknown as typeof fetch;
    await expect(groq(f, 20).completar(entrada)).rejects.toMatchObject({
      codigo: "timeout",
    });
  });
  it("una caída de red es un error explícito", async () => {
    const f = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(groq(f).completar(entrada)).rejects.toMatchObject({
      codigo: "red",
    });
  });
});
describe("selección del proveedor y configuración", () => {
  const base = {
    DATABASE_URL: "postgres://u:p@localhost:5432/x",
    NODE_ENV: "test",
  };
  const previo = { ...process.env };
  afterEach(() => {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, previo);
  });
  const con = (extra: Record<string, string>) => {
    for (const k of ["AI_PROVIDER", "AI_MODEL", "AI_API_KEY"])
      delete process.env[k];
    Object.assign(process.env, base, extra);
  };
  it("groq exige AI_API_KEY y AI_MODEL al arrancar", () => {
    con({ AI_PROVIDER: "groq" });
    expect(() => settings()).toThrow(/Groq/);
    con({ AI_PROVIDER: "groq", AI_API_KEY: "k" });
    expect(() => settings()).toThrow(/Groq/);
    con({ AI_PROVIDER: "groq", AI_API_KEY: "k", AI_MODEL: "m" });
    expect(settings().AI_PROVIDER).toBe("groq");
  });
  it("acepta disabled, anthropic y fake sin cambiar su comportamiento", () => {
    con({});
    expect(settings().AI_PROVIDER).toBe("disabled");
    expect(new Proveedores().actual()).toBeNull();
    con({ AI_PROVIDER: "fake" });
    expect(new Proveedores().actual()).toBeInstanceOf(ProveedorFake);
    con({ AI_PROVIDER: "anthropic" });
    expect(() => settings()).toThrow(/Anthropic/);
    con({ AI_PROVIDER: "fake", NODE_ENV: "production" });
    expect(() => settings()).toThrow(/producción/);
  });
  it("no se fija ningún nombre de modelo en el código", () => {
    con({ AI_PROVIDER: "groq", AI_API_KEY: "k", AI_MODEL: "otro-modelo" });
    expect(new Proveedores().actual()).toBeInstanceOf(ProveedorGroq);
  });
});
describe("proveedor fake", () => {
  it("usa una herramienta y luego cierra el turno", async () => {
    const fake = new ProveedorFake();
    const e: EntradaIA = {
      sistema: "S",
      mensajes: [{ rol: "user", texto: "hola" }],
      herramientas: [
        { nombre: "leer_grafo", descripcion: "x", parametros: {} },
      ],
    };
    const primero = await fake.completar(e);
    expect(primero.llamadas[0].nombre).toBe("leer_grafo");
    const segundo = await fake.completar({
      ...e,
      mensajes: [
        ...e.mensajes,
        {
          rol: "tool",
          llamada_id: "fake-1",
          nombre: "leer_grafo",
          texto: "{}",
        },
      ],
    });
    expect(segundo.llamadas).toEqual([]);
    expect(JSON.parse(segundo.texto!)).toMatchObject({ bloques: [] });
  });
});
