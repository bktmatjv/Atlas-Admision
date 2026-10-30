import { describe, expect, it } from "vitest";
import { corregirNumerica, leerCantidad, mismaDimension } from "@/lib/admision/motor/numerica";

describe("leerCantidad", () => {
  it("número con coma o punto, y su unidad", () => {
    expect(leerCantidad("3,5 m/s")).toEqual({ valor: 3.5, unidad: "m/s" });
    expect(leerCantidad("3.5 m/s")).toEqual({ valor: 3.5, unidad: "m/s" });
    expect(leerCantidad("-2")).toEqual({ valor: -2, unidad: null });
    expect(leerCantidad("  12 kg ")).toEqual({ valor: 12, unidad: "kg" });
  });

  it("notación científica en todas sus formas", () => {
    expect(leerCantidad("1,2e3 m")?.valor).toBe(1200);
    expect(leerCantidad("1,2 × 10^3 m")?.valor).toBeCloseTo(1200);
    expect(leerCantidad("1.2x10^3")?.valor).toBeCloseTo(1200);
    expect(leerCantidad("6,02·10^{23}")?.valor).toBeCloseTo(6.02e23, -18);
    expect(leerCantidad("3 * 10^-2 m")?.valor).toBeCloseTo(0.03);
  });

  it("fracciones y LaTeX", () => {
    expect(leerCantidad("1/2")?.valor).toBe(0.5);
    expect(leerCantidad("$\\frac{3}{4}$")?.valor).toBe(0.75);
    expect(leerCantidad("$9{,}8\\,\\text{m/s}^2$")).toEqual({ valor: 9.8, unidad: "m/s^2" });
  });

  it("los miles con espacio o punto", () => {
    expect(leerCantidad("1 200 m")?.valor).toBe(1200);
    expect(leerCantidad("1.200.000")?.valor).toBe(1200000);
  });

  it("el porcentaje y los grados", () => {
    expect(leerCantidad("50 %")).toEqual({ valor: 50, unidad: "%" });
    expect(leerCantidad("30°")).toEqual({ valor: 30, unidad: "°" });
    expect(leerCantidad("25 °C")).toEqual({ valor: 25, unidad: "°C" });
  });

  it("lo que no es un número", () => {
    expect(leerCantidad("")).toBeNull();
    expect(leerCantidad("no sé")).toBeNull();
    expect(leerCantidad("m/s")).toBeNull();
  });
});

describe("mismaDimension", () => {
  it("compara lo que se puede comparar", () => {
    expect(mismaDimension("km/h", "m/s")).toBe(true);
    expect(mismaDimension("kg", "m")).toBe(false);
    expect(mismaDimension("°C", "K")).toBe(true);
    expect(mismaDimension("L", "cm^3")).toBe(true);
  });
});

describe("corregirNumerica", () => {
  const v20 = { valor: 20, unidad: "m/s", tolerancia: 0.01 };

  it("el mismo número, con coma, punto o sin unidad (va en la del enunciado)", () => {
    expect(corregirNumerica("20 m/s", v20).correcta).toBe(true);
    expect(corregirNumerica("20,0", v20).correcta).toBe(true);
    expect(corregirNumerica("19,9 m/s", v20).correcta).toBe(true);
  });

  it("una unidad escrita en LaTeX con sus dólares también se entiende", () => {
    const g = { valor: 9.8, unidad: "$\\text{m/s}^2$", tolerancia: 0.01 };
    expect(corregirNumerica("9,8", g).correcta).toBe(true);
    expect(corregirNumerica("9,8 m/s^2", g).correcta).toBe(true);
    expect(mismaDimension("$\\text{m/s}^2$", "m/s²")).toBe(true);
  });

  it("una unidad equivalente vale", () => {
    expect(corregirNumerica("72 km/h", v20).correcta).toBe(true);
    expect(corregirNumerica("2000 cm/s", v20).correcta).toBe(true);
  });

  it("la temperatura con su desplazamiento", () => {
    const t = { valor: 298.15, unidad: "K", tolerancia: 0.001 };
    expect(corregirNumerica("25 °C", t).correcta).toBe(true);
    expect(corregirNumerica("25 K", t).correcta).toBe(false);
  });

  it("el porcentaje y la proporción son lo mismo", () => {
    const p = { valor: 0.5, unidad: null, tolerancia: 0.01 };
    expect(corregirNumerica("50 %", p).correcta).toBe(true);
    expect(corregirNumerica("0,5", p).correcta).toBe(true);
  });

  it("fuera de la tolerancia no vale", () => {
    const r = corregirNumerica("21 m/s", v20);
    expect(r.correcta).toBe(false);
    if (!r.correcta) expect(r.motivo).toBe("valor");
  });

  it("una unidad que no mide lo mismo, con su pista", () => {
    const r = corregirNumerica("20 kg", v20);
    expect(r.correcta).toBe(false);
    if (!r.correcta) {
      expect(r.motivo).toBe("unidad");
      expect(r.pista).toMatch(/m\/s/);
    }
  });

  it("la pista apunta al siguiente paso según el error", () => {
    const potencia = corregirNumerica("200 m/s", v20);
    const signo = corregirNumerica("-20 m/s", v20);
    const otra = corregirNumerica("37 m/s", v20);
    expect(!potencia.correcta && potencia.pista).toMatch(/coma|conversión/i);
    expect(!signo.correcta && signo.pista).toMatch(/signo/i);
    expect(!otra.correcta && otra.pista).toMatch(/planteamiento/i);
  });

  it("lo ilegible no es un fallo de cuenta", () => {
    const r = corregirNumerica("veinte", v20);
    expect(r.correcta).toBe(false);
    if (!r.correcta) expect(r.motivo).toBe("ilegible");
  });

  it("un resultado cero se compara en absoluto, no en relativo", () => {
    expect(corregirNumerica("0", { valor: 0, unidad: null, tolerancia: 0.01 }).correcta).toBe(true);
    expect(corregirNumerica("0,001", { valor: 0, unidad: null, tolerancia: 0.01 }).correcta).toBe(true);
    expect(corregirNumerica("0,5", { valor: 0, unidad: null, tolerancia: 0.01 }).correcta).toBe(false);
  });
});
