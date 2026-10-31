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
    | { tipo: "cita"; fragmento_id: string }
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
