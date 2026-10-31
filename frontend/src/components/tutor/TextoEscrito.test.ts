import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mensajeDeEspera } from "@/lib/tutor/escritura";
import { TextoEscrito } from "./TextoEscrito";

describe("TextoEscrito", () => {
  it("un mensaje que no es nuevo se muestra entero, sin cursor ni lector duplicado", () => {
    const html = renderToStaticMarkup(
      createElement(TextoEscrito, { texto: "Hola **mundo**", animar: false }),
    );
    expect(html).toContain("mundo");
    expect(html).not.toContain("data-escribiendo");
    expect(html).not.toContain("sr-only");
  });
  it("al animar, arranca vacío para lectores visuales y expone el texto completo una vez", () => {
    const html = renderToStaticMarkup(
      createElement(TextoEscrito, { texto: "Respuesta completa", animar: true }),
    );
    expect(html).toContain('data-escribiendo="true"');
    expect(html).toContain('<span class="sr-only">Respuesta completa</span>');
    expect(html).toContain('aria-hidden="true"');
  });
});

describe("mensajeDeEspera", () => {
  it("cambia con el tiempo sin inventar pasos", () => {
    expect(mensajeDeEspera(0)).toBe("El tutor está pensando…");
    expect(mensajeDeEspera(6)).toBe("Sigo preparando tu respuesta…");
    expect(mensajeDeEspera(30)).toContain("tardando más de lo normal");
  });
});
