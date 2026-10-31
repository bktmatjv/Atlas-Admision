import Anthropic from "@anthropic-ai/sdk";
import { Injectable, Logger } from "@nestjs/common";
import { settings, type Settings } from "../../config.js";
import { listaDeIds, parsearCadena } from "./cadena.js";
export * from "./tipos-ia.js";
import { ErrorProveedor } from "./tipos-ia.js";
import type {
  EntradaIA,
  OpcionesLlamada,
  ProveedorIA,
  RespuestaIA,
} from "./tipos-ia.js";
import { RouterIA, type DestinoRouter, type EstadoDestino } from "./router.js";
export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
export const TIMEOUT_LLAMADA_MS = 30000;
type FetchFn = typeof fetch;
type OpcionesGroq = {
  apiKey: string;
  model: string;
  fetch?: FetchFn;
  timeoutMs?: number;
  url?: string;
};
type MensajeOpenAI = Record<string, unknown>;
export const aMensajesOpenAI = (e: EntradaIA): MensajeOpenAI[] => [
  { role: "system", content: e.sistema },
  ...e.mensajes.map((m): MensajeOpenAI => {
    if (m.rol === "user") return { role: "user", content: m.texto };
    if (m.rol === "tool")
      return { role: "tool", tool_call_id: m.llamada_id, content: m.texto };
    return {
      role: "assistant",
      content: m.texto,
      ...(m.llamadas?.length
        ? {
            tool_calls: m.llamadas.map((l) => ({
              id: l.id,
              type: "function",
              function: {
                name: l.nombre,
                arguments: JSON.stringify(l.argumentos),
              },
            })),
          }
        : {}),
    };
  }),
];
const MAX_ESPERA_LIMITE_MS = 25 * 3600 * 1000;
const aMs = (ms: number) =>
  Number.isFinite(ms) && ms >= 0
    ? Math.min(Math.ceil(ms), MAX_ESPERA_LIMITE_MS)
    : undefined;
// retry-after: segundos enteros o una fecha HTTP.
export function leerRetryAfter(valor: string | null): number | undefined {
  if (!valor) return undefined;
  const v = valor.trim();
  if (/^\d+(\.\d+)?$/.test(v)) return aMs(Number(v) * 1000);
  const fecha = Date.parse(v);
  return Number.isNaN(fecha) ? undefined : aMs(fecha - Date.now());
}
// Duraciones de x-ratelimit-reset-*: «2m59.56s», «7.66s», «1h2m3s», «150ms» o segundos sueltos.
export function leerDuracion(valor: string | null): number | undefined {
  if (!valor) return undefined;
  const v = valor.trim();
  if (/^\d+(\.\d+)?$/.test(v)) return aMs(Number(v) * 1000);
  const trozos = [...v.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)];
  if (!trozos.length || trozos.map((t) => t[0]).join("") !== v)
    return undefined;
  const unidad = { ms: 1, s: 1000, m: 60000, h: 3600000 } as const;
  return aMs(
    trozos.reduce(
      (suma, t) => suma + Number(t[1]) * unidad[t[2] as keyof typeof unidad],
      0,
    ),
  );
}
// Groq: retry-after (solo en un 429) y x-ratelimit-*. Según su documentación, los encabezados
// de «requests» son del límite diario (RPD) y los de «tokens» del límite por minuto (TPM).
// Se espera lo que indique retry-after; si falta, el reinicio de la cuota que quedó en cero.
// Sin dato claro devuelve undefined: el router aplica AI_ENFRIAMIENTO_MS, sin inventar cuotas.
export function esperaGroq(h: Headers): number | undefined {
  const agotados = [
    ["x-ratelimit-remaining-requests", "x-ratelimit-reset-requests"],
    ["x-ratelimit-remaining-tokens", "x-ratelimit-reset-tokens"],
  ].flatMap(([restante, reinicio]) =>
    h.get(restante)?.trim() === "0" ? [leerDuracion(h.get(reinicio))] : [],
  );
  const candidatos = [leerRetryAfter(h.get("retry-after")), ...agotados].filter(
    (x): x is number => x !== undefined,
  );
  return candidatos.length ? Math.max(...candidatos) : undefined;
}
const CONTEXTO_LARGO =
  /context[_ ]length|maximum context|context window|too many tokens|reduce the length|demasiado largo/i;
const leerTextoAcotado = async (r: Response) => {
  try {
    return (await r.text()).slice(0, 2000);
  } catch {
    return "";
  }
};
type OpcionesOpenAI = {
  url: string;
  apiKey: string;
  model: string;
  fetch?: FetchFn;
  timeoutMs: number;
  // Cuánto esperar tras un 429, según los encabezados (y cuerpo) reales del proveedor.
  esperaLimite: (h: Headers, cuerpo: string) => number | undefined;
  // Pide response_format=json_object cuando no hay herramientas.
  formatoJson: boolean;
  // Cómo se envía la credencial; por defecto «Authorization: Bearer».
  cabeceraAuth?: (apiKey: string) => Record<string, string>;
  // Modelos de razonamiento: sin temperature y con max_completion_tokens en vez de max_tokens.
  razonamiento?: boolean;
  // Esfuerzo de razonamiento (reasoning_effort); si no se configura, no se envía y manda el valor del modelo.
  esfuerzo?: string;
};
// Groq responde 400 «tool_use_failed» cuando el modelo genera una llamada a herramienta que no
// cumple el esquema: no es un bug de la solicitud, es una salida inválida del modelo.
const LLAMADA_INVALIDA =
  /tool_use_failed|tool call validation failed|Failed to call a function/i;
// Llamada compartida por los adaptadores de la API compatible con OpenAI (Groq, Cloudflare, Foundry).
async function completarOpenAI(
  o: OpcionesOpenAI,
  e: EntradaIA,
  op?: OpcionesLlamada,
): Promise<RespuestaIA> {
  const cuerpo: Record<string, unknown> = {
    model: o.model,
    messages: aMensajesOpenAI(e),
  };
  if (o.razonamiento) {
    cuerpo.max_completion_tokens = e.max_tokens ?? 4000;
    if (o.esfuerzo) cuerpo.reasoning_effort = o.esfuerzo;
  } else {
    cuerpo.max_tokens = e.max_tokens ?? 4000;
    cuerpo.temperature = 0.3;
  }
  if (e.herramientas?.length) {
    cuerpo.tools = e.herramientas.map((h) => ({
      type: "function",
      function: {
        name: h.nombre,
        description: h.descripcion,
        parameters: h.parametros,
      },
    }));
    cuerpo.tool_choice = e.forzar
      ? { type: "function", function: { name: e.forzar } }
      : "auto";
  }
  if (e.json && !e.herramientas?.length && o.formatoJson)
    cuerpo.response_format = { type: "json_object" };
  let respuesta: Response;
  try {
    respuesta = await (o.fetch ?? fetch)(o.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(o.cabeceraAuth?.(o.apiKey) ?? {
          Authorization: `Bearer ${o.apiKey}`,
        }),
      },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(op?.timeoutMs ?? o.timeoutMs),
    });
  } catch (err) {
    const nombre = err instanceof Error ? err.name : "";
    if (nombre === "TimeoutError" || nombre === "AbortError")
      throw new ErrorProveedor(
        "timeout",
        "El proveedor de IA tardó demasiado en responder.",
      );
    throw new ErrorProveedor("red", "No se pudo contactar al proveedor de IA.");
  }
  if (!respuesta.ok) {
    const texto = await leerTextoAcotado(respuesta);
    if (respuesta.status === 429)
      throw new ErrorProveedor(
        "limite",
        "El proveedor de IA alcanzó su límite de uso. Espera un momento y reintenta.",
        429,
        { esperaMs: o.esperaLimite(respuesta.headers, texto) },
      );
    if (respuesta.status === 400 && LLAMADA_INVALIDA.test(texto))
      throw new ErrorProveedor(
        "respuesta_invalida",
        "El modelo no generó una llamada válida a la herramienta.",
        400,
      );
    throw new ErrorProveedor(
      "http",
      `El proveedor de IA respondió con error HTTP ${respuesta.status}.`,
      respuesta.status,
      {
        esperaMs: leerRetryAfter(respuesta.headers.get("retry-after")),
        contextoLargo:
          (respuesta.status === 400 || respuesta.status === 413) &&
          CONTEXTO_LARGO.test(texto),
      },
    );
  }
  let datos: unknown;
  try {
    datos = await respuesta.json();
  } catch {
    throw new ErrorProveedor(
      "respuesta_invalida",
      "El proveedor de IA devolvió una respuesta que no es JSON.",
    );
  }
  return leerRespuestaOpenAI(datos);
}
export const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";
// Workers AI: cuota diaria gratuita de 10 000 neuronas (HTTP 429, código 3036) que se reinicia a
// las 00:00 UTC. Otros 429 (p. ej. 3040, capacidad temporal) no tienen hora de recuperación.
export function esperaCloudflare(
  h: Headers,
  cuerpo: string,
  ahora = Date.now(),
): number | undefined {
  const indicada = leerRetryAfter(h.get("retry-after"));
  if (indicada !== undefined) return indicada;
  if (!/\b3036\b/.test(cuerpo)) return undefined;
  const d = new Date(ahora);
  return aMs(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - ahora,
  );
}
type OpcionesCloudflare = {
  accountId: string;
  apiToken: string;
  model: string;
  fetch?: FetchFn;
  timeoutMs?: number;
  url?: string;
};
// Workers AI mediante su endpoint compatible con OpenAI: mismos mensajes, herramientas y respuesta.
export class ProveedorCloudflare implements ProveedorIA {
  constructor(private o: OpcionesCloudflare) {}
  completar(e: EntradaIA, op?: OpcionesLlamada): Promise<RespuestaIA> {
    return completarOpenAI(
      {
        url:
          this.o.url ??
          `${CLOUDFLARE_API}/accounts/${encodeURIComponent(this.o.accountId)}/ai/v1/chat/completions`,
        apiKey: this.o.apiToken,
        model: this.o.model,
        fetch: this.o.fetch,
        timeoutMs: this.o.timeoutMs ?? TIMEOUT_LLAMADA_MS,
        esperaLimite: (h, cuerpo) => esperaCloudflare(h, cuerpo),
        // response_format no está verificado para los modelos de Workers AI.
        formatoJson: false,
      },
      e,
      op,
    );
  }
}
type OpcionesFoundry = {
  endpoint: string;
  apiKey: string;
  // Nombre del despliegue (Foundry lo usa como «model»).
  model: string;
  fetch?: FetchFn;
  timeoutMs?: number;
  // reasoning_effort de Chat Completions: minimal, low, medium o high (según el modelo desplegado).
  esfuerzo?: string;
};
// Microsoft Foundry / Azure OpenAI mediante la API v1 compatible con OpenAI:
// POST {recurso}/openai/v1/chat/completions con la clave en el encabezado «api-key».
// No hay encabezados de límite documentados para el 429: solo se respeta «retry-after» si llega.
export class ProveedorFoundry implements ProveedorIA {
  constructor(private o: OpcionesFoundry) {}
  completar(e: EntradaIA, op?: OpcionesLlamada): Promise<RespuestaIA> {
    return completarOpenAI(
      {
        // Acepta el recurso con o sin «/openai/v1» (el portal muestra la forma completa).
        url: `${this.o.endpoint.replace(/\/+$/, "").replace(/\/openai\/v1$/, "")}/openai/v1/chat/completions`,
        apiKey: this.o.apiKey,
        model: this.o.model,
        fetch: this.o.fetch,
        timeoutMs: this.o.timeoutMs ?? TIMEOUT_LLAMADA_MS,
        esperaLimite: (h) => leerRetryAfter(h.get("retry-after")),
        // response_format no está verificado en la documentación de la API v1.
        formatoJson: false,
        cabeceraAuth: (k) => ({ "api-key": k }),
        razonamiento: true,
        esfuerzo: this.o.esfuerzo,
      },
      e,
      op,
    );
  }
}
export class ProveedorGroq implements ProveedorIA {
  constructor(private o: OpcionesGroq) {}
  completar(e: EntradaIA, op?: OpcionesLlamada): Promise<RespuestaIA> {
    return completarOpenAI(
      {
        url: this.o.url ?? GROQ_URL,
        apiKey: this.o.apiKey,
        model: this.o.model,
        fetch: this.o.fetch,
        timeoutMs: this.o.timeoutMs ?? TIMEOUT_LLAMADA_MS,
        esperaLimite: (h) => esperaGroq(h),
        formatoJson: true,
      },
      e,
      op,
    );
  }
}
export function leerRespuestaOpenAI(datos: unknown): RespuestaIA {
  const msg = (
    datos as {
      choices?: {
        message?: {
          content?: unknown;
          tool_calls?: {
            id?: unknown;
            function?: { name?: unknown; arguments?: unknown };
          }[];
        };
      }[];
    }
  )?.choices?.[0]?.message;
  if (!msg)
    throw new ErrorProveedor(
      "respuesta_invalida",
      "El proveedor de IA no devolvió ningún mensaje.",
    );
  const llamadas = (msg.tool_calls ?? []).map((l, i) => {
    if (
      typeof l.function?.name !== "string" ||
      typeof l.function.arguments !== "string"
    )
      throw new ErrorProveedor(
        "respuesta_invalida",
        "El proveedor de IA devolvió una llamada a herramienta incompleta.",
      );
    let argumentos: unknown;
    try {
      argumentos = JSON.parse(l.function.arguments || "{}");
    } catch {
      throw new ErrorProveedor(
        "respuesta_invalida",
        "Los argumentos de una herramienta no son JSON válido.",
      );
    }
    return {
      id: typeof l.id === "string" ? l.id : `llamada-${i}`,
      nombre: l.function.name,
      argumentos,
    };
  });
  const u = (datos as { usage?: Record<string, unknown> })?.usage;
  const uso =
    typeof u?.prompt_tokens === "number" &&
    typeof u?.completion_tokens === "number"
      ? { entrada: u.prompt_tokens, salida: u.completion_tokens }
      : undefined;
  return {
    texto: typeof msg.content === "string" ? msg.content : null,
    llamadas,
    ...(uso ? { uso } : {}),
  };
}
export class ProveedorAnthropic implements ProveedorIA {
  constructor(private o: { apiKey: string; model: string }) {}
  async completar(e: EntradaIA): Promise<RespuestaIA> {
    const client = new Anthropic({
      apiKey: this.o.apiKey,
      maxRetries: 0,
      timeout: TIMEOUT_LLAMADA_MS,
    });
    const mensajes: Anthropic.MessageParam[] = [];
    for (const m of e.mensajes) {
      if (m.rol === "user") mensajes.push({ role: "user", content: m.texto });
      else if (m.rol === "assistant")
        mensajes.push({
          role: "assistant",
          content: [
            ...(m.texto ? [{ type: "text" as const, text: m.texto }] : []),
            ...(m.llamadas ?? []).map((l) => ({
              type: "tool_use" as const,
              id: l.id,
              name: l.nombre,
              input: l.argumentos as Record<string, unknown>,
            })),
          ],
        });
      else {
        const bloque = {
          type: "tool_result" as const,
          tool_use_id: m.llamada_id,
          content: m.texto,
        };
        const previo = mensajes[mensajes.length - 1];
        if (
          previo?.role === "user" &&
          Array.isArray(previo.content) &&
          previo.content.every((b) => b.type === "tool_result")
        )
          previo.content.push(bloque);
        else mensajes.push({ role: "user", content: [bloque] });
      }
    }
    try {
      const r = await client.messages.create({
        model: this.o.model,
        max_tokens: e.max_tokens ?? 4000,
        system: e.sistema,
        messages: mensajes,
        ...(e.herramientas?.length
          ? {
              tools: e.herramientas.map((h) => ({
                name: h.nombre,
                description: h.descripcion,
                input_schema: { type: "object" as const, ...h.parametros },
              })),
              tool_choice: e.forzar
                ? { type: "tool" as const, name: e.forzar }
                : { type: "auto" as const },
            }
          : {}),
      });
      return {
        texto:
          r.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("") || null,
        llamadas: r.content
          .filter((b) => b.type === "tool_use")
          .map((b) => ({ id: b.id, nombre: b.name, argumentos: b.input })),
      };
    } catch (err) {
      const estado = (err as { status?: number })?.status;
      if (estado === 429)
        throw new ErrorProveedor(
          "limite",
          "El proveedor de IA alcanzó su límite de uso. Espera un momento y reintenta.",
          429,
        );
      throw new ErrorProveedor(
        "http",
        "El proveedor de IA no pudo completar la solicitud.",
        estado,
      );
    }
  }
}
// Guion determinista solo para pruebas. Con herramientas disponibles llama a la
// primera que no sea la forzada; con sus resultados (o sin herramientas) responde.
// Mensajes que ya fallaron una vez (error-una-vez): el reintento sí responde.
const YA_FALLO = new Set<string>();
const ARTEFACTOS_FAKE: Record<string, unknown> = {
  pregunta_socratica: {
    tipo: "pregunta_socratica",
    texto: "¿Sobre qué cantidad se calcula la baja?",
    respuestas_rapidas: ["Sobre 100", "Sobre 120"],
  },
  contraste: {
    tipo: "contraste",
    tuyo: ["se cancelan"],
    correcto: ["100 × 1,20 × 0,80 = 96"],
  },
  razonamiento_anotado: {
    tipo: "razonamiento_anotado",
    pasos: [
      { texto: "Asumes que se anulan", estado: "revisar", cita: "se cancelan" },
    ],
  },
  prediccion: {
    tipo: "prediccion",
    pregunta: "¿Qué pasará con el precio final?",
    plantilla: "porcentaje_encadenado",
    semilla: 3,
  },
  ejemplo_paso_a_paso: {
    tipo: "ejemplo_paso_a_paso",
    pasos: [
      { texto: "Calcula el aumento", cuenta: "100 × 20% = 20" },
      {
        texto: "Calcula la baja sobre la nueva base",
        cuenta: "120 × 20% = 24",
      },
    ],
  },
  visual_cadena: {
    tipo: "visual",
    forma: "cadena_porcentual",
    pasos: [
      { valor: 100 },
      { op: "+20%", valor: 120 },
      { op: "-20%", valor: 96 },
    ],
  },
  visual_barra: {
    tipo: "visual",
    forma: "barra_de_partes",
    total: 24,
    partes: 8,
    marcadas: 3,
    fraccion: "3/8",
  },
  visual_tabla: {
    tipo: "visual",
    forma: "tabla_proporcion",
    columnas: ["Máquinas", "Horas"],
    filas: [
      [3, 12],
      [6, 6],
    ],
    relacion: "inversa",
  },
  visual_recta: {
    tipo: "visual",
    forma: "recta_numerica",
    min: 0,
    max: 10,
    puntos: [{ valor: 5, etiqueta: "mitad" }],
  },
  practica: {
    tipo: "practica",
    plantilla: "porcentaje_encadenado",
    semilla: 5,
    historia: "Una tienda ajusta sus precios.",
  },
  en_tus_palabras: {
    tipo: "en_tus_palabras",
    consigna: "Explica con tus palabras por qué cambia la base",
  },
  invitacion_comprobar: {
    tipo: "invitacion_comprobar",
    texto: "Cuando quieras, puedes hacer una comprobación sin ayudas.",
  },
};
// Turno de prueba para un artefacto: bloque, o las cinco operaciones de grafo con referencias temporales.
function artefactoFake(tipo: string, fragmento?: string) {
  if (tipo === "ops_completas")
    return {
      mensaje: "Ordeno tu mapa.",
      grafo_ops: [
        {
          op: "crear_nodo",
          ref_temporal: "f1",
          tipo: "ejemplo",
          titulo: "Ejemplo A",
          resumen: "A",
        },
        {
          op: "crear_nodo",
          ref_temporal: "f2",
          tipo: "ejemplo",
          titulo: "Ejemplo B",
          resumen: "B",
        },
        { op: "relacionar", origen: "f2", destino: "f1", tipo: "relacionado" },
        { op: "editar_nodo", nodo: "f1", resumen: "A editado" },
        { op: "fusionar", nodos: ["f1", "f2"], en: "f1" },
        { op: "enfocar", nodo: "f1" },
      ],
    };
  const bloque =
    tipo === "cita" && fragmento
      ? { tipo: "cita", fragmento_id: fragmento }
      : ARTEFACTOS_FAKE[tipo];
  return bloque ? { mensaje: `Bloque ${tipo}`, bloques: [bloque] } : null;
}
// Marcadores en el mensaje del estudiante eligen el comportamiento a probar.
export class ProveedorFake implements ProveedorIA {
  async completar(e: EntradaIA): Promise<RespuestaIA> {
    const usuarios = e.mensajes.flatMap((m) =>
      m.rol === "user" ? [m.texto] : [],
    );
    const reparando =
      usuarios[usuarios.length - 1]?.startsWith("ERROR_DE_FORMA");
    const original =
      [...usuarios].reverse().find((t) => !t.startsWith("ERROR_DE_FORMA")) ??
      "";
    const ultimo = e.mensajes[e.mensajes.length - 1];
    const nombres = (e.herramientas ?? [])
      .map((h) => h.nombre)
      .filter((n) => n !== "responder");
    const resultados = e.mensajes.flatMap((m) => (m.rol === "tool" ? [m] : []));
    const final = (turno: Record<string, unknown>): RespuestaIA => ({
      texto: JSON.stringify({ bloques: [], grafo_ops: [], ...turno }),
      llamadas: [],
    });
    const llamar = (nombre: string, n = 1): RespuestaIA => ({
      texto: null,
      llamadas: Array.from({ length: n }, (_, i) => ({
        id: `fake-${i + 1}`,
        nombre,
        argumentos: {},
      })),
    });
    // Lectura provisional: cita lo que el estudiante escribió; los marcadores fuerzan casos.
    if (e.forzar === "lectura") {
      const { respuesta } = JSON.parse(original) as { respuesta: string };
      const cancela = respuesta.includes("se cancelan");
      const lectura = {
        ideas_detectadas: cancela ? ["cambio-de-base"] : [],
        posible_confusion: cancela ? "cambio-de-base" : null,
        cita_del_estudiante: respuesta.includes("[[cita-inventada]]")
          ? "una frase que nunca escribió"
          : cancela
            ? "se cancelan"
            : respuesta.slice(0, 300),
        confianza: "media",
      };
      return {
        texto: null,
        llamadas: [{ id: "fake-1", nombre: "lectura", argumentos: lectura }],
      };
    }
    const tiene = (marca: string) => original.includes(`[[${marca}]]`);
    // Un artefacto por marcador [[b:tipo]] (cita: [[b:cita:uuid]]); el texto del estudiante aporta las citas literales.
    const marca = /\[\[b:([a-z_]+)(?::([0-9a-f-]{36}))?\]\]/.exec(original);
    if (marca) {
      const turno = artefactoFake(marca[1], marca[2]);
      if (turno) return final(turno);
    }
    if (tiene("contexto"))
      return final({
        mensaje: `${e.sistema.includes('"comprobacion_activa":{"enunciado"') ? "con-enunciado" : "sin-enunciado"};clave:${/\b96\b/.test(e.sistema.split("CONTEXTO")[1] ?? "") ? "filtrada" : "oculta"}`,
      });
    // Fallos del proveedor, para probar que el turno no termina en un error interno.
    if (tiene("error-limite"))
      throw new ErrorProveedor(
        "limite",
        "El proveedor de IA alcanzó su límite de uso. Espera un momento y reintenta.",
        429,
      );
    if (tiene("error-red"))
      throw new ErrorProveedor(
        "red",
        "No se pudo contactar al proveedor de IA.",
      );
    if (tiene("error-una-vez") && !YA_FALLO.has(original)) {
      YA_FALLO.add(original);
      throw new ErrorProveedor(
        "timeout",
        "El proveedor de IA tardó demasiado en responder.",
      );
    }
    if (tiene("sin-forma")) return { texto: "esto no es json", llamadas: [] };
    if (tiene("reparable"))
      return reparando
        ? final({ mensaje: "Respuesta reparada." })
        : { texto: JSON.stringify({ bloques: [] }), llamadas: [] };
    if (tiene("herramientas"))
      return final({ mensaje: `Herramientas: ${nombres.join(",")}` });
    if (tiene("cuatro"))
      return resultados.length
        ? final({
            mensaje: `Ejecutadas: ${resultados.filter((r) => !r.texto.includes("límite")).length}`,
          })
        : llamar("leer_grafo", 6);
    if (tiene("bloques"))
      return final({
        mensaje: "Probemos con una cuenta.",
        bloques: [
          { tipo: "holograma" },
          {
            tipo: "visual",
            forma: "cadena_porcentual",
            pasos: [
              { valor: 100 },
              { op: "+20%", valor: 120 },
              { op: "-20%", valor: 100 },
            ],
          },
          { tipo: "en_tus_palabras", consigna: "Explícalo con tus palabras" },
        ],
      });
    if (tiene("ops"))
      return final({
        mensaje: "Agrego lo que vimos a tu mapa.",
        grafo_ops: [
          {
            op: "crear_nodo",
            ref_temporal: "e",
            tipo: "error",
            titulo: "Pensar que +20% y -20% se anulan",
            resumen: "Tratar los dos porcentajes como si usaran la misma base",
            idea_clave: "cambio-de-base",
          },
          {
            op: "crear_nodo",
            ref_temporal: "i",
            tipo: "idea",
            titulo: "Cada porcentaje tiene su base",
            resumen: "Tras un cambio la base ya no es la inicial",
            idea_clave: "cambio-de-base",
            padre: "e",
          },
          {
            op: "relacionar",
            origen: "e",
            destino: "i",
            tipo: "confusion_con",
          },
          { op: "enfocar", nodo: "i" },
          { op: "enfocar", nodo: "nodo-ajeno" },
        ],
      });
    if (tiene("practica")) {
      const r = resultados.find((x) => x.nombre === "generar_practica");
      if (!r && nombres.includes("generar_practica"))
        return llamar("generar_practica");
      const datos = r
        ? (JSON.parse(r.texto) as { plantilla?: string; semilla?: number })
        : {};
      return final({
        mensaje: "Probemos con un ejercicio.",
        bloques: [
          {
            tipo: "practica",
            plantilla: datos.plantilla ?? "porcentaje_encadenado",
            semilla: datos.semilla ?? 1,
            historia: "Una tienda ajusta sus precios.",
          },
        ],
      });
    }
    if (tiene("comprobar"))
      return resultados.length
        ? final({ mensaje: "Cuando quieras, lo verificamos." })
        : llamar("proponer_comprobacion");
    if (tiene("filtrar"))
      return final({ mensaje: "El resultado correcto es 96 soles." });
    const herramienta = (e.herramientas ?? []).find(
      (h) => h.nombre !== e.forzar && h.nombre !== "responder",
    );
    if (herramienta && ultimo?.rol !== "tool" && !resultados.length)
      return llamar(herramienta.nombre);
    return final({
      mensaje: "PROVEEDOR DE PRUEBAS — no es una respuesta de IA real.",
    });
  }
}
// El router guarda su estado (disyuntores y colas) en memoria: la fábrica reutiliza la misma
// instancia mientras la configuración no cambie, aunque se construya otra `Proveedores`.
const registroLog = new Logger("RouterIA");
let routerActivo: { huella: string; router: RouterIA } | null = null;
export const olvidarRouters = () => {
  routerActivo = null;
};
function routerDeConfiguracion(c: Settings): RouterIA {
  const cadena = parsearCadena(c.AI_CADENA);
  if (!cadena.ok) throw new Error(cadena.error);
  const sinHerramientas = new Set(listaDeIds(c.AI_SIN_HERRAMIENTAS));
  const huella = JSON.stringify([
    cadena.destinos.map((d) => d.id),
    [...sinHerramientas],
    c.GROQ_API_KEY,
    c.CLOUDFLARE_ACCOUNT_ID,
    c.CLOUDFLARE_API_TOKEN,
    c.FOUNDRY_ENDPOINT,
    c.FOUNDRY_API_KEY,
    c.FOUNDRY_REASONING_EFFORT,
    c.AI_TIMEOUT_MS,
    c.AI_TIMEOUT_TOTAL_MS,
    c.AI_MAX_CONCURRENCIA,
    c.AI_MAX_ESPERA_COLA_MS,
    c.AI_ENFRIAMIENTO_MS,
    c.AI_FALLOS_DISYUNTOR,
  ]);
  if (routerActivo?.huella === huella) return routerActivo.router;
  const destinos: DestinoRouter[] = cadena.destinos.map((d) => ({
    proveedor: d.proveedor,
    modelo: d.modelo,
    herramientas: !sinHerramientas.has(d.id),
    adaptador:
      d.proveedor === "cloudflare"
        ? new ProveedorCloudflare({
            accountId: c.CLOUDFLARE_ACCOUNT_ID!,
            apiToken: c.CLOUDFLARE_API_TOKEN!,
            model: d.modelo,
            timeoutMs: c.AI_TIMEOUT_MS,
          })
        : d.proveedor === "foundry"
          ? new ProveedorFoundry({
              endpoint: c.FOUNDRY_ENDPOINT!,
              apiKey: c.FOUNDRY_API_KEY!,
              model: d.modelo,
              timeoutMs: c.AI_TIMEOUT_MS,
              esfuerzo: c.FOUNDRY_REASONING_EFFORT,
            })
          : new ProveedorGroq({
              apiKey: c.GROQ_API_KEY!,
              model: d.modelo,
              timeoutMs: c.AI_TIMEOUT_MS,
            }),
  }));
  const router = new RouterIA({
    destinos,
    timeoutLlamadaMs: c.AI_TIMEOUT_MS,
    timeoutTotalMs: c.AI_TIMEOUT_TOTAL_MS,
    maxConcurrencia: c.AI_MAX_CONCURRENCIA,
    maxEsperaColaMs: c.AI_MAX_ESPERA_COLA_MS,
    enfriamientoMs: c.AI_ENFRIAMIENTO_MS,
    fallosParaAbrir: c.AI_FALLOS_DISYUNTOR,
    log: (nivel, evento) =>
      registroLog[nivel === "info" ? "log" : nivel](JSON.stringify(evento)),
  });
  routerActivo = { huella, router };
  return router;
}
@Injectable()
export class Proveedores {
  // Se lee la configuración en cada uso: el proveedor activo no se fija al arrancar.
  actual(): ProveedorIA | null {
    const c = settings();
    switch (c.AI_PROVIDER) {
      case "groq":
        return new ProveedorGroq({ apiKey: c.AI_API_KEY!, model: c.AI_MODEL! });
      case "anthropic":
        return new ProveedorAnthropic({
          apiKey: c.AI_API_KEY!,
          model: c.AI_MODEL!,
        });
      case "router":
        return routerDeConfiguracion(c);
      case "fake":
        return new ProveedorFake();
      default:
        return null;
    }
  }
  // Estado de los destinos del router para /salud; null si no se usa el router.
  estadoRouter(): EstadoDestino[] | null {
    const c = settings();
    return c.AI_PROVIDER === "router"
      ? routerDeConfiguracion(c).estado()
      : null;
  }
}
