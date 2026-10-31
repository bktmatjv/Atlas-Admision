/**
 * «Foto del problema → resolver», del lado de la app: leer lo que devuelve `resolver-problema`
 * y llevar el recorrido guiado.
 *
 * El recorrido es la regla del proyecto: el alumno trabaja y Atlas guía. Primero la pista y una
 * pregunta para que dé él el primer paso (si escribe una cuenta, se comprueba aquí, sin red y
 * sin decirle la respuesta); después los pasos de uno en uno, y al final el resultado y los
 * parecidos. «Ver la solución completa» existe porque esconderla del todo solo empuja a
 * buscarla en otro sitio, pero no es lo primero que se ofrece.
 */
import { comprobarCuenta } from "./numerica";
import { validarGrafica, type Grafica } from "./grafica";

// ─── La respuesta del servidor ──────────────────────────────────────────────────────────────

export type Comprobado = "cuadra" | "sin_numeros" | "no_cuadra";

export interface CitaDelPaso {
  material_id: string;
  archivo: string;
  pagina: number | null;
}

export interface PasoDeSolucion {
  /** LaTeX sin `$`. */
  cuenta: string;
  porque: string;
  comprobado: Comprobado;
  cita: CitaDelPaso | null;
}

export type OrigenDelParecido = "material" | "admision";

export interface Parecido {
  origen: OrigenDelParecido;
  id: string;
  enunciado: string;
}

export interface Resolucion {
  problemaId: string | null;
  enunciado: string;
  area: string | null;
  figura: Grafica | null;
  pista: string;
  primeraPregunta: string;
  pasos: PasoDeSolucion[];
  resultado: string;
  todasCuadran: boolean;
  cuentasComprobadas: number;
  tema: { id: string; title: string } | null;
  parecidos: Parecido[];
}

export type MotivoDeFallo = "ilegible" | "no_es_problema" | "sin_solucion" | "respuesta_rara";

export type RespuestaLeida = { ok: true; resolucion: Resolucion } | { ok: false; motivo: MotivoDeFallo; mensaje: string };

const MENSAJE_DE: Record<MotivoDeFallo, string> = {
  ilegible: "No he podido leer el problema. Prueba con una foto más nítida y recta.",
  no_es_problema: "No veo un problema en la foto. Encuadra solo el enunciado.",
  sin_solucion: "No he conseguido resolverlo. Vuelve a intentarlo.",
  respuesta_rara: "La respuesta llegó incompleta. Vuelve a intentarlo.",
};

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const texto = (v: unknown): string => (typeof v === "string" ? v : "");

function leerCita(v: unknown): CitaDelPaso | null {
  if (!esObjeto(v)) return null;
  const archivo = texto(v.archivo).trim();
  const material_id = texto(v.material_id);
  if (!archivo || !material_id) return null;
  const pagina = typeof v.pagina === "number" && Number.isFinite(v.pagina) ? v.pagina : null;
  return { material_id, archivo, pagina };
}

function leerPaso(v: unknown): PasoDeSolucion | null {
  if (!esObjeto(v) || typeof v.cuenta !== "string" || !v.cuenta.trim()) return null;
  const comprobado: Comprobado = v.comprobado === "cuadra" || v.comprobado === "no_cuadra" ? v.comprobado : "sin_numeros";
  return { cuenta: v.cuenta.trim(), porque: texto(v.porque).trim(), comprobado, cita: leerCita(v.cita) };
}

function leerParecido(v: unknown): Parecido | null {
  if (!esObjeto(v)) return null;
  if (v.origen !== "material" && v.origen !== "admision") return null;
  const id = texto(v.id);
  const enunciado = texto(v.enunciado).trim();
  return id && enunciado ? { origen: v.origen, id, enunciado } : null;
}

/** Valida la forma de lo que devuelve `resolver-problema`. Lo roto se tira; sin lo esencial, es un fallo. */
export function leerRespuesta(data: unknown): RespuestaLeida {
  if (!esObjeto(data)) return { ok: false, motivo: "respuesta_rara", mensaje: MENSAJE_DE.respuesta_rara };
  if (data.ok === false) {
    const motivo: MotivoDeFallo =
      data.reason === "ilegible" || data.reason === "no_es_problema" || data.reason === "sin_solucion" ? data.reason : "respuesta_rara";
    const mensaje = texto(data.message).trim() || MENSAJE_DE[motivo];
    return { ok: false, motivo, mensaje };
  }
  const enunciado = texto(data.enunciado).trim();
  if (data.ok !== true || !enunciado || !Array.isArray(data.pasos)) {
    return { ok: false, motivo: "respuesta_rara", mensaje: MENSAJE_DE.respuesta_rara };
  }
  const pasos = data.pasos.map(leerPaso).filter((p): p is PasoDeSolucion => p !== null);
  const parecidos = (Array.isArray(data.parecidos) ? data.parecidos : [])
    .map(leerParecido)
    .filter((p): p is Parecido => p !== null);
  const tema =
    esObjeto(data.tema) && typeof data.tema.id === "string" && typeof data.tema.title === "string"
      ? { id: data.tema.id, title: data.tema.title }
      : null;
  return {
    ok: true,
    resolucion: {
      problemaId: typeof data.problemaId === "string" ? data.problemaId : null,
      enunciado,
      area: typeof data.area === "string" ? data.area : null,
      figura: data.figura ? validarGrafica(data.figura).grafica : null,
      pista: texto(data.pista).trim(),
      primeraPregunta: texto(data.primeraPregunta).trim(),
      pasos,
      resultado: texto(data.resultado).trim(),
      todasCuadran: typeof data.todasCuadran === "boolean" ? data.todasCuadran : pasos.every((p) => p.comprobado !== "no_cuadra"),
      cuentasComprobadas: typeof data.cuentasComprobadas === "number" ? data.cuentasComprobadas : 0,
      tema,
      parecidos,
    },
  };
}

// ─── El recorrido guiado ────────────────────────────────────────────────────────────────────

export type Fase = "pista" | "pasos" | "final";
export type Veredicto = "cuadra" | "revisa" | "sin_numeros" | "sin_igualdad";

export interface EstadoDeResolucion {
  fase: Fase;
  /** Cuántos pasos están a la vista. */
  vistos: number;
  total: number;
  /** Lo que escribió el alumno como primer paso. */
  intento: string;
  veredicto: Veredicto | null;
}

export type AccionDeResolucion =
  | { tipo: "escribir"; texto: string }
  | { tipo: "comprobar" }
  | { tipo: "siguiente" }
  | { tipo: "todo" }
  | { tipo: "reiniciar"; total: number };

export const ESTADO_INICIAL: EstadoDeResolucion = { fase: "pista", vistos: 0, total: 0, intento: "", veredicto: null };

export const estadoInicial = (total: number): EstadoDeResolucion => ({ ...ESTADO_INICIAL, total });

export function avanzarResolucion(e: EstadoDeResolucion, a: AccionDeResolucion): EstadoDeResolucion {
  switch (a.tipo) {
    case "escribir":
      return { ...e, intento: a.texto, veredicto: null };
    case "comprobar":
      return { ...e, veredicto: comprobarMiPaso(e.intento).veredicto };
    case "siguiente":
      if (e.fase === "final") return e;
      if (e.vistos >= e.total) return { ...e, fase: "final", vistos: e.total };
      return { ...e, fase: "pasos", vistos: e.vistos + 1 };
    case "todo":
      return { ...e, fase: "final", vistos: e.total };
    case "reiniciar":
      return estadoInicial(a.total);
  }
}

/** El rótulo del botón que avanza: dice qué se va a ver, no «Siguiente». */
export function textoDelSiguiente(e: EstadoDeResolucion): string {
  if (e.vistos >= e.total) return "Ver el resultado";
  return e.vistos === 0 ? "Ver el primer paso" : "Ver el siguiente paso";
}

const FRASE: Record<Veredicto, string> = {
  cuadra: "Esa cuenta cuadra. Sigue desde ahí y compárala con el primer paso.",
  revisa: "Revisa esa cuenta: rehaz la operación con calma antes de seguir.",
  sin_numeros: "Ahí no hay números que comprobar. Pon los valores del problema en tu cuenta.",
  sin_igualdad: "Escribe tu paso como una cuenta con «=», por ejemplo 2 · 10 = 20.",
};

/**
 * Comprueba lo que el alumno escribió como primer paso: cada línea con una igualdad se evalúa
 * con `comprobarCuenta`, la misma del servidor. Basta una que no cuadre para pedir revisar.
 * Nunca dice cuál es el resultado bueno: solo si su cuenta es coherente consigo misma.
 */
export function comprobarMiPaso(escrito: string): { veredicto: Veredicto; mensaje: string } {
  const lineas = escrito.split(/\n+/).filter((l) => /=|\\approx|≈/.test(l));
  let veredicto: Veredicto = lineas.length === 0 ? "sin_igualdad" : "sin_numeros";
  for (const linea of lineas) {
    let estado: Comprobado;
    try {
      estado = comprobarCuenta(linea).estado;
    } catch {
      estado = "sin_numeros";
    }
    if (estado === "no_cuadra") {
      veredicto = "revisa";
      break;
    }
    if (estado === "cuadra") veredicto = "cuadra";
  }
  return { veredicto, mensaje: FRASE[veredicto] };
}

export const fraseDelVeredicto = (v: Veredicto): string => FRASE[v];

// ─── Ayudas ─────────────────────────────────────────────────────────────────────────────────

/** Dónde se sube la foto: la carpeta del alumno en el bucket `problemas` (la RLS lo exige). */
export function rutaDeLaFoto(userId: string, id: string = crypto.randomUUID()): string {
  return `${userId}/${id}.jpg`;
}

export type EntradaDeResolucion =
  | { tipo: "foto"; fotoPath: string }
  | { tipo: "admision"; id: string }
  | { tipo: "texto"; enunciado: string };

export function cuerpoDeResolucion(entrada: EntradaDeResolucion, classId?: string | null): Record<string, string> {
  const cuerpo: Record<string, string> =
    entrada.tipo === "foto"
      ? { fotoPath: entrada.fotoPath }
      : entrada.tipo === "admision"
        ? { admisionPreguntaId: entrada.id }
        : { enunciado: entrada.enunciado.trim() };
  if (classId) cuerpo.classId = classId;
  return cuerpo;
}

export const LADO_MAXIMO_DE_LA_FOTO = 1600;

/** Las medidas de la foto comprimida: el lado mayor a 1600 px como mucho, sin deformar. */
export function medidasReducidas(ancho: number, alto: number, maximo = LADO_MAXIMO_DE_LA_FOTO): { ancho: number; alto: number } {
  const escala = Math.min(1, maximo / Math.max(ancho, alto));
  return { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) };
}

export function textoDeCita(cita: CitaDelPaso): string {
  return `De tu material: ${cita.archivo}${cita.pagina !== null ? ` · pág. ${cita.pagina}` : ""}`;
}

export const rotuloDeOrigen = (origen: OrigenDelParecido): string => (origen === "material" ? "De tu material" : "Admisión San Marcos");

/** Los cursos de admisión que se resuelven con cuentas: a esos se les ofrece «Resolver paso a paso». */
const CURSOS_DE_CALCULO = new Set(["aritmetica", "algebra", "geometria", "trigonometria", "fisica", "quimica", "habilidad-logico-matematica"]);

export const esCursoDeCalculo = (curso: string | null | undefined): boolean => !!curso && CURSOS_DE_CALCULO.has(curso);
