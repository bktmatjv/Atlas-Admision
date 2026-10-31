import { describe, expect, it } from "vitest";
import { textoLegible } from "./texto-legible";

describe("textoLegible", () => {
  it("el texto sin fórmulas no cambia", () => {
    expect(textoLegible("difundirse sabiendo que son falsas.")).toBe("difundirse sabiendo que son falsas.");
  });
  it("quita los dólares y pasa los símbolos a su carácter", () => {
    expect(textoLegible("$1400\\pi$")).toBe("1400π");
    expect(textoLegible("$30^\\circ$")).toBe("30°");
    expect(textoLegible("$2 \\cdot 3 \\times 4$")).toBe("2 · 3 × 4");
    expect(textoLegible("$p \\rightarrow q$, $p \\wedge q$")).toBe("p → q, p ∧ q");
    expect(textoLegible("$\\alpha + \\beta = \\theta$")).toBe("α + β = θ");
  });
  it("fracciones y raíces se leen en línea", () => {
    expect(textoLegible("$\\frac{\\pi}{2}$")).toBe("π/2");
    expect(textoLegible("$\\dfrac{a+b}{2}$")).toBe("(a+b)/2");
    expect(textoLegible("$20\\sqrt{7}$ m")).toBe("20√7 m");
    expect(textoLegible("$\\sqrt{x+1}$")).toBe("√(x+1)");
    expect(textoLegible("$\\frac{\\sqrt{3}}{2}$")).toBe("√3/2");
  });
  it("texto, potencias y llaves sobrantes", () => {
    expect(textoLegible("$5\\text{ cm}^2$")).toBe("5 cm^2");
    expect(textoLegible("$\\left( x \\right)$")).toBe("( x )");
    expect(textoLegible("$\\cos x$")).toBe("cos x");
  });
  it("un comando desconocido pierde la barra, no desaparece", () => {
    expect(textoLegible("$\\raro{3}$")).toBe("raro3");
  });
});
