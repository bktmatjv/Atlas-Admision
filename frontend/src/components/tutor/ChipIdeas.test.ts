import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { claveEvento, etiquetaIdeas } from "@/lib/tutor/eventos";
import { ChipIdeas } from "./ChipIdeas";

describe("eventos del tutor", () => {
  it("la clave del evento es estable por comprobación y tiene largo válido", () => {
    const id = "9b2f3c1e-0000-4000-8000-000000000001";
    expect(claveEvento(id)).toBe(`evento-${id}`);
    expect(claveEvento(id)).toBe(claveEvento(id));
    expect(claveEvento(id).length).toBeGreaterThanOrEqual(8);
  });
  it("etiqueta singular, plural y vacío", () => {
    expect(etiquetaIdeas(1)).toBe("+1 idea en tu mapa");
    expect(etiquetaIdeas(2)).toBe("+2 ideas en tu mapa");
    expect(etiquetaIdeas(0)).toBeNull();
    expect(etiquetaIdeas(-1)).toBeNull();
  });
});

describe("ChipIdeas", () => {
  it("muestra el chip y su nombre accesible", () => {
    const html = renderToStaticMarkup(createElement(ChipIdeas, { ideas: 2 }));
    expect(html).toContain("+2 ideas en tu mapa");
    expect(html).toContain("Abrir el grafo");
  });
  it("sin ideas nuevas no muestra nada", () => {
    expect(renderToStaticMarkup(createElement(ChipIdeas, { ideas: 0 }))).toBe(
      "",
    );
  });
});
