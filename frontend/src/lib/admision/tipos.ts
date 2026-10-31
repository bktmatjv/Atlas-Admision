/**
 * Los tipos del banco de admisión. Los usan el script de extracción
 * (scripts/admision) y, más adelante, la app y las edge functions.
 */
export type Letra = "A" | "B" | "C" | "D" | "E";
export const LETRAS: readonly Letra[] = ["A", "B", "C", "D", "E"];

/** Caja de un gráfico en el formato nativo de Gemini: [ymin, xmin, ymax, xmax] en 0–1000. */
export interface CajaGrafico {
  pagina: number;
  box_2d: [number, number, number, number];
  /** La visión ve una marca de agua de terceros (Lumbreras, ADUNI…) dentro de la caja. */
  marca_de_agua?: boolean;
}

/** Lo que la visión lee de una página del cuadernillo, ya fusionado por número. */
export interface PreguntaExtraida {
  numero: number;
  enunciado: string;
  opciones: Partial<Record<Letra, string>>;
  /** Etiqueta de la lectura a la que pertenece («TEXTO 1»), o null. */
  texto: string | null;
  graficos: CajaGrafico[];
  paginas: number[];
}

export interface TextoExtraido {
  etiqueta: string;
  cuerpo: string;
  /** Gráficos de la lectura (la infografía de un texto mixto): cuelgan del texto, no de una pregunta. */
  graficos?: CajaGrafico[];
}

/** Lo que la IA devuelve al analizar una pregunta. */
export interface Analisis {
  curso: string;
  tema: string;
  dificultad: 1 | 2 | 3 | 4 | 5;
  solucion: string;
  respuesta_final: Letra | null;
}

export interface PreguntaDelBanco extends PreguntaExtraida {
  clave: Letra | null;
  analisis: Analisis | null;
  /** Rutas relativas a la carpeta del examen en salida/, una por gráfico. */
  recortes: string[];
  estado: "publicada" | "descartada";
  motivos: string[];
  /** No bloquean la publicación, pero piden mano antes de enseñarla («grafico_con_marca»). */
  avisos?: string[];
}
