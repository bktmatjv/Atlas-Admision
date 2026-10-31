import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContextoAcceso, type CuentaActual } from "./contexto";
import { MenuCuenta } from "./MenuCuenta";

const render = (cuenta: CuentaActual) =>
  renderToStaticMarkup(
    createElement(
      ContextoAcceso.Provider,
      {
        value: {
          cuenta,
          abrir: () => undefined,
          salir: async () => undefined,
          ocupado: false,
        },
      },
      createElement(MenuCuenta),
    ),
  );

describe("MenuCuenta", () => {
  it("invitado: menú compacto en anchos chicos y botones en anchos grandes", () => {
    const html = render({ actorId: "a", usuario: null });
    expect(html).toContain("sm:hidden");
    expect(html).toContain('aria-label="Cuenta"');
    expect(html).toContain("hidden shrink-0 items-center gap-1 sm:flex");
    expect(html.match(/>Ingresar</g)).toHaveLength(2);
    expect(html.match(/>Crear cuenta</g)).toHaveLength(2);
  });
  it("con cuenta muestra el usuario y la opción de salir, sin duplicar variantes", () => {
    const html = render({ actorId: "a", usuario: "ana_01" });
    expect(html).toContain("ana_01");
    expect(html).toContain(">Salir<");
    expect(html).not.toContain("Ingresar");
  });
  it("los controles mantienen objetivos de 44 px", () => {
    expect(render({ actorId: "a", usuario: null })).toContain("min-h-11");
  });
});
