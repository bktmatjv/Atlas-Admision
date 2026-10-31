import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/integrations/api/client";
import { ElegirTema } from "./ElegirTema";

describe("ElegirTema", () => {
  it("ofrece solo los tres temas con comprobación y un grupo accesible", () => {
    const html = renderToStaticMarkup(
      createElement(ElegirTema, { onElegir: () => undefined }),
    );
    expect(html).toContain("¿Sobre qué tema quieres la comprobación?");
    for (const tema of ["Porcentajes", "Proporciones", "Fracciones"])
      expect(html).toContain(`>${tema}</button>`);
    expect(html).toContain('role="group"');
    expect(html.match(/<button/g)).toHaveLength(3);
  });
  it("se desactiva mientras se crea la comprobación", () => {
    const html = renderToStaticMarkup(
      createElement(ElegirTema, { onElegir: () => undefined, ocupado: true }),
    );
    expect(html.match(/disabled=""/g)).toHaveLength(3);
  });
  it("ApiError conserva el código propio del servidor", () => {
    const e = new ApiError("Elige el tema", 409, "elige_tema");
    expect(e.codigo).toBe("elige_tema");
    expect(new ApiError("x", 500).codigo).toBeUndefined();
  });
});
