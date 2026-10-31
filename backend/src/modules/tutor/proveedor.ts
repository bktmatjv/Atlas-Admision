import Anthropic from "@anthropic-ai/sdk";
import { Injectable } from "@nestjs/common";
import { settings } from "../../config.js";
// Interfaz propia del backend: el ciclo del tutor no conoce a ningún proveedor concreto.
export type JsonSchema = Record<string, unknown>;
export type HerramientaIA = {
  nombre: string;
  descripcion: string;
  parametros: JsonSchema;
};
export type LlamadaIA = { id: string; nombre: string; argumentos: unknown };
export type MensajeIA =
  | { rol: "user"; texto: string }
  | { rol: "assistant"; texto: string | null; llamadas?: LlamadaIA[] }
  | { rol: "tool"; llamada_id: string; nombre: string; texto: string };
export type EntradaIA = {
  sistema: string;
  mensajes: MensajeIA[];
  herramientas?: HerramientaIA[];
  // Obliga al modelo a responder llamando a esta herramienta (salida estructurada).
  forzar?: string;
  max_tokens?: number;
  // Pide una respuesta de texto en formato JSON (sin herramientas).
  json?: boolean;
};
export type RespuestaIA = { texto: string | null; llamadas: LlamadaIA[] };
export interface ProveedorIA {
  completar(entrada: EntradaIA): Promise<RespuestaIA>;
}
export type CodigoErrorProveedor =
  "limite" | "timeout" | "http" | "respuesta_invalida" | "red";
// Error explícito y comprensible: nunca se sustituye por una respuesta inventada.
export class ErrorProveedor extends Error {
  constructor(
    readonly codigo: CodigoErrorProveedor,
    mensaje: string,
    readonly estado?: number,
  ) {
    super(mensaje);
    this.name = "ErrorProveedor";
  }
}
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
export class ProveedorGroq implements ProveedorIA {
  constructor(private o: OpcionesGroq) {}
  async completar(e: EntradaIA): Promise<RespuestaIA> {
    const cuerpo: Record<string, unknown> = {
      model: this.o.model,
      messages: aMensajesOpenAI(e),
      max_tokens: e.max_tokens ?? 4000,
      temperature: 0.3,
    };
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
    if (e.json && !e.herramientas?.length)
      cuerpo.response_format = { type: "json_object" };
    let respuesta: Response;
    try {
      respuesta = await (this.o.fetch ?? fetch)(this.o.url ?? GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.o.apiKey}`,
        },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(this.o.timeoutMs ?? TIMEOUT_LLAMADA_MS),
      });
    } catch (err) {
      const nombre = err instanceof Error ? err.name : "";
      if (nombre === "TimeoutError" || nombre === "AbortError")
        throw new ErrorProveedor(
          "timeout",
          "El proveedor de IA tardó demasiado en responder.",
        );
      throw new ErrorProveedor(
        "red",
        "No se pudo contactar al proveedor de IA.",
      );
    }
    if (respuesta.status === 429)
      throw new ErrorProveedor(
        "limite",
        "El proveedor de IA alcanzó su límite de uso. Espera un momento y reintenta.",
        429,
      );
    if (!respuesta.ok)
      throw new ErrorProveedor(
        "http",
        `El proveedor de IA respondió con error HTTP ${respuesta.status}.`,
        respuesta.status,
      );
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
  return {
    texto: typeof msg.content === "string" ? msg.content : null,
    llamadas,
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
export class ProveedorFake implements ProveedorIA {
  async completar(e: EntradaIA): Promise<RespuestaIA> {
    const ultimo = e.mensajes[e.mensajes.length - 1];
    const herramienta = e.herramientas?.find((h) => h.nombre !== e.forzar);
    if (herramienta && ultimo?.rol !== "tool")
      return {
        texto: null,
        llamadas: [
          { id: "fake-1", nombre: herramienta.nombre, argumentos: {} },
        ],
      };
    return {
      texto: JSON.stringify({
        mensaje: "PROVEEDOR DE PRUEBAS — no es una respuesta de IA real.",
        bloques: [],
        grafo_ops: [],
      }),
      llamadas: [],
    };
  }
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
      case "fake":
        return new ProveedorFake();
      default:
        return null;
    }
  }
}
