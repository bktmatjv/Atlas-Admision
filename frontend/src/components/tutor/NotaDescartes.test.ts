import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NotaDescartes } from "./NotaDescartes";

const render = (descartes: number) =>
  renderToStaticMarkup(createElement(NotaDescartes, { descartes }));

describe("NotaDescartes", () => {
  it("avisa de un recurso que no pasó la verificación", () => {
    expect(render(1)).toContain(
      "Un recurso de este mensaje no pasó la verificación de CALIBRA y no se muestra.",
    );
  });
  it("usa el plural con varios descartes", () => {
    expect(render(3)).toContain("3 recursos de este mensaje no pasaron");
  });
  it("no muestra nada sin descartes", () => {
    expect(render(0)).toBe("");
  });
});
