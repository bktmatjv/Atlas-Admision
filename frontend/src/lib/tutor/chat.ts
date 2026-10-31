// Contratos de /conversaciones y /bloques (los bloques los valida y enriquece el backend).
export type BloqueBase = { id: string };
export type Bloque = BloqueBase &
  (
    | {
        tipo: "pregunta_socratica";
        texto: string;
        respuestas_rapidas?: string[];
      }
    | { tipo: "contraste"; tuyo: string[]; correcto: string[] }
    | {
        tipo: "razonamiento_anotado";
        pasos: { texto: string; estado: "ok" | "revisar"; cita: string }[];
      }
    | {
        tipo: "prediccion";
        pregunta: string;
        enunciado: string;
        opciones: number[];
      }
    | {
        tipo: "practica";
        enunciado: string;
        opciones: number[];
        historia?: string;
      }
    | {
        tipo: "ejemplo_paso_a_paso";
        pasos: { texto: string; cuenta?: string }[];
      }
    | ({ tipo: "visual" } & Visual)
    | { tipo: "en_tus_palabras"; consigna: string }
    | { tipo: "invitacion_comprobar"; texto: string }
    | {
        tipo: "cita";
        fragmento_id: string;
        documento?: string;
        pagina?: number;
      }
  );
export type Visual =
  | {
      forma: "cadena_porcentual";
      pasos: { op?: string; valor: number }[];
    }
  | {
      forma: "barra_de_partes";
      total: number;
      partes: number;
      marcadas: number;
      fraccion?: string;
    }
  | {
      forma: "tabla_proporcion";
      columnas: [string, string];
      filas: [number, number][];
      relacion: "directa" | "inversa";
    }
  | {
      forma: "recta_numerica";
      min: number;
      max: number;
      puntos: { valor: number; etiqueta?: string }[];
    };
export type MensajeChat = {
  id: string;
  orden: number;
  rol: "estudiante" | "tutor";
  texto: string;
  bloques: Bloque[];
  degradado: boolean;
  descartes: number;
  pasos?: string[];
  // Mensaje que disparó el sistema (no lo escribió el estudiante) e ideas que el tutor sumó al mapa.
  evento?: string | null;
  ideas_nuevas?: number;
};
export type Conversacion = {
  id: string;
  arbol_id: string;
  mensajes: MensajeChat[];
};
export type RespuestaBloque = {
  correcta?: boolean;
  idea_clave?: string | null;
  descripcion?: string | null;
  solucion?: string | null;
  senal?: boolean;
  guardada?: boolean;
  lectura?: { cita_del_estudiante: string; confianza: string } | null;
  mensaje?: string | null;
  nota: string;
};
export type TipoBloque = Bloque["tipo"];
export const TIPOS_BLOQUE = [
  "pregunta_socratica",
  "contraste",
  "razonamiento_anotado",
  "prediccion",
  "ejemplo_paso_a_paso",
  "visual",
  "practica",
  "en_tus_palabras",
  "invitacion_comprobar",
  "cita",
] as const satisfies readonly TipoBloque[];
// Bloques que reciben una respuesta del estudiante (POST /bloques/:id/respuesta).
const CON_RESPUESTA: readonly TipoBloque[] = [
  "pregunta_socratica",
  "prediccion",
  "ejemplo_paso_a_paso",
  "practica",
  "en_tus_palabras",
];
// Las opciones numéricas se corrigen en el servidor; el texto libre vuelve a la charla.
const TEXTO_LIBRE: readonly TipoBloque[] = [
  "pregunta_socratica",
  "ejemplo_paso_a_paso",
  "en_tus_palabras",
];
export const admiteRespuesta = (t: TipoBloque) => CON_RESPUESTA.includes(t);
export const reenviaALaCharla = (t: TipoBloque) => TEXTO_LIBRE.includes(t);
export const MAX_RESPUESTA = 2000;
export const respuestaValida = (t: string) =>
  t.trim().length > 0 && t.length <= MAX_RESPUESTA;
export const textoParaEnviar = (t: string) =>
  respuestaValida(t) ? t.trim() : null;
export const formatearOpcion = (n: number) => String(n).replace(".", ",");
const TITULOS: Record<TipoBloque, string> = {
  pregunta_socratica: "Pregunta para pensar",
  contraste: "Contraste",
  razonamiento_anotado: "Tu razonamiento anotado",
  prediccion: "Predicción",
  ejemplo_paso_a_paso: "Ejemplo paso a paso",
  visual: "Visual verificado",
  practica: "Práctica",
  en_tus_palabras: "En tus palabras",
  invitacion_comprobar: "Invitación a comprobar",
  cita: "Fuente",
};
export const tituloAccesible = (t: TipoBloque) => TITULOS[t];
export const pluralizar = (n: number, uno: string, varios: string) =>
  `${n} ${n === 1 ? uno : varios}`;
type Tecla = {
  key: string;
  shiftKey: boolean;
  isComposing?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
};
// Enter envía; Shift+Enter hace salto de línea; no se envía mientras se compone con un IME.
export const teclaEnvia = (e: Tecla) =>
  e.key === "Enter" && !e.isComposing && !e.shiftKey;
