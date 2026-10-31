import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ErrorProveedor,
  ProveedorFoundry,
  ProveedorGroq,
  Proveedores,
  olvidarRouters,
  type EntradaIA,
} from "../src/modules/tutor/proveedor";
import { RouterIA } from "../src/modules/tutor/router";
import { settings } from "../src/config";

const ENDPOINT = "https://recurso-prueba.openai.azure.com";
const CLAVE = "clave-foundry-secreta";
const DESPLIEGUE = "despliegue-x";
const entrada: EntradaIA = {
  sistema: "Sistema de prueba",
  mensajes: [{ rol: "user", texto: "mensaje privado del estudiante" }],
  herramientas: [
    {
      nombre: "resultado",
      descripcion: "Resultado",
      parametros: { properties: { a: { type: "string" } } },
    },
  ],
  forzar: "resultado",
};
const http = (
  estado: number,
  cuerpo: unknown = {},
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json", ...headers },
  });
const fo = (f: typeof fetch, extra: { timeoutMs?: number; endpoint?: string } = {}) =>
  new ProveedorFoundry({
    endpoint: extra.endpoint ?? ENDPOINT,
    apiKey: CLAVE,
    model: DESPLIEGUE,
    fetch: f,
    timeoutMs: extra.timeoutMs,
  });
const falla = async (p: Promise<unknown>) =>
  (await p.then(
    () => {
      throw new Error("se esperaba un error");
    },
    (e: unknown) => e,
  )) as ErrorProveedor;

describe("adaptador Microsoft Foundry (fetch simulado)", () => {
  it("usa la ruta v1 del recurso, el encabezado api-key y el despliegue como model", async () => {
    let visto: { url: string; init: RequestInit } | undefined;
    const f = (async (url: string, init: RequestInit) => {
      visto = { url, init };
      return http(200, {
        choices: [{ message: { content: "Hola desde Foundry" } }],
        usage: { prompt_tokens: 7, completion_tokens: 3 },
      });
    }) as unknown as typeof fetch;
    const r = await fo(f).completar({
      sistema: "S",
      mensajes: [{ rol: "user", texto: "Hola" }],
      json: true,
      max_tokens: 123,
    });
    expect(r).toEqual({
      texto: "Hola desde Foundry",
      llamadas: [],
      uso: { entrada: 7, salida: 3 },
    });
    expect(visto!.url).toBe(`${ENDPOINT}/openai/v1/chat/completions`);
    expect(visto!.init.method).toBe("POST");
    const h = visto!.init.headers as Record<string, string>;
    expect(h["api-key"]).toBe(CLAVE);
    expect(h.Authorization).toBeUndefined();
    const cuerpo = JSON.parse(visto!.init.body as string);
    expect(cuerpo.model).toBe(DESPLIEGUE);
    // Los modelos de razonamiento rechazan temperature y max_tokens.
    expect(cuerpo.max_completion_tokens).toBe(123);
    expect(cuerpo).not.toHaveProperty("max_tokens");
    expect(cuerpo).not.toHaveProperty("temperature");
    expect(cuerpo).not.toHaveProperty("response_format");
  });

  it.each([
    ["https://calibra-ia-resource.services.ai.azure.com/openai/v1"],
    ["https://calibra-ia-resource.services.ai.azure.com/openai/v1/"],
    ["https://calibra-ia-resource.services.ai.azure.com/"],
    ["https://calibra-ia-resource.services.ai.azure.com"],
  ])("normaliza el endpoint %s con o sin /openai/v1", async (endpoint) => {
    let url = "";
    const f = (async (u: string) => {
      url = u;
      return http(200, { choices: [{ message: { content: "ok" } }] });
    }) as unknown as typeof fetch;
    await fo(f, { endpoint }).completar(entrada);
    expect(url).toBe(
      "https://calibra-ia-resource.services.ai.azure.com/openai/v1/chat/completions",
    );
  });

  it("tolera una barra final en el endpoint", async () => {
    let url = "";
    const f = (async (u: string) => {
      url = u;
      return http(200, { choices: [{ message: { content: "ok" } }] });
    }) as unknown as typeof fetch;
    await fo(f, { endpoint: `${ENDPOINT}/` }).completar(entrada);
    expect(url).toBe(`${ENDPOINT}/openai/v1/chat/completions`);
  });

  it("ida y vuelta de herramientas en formato OpenAI", async () => {
    const cuerpos: Record<string, unknown>[] = [];
    const f = (async (_u: string, init: RequestInit) => {
      cuerpos.push(JSON.parse(init.body as string));
      return cuerpos.length === 1
        ? http(200, {
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
          })
        : http(200, { choices: [{ message: { content: "listo" } }] });
    }) as unknown as typeof fetch;
    const p = fo(f);
    const r1 = await p.completar(entrada);
    expect(r1.llamadas).toEqual([
      { id: "call_1", nombre: "resultado", argumentos: { a: "x" } },
    ]);
    expect(cuerpos[0].tools).toEqual([
      {
        type: "function",
        function: {
          name: "resultado",
          description: "Resultado",
          parameters: { properties: { a: { type: "string" } } },
        },
      },
    ]);
    expect(cuerpos[0].tool_choice).toEqual({
      type: "function",
      function: { name: "resultado" },
    });
    const r2 = await p.completar({
      ...entrada,
      forzar: undefined,
      mensajes: [
        ...entrada.mensajes,
        { rol: "assistant", texto: "", llamadas: r1.llamadas },
        { rol: "tool", llamada_id: "call_1", texto: "{}" },
      ],
    });
    expect(r2.texto).toBe("listo");
    expect(cuerpos[1].tool_choice).toBe("auto");
    const msgs = cuerpos[1].messages as { role: string }[];
    expect(msgs.map((m) => m.role)).toEqual([
      "system",
      "user",
      "assistant",
      "tool",
    ]);
  });

  it("un 429 con retry-after informa cuánto esperar", async () => {
    const f = (async () =>
      http(429, {}, { "retry-after": "17" })) as unknown as typeof fetch;
    const e = await falla(fo(f).completar(entrada));
    expect(e.codigo).toBe("limite");
    expect(e.esperaMs).toBe(17000);
  });

  it("un 429 sin encabezados no inventa una espera", async () => {
    const f = (async () => http(429)) as unknown as typeof fetch;
    const e = await falla(fo(f).completar(entrada));
    expect(e.codigo).toBe("limite");
    expect(e.esperaMs).toBeUndefined();
  });

  it("traduce 401, 403 y 5xx sin mostrar la clave ni el endpoint", async () => {
    for (const estado of [401, 403, 500, 503]) {
      const f = (async () =>
        http(estado, { error: { message: "x" } })) as unknown as typeof fetch;
      const e = await falla(fo(f).completar(entrada));
      expect(e.codigo).toBe("http");
      expect(e.estado).toBe(estado);
      expect(e.message).not.toContain(CLAVE);
      expect(e.message).not.toContain("recurso-prueba");
    }
  });

  it("marca el contexto demasiado largo", async () => {
    const f = (async () =>
      http(400, {
        error: {
          code: "context_length_exceeded",
          message: "maximum context length exceeded",
        },
      })) as unknown as typeof fetch;
    const e = await falla(fo(f).completar(entrada));
    expect(e.estado).toBe(400);
    expect(e.contextoLargo).toBe(true);
  });

  it("corta por timeout y una caída de red es explícita", async () => {
    const lento = (async (_u: string, init: RequestInit) =>
      new Promise((_, rechazar) =>
        init.signal!.addEventListener("abort", () =>
          rechazar(new DOMException("t", "TimeoutError")),
        ),
      )) as unknown as typeof fetch;
    expect(
      (await falla(fo(lento, { timeoutMs: 20 }).completar(entrada))).codigo,
    ).toBe("timeout");
    const caido = (async () => {
      throw new TypeError("fetch failed " + CLAVE);
    }) as unknown as typeof fetch;
    const e = await falla(fo(caido).completar(entrada));
    expect(e.codigo).toBe("red");
    expect(e.message).not.toContain(CLAVE);
  });

  it("cuerpo vacío o que no es JSON es una respuesta inválida", async () => {
    const vacio = (async () =>
      http(200, { choices: [] })) as unknown as typeof fetch;
    expect((await falla(fo(vacio).completar(entrada))).codigo).toBe(
      "respuesta_invalida",
    );
    const roto = (async () =>
      new Response("no json", { status: 200 })) as unknown as typeof fetch;
    expect((await falla(fo(roto).completar(entrada))).codigo).toBe(
      "respuesta_invalida",
    );
  });

  it("regresión: Groq sigue enviando Bearer, temperature y max_tokens", async () => {
    let init: RequestInit | undefined;
    const f = (async (_u: string, i: RequestInit) => {
      init = i;
      return http(200, { choices: [{ message: { content: "ok" } }] });
    }) as unknown as typeof fetch;
    await new ProveedorGroq({ apiKey: "g", model: "m", fetch: f }).completar({
      sistema: "S",
      mensajes: [{ rol: "user", texto: "hola" }],
      json: true,
    });
    const h = init!.headers as Record<string, string>;
    expect(h.Authorization).toBe("Bearer g");
    expect(h["api-key"]).toBeUndefined();
    const cuerpo = JSON.parse(init!.body as string);
    expect(cuerpo.max_tokens).toBe(4000);
    expect(cuerpo.temperature).toBe(0.3);
    expect(cuerpo.response_format).toEqual({ type: "json_object" });
    expect(cuerpo).not.toHaveProperty("max_completion_tokens");
  });
});

describe("Foundry dentro del router", () => {
  const base = {
    DATABASE_URL: "postgres://u:p@localhost:5432/x",
    NODE_ENV: "test",
  };
  const previo = { ...process.env };
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, previo);
    olvidarRouters();
  });
  const con = (extra: Record<string, string>) => {
    for (const k of Object.keys(process.env))
      if (/^(AI_|GROQ_|CLOUDFLARE_|FOUNDRY_)/.test(k)) delete process.env[k];
    Object.assign(process.env, base, extra);
  };
  const completa = {
    AI_PROVIDER: "router",
    AI_CADENA: `groq:modelo-a,foundry:${DESPLIEGUE}`,
    GROQ_API_KEY: "g-secreto",
    FOUNDRY_ENDPOINT: ENDPOINT,
    FOUNDRY_API_KEY: CLAVE,
  };

  it("los destinos de Foundry exigen endpoint https y clave, sin mostrarlas", () => {
    con(completa);
    expect(settings().AI_PROVIDER).toBe("router");
    con({ ...completa, FOUNDRY_ENDPOINT: "" });
    expect(() => settings()).toThrow(/FOUNDRY_ENDPOINT/);
    con({ ...completa, FOUNDRY_API_KEY: "" });
    try {
      settings();
      throw new Error("debía fallar");
    } catch (e) {
      const texto = e instanceof Error ? e.message : String(e);
      expect(texto).toMatch(/FOUNDRY_API_KEY/);
      expect(texto).not.toContain("recurso-prueba");
      expect(texto).not.toContain("g-secreto");
    }
    con({ ...completa, FOUNDRY_ENDPOINT: "http://recurso-prueba.openai.azure.com" });
    expect(() => settings()).toThrow(/FOUNDRY_ENDPOINT/);
    con({ ...completa, FOUNDRY_ENDPOINT: "esto no es una url" });
    try {
      settings();
      throw new Error("debía fallar");
    } catch (e) {
      expect(String(e)).not.toContain("esto no es una url");
    }
    // Sin Foundry en la cadena no se exigen.
    con({
      ...completa,
      AI_CADENA: "groq:modelo-a",
      FOUNDRY_ENDPOINT: "",
      FOUNDRY_API_KEY: "",
    });
    expect(settings().AI_PROVIDER).toBe("router");
  });

  it("la fábrica arma la cadena y respeta AI_SIN_HERRAMIENTAS", () => {
    con({ ...completa, AI_SIN_HERRAMIENTAS: `foundry:${DESPLIEGUE}` });
    const estado = new Proveedores().estadoRouter()!;
    expect(estado.map((d) => [d.id, d.herramientas])).toEqual([
      ["groq:modelo-a", true],
      [`foundry:${DESPLIEGUE}`, false],
    ]);
    expect(JSON.stringify(estado)).not.toContain(CLAVE);
    expect(JSON.stringify(estado)).not.toContain("recurso-prueba");
  });

  it("failover de Groq (429 con retry-after) a Foundry y registra el destino", async () => {
    con(completa);
    const llamadas: { url: string; cab: Record<string, string>; modelo: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        llamadas.push({
          url,
          cab: init.headers as Record<string, string>,
          modelo: JSON.parse(init.body as string).model,
        });
        return url.includes("groq.com")
          ? http(429, {}, { "retry-after": "30" })
          : http(200, { choices: [{ message: { content: "desde Foundry" } }] });
      }),
    );
    const proveedor = new Proveedores().actual()!;
    expect(proveedor).toBeInstanceOf(RouterIA);
    const r = await proveedor.completar({
      sistema: "S",
      mensajes: [{ rol: "user", texto: "hola" }],
    });
    expect(r.texto).toBe("desde Foundry");
    expect(r.destino).toBe(`foundry:${DESPLIEGUE}`);
    expect(llamadas[1]).toMatchObject({
      url: `${ENDPOINT}/openai/v1/chat/completions`,
      modelo: DESPLIEGUE,
    });
    expect(llamadas[1].cab["api-key"]).toBe(CLAVE);
    const salud = new Proveedores().estadoRouter()!;
    expect(salud[0]).toMatchObject({ id: "groq:modelo-a", estado: "ABIERTO" });
    expect(salud[1]).toMatchObject({ estado: "CERRADO" });
  });

  it("Foundry primero: un 5xx se reintenta y luego pasa al siguiente destino", async () => {
    con({
      ...completa,
      AI_CADENA: `foundry:${DESPLIEGUE},groq:modelo-a`,
    });
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return url.includes("azure.com")
          ? http(503)
          : http(200, { choices: [{ message: { content: "desde Groq" } }] });
      }),
    );
    const r = await new Proveedores().actual()!.completar({
      sistema: "S",
      mensajes: [{ rol: "user", texto: "hola" }],
    });
    expect(r.destino).toBe("groq:modelo-a");
    expect(urls.filter((u) => u.includes("azure.com")).length).toBeGreaterThanOrEqual(1);
    expect(urls.at(-1)).toContain("groq.com");
  });

  it("un 401 de Foundry lo marca mal configurado y se sigue con el resto", async () => {
    con({
      ...completa,
      AI_CADENA: `foundry:${DESPLIEGUE},groq:modelo-a`,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("azure.com")
          ? http(401, { error: { message: "denegado" } })
          : http(200, { choices: [{ message: { content: "desde Groq" } }] }),
      ),
    );
    const p = new Proveedores();
    const r = await p.actual()!.completar({
      sistema: "S",
      mensajes: [{ rol: "user", texto: "hola" }],
    });
    expect(r.destino).toBe("groq:modelo-a");
    const salud = p.estadoRouter()!;
    expect(salud[0]).toMatchObject({
      id: `foundry:${DESPLIEGUE}`,
      motivo: "mal_configurado",
    });
    expect(JSON.stringify(salud)).not.toContain(CLAVE);
  });

  it("regresión: una cadena sin Foundry no necesita sus variables ni las llama", async () => {
    con({
      AI_PROVIDER: "router",
      AI_CADENA: "groq:modelo-a",
      GROQ_API_KEY: "g-secreto",
    });
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return http(200, { choices: [{ message: { content: "ok" } }] });
      }),
    );
    const r = await new Proveedores().actual()!.completar({
      sistema: "S",
      mensajes: [{ rol: "user", texto: "hola" }],
    });
    expect(r.destino).toBe("groq:modelo-a");
    expect(urls).toEqual(["https://api.groq.com/openai/v1/chat/completions"]);
  });
});

describe("esfuerzo de razonamiento de Foundry y llamadas inválidas de Groq", () => {
  const cuerpoDe = (init: RequestInit) =>
    JSON.parse(String(init.body)) as Record<string, unknown>;
  const ok = () =>
    http(200, { choices: [{ message: { content: "listo" } }] });
  it("sin esfuerzo configurado no envía reasoning_effort", async () => {
    let init: RequestInit | undefined;
    const f = (async (_u: string, i: RequestInit) => {
      init = i;
      return ok();
    }) as unknown as typeof fetch;
    await fo(f).completar({ sistema: "S", mensajes: [{ rol: "user", texto: "hola" }] });
    const cuerpo = cuerpoDe(init!);
    expect(cuerpo).not.toHaveProperty("reasoning_effort");
    expect(cuerpo).not.toHaveProperty("temperature");
    expect(cuerpo).toHaveProperty("max_completion_tokens");
  });
  it("con esfuerzo configurado lo envía tal cual", async () => {
    let init: RequestInit | undefined;
    const f = (async (_u: string, i: RequestInit) => {
      init = i;
      return ok();
    }) as unknown as typeof fetch;
    const p = new ProveedorFoundry({
      endpoint: ENDPOINT,
      apiKey: CLAVE,
      model: DESPLIEGUE,
      fetch: f,
      esfuerzo: "low",
    });
    await p.completar({ sistema: "S", mensajes: [{ rol: "user", texto: "hola" }] });
    expect(cuerpoDe(init!).reasoning_effort).toBe("low");
  });
  it("la configuración acepta solo valores conocidos y trata vacío como sin configurar", () => {
    const previo = { ...process.env };
    try {
      process.env.DATABASE_URL = "postgres://u:p@localhost:5432/x";
      process.env.NODE_ENV = "test";
      process.env.FOUNDRY_REASONING_EFFORT = "enorme";
      expect(() => settings()).toThrow();
      process.env.FOUNDRY_REASONING_EFFORT = "";
      expect(settings().FOUNDRY_REASONING_EFFORT).toBeUndefined();
      process.env.FOUNDRY_REASONING_EFFORT = "minimal";
      expect(settings().FOUNDRY_REASONING_EFFORT).toBe("minimal");
    } finally {
      for (const k of Object.keys(process.env)) delete process.env[k];
      Object.assign(process.env, previo);
    }
  });
  it("un 400 tool_use_failed de Groq es una salida inválida del modelo, no un bug de la solicitud", async () => {
    const f = (async () =>
      http(400, {
        error: {
          message:
            "Failed to call a function. Please adjust your prompt. See 'failed_generation' for more details.",
          type: "invalid_request_error",
          code: "tool_use_failed",
          failed_generation: "{ ... }",
        },
      })) as unknown as typeof fetch;
    const g = new ProveedorGroq({ apiKey: "k", model: "m", fetch: f });
    const e = await falla(g.completar(entrada));
    expect(e).toBeInstanceOf(ErrorProveedor);
    expect(e.codigo).toBe("respuesta_invalida");
    expect(e.message).not.toContain("failed_generation");
  });
  it("otros 400 de Groq siguen siendo un error HTTP de la solicitud", async () => {
    const f = (async () =>
      http(400, { error: { message: "parámetro desconocido" } })) as unknown as typeof fetch;
    const e = await falla(
      new ProveedorGroq({ apiKey: "k", model: "m", fetch: f }).completar(entrada),
    );
    expect(e.codigo).toBe("http");
    expect(e.estado).toBe(400);
  });
});
