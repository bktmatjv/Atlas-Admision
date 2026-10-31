import type { Bloque } from "./chat";
import type { Grafo, NodoGrafo } from "./grafo";

export type Rastro = {
  respuesta: string;
  idea_clave: string | null;
  descripcion?: string | null;
  nodo_retorno_id: string | null;
  motivo: string;
};
export type Evidencia = {
  id: string;
  tipo: string;
  arbol_id: string | null;
  comprobacion_id: string | null;
  created_at: string;
  detalle: {
    idea_clave?: string | null;
    correcta?: boolean;
    ayuda?: boolean;
    solucion?: string;
    rastro?: Rastro | null;
  };
};
export type PlanRetro = {
  origen: string;
  retorno: string;
  titulo: string;
  tramos: {
    arista: string;
    desde: string;
    hasta: string;
    inicio: number;
    duracion: number;
  }[];
  destello: number;
  llegada: number;
  total: number;
};
/** No infiere relaciones: usa confusion_con real o la ruta raíz → retorno que entrega la API.
 * Invertir ciegamente camino_error terminaría en la raíz, no en la idea del rastro. */
export function planRetropropagacion(
  g: Grafo,
  r: Rastro | null,
): PlanRetro | null {
  if (!r?.idea_clave || r.motivo === "sin_evidencia" || !g.camino_error.length)
    return null;
  const retorno = g.nodos.find(
    (n) =>
      n.id === r.nodo_retorno_id &&
      n.idea_clave === r.idea_clave &&
      n.estado === "fallo",
  );
  if (!retorno) return null;
  const confusion = g.aristas.find(
    (a) =>
      a.tipo === "confusion_con" &&
      a.destino === retorno.id &&
      g.nodos.some((n) => n.id === a.origen && n.tipo === "error"),
  );
  const camino = confusion ? [confusion.origen, retorno.id] : g.camino_error;
  if (
    camino.at(-1) !== retorno.id ||
    new Set(camino).size !== camino.length ||
    camino.some((id) => !g.nodos.some((n) => n.id === id))
  )
    return null;
  const tramos: PlanRetro["tramos"] = [];
  for (let i = 0; i < camino.length - 1; i++) {
    const desde = camino[i],
      hasta = camino[i + 1];
    const a = g.aristas.find(
      (a) =>
        (a.origen === desde && a.destino === hasta) ||
        (a.destino === desde && a.origen === hasta),
    );
    if (!a) return null;
    tramos.push({
      arista: a.id,
      desde,
      hasta,
      inicio: 400 + (i * 900) / (camino.length - 1),
      duracion: 900 / (camino.length - 1),
    });
  }
  return {
    origen: camino[0],
    retorno: retorno.id,
    titulo: retorno.titulo,
    tramos,
    destello: 400,
    llegada: 1300,
    total: 1800,
  };
}
export function ultimoFallo(evidencias: Evidencia[], arbolId: string) {
  return (
    evidencias
      .filter(
        (e) => (!arbolId || e.arbol_id === arbolId) && e.tipo === "aplicacion_por_reforzar",
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}
export function caminoComprension(n: NodoGrafo, evidencias: Evidencia[]) {
  const propias = evidencias.filter((e) => e.arbol_id === n.arbol_id);
  const correcciones = propias.filter(
    (e) =>
      e.tipo === "corrigio_tras_error" &&
      e.detalle.idea_clave === n.idea_clave &&
      n.idea_clave !== null,
  );
  const comprobado = propias.some(
    (e) =>
      e.tipo === "resolvio_sin_ayuda" &&
      e.detalle.correcta === true &&
      e.detalle.ayuda === false &&
      (!n.idea_clave ||
        correcciones.some((c) => c.comprobacion_id === e.comprobacion_id)),
  );
  const fallo = n.estado === "fallo";
  return [
    {
      texto: "Exploraste",
      hecho: n.estado === "explorado",
      disponible: true,
      nota: "Interacción del estudiante registrada por el sistema. Leer no demuestra comprensión.",
    },
    {
      texto: "Lo explicaste",
      hecho: false,
      disponible: false,
      nota: "La API no expone el historial de respuestas a «En tus palabras» ni sus lecturas aceptadas.",
    },
    {
      texto: "Practicaste",
      hecho: false,
      disponible: false,
      nota: "La API no expone el historial de prácticas y predicciones respondidas. No se infiere de los mensajes.",
    },
    {
      texto: "Lo comprobaste solo",
      hecho: !fallo && comprobado,
      disponible: true,
      nota: "Resultado correcto sin ayudas de CALIBRA; no detectamos ayuda externa.",
    },
    {
      texto: "Lo aplicaste",
      hecho: !fallo && n.estado === "aplicado" && correcciones.length > 0,
      disponible: true,
      nota: "Evidencia del sistema: corrigió un fallo con una comprobación nueva sin ayuda.",
    },
  ];
}
export function momentoComprension(n: NodoGrafo, evidencias: Evidencia[]) {
  if (n.estado !== "aplicado" || !n.idea_clave) return null;
  const propias = evidencias.filter((e) => e.arbol_id === n.arbol_id);
  const correccion = propias
    .filter(
      (e) =>
        e.tipo === "corrigio_tras_error" &&
        e.detalle.idea_clave === n.idea_clave,
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!correccion) return null;
  const ahora = propias.find(
    (e) =>
      e.comprobacion_id === correccion.comprobacion_id &&
      e.tipo === "resolvio_sin_ayuda" &&
      e.detalle.correcta === true &&
      e.detalle.ayuda === false &&
      e.detalle.solucion,
  );
  const antes = propias
    .filter(
      (e) =>
        e.tipo === "aplicacion_por_reforzar" &&
        e.detalle.rastro?.idea_clave === n.idea_clave &&
        e.created_at < correccion.created_at,
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!antes?.detalle.rastro?.respuesta || !ahora?.detalle.solucion)
    return null;
  return {
    id: correccion.id,
    antes: antes.detalle.rastro.respuesta,
    ahora: ahora.detalle.solucion,
    titulo: n.titulo,
  };
}
export const ETIQUETAS_PASOS: Record<string, string> = {
  leer_grafo: "Revisé tu mapa de comprensión",
  leer_rastro: "Encontré dónde se rompió tu razonamiento",
  leer_evidencias: "Revisé lo que ya resolviste",
  leer_intento: "Miré tu respuesta",
  generar_practica: "Preparé una práctica verificada por CALIBRA",
  proponer_comprobacion: "Preparé una comprobación",
};
export const etiquetasPasos = (pasos: string[] = []) =>
  pasos.map((p) => ETIQUETAS_PASOS[p] ?? `Herramienta utilizada: ${p}`);
export const esArtefactoGrande = (b: Bloque) =>
  [
    "visual",
    "ejemplo_paso_a_paso",
    "contraste",
    "razonamiento_anotado",
  ].includes(b.tipo);
export const limitarAnchoPanel = (n: number) =>
  Math.min(68, Math.max(30, Number.isFinite(n) ? n : 44));
