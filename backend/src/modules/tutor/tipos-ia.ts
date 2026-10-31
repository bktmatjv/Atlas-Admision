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
export type RespuestaIA = {
  texto: string | null;
  llamadas: LlamadaIA[];
  // Tokens informados por el proveedor, si los informa.
  uso?: { entrada: number; salida: number };
  // Solo lo fija el router: «proveedor:modelo» que respondió.
  destino?: string;
};
export type OpcionesLlamada = {
  // Sustituye el timeout propio del adaptador (el router lo acota al tiempo que le queda).
  timeoutMs?: number;
};
export interface ProveedorIA {
  completar(
    entrada: EntradaIA,
    opciones?: OpcionesLlamada,
  ): Promise<RespuestaIA>;
}
export type CodigoErrorProveedor =
  "limite" | "timeout" | "http" | "respuesta_invalida" | "red";
// Error explícito y comprensible: nunca se sustituye por una respuesta inventada.
export type DetalleError = {
  // Tiempo hasta que el proveedor admitirá de nuevo llamadas, leído de su respuesta real.
  esperaMs?: number;
  // El proveedor rechazó la solicitud por exceder el contexto del modelo.
  contextoLargo?: boolean;
};
export class ErrorProveedor extends Error {
  readonly esperaMs?: number;
  readonly contextoLargo?: boolean;
  constructor(
    readonly codigo: CodigoErrorProveedor,
    mensaje: string,
    readonly estado?: number,
    detalle: DetalleError = {},
  ) {
    super(mensaje);
    this.name = "ErrorProveedor";
    this.esperaMs = detalle.esperaMs;
    this.contextoLargo = detalle.contextoLargo;
  }
}
