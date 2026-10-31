import { describe, expect, it } from "vitest";
import {
  ESTADO_TEXTO,
  aristasCamino,
  descripcionNodo,
  jerarquia,
  radioNodo,
  textoEstado,
  type Grafo,
} from "./grafo";
const nodo = (id: string, extra: Partial<Grafo["nodos"][number]> = {}) => ({
  id,
  arbol_id: "a1",
  tipo: "idea",
  titulo: "Nodo " + id,
  resumen: "",
  idea_clave: null,
  concepto: "porcentajes",
  estado: "sin_explorar" as const,
  senal: null,
  origen: "ia",
  evidencias: 0,
  ...extra,
});
const arista = (origen: string, destino: string, tipo = "subtema") => ({
  id: `${origen}-${destino}`,
  origen,
  destino,
  tipo,
  creada_por: "sistema",
});
describe("jerarquia (lista para móvil)", () => {
  it("agrupa por aristas subtema desde las raíces", () => {
    const g: Pick<Grafo, "nodos" | "aristas"> = {
      nodos: [nodo("r"), nodo("a"), nodo("b"), nodo("c"), nodo("sola")],
      aristas: [
        arista("r", "a"),
        arista("r", "b"),
        arista("a", "c"),
        arista("c", "sola", "relacionado"),
      ],
    };
    const arbol = jerarquia(g);
    expect(arbol.map((n) => n.nodo.id)).toEqual(["r", "sola"]);
    expect(arbol[0].hijos.map((n) => n.nodo.id)).toEqual(["a", "b"]);
    expect(arbol[0].hijos[0].hijos.map((n) => n.nodo.id)).toEqual(["c"]);
    expect(arbol[0].hijos[0].hijos[0].profundidad).toBe(2);
  });
  it("no se cuelga con ciclos y no pierde nodos", () => {
    const g = {
      nodos: [nodo("x"), nodo("y")],
      aristas: [arista("x", "y"), arista("y", "x")],
    };
    const ids: string[] = [];
    const recorrer = (l: ReturnType<typeof jerarquia>) =>
      l.forEach((n) => {
        ids.push(n.nodo.id);
        recorrer(n.hijos);
      });
    recorrer(jerarquia(g));
    expect(ids.sort()).toEqual(["x", "y"]);
  });
  it("un nodo con dos padres aparece una sola vez", () => {
    const g = {
      nodos: [nodo("p"), nodo("q"), nodo("h")],
      aristas: [arista("p", "h"), arista("q", "h")],
    };
    const ids: string[] = [];
    const recorrer = (l: ReturnType<typeof jerarquia>) =>
      l.forEach((n) => {
        ids.push(n.nodo.id);
        recorrer(n.hijos);
      });
    recorrer(jerarquia(g));
    expect(ids.filter((i) => i === "h")).toHaveLength(1);
  });
});
describe("camino del error", () => {
  it("marca los tramos consecutivos", () => {
    const k = aristasCamino(["r", "a", "b"]);
    expect(k.has("r>a")).toBe(true);
    expect(k.has("a>b")).toBe(true);
    expect(k.has("r>b")).toBe(false);
    expect(aristasCamino([]).size).toBe(0);
  });
});
describe("presentación de nodos", () => {
  it("el tamaño crece con las evidencias y se acota", () => {
    expect(radioNodo(0)).toBeLessThan(radioNodo(3));
    expect(radioNodo(100)).toBe(radioNodo(6));
    expect(radioNodo(-2)).toBe(radioNodo(0));
  });
  it("el estado se dice con palabras, no solo con color", () => {
    for (const e of ["sin_explorar", "explorado", "fallo", "aplicado"] as const)
      expect(ESTADO_TEXTO[e].length).toBeGreaterThan(3);
    const d = descripcionNodo(
      nodo("n", { estado: "fallo", senal: "posible_confusion", evidencias: 2 }),
    );
    expect(d).toContain(ESTADO_TEXTO.fallo);
    expect(d).toMatch(/posible confusión/i);
    expect(d).toContain("2");
  });
});
describe("estado a la vista de un nodo de error (S5)", () => {
  it("un error nuevo no se presenta como «Sin explorar»", () => {
    const e = nodo("e", { tipo: "error", estado: "sin_explorar" });
    expect(textoEstado(e)).toBe("Error por comprobar");
    expect(descripcionNodo(e)).toContain("Error por comprobar");
  });
  it("la señal se dice como posible confusión provisional", () => {
    const e = nodo("e", { tipo: "idea", senal: "posible_confusion" });
    expect(textoEstado(e)).toBe(
      "Sin explorar · posible confusión (provisional)",
    );
  });
  it("el estado real no se disfraza: un error con fallo o aplicado conserva su texto", () => {
    expect(textoEstado(nodo("e", { tipo: "error", estado: "fallo" }))).toBe(
      ESTADO_TEXTO.fallo,
    );
    expect(textoEstado(nodo("e", { tipo: "error", estado: "aplicado" }))).toBe(
      ESTADO_TEXTO.aplicado,
    );
    expect(textoEstado(nodo("i", { tipo: "idea", estado: "explorado" }))).toBe(
      ESTADO_TEXTO.explorado,
    );
  });
});
