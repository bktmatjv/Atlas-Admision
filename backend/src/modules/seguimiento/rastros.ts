import { ACTIVIDADES, buscarError, ideaPorClave } from "./actividades.js";
import { igualesNumeros, normalizarNumero } from "./numeros.js";
import { instanciaDesdeClave } from "./plantillas.js";
export type NivelAyuda = "pista" | "ejemplo" | "explicacion_completa";
export type RastroFila = {
  actividad_id: string;
  respuesta: string;
  idea_clave: string | null;
  nodo_retorno_id: string | null;
  nivel_ayuda: NivelAyuda;
};
export const nivelPorFallos = (previos: number): NivelAyuda =>
  previos <= 0 ? "pista" : previos === 1 ? "ejemplo" : "explicacion_completa";
// En una instancia de plantilla cada distractor ya trae su idea clave; el texto es fijo del sistema.
function errorDePlantilla(actividadId: string, num: number) {
  const i = instanciaDesdeClave(actividadId);
  const d = i?.distractores.find((x) => igualesNumeros(x.valor, num));
  const idea = d && ideaPorClave(d.idea_clave);
  return d && idea
    ? {
        idea_clave: d.idea_clave,
        explicacion: `Esa respuesta coincide con un error frecuente en este tipo de problema, ligado a esta idea: ${idea.descripcion}`,
        pista: `Revisa tu cálculo pensando en esta idea: ${idea.descripcion}`,
      }
    : undefined;
}
// Devolución determinista: sale del mapa curado de la actividad, nunca de la IA.
export function construirRastro(f: RastroFila) {
  const actividad = ACTIVIDADES.find((a) => a.id === f.actividad_id);
  const leido = normalizarNumero(f.respuesta);
  const num = leido.legible ? leido.valor : Number.NaN;
  const tipico = actividad
    ? buscarError(actividad, num)
    : errorDePlantilla(f.actividad_id, num);
  const base = {
    respuesta: f.respuesta,
    nodo_retorno_id: f.nodo_retorno_id,
    nivel_ayuda: f.nivel_ayuda,
  };
  if (!f.idea_clave || !tipico)
    return {
      ...base,
      idea_clave: null,
      descripcion: null,
      motivo: "sin_evidencia" as const,
      explicacion:
        "Con esta respuesta no hay evidencia suficiente para ubicar dónde se rompió la comprensión.",
      pista:
        "Escribe tu justificación o un paso intermedio de tu cálculo para poder orientarte mejor.",
    };
  return {
    ...base,
    idea_clave: f.idea_clave,
    descripcion: ideaPorClave(f.idea_clave)?.descripcion ?? null,
    motivo: null,
    explicacion: tipico.explicacion,
    pista: tipico.pista,
  };
}
// Ids desde la raíz hasta el nodo de retorno, calculados en el servidor.
export function caminoHasta(
  nodos: { id: string; padre_id: string | null }[],
  destino: string | null,
) {
  const camino: string[] = [];
  let actual = destino ? nodos.find((n) => n.id === destino) : undefined;
  while (actual && camino.length <= nodos.length) {
    camino.unshift(actual.id);
    const padre: string | null = actual.padre_id;
    actual = padre ? nodos.find((n) => n.id === padre) : undefined;
  }
  return camino;
}
