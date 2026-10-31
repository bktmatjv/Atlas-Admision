import { describe, expect, it } from "vitest";
import {
  INTENCIONES,
  TEMAS_SOPORTADOS,
  cuerpoDeCreacion,
  opcionesDeContexto,
  ordenarTemas,
  ultimaPracticaFallada,
} from "./inicio";
import { agruparPorFecha, etiquetaTema } from "./historial";
import { pluralizar, teclaEnvia } from "./chat";
import type { Grafo, NodoGrafo } from "./grafo";
const nodo = (concepto: string, estado: NodoGrafo["estado"]): NodoGrafo => ({
  id: concepto + estado,
  arbol_id: "a",
  tipo: "idea",
  titulo: "x",
  resumen: "",
  idea_clave: null,
  concepto,
  estado,
  senal: null,
  origen: "ia",
  evidencias: 0,
});
const grafo = (...nodos: NodoGrafo[]): Grafo => ({
  version: 1,
  foco: null,
  camino_error: [],
  nodos,
  aristas: [],
});
describe("pantalla inicial: intenciones y temas (S1, S7)", () => {
  it("hay cuatro tarjetas con el texto del diseño", () => {
    expect(INTENCIONES.map((i) => i.titulo)).toEqual([
      "Resolver una duda",
      "Analizar un ejercicio",
      "Practicar por tema",
      "Explorar mi grafo",
    ]);
    expect(INTENCIONES.map((i) => i.accion)).toEqual([
      "texto",
      "texto",
      "practica",
      "grafo",
    ]);
  });
  it("las intenciones de texto precargan el campo", () => {
    for (const i of INTENCIONES.filter((x) => x.accion === "texto"))
      expect(i.precarga.length, i.id).toBeGreaterThan(8);
  });
  it("solo ofrece los temas que el backend soporta", () => {
    expect(TEMAS_SOPORTADOS.map((t) => t.id)).toEqual([
      "porcentajes",
      "proporciones",
      "fracciones",
    ]);
    const todo = JSON.stringify([INTENCIONES, TEMAS_SOPORTADOS]).toLowerCase();
    for (const falso of ["ecuaciones", "progresiones", "imagen", "notific"])
      expect(todo).not.toContain(falso);
  });
  it("sin evidencias respeta el orden del catálogo", () => {
    expect(ordenarTemas(undefined).map((t) => t.id)).toEqual([
      "porcentajes",
      "proporciones",
      "fracciones",
    ]);
    expect(
      ordenarTemas(grafo(nodo("porcentajes", "aplicado"))).map((t) => t.id)[0],
    ).toBe("porcentajes");
  });
  it("pone primero el tema con un fallo pendiente y lo marca", () => {
    const orden = ordenarTemas(
      grafo(nodo("proporciones", "explorado"), nodo("fracciones", "fallo")),
    );
    expect(orden.map((t) => t.id)).toEqual([
      "fracciones",
      "porcentajes",
      "proporciones",
    ]);
    expect(orden.map((t) => t.pendiente)).toEqual([true, false, false]);
  });
});
describe("selector de contexto", () => {
  it("siempre ofrece los temas y suma la práctica y el material solo si existen", () => {
    const base = opcionesDeContexto({});
    expect(base.map((o) => o.etiqueta)).toEqual([
      "Porcentajes",
      "Proporciones",
      "Fracciones",
    ]);
    const todo = opcionesDeContexto({
      practica: { intento_id: "i1", pregunta_id: "p1" },
      material: { fragmento_id: "f1", nombre: "Apuntes.pdf" },
    });
    expect(todo.map((o) => o.etiqueta)).toEqual([
      "Porcentajes",
      "Proporciones",
      "Fracciones",
      "Mi última práctica",
      "Material: Apuntes.pdf",
    ]);
  });
  it("arma el cuerpo de creación según el contexto elegido", () => {
    expect(cuerpoDeCreacion({ tema: "fracciones" }, "  Hola  ")).toEqual({
      tema: "fracciones",
      mensaje_inicial: "Hola",
    });
    expect(
      cuerpoDeCreacion({ intento_id: "i1", pregunta_id: "p1" }, "Revisemos"),
    ).toEqual({
      intento_id: "i1",
      pregunta_id: "p1",
      mensaje_inicial: "Revisemos",
    });
    expect(cuerpoDeCreacion({ fragmento_id: "f1" }, "Resume")).toEqual({
      fragmento_id: "f1",
      mensaje_inicial: "Resume",
    });
    expect(cuerpoDeCreacion(null, "Sin contexto")).toEqual({
      mensaje_inicial: "Sin contexto",
    });
  });
  it("«Mi última práctica» solo existe si hay una pregunta fallada", () => {
    const intentos = [
      { id: "i3", estado: "en_curso" },
      { id: "i2", estado: "entregado" },
      { id: "i1", estado: "entregado" },
    ];
    const respuestas: Record<
      string,
      { pregunta_id: string; correcta: boolean | null }[]
    > = {
      i2: [
        { pregunta_id: "p1", correcta: true },
        { pregunta_id: "p2", correcta: null },
      ],
      i1: [{ pregunta_id: "p9", correcta: false }],
    };
    expect(
      ultimaPracticaFallada(intentos, (id) => respuestas[id] ?? []),
    ).toEqual({
      intento_id: "i1",
      pregunta_id: "p9",
    });
    expect(
      ultimaPracticaFallada(intentos, () => [
        { pregunta_id: "p", correcta: true },
      ]),
    ).toBeNull();
    expect(ultimaPracticaFallada([], () => [])).toBeNull();
  });
});
describe("historial de conversaciones (S2)", () => {
  const ahora = new Date(2026, 9, 31, 15, 0);
  const dia = (d: number, h = 10) => new Date(2026, 9, 31 - d, h).toISOString();
  const conv = (
    id: string,
    created_at: string,
    concepto: string | null = null,
  ) => ({
    id,
    titulo: "Conversación " + id,
    concepto,
    created_at,
  });
  it("agrupa en Hoy, Ayer, Esta semana y Anteriores, sin grupos vacíos", () => {
    const grupos = agruparPorFecha(
      [
        conv("a", dia(0)),
        conv("b", dia(0, 8)),
        conv("c", dia(1)),
        conv("d", dia(4)),
        conv("e", dia(20)),
      ],
      ahora,
    );
    expect(grupos.map((g) => g.etiqueta)).toEqual([
      "Hoy",
      "Ayer",
      "Esta semana",
      "Anteriores",
    ]);
    expect(grupos.map((g) => g.items.map((i) => i.id))).toEqual([
      ["a", "b"],
      ["c"],
      ["d"],
      ["e"],
    ]);
    expect(
      agruparPorFecha([conv("a", dia(0))], ahora).map((g) => g.etiqueta),
    ).toEqual(["Hoy"]);
    expect(agruparPorFecha([], ahora)).toEqual([]);
  });
  it("etiqueta el tema o «General» si no hay concepto", () => {
    expect(etiquetaTema("porcentajes")).toBe("Porcentajes");
    expect(etiquetaTema(null)).toBe("General");
    expect(etiquetaTema("geometria")).toBe("General");
  });
});
describe("lógica del chat (S3)", () => {
  it("Enter envía y Shift+Enter hace salto de línea", () => {
    expect(teclaEnvia({ key: "Enter", shiftKey: false })).toBe(true);
    expect(teclaEnvia({ key: "Enter", shiftKey: true })).toBe(false);
    expect(teclaEnvia({ key: "a", shiftKey: false })).toBe(false);
  });
  it("no envía mientras se compone con un método de entrada", () => {
    expect(
      teclaEnvia({ key: "Enter", shiftKey: false, isComposing: true }),
    ).toBe(false);
  });
  it("Ctrl o Cmd + Enter también envía", () => {
    expect(teclaEnvia({ key: "Enter", shiftKey: false, ctrlKey: true })).toBe(
      true,
    );
    expect(teclaEnvia({ key: "Enter", shiftKey: false, metaKey: true })).toBe(
      true,
    );
  });
  it("pluraliza bien", () => {
    expect(pluralizar(1, "idea", "ideas")).toBe("1 idea");
    expect(pluralizar(0, "idea", "ideas")).toBe("0 ideas");
    expect(pluralizar(2, "idea", "ideas")).toBe("2 ideas");
    expect(pluralizar(1, "idea más disponible", "ideas más disponibles")).toBe(
      "1 idea más disponible",
    );
  });
});
