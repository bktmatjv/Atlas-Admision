import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { buscarNodos, disponerMapa, resumenDelMapa } from "./presentacion";
import type { Grafo, NodoGrafo } from "./grafo";
import { GrafoComprension } from "@/components/tutor/GrafoComprension";
import { TutorProgress } from "@/components/tutor/TutorProgress";
const node = (
  id: string,
  estado: NodoGrafo["estado"],
  arbol = "a",
): NodoGrafo => ({
  id,
  arbol_id: arbol,
  estado,
  tipo: "concepto",
  titulo: id === "1" ? "Proporciones y razón" : `Idea ${id}`,
  resumen: "Una explicación del concepto.",
  idea_clave: null,
  concepto: "proporciones",
  senal: null,
  origen: "tutor",
  evidencias: estado === "aplicado" ? 2 : 0,
});
const grafo: Grafo = {
  version: 1,
  foco: "1",
  camino_error: [],
  nodos: [
    node("1", "explorado"),
    node("2", "aplicado"),
    node("3", "fallo"),
    node("4", "sin_explorar", "otro"),
  ],
  aristas: [
    {
      id: "r1",
      origen: "1",
      destino: "2",
      tipo: "subtema",
      creada_por: "tutor",
    },
    {
      id: "r2",
      origen: "1",
      destino: "3",
      tipo: "subtema",
      creada_por: "tutor",
    },
  ],
};
const render = (
  component: Parameters<typeof createElement>[0],
  props: Record<string, unknown>,
) =>
  renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(component, props)),
  );
describe("presentación honesta del tutor", () => {
  it("cuenta estados, sin inventar porcentajes ni dominio", () => {
    expect(resumenDelMapa(grafo)).toEqual({
      total: 4,
      aplicados: 1,
      explorados: 1,
      revisar: 1,
      sinExplorar: 1,
    });
    const html = render(TutorProgress, { grafo });
    expect(html).toContain("No es una nota de comprensión");
    expect(html).not.toContain("68%");
    expect(html).not.toContain("Días de práctica");
  });
  it("limita el resumen al árbol de la conversación", () => {
    expect(resumenDelMapa(grafo, "a")).toEqual({
      total: 3,
      aplicados: 1,
      explorados: 1,
      revisar: 1,
      sinExplorar: 0,
    });
  });
  it("no presenta cero como dato conocido si falta la respuesta", () => {
    const html = render(TutorProgress, {});
    expect(html).toContain("—");
  });
  it("busca por título o resumen sin distinguir tildes y mayúsculas", () => {
    expect(buscarNodos(grafo.nodos, "RAZON").map((n) => n.id)).toEqual(["1"]);
    expect(buscarNodos(grafo.nodos, " inexistente ")).toEqual([]);
    expect(buscarNodos(grafo.nodos, " ")).toHaveLength(4);
  });
  it("el mapa muestra solo nodos existentes y conexiones reales", () => {
    const view = disponerMapa(grafo, "1");
    expect(view.nodos.map((n) => n.id)).toEqual(["1", "2", "3"]);
    expect(view.aristas).toEqual(grafo.aristas);
    expect(view.omitidos).toBe(1);
    expect(
      view.nodos.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)),
    ).toBe(true);
  });
  it("el foco inexistente tiene un fallback real, sin fabricar nodos", () => {
    expect(disponerMapa(grafo, "ajeno").nodos[0].id).toBe("1");
    expect(disponerMapa({ ...grafo, nodos: [], aristas: [] }, null)).toEqual({
      nodos: [],
      aristas: [],
      omitidos: 0,
    });
  });
  it("acota la densidad visual y avisa de las ideas restantes", () => {
    const large: Grafo = {
      ...grafo,
      nodos: Array.from({ length: 20 }, (_, i) =>
        node(String(i), "sin_explorar"),
      ),
      aristas: Array.from({ length: 19 }, (_, i) => ({
        id: String(i),
        origen: "0",
        destino: String(i + 1),
        tipo: "subtema",
        creada_por: "sistema",
      })),
    };
    const view = disponerMapa(large, "0");
    expect(view.nodos).toHaveLength(9);
    expect(view.omitidos).toBe(11);
    const ids = new Set(view.nodos.map((n) => n.id));
    expect(
      view.aristas.every((a) => ids.has(a.origen) && ids.has(a.destino)),
    ).toBe(true);
  });
  it("expone mapa, lista y pestañas accesibles sobre datos reales", () => {
    const html = render(GrafoComprension, {
      grafo,
      seleccionado: "1",
      onSeleccionar: () => undefined,
    });
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain("Ver como lista");
    expect(html).toContain("Proporciones y razón");
    expect(html).toContain("sin porcentaje de comprensión");
    expect(html).not.toContain('aria-valuenow="68"');
  });
  it("el estado vacío explica el siguiente paso en vez de simular un grafo", () => {
    const html = render(GrafoComprension, {
      grafo: { ...grafo, nodos: [], aristas: [] },
      seleccionado: null,
      onSeleccionar: () => undefined,
    });
    expect(html).toContain("Una buena pregunta abre un camino.");
    expect(html).not.toContain('role="group"');
  });
});
