import { describe, expect, it } from "vitest";
import { tipoDeTexto } from "./tipo-de-texto";

describe("tipoDeTexto", () => {
  it("una frase sin marcas es texto plano", () => {
    expect(tipoDeTexto("La célula es la unidad básica de la vida.")).toBe("plano");
    expect(tipoDeTexto("¿Qué es la fotosíntesis? Responde con tus palabras.")).toBe("plano");
  });

  it("cualquier marca de markdown pide el renderizador de markdown", () => {
    for (const texto of [
      "Es **importante**",
      "_cursiva_",
      "usa `código`",
      "# Título",
      "> cita",
      "- uno",
      "1. primero",
      "| a | b |",
      "[enlace](https://x.y)",
      "a\\*b",
      "<b>html</b>",
      "a &amp; b",
      "línea uno\nlínea dos",
      "    código indentado",
      "~~tachado~~",
    ]) {
      expect(tipoDeTexto(texto), texto).toBe("markdown");
    }
  });

  it("un `$` pide KaTeX aunque no haya otra marca", () => {
    expect(tipoDeTexto("La energía es $E = mc^2$.")).toBe("formulas");
    expect(tipoDeTexto("$$\\int_0^1 x\\,dx$$")).toBe("formulas");
  });

  it("el $ del dinero no pide KaTeX", () => {
    expect(tipoDeTexto("Cuesta $5 y luego $10.")).not.toBe("formulas");
    expect(tipoDeTexto("Son US$ 20")).not.toBe("formulas");
  });

  it("\\(…\\) también es una fórmula", () => {
    expect(tipoDeTexto("La recta \\(y = mx\\)")).toBe("formulas");
  });

  it("un número suelto o un guion dentro de la frase no es una lista", () => {
    expect(tipoDeTexto("En 1492 llegó a América, un hecho clave - según el libro.")).toBe("plano");
  });
});
