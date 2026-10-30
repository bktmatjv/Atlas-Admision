import { describe, expect, it } from "vitest";
import { normalizarFormulas, tieneFormula, trocearFormulas } from "./formulas";

describe("normalizarFormulas", () => {
  it("convierte \\(…\\) en $…$ y \\[…\\] en $$…$$", () => {
    expect(normalizarFormulas("La recta \\(y = mx + b\\) corta.")).toBe("La recta $y = mx + b$ corta.");
    expect(normalizarFormulas("Sea \\[x^2 + 1 = 0\\] la ecuación")).toBe("Sea $$x^2 + 1 = 0$$ la ecuación");
    expect(normalizarFormulas("\\[\n\\frac{a}{b}\n\\]")).toBe("$$\n\\frac{a}{b}\n$$");
  });

  it("deja tal cual las fórmulas ya bien escritas", () => {
    for (const t of ["La energía es $E = mc^2$.", "$$\\int_0^1 x\\,dx$$", "Si $x>0$ y $y<0$, entonces"]) {
      expect(normalizarFormulas(t), t).toBe(t);
    }
  });

  it("escapa el $ de la moneda para que no abra una fórmula", () => {
    expect(normalizarFormulas("Cuesta $5 y luego $10 más.")).toBe("Cuesta \\$5 y luego \\$10 más.");
    expect(normalizarFormulas("Son US$ 20 al mes")).toBe("Son US\\$ 20 al mes");
    expect(normalizarFormulas("Pagó US$20")).toBe("Pagó US\\$20");
    expect(normalizarFormulas("Un $ suelto")).toBe("Un \\$ suelto");
  });

  it("el $ pegado a una palabra no cierra una fórmula («US$»)", () => {
    expect(normalizarFormulas("Cuesta $5 y US$ 20")).toBe("Cuesta \\$5 y US\\$ 20");
    expect(tieneFormula("Cuesta $5 y US$ 20")).toBe(false);
  });

  it("los soles no se tocan", () => {
    expect(normalizarFormulas("Vale S/ 5 o S/. 4,50")).toBe("Vale S/ 5 o S/. 4,50");
  });

  it("una fórmula y una moneda en la misma frase", () => {
    expect(normalizarFormulas("Si $x = 3$, pagas $5")).toBe("Si $x = 3$, pagas \\$5");
  });

  it("no toca el $ dentro de código", () => {
    expect(normalizarFormulas("usa `echo $HOME` y $5")).toBe("usa `echo $HOME` y \\$5");
    expect(normalizarFormulas("```\nprecio = $5\n```")).toBe("```\nprecio = $5\n```");
  });

  it("un $ ya escapado se queda escapado", () => {
    expect(normalizarFormulas("cuesta \\$5")).toBe("cuesta \\$5");
  });
});

describe("tieneFormula", () => {
  it("solo con una fórmula de verdad", () => {
    expect(tieneFormula("La energía es $E = mc^2$.")).toBe(true);
    expect(tieneFormula("\\(a+b\\)")).toBe(true);
    expect(tieneFormula("Cuesta $5 y $10")).toBe(false);
    expect(tieneFormula("US$ 20")).toBe(false);
    expect(tieneFormula("Nada que ver")).toBe(false);
  });
});

describe("trocearFormulas", () => {
  it("parte el texto en trozos de texto y de fórmula", () => {
    expect(trocearFormulas("Si $x=2$, entonces $$x^2=4$$ y cuesta $5")).toEqual([
      { tipo: "texto", valor: "Si " },
      { tipo: "formula", valor: "x=2", bloque: false },
      { tipo: "texto", valor: ", entonces " },
      { tipo: "formula", valor: "x^2=4", bloque: true },
      { tipo: "texto", valor: " y cuesta $5" },
    ]);
  });

  it("un texto sin fórmulas es un solo trozo", () => {
    expect(trocearFormulas("hola")).toEqual([{ tipo: "texto", valor: "hola" }]);
  });
});
