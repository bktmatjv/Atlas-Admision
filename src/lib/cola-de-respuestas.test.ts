import { describe, expect, it } from "vitest";
import { crearCola } from "./cola-de-respuestas";

type P = { pregunta_id: string; valor: string | null };

const almacen = () => {
  const datos = new Map<string, string>();
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => { datos.set(k, v); },
    removeItem: (k: string) => { datos.delete(k); },
    claves: () => [...datos.keys()],
  };
};

describe("crearCola", () => {
  const cola = crearCola<P>("prueba-cola:");

  it("la última respuesta de cada pregunta gana", () => {
    const c = cola.encolar(cola.encolar([], { pregunta_id: "a", valor: "1" }), { pregunta_id: "a", valor: "2" });
    expect(c).toEqual([{ pregunta_id: "a", valor: "2" }]);
  });

  it("solo quita lo guardado si no cambió entretanto", () => {
    const c: P[] = [{ pregunta_id: "a", valor: "2" }, { pregunta_id: "b", valor: "x" }];
    expect(cola.quitar(c, [{ pregunta_id: "a", valor: "1" }, { pregunta_id: "b", valor: "x" }])).toEqual([{ pregunta_id: "a", valor: "2" }]);
  });

  it("guarda y lee bajo su prefijo, y borra la clave cuando se vacía", () => {
    const a = almacen();
    cola.escribir(a, "i1", [{ pregunta_id: "a", valor: "1" }]);
    expect(a.claves()).toEqual(["prueba-cola:i1"]);
    expect(cola.leer(a, "i1")).toEqual([{ pregunta_id: "a", valor: "1" }]);
    cola.escribir(a, "i1", []);
    expect(a.claves()).toEqual([]);
  });

  it("dos prefijos no se mezclan", () => {
    const a = almacen();
    const otra = crearCola<P>("otra-cola:");
    cola.escribir(a, "i1", [{ pregunta_id: "a", valor: "1" }]);
    expect(otra.leer(a, "i1")).toEqual([]);
  });

  it("un almacén roto o un JSON roto no rompen la pantalla", () => {
    const roto = { getItem: () => "{no es json", setItem: () => { throw new Error("lleno"); }, removeItem: () => {} };
    expect(cola.leer(roto, "i1")).toEqual([]);
    expect(() => cola.escribir(roto, "i1", [{ pregunta_id: "a", valor: "1" }])).not.toThrow();
  });
});
