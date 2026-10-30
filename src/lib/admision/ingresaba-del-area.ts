/**
 * Qué intento cuenta para «¿Ingresaba?». Con escuela elegida, solo los de su área: un simulacro del Área A
 * no dice nada de Derecho (Área E). Si no hay ninguno de su área, en vez del veredicto, el siguiente paso.
 * Sin escuela, cualquiera (la portada, además, no pinta «¿Ingresaba?» sin escuela).
 *
 * La regla es `intentoValidoParaIngresaba`, y la usan los tres sitios: la portada, el intento corregido
 * (`Ingresaba`) y «Tu progreso».
 */
import type { AreaExamen } from "@/lib/admision/motor/admision-molde";
import { puntajeParaIngresaba, type IntentoParaIngresaba } from "./diagnostico";

export interface IntentoConArea extends IntentoParaIngresaba {
  area: AreaExamen;
  created_at: string;
}

export type IngresabaDelArea =
  | { tipo: "veredicto"; puntaje: number; aviso: string | null; fecha: string; area: AreaExamen }
  | { tipo: "falta-area"; area: AreaExamen; texto: string };

const NOMBRE: Record<AreaExamen, string> = {
  A: "del Área A", B: "del Área B", C: "del Área C", D: "del Área D", E: "del Área E", medicina: "de Medicina Humana",
};

/** ¿Se puede comparar este intento con su escuela? Solo si es de su área (o si aún no la eligió). */
export function intentoValidoParaIngresaba(intento: { area: string }, areaDeSuEscuela: AreaExamen | null): boolean {
  return !areaDeSuEscuela || intento.area === areaDeSuEscuela;
}

/** `intentos` va del más reciente al más antiguo, como lo trae la portada. */
export function ingresabaDelArea(intentos: IntentoConArea[], areaDeSuEscuela: AreaExamen | null, escuela = "tu escuela"): IngresabaDelArea | null {
  let algunoCompleto = false;
  for (const i of intentos) {
    const c = puntajeParaIngresaba(i, i.area);
    if (!c) continue;
    algunoCompleto = true;
    if (!intentoValidoParaIngresaba(i, areaDeSuEscuela)) continue;
    return { tipo: "veredicto", ...c, fecha: i.created_at, area: i.area };
  }
  if (!algunoCompleto || !areaDeSuEscuela) return null;
  return { tipo: "falta-area", area: areaDeSuEscuela, texto: pasoParaSuArea(areaDeSuEscuela, escuela) };
}

/** El siguiente paso cuando el intento es de otra área que la de su escuela. */
export function pasoParaSuArea(areaDeSuEscuela: AreaExamen, escuela = "tu escuela"): string {
  return `Haz un simulacro ${NOMBRE[areaDeSuEscuela]} para saber si ingresabas en ${escuela}.`;
}

/** Los intentos que se pueden comparar con su escuela (la serie de «Tu progreso» y su percentil). */
export function soloDeSuArea<T extends { area: string }>(intentos: T[], areaDeSuEscuela: AreaExamen | null): T[] {
  return intentos.filter((i) => intentoValidoParaIngresaba(i, areaDeSuEscuela));
}
