import { describe, it, expect } from "vitest";
import {
  evaluarExpresion,
  igualesNumeros,
  normalizarNumero,
  verificarIgualdad,
} from "../src/modules/seguimiento/numeros";
describe("normalizarNumero (§4.4)", () => {
  it("acepta coma o punto decimal y espacios", () => {
    expect(normalizarNumero("96")).toEqual({ legible: true, valor: 96 });
    expect(normalizarNumero(" 96,5 ")).toEqual({ legible: true, valor: 96.5 });
    expect(normalizarNumero("96.5")).toEqual({ legible: true, valor: 96.5 });
    expect(normalizarNumero("-5")).toEqual({ legible: true, valor: -5 });
  });
  it("acepta % y las unidades conocidas", () => {
    expect(normalizarNumero("25%")).toEqual({ legible: true, valor: 25 });
    expect(normalizarNumero("S/100")).toEqual({ legible: true, valor: 100 });
    expect(normalizarNumero("S/ 100,50")).toEqual({
      legible: true,
      valor: 100.5,
    });
    expect(normalizarNumero("15 cm")).toEqual({ legible: true, valor: 15 });
    expect(normalizarNumero("300ml")).toEqual({ legible: true, valor: 300 });
    expect(normalizarNumero("3 litros")).toEqual({ legible: true, valor: 3 });
  });
  it("acepta fracciones simples a/b", () => {
    expect(normalizarNumero("3/8")).toEqual({ legible: true, valor: 0.375 });
    expect(normalizarNumero("S/3/4")).toEqual({ legible: true, valor: 0.75 });
  });
  it("lo no interpretable no es un número ni un fallo", () => {
    for (const t of [
      "",
      "  ",
      "abc",
      "1,2,3",
      "3/0",
      "1e3",
      "10 manzanas",
      "--5",
      "5 5",
    ])
      expect(normalizarNumero(t), t).toEqual({ legible: false });
  });
});
describe("igualesNumeros", () => {
  it("usa tolerancia relativa de 1e-9", () => {
    expect(igualesNumeros(0.1 + 0.2, 0.3)).toBe(true);
    expect(igualesNumeros(96, 96.01)).toBe(false);
    expect(igualesNumeros(1e9, 1e9 + 0.5)).toBe(true);
  });
});
describe("evaluarExpresion (sin eval)", () => {
  it("respeta precedencia, paréntesis y signos", () => {
    expect(evaluarExpresion("2 + 3 * 4")).toBe(14);
    expect(evaluarExpresion("(2 + 3) × 4")).toBe(20);
    expect(evaluarExpresion("7 ÷ 2")).toBe(3.5);
    expect(evaluarExpresion("-3 + 5")).toBe(2);
    expect(evaluarExpresion("100 × 1,20 × 0,80")).toBeCloseTo(96, 9);
  });
  it("interpreta porcentajes", () => {
    expect(evaluarExpresion("20%")).toBeCloseTo(0.2, 12);
    expect(evaluarExpresion("100 × 20%")).toBeCloseTo(20, 9);
    expect(evaluarExpresion("20% de 120")).toBeCloseTo(24, 9);
  });
  it("devuelve null ante lo que no es aritmética simple", () => {
    for (const t of [
      "2 +",
      "abc",
      "alert(1)",
      "process.exit()",
      "constructor",
      "2 ** 3",
      "1 / 0",
      "((2)",
      "",
      "2 3",
      "x = 3",
    ])
      expect(evaluarExpresion(t), t).toBeNull();
  });
  it("limita el tamaño y la profundidad", () => {
    expect(evaluarExpresion("1+".repeat(300) + "1")).toBeNull();
    expect(evaluarExpresion("(".repeat(60) + "1" + ")".repeat(60))).toBeNull();
  });
});
describe("verificarIgualdad", () => {
  it("cierra cuando ambos lados valen lo mismo", () => {
    expect(verificarIgualdad("120 - 24 = 96")).toEqual({ valida: true });
    expect(verificarIgualdad("100 × 1,20 × 0,80 = 96")).toEqual({
      valida: true,
    });
    expect(verificarIgualdad("20% de 120 = 24")).toEqual({ valida: true });
    expect(verificarIgualdad("2 + 2 = 4 = 8 / 2")).toEqual({ valida: true });
  });
  it("detecta la cuenta falsa", () => {
    const r = verificarIgualdad("120 - 24 = 95");
    expect(r.valida).toBe(false);
  });
  it("una expresión ilegible o sin igual no es válida", () => {
    expect(verificarIgualdad("120 - 24").valida).toBe(false);
    expect(verificarIgualdad("hola = 3").valida).toBe(false);
  });
});
