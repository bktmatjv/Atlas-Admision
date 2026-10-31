import { describe, it, expect } from "vitest";
import {
  ACTIVIDADES,
  IDEAS_CLAVE,
  clavesDe,
  esClaveDe,
  buscarError,
} from "../src/modules/seguimiento/actividades";
const esperadas = {
  porcentajes: ["base-del-porcentaje", "cambio-de-base"],
  proporciones: ["directa-vs-inversa", "valor-unitario"],
  fracciones: ["parte-vs-complemento", "fraccion-de-cantidad"],
};
describe("catálogo de ideas clave", () => {
  it("define las 6 claves de los 3 conceptos con descripción", () => {
    for (const [concepto, claves] of Object.entries(esperadas))
      expect(clavesDe(concepto).map((i) => i.clave)).toEqual(claves);
    expect(IDEAS_CLAVE).toHaveLength(6);
    for (const i of IDEAS_CLAVE) {
      expect(i.descripcion.length).toBeGreaterThan(10);
      expect(i.concepto).toBeTruthy();
    }
  });
  it("no devuelve claves para conceptos desconocidos o nulos", () => {
    expect(clavesDe(null)).toEqual([]);
    expect(clavesDe("geometria")).toEqual([]);
    expect(esClaveDe("porcentajes", "valor-unitario")).toBe(false);
    expect(esClaveDe("porcentajes", "cambio-de-base")).toBe(true);
    expect(esClaveDe(null, "cambio-de-base")).toBe(false);
  });
});
describe("mapa de errores de las actividades", () => {
  it("cubre los casos mínimos con la idea esperada", () => {
    const esperado = [
      ["porcentajes-1", 100, "cambio-de-base"],
      ["porcentajes-2", 190, "cambio-de-base"],
      ["porcentajes-3", 20, "base-del-porcentaje"],
      ["proporciones-1", 24, "directa-vs-inversa"],
      ["fracciones-1", 9, "parte-vs-complemento"],
      ["fracciones-2", 600, "parte-vs-complemento"],
    ] as const;
    for (const [id, respuesta, clave] of esperado) {
      const a = ACTIVIDADES.find((x) => x.id === id)!;
      expect(buscarError(a, respuesta)?.idea_clave, id).toBe(clave);
    }
  });
  it("cada idea existe en el catálogo del mismo concepto y nunca coincide con la correcta", () => {
    for (const a of ACTIVIDADES) {
      for (const e of a.errores) {
        expect(esClaveDe(a.concepto, e.idea_clave), a.id).toBe(true);
        expect(e.respuesta, a.id).not.toBe(a.respuesta);
        expect(e.explicacion.length, a.id).toBeGreaterThan(10);
        expect(e.pista.length, a.id).toBeGreaterThan(10);
      }
      const respuestas = a.errores.map((e) => e.respuesta);
      expect(new Set(respuestas).size, a.id).toBe(respuestas.length);
    }
  });
  it("una respuesta fuera del mapa no se adivina", () => {
    const a = ACTIVIDADES.find((x) => x.id === "porcentajes-1")!;
    expect(buscarError(a, 7)).toBeUndefined();
    expect(buscarError(a, Number.NaN)).toBeUndefined();
  });
});
