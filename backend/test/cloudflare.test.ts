import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ErrorProveedor,
  ProveedorCloudflare,
  Proveedores,
  olvidarRouters,
  type EntradaIA,
} from "../src/modules/tutor/proveedor";
import { RouterIA } from "../src/modules/tutor/router";
import { settings } from "../src/config";

const CUENTA = "0123456789abcdef0123456789abcdef";
const TOKEN = "token-cloudflare-secreto";
const MODELO = "@cf/ejemplo/modelo-x";
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
const cf = (f: typeof fetch, timeoutMs?: number) =>
  new ProveedorCloudflare({
    accountId: CUENTA,
    apiToken: TOKEN,
    model: MODELO,
    fetch: f,
    timeoutMs,
  });
const falla = async (p: Promise<unknown>) =>
  (await p.then(
    () => {
      throw new Error("se esperaba un error");
    },
    (e: unknown) => e,
  )) as ErrorProveedor;

describe("adaptador Cloudflare Workers AI (fetch simulado)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("usa el endpoint compatible con OpenAI de la cuenta y el token como Bearer", async () => {
    let visto: { url: string; init: RequestInit } | undefined;
    const f = (async (url: string, init: RequestInit) => {
      visto = { url, init };
      return http(200, {
        choices: [{ message: { content: "Hola desde Cloudflare" } }],
        usage: { prompt_tokens: 7, completion_tokens: 3 },
      });
    }) as unknown as typeof fetch;
    const r = await cf(f).completar({
      sistema: "S",
      mensajes: [{ rol: "user", texto: "Hola" }],
      json: true,
    });
    expect(r).toEqual({
      texto: "Hola desde Cloudflare",
      llamadas: [],
      uso: { entrada: 7, salida: 3 },
    });
    expect(visto!.url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${CUENTA}/ai/v1/chat/completions`,
    );
    expect(visto!.init.method).toBe("POST");
    const h = visto!.init.headers as Record<string, string>;
    expect(h.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(h["Content-Type"]).toBe("application/json");
    const cuerpo = JSON.parse(visto!.init.body as string);
    expect(cuerpo.model).toBe(MODELO);
    expect(cuerpo.messages[0]).toEqual({ role: "system", content: "S" });
    expect(cuerpo.tools).toBeUndefined();
    // No se pide response_format: no está verificado para los modelos de Workers AI.
    expect(cuerpo.response_format).toBeUndefined();
  });

  it("el identificador de cuenta no puede alterar la ruta", async () => {
    let url = "";
    const f = (async (u: string) => {
      url = u;
      return http(200, { choices: [{ message: { content: "ok" } }] });
    }) as unknown as typeof fetch;
    await new ProveedorCloudflare({
      accountId: "abc/../../x?y=1",
      apiToken: TOKEN,
      model: MODELO,
      fetch: f,
    }).completar({ sistema: "S", mensajes: [{ rol: "user", texto: "h" }] });
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/abc%2F..%2F..%2Fx%3Fy%3D1/ai/v1/chat/completions",
    );
  });

  it("traduce herramientas y conserva los ids de las llamadas", async () => {
    let cuerpo: Record<string, unknown> = {};
    const f = (async (_u: string, init: RequestInit) => {
      cuerpo = JSON.parse(init.body as string);
      return http(200, {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_cf_1",
                  type: "function",
                  function: { name: "resultado", arguments: '{"a":"x"}' },
                },
              ],
            },
          },
        ],
      });
    }) as unknown as typeof fetch;
    const r = await cf(f).completar(entrada);
    expect(r.llamadas).toEqual([
      { id: "call_cf_1", nombre: "resultado", argumentos: { a: "x" } },
    ]);
    expect(cuerpo.tool_choice).toEqual({
      type: "function",
      function: { name: "resultado" },
    });
  });

  it("un historial con herramientas de otro proveedor se reenvía en formato OpenAI", async () => {
    let cuerpo: { messages: Record<string, unknown>[] } = { messages: [] };
    const f = (async (_u: string, init: RequestInit) => {
      cuerpo = JSON.parse(init.body as string);
      return http(200, { choices: [{ message: { content: "ok" } }] });
    }) as unknown as typeof fetch;
    await cf(f).completar({
      sistema: "S",
      mensajes: [
        { rol: "user", texto: "u" },
        {
          rol: "assistant",
          texto: null,
          llamadas: [
            { id: "call_groq_9", nombre: "leer_grafo", argumentos: {} },
          ],
        },
        {
          rol: "tool",
          llamada_id: "call_groq_9",
          nombre: "leer_grafo",
          texto: "{}",
        },
      ],
    });
    expect(cuerpo.messages[2]).toMatchObject({
      role: "assistant",
      tool_calls: [{ id: "call_groq_9", function: { name: "leer_grafo" } }],
    });
    expect(cuerpo.messages[3]).toEqual({
      role: "tool",
      tool_call_id: "call_groq_9",
      content: "{}",
    });
  });

  it("un 429 con retry-after informa cuánto esperar", async () => {
    const f = (async () =>
      http(429, {}, { "retry-after": "45" })) as unknown as typeof fetch;
    const e = await falla(cf(f).completar(entrada));
    expect(e.codigo).toBe("limite");
    expect(e.estado).toBe(429);
    expect(e.esperaMs).toBe(45000);
  });

  it("la cuota diaria gratuita agotada (código 3036) espera hasta las 00:00 UTC", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T20:30:00Z"));
    const f = (async () =>
      http(429, {
        success: false,
        errors: [{ code: 3036, message: "daily free allocation exceeded" }],
      })) as unknown as typeof fetch;
    const e = await falla(cf(f).completar(entrada));
    expect(e.codigo).toBe("limite");
    expect(e.esperaMs).toBe(3.5 * 3600 * 1000);
  });

  it("un 429 por capacidad temporal (3040) o sin datos no inventa una espera", async () => {
    const f = (async () =>
      http(429, {
        errors: [{ code: 3040, message: "Capacity temporarily exceeded" }],
      })) as unknown as typeof fetch;
    const e = await falla(cf(f).completar(entrada));
    expect(e.codigo).toBe("limite");
    expect(e.esperaMs).toBeUndefined();
  });

  it("traduce 401, 403 y 5xx sin mostrar el token", async () => {
    for (const estado of [401, 403, 500, 503]) {
      const f = (async () =>
        http(estado, { errors: [{ code: 5035 }] })) as unknown as typeof fetch;
      const e = await falla(cf(f).completar(entrada));
      expect(e.codigo).toBe("http");
      expect(e.estado).toBe(estado);
      expect(e.message).not.toContain(TOKEN);
      expect(e.message).not.toContain(CUENTA);
    }
  });

  it("marca el contexto demasiado largo", async () => {
    const f = (async () =>
      http(400, {
        errors: [
          { message: "The input is too long: exceeds the context window" },
        ],
      })) as unknown as typeof fetch;
    const e = await falla(cf(f).completar(entrada));
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
    expect((await falla(cf(lento, 20).completar(entrada))).codigo).toBe(
      "timeout",
    );
    const caido = (async () => {
      throw new TypeError("fetch failed " + TOKEN);
    }) as unknown as typeof fetch;
    const e = await falla(cf(caido).completar(entrada));
    expect(e.codigo).toBe("red");
    expect(e.message).not.toContain(TOKEN);
  });
});

describe("Cloudflare dentro del router", () => {
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
      if (/^(AI_|GROQ_|CLOUDFLARE_)/.test(k)) delete process.env[k];
    Object.assign(process.env, base, extra);
  };
  const completa = {
    AI_PROVIDER: "router",
    AI_CADENA: `groq:modelo-a,cloudflare:${MODELO}`,
    GROQ_API_KEY: "g-secreto",
    CLOUDFLARE_ACCOUNT_ID: CUENTA,
    CLOUDFLARE_API_TOKEN: TOKEN,
  };

  it("12. los destinos de Cloudflare exigen sus dos credenciales, sin mostrarlas", () => {
    expect(settings).toBeDefined();
    con(completa);
    expect(settings().AI_PROVIDER).toBe("router");
    con({ ...completa, CLOUDFLARE_ACCOUNT_ID: "" });
    expect(() => settings()).toThrow(/CLOUDFLARE_ACCOUNT_ID/);
    con({ ...completa, CLOUDFLARE_API_TOKEN: "" });
    try {
      settings();
      throw new Error("debía fallar");
    } catch (e) {
      const texto = e instanceof Error ? e.message : String(e);
      expect(texto).toMatch(/CLOUDFLARE_API_TOKEN/);
      expect(texto).not.toContain(CUENTA);
      expect(texto).not.toContain("g-secreto");
    }
    con({ ...completa, CLOUDFLARE_ACCOUNT_ID: "no es/un id válido" });
    expect(() => settings()).toThrow(/CLOUDFLARE_ACCOUNT_ID/);
    // Con una cadena solo de Groq no se exigen.
    con({
      ...completa,
      AI_CADENA: "groq:modelo-a",
      CLOUDFLARE_ACCOUNT_ID: "",
      CLOUDFLARE_API_TOKEN: "",
    });
    expect(settings().AI_PROVIDER).toBe("router");
  });

  it("la fábrica arma la cadena mixta y respeta AI_SIN_HERRAMIENTAS", () => {
    con({ ...completa, AI_SIN_HERRAMIENTAS: `cloudflare:${MODELO}` });
    const estado = new Proveedores().estadoRouter()!;
    expect(estado.map((d) => [d.id, d.herramientas])).toEqual([
      ["groq:modelo-a", true],
      [`cloudflare:${MODELO}`, false],
    ]);
    expect(JSON.stringify(estado)).not.toContain(TOKEN);
    expect(JSON.stringify(estado)).not.toContain(CUENTA);
  });

  it("failover real de Groq a Cloudflare: cada destino recibe su URL, modelo y credencial", async () => {
    con(completa);
    const llamadas: { url: string; auth: string; modelo: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        const h = init.headers as Record<string, string>;
        llamadas.push({
          url,
          auth: h.Authorization,
          modelo: JSON.parse(init.body as string).model,
        });
        return url.includes("groq.com")
          ? http(429, {}, { "retry-after": "30" })
          : http(200, {
              choices: [{ message: { content: "desde Cloudflare" } }],
            });
      }),
    );
    const proveedor = new Proveedores().actual()!;
    expect(proveedor).toBeInstanceOf(RouterIA);
    const r = await proveedor.completar({
      sistema: "S",
      mensajes: [{ rol: "user", texto: "hola" }],
    });
    expect(r.texto).toBe("desde Cloudflare");
    expect(r.destino).toBe(`cloudflare:${MODELO}`);
    expect(llamadas).toEqual([
      {
        url: "https://api.groq.com/openai/v1/chat/completions",
        auth: "Bearer g-secreto",
        modelo: "modelo-a",
      },
      {
        url: `https://api.cloudflare.com/client/v4/accounts/${CUENTA}/ai/v1/chat/completions`,
        auth: `Bearer ${TOKEN}`,
        modelo: MODELO,
      },
    ]);
    const salud = new Proveedores().estadoRouter()!;
    expect(salud[0]).toMatchObject({ id: "groq:modelo-a", estado: "ABIERTO" });
    expect(salud[1]).toMatchObject({ estado: "CERRADO" });
  });

  it("un destino de Cloudflare sin herramientas no recibe llamadas con herramientas", async () => {
    con({
      ...completa,
      AI_SIN_HERRAMIENTAS: `cloudflare:${MODELO}`,
    });
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return http(429, {}, { "retry-after": "30" });
      }),
    );
    const proveedor = new Proveedores().actual()!;
    const e = await falla(proveedor.completar(entrada));
    expect(e.codigo).toBe("limite");
    expect(urls.every((u) => u.includes("groq.com"))).toBe(true);
  });
});
