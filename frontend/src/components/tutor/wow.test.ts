import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ArtefactoCompacto, PanelArtefactos } from "./PanelArtefactos";
import { CaminoComprension, MomentoComprension } from "./CaminoComprension";
import { PasosAgente } from "./PasosAgente";
import { ComprobacionTutor } from "./ComprobacionTutor";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { NodoGrafo } from "@/lib/tutor/grafo";
const render = (el: ReactElement) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, el));
const noop = () => undefined;
const nodo: NodoGrafo = {
  id: "n",
  arbol_id: "a",
  tipo: "idea",
  titulo: "Cambio de base",
  resumen: "",
  idea_clave: "cambio-de-base",
  concepto: "porcentajes",
  estado: "fallo",
  senal: null,
  origen: "sistema",
  evidencias: 1,
};
describe("superficies del tutor wow", () => {
  it("el camino expone cinco estaciones y explica los datos no disponibles", () => {
    const html = render(
      createElement(CaminoComprension, { nodo, evidencias: [] }),
    );
    expect(html.match(/<li /g)).toHaveLength(5);
    expect(html).toContain("La API no expone");
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("Volvamos a practicar");
    expect(html).toContain('aria-live="polite"');
  });
  it("no dibuja antes/después si falta un lado guardado", () => {
    expect(
      render(createElement(MomentoComprension, { nodo, evidencias: [] })),
    ).toBe("");
  });
  it("los pasos guardados empiezan plegados y los desconocidos no inventan una acción", () => {
    const html = render(
      createElement(PasosAgente, { pasos: ["leer_grafo", "otra"] }),
    );
    expect(html).toContain("Revisé tu mapa de comprensión");
    expect(html).toContain("Herramienta utilizada: otra");
    expect(html).not.toContain("open=");
    expect(render(createElement(PasosAgente, {}))).toBe("");
  });
  it("tarjeta compacta accionable y sin afirmar que fue aprendida", () => {
    const html = render(
      createElement(ArtefactoCompacto, {
        bloque: {
          id: "v",
          tipo: "visual",
          forma: "barra_de_partes",
          partes: 4,
          marcadas: 1,
          total: 1,
        },
        activo: false,
        onAbrir: noop,
      }),
    );
    expect(html).toContain("Abrir Visual verificado en el panel");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("aprendido");
  });
  it("el panel tiene separador con valor y control móvil operable por teclado", () => {
    const html = render(
      createElement(PanelArtefactos, {
        ancho: 44,
        onAncho: noop,
        activo: "grafo",
        onActivo: noop,
        bloques: [],
        onCerrarTab: noop,
        onCerrar: noop,
        grafo: createElement("p", null, "Grafo de prueba"),
        children: null,
      }),
    );
    for (const t of [
      'role="separator"',
      'aria-valuenow="44"',
      'role="slider"',
      'aria-orientation="vertical"',
      'role="tablist"',
      'role="tabpanel"',
      "Grafo de prueba",
    ])
      expect(html).toContain(t);
  });
  it("comprobación pide solo datos que acepta el contrato real", () => {
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(ComprobacionTutor, {
          activa: {
            id: "c",
            arbol_id: "a",
            enunciado: "100 sube 20% y baja 20%.",
          },
          onActualizar: noop,
        }),
      ),
    );
    expect(html).toContain("Ahora, por tu cuenta");
    expect(html).toContain("Comprobar mi resultado");
    expect(html).toContain("no se califica automáticamente");
    expect(html).not.toContain("96");
  });
});
