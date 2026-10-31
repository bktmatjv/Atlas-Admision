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
