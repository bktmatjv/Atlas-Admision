import { describe, expect, it } from "vitest";
import {
  marcasDeRecta,
  posicionEnRecta,
  primeraDivergencia,
  tramosDeCadena,
} from "./visual";
describe("contraste: dónde se separan los razonamientos (S4)", () => {
  it("devuelve la primera línea donde difieren", () => {
    expect(primeraDivergencia(["a", "b", "c"], ["a", "x", "c"])).toBe(1);
    expect(primeraDivergencia(["a"], ["b"])).toBe(0);
  });
  it("ignora mayúsculas, espacios y tildes", () => {
    expect(primeraDivergencia(["Subió  20%"], ["subio 20%"])).toBeNull();
  });
  it("si una lista es más larga, se separan donde termina la corta", () => {
    expect(primeraDivergencia(["a"], ["a", "b"])).toBe(1);
  });
  it("sin diferencias no hay punto de separación", () => {
    expect(primeraDivergencia(["a", "b"], ["a", "b"])).toBeNull();
  });
});
describe("visual: recta numérica", () => {
  it("elige marcas cómodas dentro del rango", () => {
    expect(marcasDeRecta(0, 10)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(marcasDeRecta(0, 1)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(marcasDeRecta(0, 100)).toEqual([0, 20, 40, 60, 80, 100]);
  });
  it("nunca devuelve marcas fuera del rango ni demasiadas", () => {
    for (const [a, b] of [
      [-5, 5],
      [3, 47],
      [0, 0.5],
      [100, 900],
    ] as const) {
      const m = marcasDeRecta(a, b);
      expect(m.every((x) => x >= a && x <= b)).toBe(true);
      expect(m.length).toBeLessThanOrEqual(8);
      expect(m.length).toBeGreaterThan(1);
    }
  });
  it("posiciona un valor entre 0 y 1", () => {
    expect(posicionEnRecta(5, 0, 10)).toBe(0.5);
    expect(posicionEnRecta(0, 0, 10)).toBe(0);
    expect(posicionEnRecta(10, 0, 10)).toBe(1);
    expect(posicionEnRecta(15, 0, 10)).toBe(1);
    expect(posicionEnRecta(5, 5, 5)).toBe(0);
  });
});
describe("visual: cadena porcentual", () => {
  it("une cada valor con el siguiente y marca si sube o baja", () => {
    const t = tramosDeCadena([
      { valor: 100 },
      { op: "+20%", valor: 120 },
      { op: "-20%", valor: 96 },
    ]);
    expect(t).toEqual([
      { desde: 100, hasta: 120, op: "+20%", sube: true },
      { desde: 120, hasta: 96, op: "-20%", sube: false },
    ]);
  });
  it("sin operación indicada, deduce el sentido de los valores", () => {
    expect(tramosDeCadena([{ valor: 10 }, { valor: 5 }])[0]).toMatchObject({
      sube: false,
      op: "",
    });
  });
});
