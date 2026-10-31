import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ErrorProveedor,
  ProveedorGroq,
  Proveedores,
  olvidarRouters,
  type EntradaIA,
  type ProveedorIA,
  type RespuestaIA,
} from "../src/modules/tutor/proveedor";
import {
  RouterIA,
  type DestinoRouter,
  type OpcionesRouter,
} from "../src/modules/tutor/router";
import { settings } from "../src/config";

const CLAVE = "clave-secreta-123";
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
const sinHerramientas: EntradaIA = {
  sistema: "S",
  mensajes: [{ rol: "user", texto: "hola" }],
};
const ok = (texto = "ok"): RespuestaIA => ({ texto, llamadas: [] });
const http = (
  estado: number,
  cuerpo: unknown = {},
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json", ...headers },
  });
const exito = () =>
  http(200, {
    choices: [{ message: { content: "respuesta" } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  });
type Paso = Response | Error | "colgar";
// Un fetch simulado que sigue un guion y cuenta sus llamadas.
const guion = (...pasos: Paso[]) => {
  const f = vi.fn(async (_u: unknown, init?: RequestInit) => {
    const p = pasos[Math.min(f.mock.calls.length - 1, pasos.length - 1)];
    if (p === "colgar")
      return new Promise<Response>((_, rechazar) =>
        init?.signal?.addEventListener("abort", () =>
          rechazar(new DOMException("t", "TimeoutError")),
        ),
      );
    if (p instanceof Error) throw p;
    return p.clone();
  });
  return f;
};
const groq = (modelo: string, f: ReturnType<typeof guion>) =>
  new ProveedorGroq({
    apiKey: CLAVE,
    model: modelo,
    fetch: f as unknown as typeof fetch,
  });
const destino = (modelo: string, adaptador: ProveedorIA, proveedor = "groq") =>
  ({ proveedor, modelo, adaptador }) as DestinoRouter;
// Adaptador de guion propio, para casos donde el fetch no es lo que interesa.
class Falso implements ProveedorIA {
  llamadas = 0;
  constructor(
    private respuesta: (n: number, e: EntradaIA) => Promise<RespuestaIA>,
  ) {}
  completar(e: EntradaIA) {
    return this.respuesta(++this.llamadas, e);
  }
}
const siempre = (r: RespuestaIA = ok()) => new Falso(async () => r);
const cuelga = () => new Falso(() => new Promise<RespuestaIA>(() => {}));

type Registro = { nivel: string; evento: Record<string, unknown> };
let registros: Registro[];
const router = (
  destinos: DestinoRouter[],
  extra: Partial<OpcionesRouter> = {},
) =>
  new RouterIA({
    destinos,
    timeoutLlamadaMs: 1000,
    timeoutTotalMs: 5000,
    maxConcurrencia: 4,
    maxEsperaColaMs: 500,
    enfriamientoMs: 10000,
    fallosParaAbrir: 3,
    backoffBaseMs: 100,
    azar: () => 0.5,
    log: (nivel, evento) => registros.push({ nivel, evento }),
    ...extra,
  });
// Avanza el reloj simulado y entrega el resultado (o el error) de la promesa.
const correr = async <T>(p: Promise<T>, ms = 0): Promise<T> => {
  const s = p.then(
    (v) => ({ v }),
    (e: unknown) => ({ e }),
  );
  await vi.advanceTimersByTimeAsync(ms);
  const r = await s;
  if ("e" in r) throw r.e;
  return r.v;
};
const fallo = async (p: Promise<unknown>, ms = 0) =>
  correr(p, ms).then(
    () => {
      throw new Error("se esperaba un error");
    },
    (e: unknown) => e as ErrorProveedor,
  );

beforeEach(() => {
  registros = [];
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("router de modelos: failover", () => {
  it("1. si el primer destino responde, los demás no se llaman", async () => {
    const a = siempre(ok("de A"));
    const b = siempre(ok("de B"));
    const r = router([destino("a", a), destino("b", b)]);
    const res = await correr(r.completar(entrada));
    expect(res.texto).toBe("de A");
    expect(res.destino).toBe("groq:a");
    expect(a.llamadas).toBe(1);
    expect(b.llamadas).toBe(0);
  });

  it("2. un 429 en Groq pasa al siguiente sin reintentar y deja el destino abierto", async () => {
    const fa = guion(http(429, {}, { "retry-after": "30" }));
    const b = siempre(ok("de B"));
    const r = router([destino("a", groq("a", fa)), destino("b", b)]);
    const res = await correr(r.completar(entrada));
    expect(res.destino).toBe("groq:b");
    expect(fa).toHaveBeenCalledTimes(1);
    const a = r.estado().find((d) => d.id === "groq:a")!;
    expect(a.estado).toBe("ABIERTO");
    expect(a.hasta).toBe(new Date(Date.now() + 30000).toISOString());
    // Mientras está abierto no se vuelve a llamar.
    await correr(r.completar(entrada));
    expect(fa).toHaveBeenCalledTimes(1);
    expect(b.llamadas).toBe(2);
  });

  it("3. un 503 se reintenta una vez con backoff y después pasa al siguiente", async () => {
    const fa = guion(http(503), http(503));
    const b = siempre(ok("de B"));
    const r = router([destino("a", groq("a", fa)), destino("b", b)]);
    const p = r.completar(entrada);
    const visto = p.then((x) => x);
    await vi.advanceTimersByTimeAsync(99);
    expect(fa).toHaveBeenCalledTimes(1); // backoff: 100 ms × (0,5 + azar 0,5)
    await vi.advanceTimersByTimeAsync(1);
    expect(fa).toHaveBeenCalledTimes(2);
    expect((await visto).destino).toBe("groq:b");
    expect(fa).toHaveBeenCalledTimes(2); // nunca más de un reintento
  });

  it("3b. si el reintento tiene éxito, responde el mismo destino", async () => {
    const fa = guion(http(500), exito());
    const b = siempre();
    const r = router([destino("a", groq("a", fa)), destino("b", b)]);
    const res = await correr(r.completar(entrada), 1000);
    expect(res.destino).toBe("groq:a");
    expect(b.llamadas).toBe(0);
    expect(res.uso).toEqual({ entrada: 10, salida: 5 });
  });

  it("3c. el backoff crece de forma exponencial y respeta retry-after", async () => {
    const fa = guion(http(503, {}, { "retry-after": "2" }), exito());
    const r = router([destino("a", groq("a", fa))]);
    const p = r.completar(entrada);
    const visto = p.then((x) => x);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fa).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fa).toHaveBeenCalledTimes(2);
    expect((await visto).destino).toBe("groq:a");
  });

  it("3d. un retry-after que no cabe en el tiempo total no se espera: pasa al siguiente", async () => {
    const fa = guion(http(503, {}, { "retry-after": "60" }));
    const b = siempre(ok("de B"));
    const r = router([destino("a", groq("a", fa)), destino("b", b)]);
    const res = await correr(r.completar(entrada));
    expect(res.destino).toBe("groq:b");
    expect(fa).toHaveBeenCalledTimes(1);
  });

  it("4. un timeout pasa al siguiente dentro de AI_TIMEOUT_TOTAL_MS", async () => {
    const a = cuelga();
    const b = siempre(ok("de B"));
    const r = router([destino("a", a), destino("b", b)], {
      timeoutTotalMs: 2500,
    });
    const t0 = Date.now();
    const res = await correr(r.completar(entrada), 3000);
    expect(res.destino).toBe("groq:b");
    expect(Date.now() - t0).toBeLessThanOrEqual(3000);
    expect(a.llamadas).toBe(2); // llamada + único reintento
    expect(registros[0].evento.failovers).toEqual([
      expect.objectContaining({ destino: "groq:a", motivo: "timeout" }),
    ]);
  });

  it("4b. nunca supera AI_TIMEOUT_TOTAL_MS aunque todos cuelguen", async () => {
    const r = router([destino("a", cuelga()), destino("b", cuelga())], {
      timeoutTotalMs: 2500,
    });
    const t0 = Date.now();
    const p = r.completar(entrada);
    const e = await fallo(p, 3000);
    expect(e).toBeInstanceOf(ErrorProveedor);
    expect(e.codigo).toBe("timeout");
    expect(Date.now() - t0).toBeLessThanOrEqual(3000);
    const fin = registros.at(-1)!;
    expect(fin.evento.ok).toBe(false);
    expect(Number(fin.evento.latencia_ms)).toBeLessThanOrEqual(2500);
  });

  it("4c. un error de red es transitorio: un reintento y failover", async () => {
    const a = new Falso(async () => {
      throw new ErrorProveedor("red", "sin red");
    });
    const b = siempre(ok("de B"));
    const r = router([destino("a", a), destino("b", b)]);
    const res = await correr(r.completar(entrada), 1000);
    expect(res.destino).toBe("groq:b");
    expect(a.llamadas).toBe(2);
  });

  it("4d. una respuesta ilegible pasa al siguiente sin reintentar", async () => {
    const fa = guion(http(200, { choices: [] }));
    const b = siempre(ok("de B"));
    const r = router([destino("a", groq("a", fa)), destino("b", b)]);
    const res = await correr(r.completar(entrada));
    expect(res.destino).toBe("groq:b");
    expect(fa).toHaveBeenCalledTimes(1);
  });

  it("4e. una respuesta vacía (sin texto ni herramientas) pasa al siguiente", async () => {
    const a = siempre({ texto: "  ", llamadas: [] });
    const b = siempre(ok("de B"));
    const r = router([destino("a", a), destino("b", b)]);
    const res = await correr(r.completar(entrada));
    expect(res.destino).toBe("groq:b");
    expect(a.llamadas).toBe(1);
  });

  it("5. cuota diaria agotada: queda abierto el tiempo que informa Groq", async () => {
    const abierto = async (headers: Record<string, string>) => {
      const fa = guion(
        http(429, { error: { message: "rate limit" } }, headers),
      );
      const r = router([destino("a", groq("a", fa)), destino("b", siempre())]);
      await correr(r.completar(entrada));
      const a = r.estado().find((d) => d.id === "groq:a")!;
      return new Date(a.hasta!).getTime() - Date.now();
    };
    // retry-after en segundos manda cuando existe.
    expect(
      await abierto({
        "retry-after": "432",
        "x-ratelimit-remaining-requests": "0",
        "x-ratelimit-reset-requests": "7m12s",
      }),
    ).toBe(432000);
    // Sin retry-after: el reinicio de los requests (RPD) si ya no quedan.
    expect(
      await abierto({
        "x-ratelimit-limit-requests": "14400",
        "x-ratelimit-remaining-requests": "0",
        "x-ratelimit-reset-requests": "7m12.5s",
        "x-ratelimit-remaining-tokens": "5000",
        "x-ratelimit-reset-tokens": "1.2s",
      }),
    ).toBe(432500);
    // Se agotaron los tokens y no los requests.
    expect(
      await abierto({
        "x-ratelimit-remaining-requests": "100",
        "x-ratelimit-reset-requests": "3m0s",
        "x-ratelimit-remaining-tokens": "0",
        "x-ratelimit-reset-tokens": "6.5s",
      }),
    ).toBe(6500);
    // Sin ningún dato útil: AI_ENFRIAMIENTO_MS, sin inventar cuotas.
    expect(await abierto({})).toBe(10000);
    expect(
      await abierto({
        "x-ratelimit-remaining-requests": "100",
        "x-ratelimit-reset-requests": "3m0s",
      }),
    ).toBe(10000);
  });

  it("6. si todos fallan: ErrorProveedor controlado con la recuperación más cercana", async () => {
    const fa = guion(http(429, {}, { "retry-after": "30" }));
    const fb = guion(http(429, {}, { "retry-after": "12" }));
    const r = router([
      destino("a", groq("a", fa)),
      destino("b", groq("b", fb)),
    ]);
    const e = await fallo(r.completar(entrada));
    expect(e).toBeInstanceOf(ErrorProveedor);
    expect(e.codigo).toBe("limite");
    expect(e.esperaMs).toBe(12000);
    expect(e.message).toMatch(/12 s/);
    expect(e.message).not.toContain(CLAVE);
    // Con todos abiertos responde de inmediato, sin tocar a los proveedores.
    const e2 = await fallo(r.completar(entrada));
    expect(e2.codigo).toBe("limite");
    expect(e2.esperaMs).toBe(12000);
    expect(fa).toHaveBeenCalledTimes(1);
    expect(fb).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect((await fallo(r.completar(entrada))).esperaMs).toBe(10000);
  });

  it("7. recuperación: tras el enfriamiento, SEMIABIERTO vuelve a usar el primer destino", async () => {
    const fa = guion(http(429, {}, { "retry-after": "10" }), exito());
    const b = siempre(ok("de B"));
    const r = router([destino("a", groq("a", fa)), destino("b", b)]);
    expect((await correr(r.completar(entrada))).destino).toBe("groq:b");
    expect(r.estado()[0].estado).toBe("ABIERTO");
    await vi.advanceTimersByTimeAsync(9999);
    expect((await correr(r.completar(entrada))).destino).toBe("groq:b");
    expect(fa).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(r.estado()[0].estado).toBe("SEMIABIERTO");
    const res = await correr(r.completar(entrada));
    expect(res.destino).toBe("groq:a"); // la llamada de prueba salió bien
    expect(r.estado()[0].estado).toBe("CERRADO");
    expect(r.estado()[0].hasta).toBeNull();
    expect((await correr(r.completar(entrada))).destino).toBe("groq:a");
  });

  it("7b. SEMIABIERTO admite una sola llamada de prueba y si falla vuelve a abrirse", async () => {
    let suelta!: (r: RespuestaIA) => void;
    let n = 0;
    const a = new Falso(async () => {
      n++;
      if (n === 1)
        throw new ErrorProveedor("limite", "límite", 429, { esperaMs: 5000 });
      return new Promise<RespuestaIA>((res) => (suelta = res));
    });
    const b = siempre(ok("de B"));
    const r = router([destino("a", a), destino("b", b)]);
    await correr(r.completar(entrada));
    await vi.advanceTimersByTimeAsync(5000);
    const sonda = r.completar(entrada); // toma la única llamada de prueba
    const vistoSonda = sonda.then((x) => x);
    await vi.advanceTimersByTimeAsync(0);
    expect(a.llamadas).toBe(2);
    // Mientras la prueba está en curso, los demás usan el siguiente destino.
    expect((await correr(r.completar(entrada))).destino).toBe("groq:b");
    expect(a.llamadas).toBe(2);
    suelta(ok("de A"));
    expect((await vistoSonda).destino).toBe("groq:a");
    expect(r.estado()[0].estado).toBe("CERRADO");
    // Prueba fallida: vuelve a abrirse.
    const c = new Falso(async (n2) => {
      if (n2 === 1)
        throw new ErrorProveedor("limite", "l", 429, { esperaMs: 1000 });
      throw new ErrorProveedor("http", "x", 500);
    });
    const r2 = router([destino("c", c), destino("d", siempre())]);
    await correr(r2.completar(entrada));
    await vi.advanceTimersByTimeAsync(1000);
    await correr(r2.completar(entrada), 1000);
    expect(r2.estado()[0].estado).toBe("ABIERTO");
  });

  it("7c. tras N fallos transitorios seguidos el destino se abre por AI_ENFRIAMIENTO_MS", async () => {
    const a = new Falso(async () => {
      throw new ErrorProveedor("http", "caído", 502);
    });
    const r = router([destino("a", a), destino("b", siempre())], {
      fallosParaAbrir: 2,
    });
    await correr(r.completar(entrada), 500);
    expect(r.estado()[0].estado).toBe("CERRADO");
    await correr(r.completar(entrada), 500);
    const e = r.estado()[0];
    expect(e.estado).toBe("ABIERTO");
    const falta = new Date(e.hasta!).getTime() - Date.now();
    expect(falta).toBeGreaterThan(9000);
    expect(falta).toBeLessThanOrEqual(10000);
    expect(a.llamadas).toBe(4);
  });

  it("13. un 401 marca el destino como mal configurado, pasa al siguiente y no reintenta", async () => {
    const fa = guion(http(401, { error: { message: "invalid key" } }));
    const b = siempre(ok("de B"));
    const r = router([destino("a", groq("a", fa)), destino("b", b)]);
    const res = await correr(r.completar(entrada));
    expect(res.destino).toBe("groq:b");
    expect(fa).toHaveBeenCalledTimes(1);
    const a = r.estado()[0];
    expect(a.estado).toBe("ABIERTO");
    expect(a.motivo).toBe("mal_configurado");
    expect(a.hasta).toBeNull();
    await vi.advanceTimersByTimeAsync(7 * 24 * 3600 * 1000);
    await correr(r.completar(entrada));
    expect(fa).toHaveBeenCalledTimes(1); // hasta reiniciar
    expect(JSON.stringify(registros)).not.toContain(CLAVE);
  });

  it("13b. un 403 y un modelo inexistente (404) también marcan el destino", async () => {
    for (const estado of [403, 404]) {
      const fa = guion(http(estado));
      const r = router([destino("a", groq("a", fa)), destino("b", siempre())]);
      expect((await correr(r.completar(entrada))).destino).toBe("groq:b");
      expect(r.estado()[0].motivo).toBe("mal_configurado");
      expect(fa).toHaveBeenCalledTimes(1);
    }
  });

  it("13c. si todos están mal configurados, el error lo dice y no es un límite", async () => {
    const r = router([destino("a", groq("a", guion(http(401))))]);
    await fallo(r.completar(entrada));
    const e = await fallo(r.completar(entrada));
    expect(e.codigo).toBe("http");
    expect(e.message).toMatch(/configuraci/i);
  });

  it("un 400 es un bug: no pasa al siguiente, no reintenta y se registra", async () => {
    const fa = guion(http(400, { error: { message: "mala forma" } }));
    const b = siempre();
    const r = router([destino("a", groq("a", fa)), destino("b", b)]);
    const e = await fallo(r.completar(entrada));
    expect(e.codigo).toBe("http");
    expect(e.estado).toBe(400);
    expect(fa).toHaveBeenCalledTimes(1);
    expect(b.llamadas).toBe(0);
    expect(registros.some((x) => x.nivel === "error")).toBe(true);
    expect(r.estado()[0].estado).toBe("CERRADO"); // no es culpa del destino
  });

  it("un 400 por contexto demasiado largo prueba el siguiente destino", async () => {
    const fa = guion(
      http(400, {
        error: {
          message: "This model's maximum context length is 8192 tokens",
          code: "context_length_exceeded",
        },
      }),
    );
    const b = siempre(ok("de B"));
    const r = router([destino("a", groq("a", fa)), destino("b", b)]);
    const res = await correr(r.completar(entrada));
    expect(res.destino).toBe("groq:b");
    expect(fa).toHaveBeenCalledTimes(1);
    expect(r.estado()[0].estado).toBe("CERRADO");
  });

  it("los destinos sin herramientas solo se usan en llamadas sin herramientas", async () => {
    const a = siempre(ok("de A"));
    const b = siempre(ok("de B"));
    const r = router([
      { ...destino("a", a, "cloudflare"), herramientas: false },
      destino("b", b),
    ]);
    expect((await correr(r.completar(entrada))).destino).toBe("groq:b");
    expect(a.llamadas).toBe(0);
    expect((await correr(r.completar(sinHerramientas))).destino).toBe(
      "cloudflare:a",
    );
  });

  it("el registro por llamada no contiene prompts, mensajes ni claves", async () => {
    const fa = guion(http(429, {}, { "retry-after": "5" }));
    const r = router([
      destino("a", groq("a", fa)),
      destino("b", groq("b", guion(exito()))),
    ]);
    await correr(r.completar(entrada));
    expect(registros).toHaveLength(1);
    const ev = registros[0].evento;
    expect(ev).toMatchObject({
      ok: true,
      destino: "groq:b",
      intentos: 2,
      failovers: [{ destino: "groq:a", motivo: "limite" }],
      tokens: { entrada: 10, salida: 5 },
    });
    expect(typeof ev.latencia_ms).toBe("number");
    expect(typeof ev.espera_cola_ms).toBe("number");
    expect(ev.disyuntor).toMatchObject({
      "groq:a": "ABIERTO",
      "groq:b": "CERRADO",
    });
    const texto = JSON.stringify(registros);
    expect(texto).not.toContain("mensaje privado");
    expect(texto).not.toContain("Sistema de prueba");
    expect(texto).not.toContain(CLAVE);
  });
});

describe("router de modelos: concurrencia", () => {
  const diferido = () => {
    const pendientes: { texto: string; sigue: () => void }[] = [];
    let activas = 0;
    let maxima = 0;
    const adaptador = new Falso(
      (_n, e) =>
        new Promise<RespuestaIA>((res) => {
          activas++;
          maxima = Math.max(maxima, activas);
          const texto = (e.mensajes[0] as { texto: string }).texto;
          pendientes.push({
            texto,
            sigue: () => {
              activas--;
              res(ok(texto));
            },
          });
        }),
    );
    return { adaptador, pendientes, maxima: () => maxima };
  };
  const msg = (i: number): EntradaIA => ({
    sistema: "S",
    mensajes: [{ rol: "user", texto: `s${i}` }],
  });

  it("9. con 10 solicitudes simultáneas respeta el máximo por destino y la cola FIFO", async () => {
    const d = diferido();
    const r = router([destino("a", d.adaptador)], {
      maxConcurrencia: 2,
      maxEsperaColaMs: 60000,
      timeoutLlamadaMs: 60000,
      timeoutTotalMs: 120000,
    });
    const resultados = Array.from({ length: 10 }, (_, i) =>
      r.completar(msg(i)).then((x) => x.texto),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(d.pendientes.map((p) => p.texto)).toEqual(["s0", "s1"]);
    expect(r.estado()[0]).toMatchObject({ ocupados: 2, en_cola: 8 });
    const orden: string[] = [];
    while (d.pendientes.length) {
      const p = d.pendientes.shift()!;
      orden.push(p.texto);
      p.sigue();
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(await Promise.all(resultados)).toEqual(
      Array.from({ length: 10 }, (_, i) => `s${i}`),
    );
    expect(orden).toEqual(Array.from({ length: 10 }, (_, i) => `s${i}`));
    expect(d.maxima()).toBe(2);
    expect(r.estado()[0]).toMatchObject({ ocupados: 0, en_cola: 0 });
  });

  it("9b. si la espera en cola se supera, prueba el siguiente destino", async () => {
    const d = diferido();
    const b = siempre(ok("de B"));
    const r = router([destino("a", d.adaptador), destino("b", b)], {
      maxConcurrencia: 1,
      maxEsperaColaMs: 300,
      timeoutLlamadaMs: 60000,
      timeoutTotalMs: 120000,
    });
    const primera = r.completar(msg(0));
    await vi.advanceTimersByTimeAsync(0);
    const segunda = r.completar(msg(1));
    await vi.advanceTimersByTimeAsync(299);
    expect(b.llamadas).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect((await segunda).destino).toBe("groq:b");
    expect(registros.at(-1)!.evento.espera_cola_ms).toBe(300);
    d.pendientes[0].sigue();
    expect((await primera).destino).toBe("groq:a");
  });

  it("9c. si ningún destino tiene lugar: ErrorProveedor limite", async () => {
    const d = diferido();
    const r = router([destino("a", d.adaptador)], {
      maxConcurrencia: 1,
      maxEsperaColaMs: 200,
      timeoutLlamadaMs: 60000,
      timeoutTotalMs: 120000,
    });
    const primera = r.completar(msg(0)).then((x) => x);
    await vi.advanceTimersByTimeAsync(0);
    const e = await fallo(r.completar(msg(1)), 200);
    expect(e.codigo).toBe("limite");
    expect(e.message).toMatch(/ocupad/i);
    d.pendientes[0].sigue();
    await primera;
    expect(r.estado()[0].estado).toBe("CERRADO"); // la saturación no abre el disyuntor
  });
});

describe("router de modelos: configuración y fábrica", () => {
  const base = {
    DATABASE_URL: "postgres://u:p@localhost:5432/x",
    NODE_ENV: "test",
  };
  const previo = { ...process.env };
  afterEach(() => {
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
    AI_CADENA: "groq:modelo-a,groq:modelo-b,groq:modelo-c",
    GROQ_API_KEY: "g-secreto",
  };

  it("12. sin cadena válida o sin credenciales es un error claro que no muestra secretos", () => {
    con({ ...completa, AI_CADENA: "" });
    expect(() => settings()).toThrow(/AI_CADENA/);
    con({ ...completa, AI_CADENA: undefined as unknown as string });
    expect(() => settings()).toThrow(/AI_CADENA/);
    con({ ...completa, AI_CADENA: "openai:gpt" });
    expect(() => settings()).toThrow(/AI_CADENA/);
    con({ ...completa, AI_CADENA: "groq:a,groq:a" });
    expect(() => settings()).toThrow(/repetid/i);
    con({ ...completa, AI_CADENA: "groq" });
    expect(() => settings()).toThrow(/AI_CADENA/);
    con({ ...completa, GROQ_API_KEY: "" });
    expect(() => settings()).toThrow(/GROQ_API_KEY/);
    // Ningún mensaje de error contiene valores secretos.
    con({ ...completa, GROQ_API_KEY: "", AI_API_KEY: "super-secreto-zzz" });
    try {
      settings();
      throw new Error("debía fallar");
    } catch (e) {
      const texto = e instanceof Error ? e.message : String(e);
      expect(texto).not.toContain("super-secreto-zzz");
      expect(texto).not.toContain("g-secreto");
    }
  });

  it("12b. valida los números y AI_SIN_HERRAMIENTAS contra la cadena", () => {
    con({ ...completa, AI_TIMEOUT_MS: "abc" });
    expect(() => settings()).toThrow();
    con({ ...completa, AI_MAX_CONCURRENCIA: "0" });
    expect(() => settings()).toThrow();
    con({ ...completa, AI_SIN_HERRAMIENTAS: "groq:otro" });
    expect(() => settings()).toThrow(/AI_SIN_HERRAMIENTAS/);
    con({ ...completa, AI_TIMEOUT_MS: "", AI_ENFRIAMIENTO_MS: "" });
    const c = settings();
    expect(c.AI_TIMEOUT_MS).toBe(20000);
    expect(c.AI_TIMEOUT_TOTAL_MS).toBe(45000);
    expect(c.AI_ENFRIAMIENTO_MS).toBe(60000);
    con({ ...completa, AI_SIN_HERRAMIENTAS: "groq:modelo-c" });
    expect(settings().AI_SIN_HERRAMIENTAS).toBe("groq:modelo-c");
  });

  it("con AI_PROVIDER=router la fábrica devuelve un único router con estado compartido", () => {
    con(completa);
    const uno = new Proveedores().actual();
    const dos = new Proveedores().actual();
    expect(uno).toBeInstanceOf(RouterIA);
    expect(dos).toBe(uno);
    expect(new Proveedores().estadoRouter()?.map((d) => d.id)).toEqual([
      "groq:modelo-a",
      "groq:modelo-b",
      "groq:modelo-c",
    ]);
    // Un cambio de configuración construye otro router.
    con({ ...completa, AI_CADENA: "groq:solo" });
    expect(new Proveedores().actual()).not.toBe(uno);
    olvidarRouters();
    con({ AI_PROVIDER: "fake" });
    expect(new Proveedores().estadoRouter()).toBeNull();
  });

  it("14. AI_PROVIDER=groq sigue usando AI_API_KEY y AI_MODEL, sin exigir variables del router", () => {
    con({ AI_PROVIDER: "groq", AI_API_KEY: "k", AI_MODEL: "m" });
    expect(settings().AI_PROVIDER).toBe("groq");
    expect(new Proveedores().actual()).toBeInstanceOf(ProveedorGroq);
    expect(new Proveedores().estadoRouter()).toBeNull();
    con({
      AI_PROVIDER: "groq",
      AI_API_KEY: "k",
      AI_MODEL: "m",
      AI_CADENA: "basura",
    });
    expect(settings().AI_PROVIDER).toBe("groq"); // la cadena solo importa con router
  });

  it("14b. el adaptador Groq directo conserva su contrato de errores", async () => {
    const f = guion(http(429, {}, { "retry-after": "7" }));
    const e = (await groq("m", f)
      .completar(entrada)
      .catch((x: unknown) => x)) as ErrorProveedor;
    expect(e.codigo).toBe("limite");
    expect(e.estado).toBe(429);
    expect(e.esperaMs).toBe(7000);
    const f2 = guion(http(503));
    const e2 = (await groq("m", f2)
      .completar(entrada)
      .catch((x: unknown) => x)) as ErrorProveedor;
    expect(e2.codigo).toBe("http");
    expect(e2.estado).toBe(503);
  });
});
