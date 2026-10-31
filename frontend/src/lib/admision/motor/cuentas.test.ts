import { describe, expect, it } from "vitest";
import { comprobarCuenta, evaluar, latexAExpresion } from "@/lib/admision/motor/cuentas";

describe("evaluar", () => {
  it("la aritmética con su precedencia", () => {
    expect(evaluar("2 + 3 * 4")).toBe(14);
    expect(evaluar("(2 + 3) * 4")).toBe(20);
    expect(evaluar("2^3^2")).toBe(512);
    expect(evaluar("-2^2")).toBe(-4);
    expect(evaluar("10 / 4")).toBe(2.5);
    expect(evaluar("7 - 2 - 1")).toBe(4);
  });

  it("decimales con punto o coma y notación científica", () => {
    expect(evaluar("3,5 + 1.5")).toBe(5);
    expect(evaluar("1.2e3")).toBe(1200);
    expect(evaluar("6.02 * 10^23")).toBeCloseTo(6.02e23, -18);
  });

  it("producto implícito", () => {
    expect(evaluar("2x", { x: 3 })).toBe(6);
    expect(evaluar("2(3 + 1)")).toBe(8);
    expect(evaluar("(1 + 1)(2 + 2)")).toBe(8);
    expect(evaluar("3pi")).toBeCloseTo(3 * Math.PI);
    expect(evaluar("xy", { x: 2, y: 5 })).toBe(10);
  });

  it("funciones y constantes", () => {
    expect(evaluar("sqrt(16)")).toBe(4);
    expect(evaluar("sin(pi / 2)")).toBeCloseTo(1);
    expect(evaluar("log(1000)")).toBeCloseTo(3);
    expect(evaluar("ln(e)")).toBeCloseTo(1);
    expect(evaluar("abs(-3)")).toBe(3);
    expect(evaluar("|-3| + 1")).toBe(4);
    expect(evaluar("5!")).toBe(120);
    expect(evaluar("20%")).toBe(0.2);
  });

  it("variables con subíndice", () => {
    expect(evaluar("v_0 + a t", { v_0: 2, a: 3, t: 4 })).toBe(14);
  });

  it("una variable que no se conoce es un error, no un cero", () => {
    expect(() => evaluar("x + 1")).toThrow(/x/);
  });

  it("la división entre cero no da un número", () => {
    expect(() => evaluar("1 / 0")).toThrow();
  });

  it("una expresión mal formada es un error", () => {
    expect(() => evaluar("2 +")).toThrow();
    expect(() => evaluar("(2 + 3")).toThrow();
  });
});

describe("latexAExpresion", () => {
  it("fracciones, raíces y productos", () => {
    expect(evaluar(latexAExpresion("\\frac{1}{2} + \\frac{3}{4}"))).toBe(1.25);
    expect(evaluar(latexAExpresion("\\dfrac{\\sqrt{16}}{2}"))).toBe(2);
    expect(evaluar(latexAExpresion("\\sqrt[3]{27}"))).toBeCloseTo(3);
    expect(evaluar(latexAExpresion("3 \\cdot 4 \\times 2"))).toBe(24);
    expect(evaluar(latexAExpresion("12 \\div 4"))).toBe(3);
    expect(evaluar(latexAExpresion("\\left( 2 + 3 \\right)^{2}"))).toBe(25);
  });

  it("la coma decimal peruana y las unidades", () => {
    expect(evaluar(latexAExpresion("9{,}8 \\cdot 2"))).toBeCloseTo(19.6);
    expect(evaluar(latexAExpresion("5\\,\\text{m/s} \\cdot 2"))).toBe(10);
    expect(evaluar(latexAExpresion("100\\ \\mathrm{kg}"))).toBe(100);
  });

  it("grados y funciones trigonométricas", () => {
    expect(evaluar(latexAExpresion("\\sin(30^\\circ)"))).toBeCloseTo(0.5);
    expect(evaluar(latexAExpresion("\\cos 60°"))).toBeCloseTo(0.5);
    expect(evaluar(latexAExpresion("2\\pi"))).toBeCloseTo(2 * Math.PI);
  });

  it("fracciones anidadas, sin llaves y exponentes negativos", () => {
    expect(evaluar(latexAExpresion("\\frac{1}{\\frac{1}{4}}"))).toBe(4);
    expect(evaluar(latexAExpresion("\\frac12"))).toBe(0.5);
    expect(evaluar(latexAExpresion("2^{-1}"))).toBe(0.5);
    expect(evaluar(latexAExpresion("10^{-3} \\cdot 5"))).toBeCloseTo(0.005);
  });

  it("las letras griegas son variables, y Δ va pegada a la suya", () => {
    expect(evaluar(latexAExpresion("\\Delta x / \\Delta t"), { "Δx": 10, "Δt": 2 })).toBe(5);
    expect(evaluar(latexAExpresion("2\\theta"), { "θ": 3 })).toBe(6);
  });

  it("una orden que no sabe calcular es un error, no un número inventado", () => {
    expect(() => evaluar(latexAExpresion("\\int_0^1 x\\,dx"))).toThrow(/int/);
    expect(() => evaluar(latexAExpresion("\\lim_{x \\to 0} x"))).toThrow();
  });

  it("los signos de Unicode", () => {
    expect(evaluar(latexAExpresion("6 × 7 − 2 · 1 ÷ 2"))).toBe(41);
  });
});

describe("comprobarCuenta", () => {
  it("una cadena de igualdades que cuadra", () => {
    expect(comprobarCuenta("$v = \\frac{d}{t} = \\frac{100}{20} = 5\\,\\text{m/s}$").estado).toBe("cuadra");
    expect(comprobarCuenta("2x + 3 = 7 \\Rightarrow x = 2").estado).toBe("sin_numeros");
  });

  it("una cuenta mal hecha no cuadra, y dice dónde", () => {
    const r = comprobarCuenta("\\frac{100}{20} = 4");
    expect(r.estado).toBe("no_cuadra");
    if (r.estado === "no_cuadra") {
      expect(r.esperado).toBe(5);
      expect(r.escrito).toBe(4);
    }
  });

  it("el redondeo a los decimales que se escriben vale", () => {
    expect(comprobarCuenta("\\frac{10}{3} = 3{,}33").estado).toBe("cuadra");
    expect(comprobarCuenta("\\frac{10}{3} = 3{,}4").estado).toBe("no_cuadra");
    expect(comprobarCuenta("\\frac{10}{3} = 3").estado).toBe("no_cuadra");
  });

  it("\\approx tolera un 1 %", () => {
    expect(comprobarCuenta("\\sqrt{2} \\approx 1{,}4").estado).toBe("cuadra");
    expect(comprobarCuenta("\\pi \\approx 3").estado).toBe("no_cuadra");
  });

  it("con las variables del problema se comprueban también los lados con letras", () => {
    expect(comprobarCuenta("F = m a = 2 \\cdot 3 = 6", { m: 2, a: 3, F: 6 }).estado).toBe("cuadra");
    expect(comprobarCuenta("F = m a = 7", { m: 2, a: 3 }).estado).toBe("no_cuadra");
  });

  it("un solo lado con números no es una cuenta", () => {
    expect(comprobarCuenta("E = mc^2").estado).toBe("sin_numeros");
    expect(comprobarCuenta("12").estado).toBe("sin_numeros");
  });

  it("las comparaciones no se tratan como igualdades", () => {
    expect(comprobarCuenta("x < 3").estado).toBe("sin_numeros");
  });
});
