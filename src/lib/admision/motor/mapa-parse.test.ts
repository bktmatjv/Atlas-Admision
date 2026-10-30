import { describe, expect, it } from "vitest";
import { normalizar, parsearMapa, TOPE_DE_CONCEPTOS, type TrozoParaMapa } from "@/lib/admision/motor/mapa-parse";

const trozos: TrozoParaMapa[] = [
  { id: "t1", material_id: "m1", page_number: 2, content: "La matriz de riesgo cruza la probabilidad de que un suceso ocurra con el impacto que tendría." },
  { id: "t2", material_id: "m1", page_number: 4, content: "Se lee por cuadrantes: acción inmediata arriba a la derecha." },
  { id: "t3", material_id: "m2", page_number: 31, content: "La evaluación de riesgos en la auditoría interna." },
];

function respuesta(conceptos: unknown[], relaciones: unknown[] = []): string {
  return "Aquí va el mapa:\n```json\n" + JSON.stringify({ conceptos, relaciones }) + "\n```";
}

describe("normalizar", () => {
  it("la puntuación pegada a una palabra no impide casarla", () => {
    expect(normalizar("auditoría interna.")).toBe("auditoria interna");
    expect(normalizar("(riesgo), impacto:")).toBe("riesgo impacto");
  });

  it("quita mayúsculas, tildes y espacios repetidos", () => {
    expect(normalizar("  Matriz  de RIESGO ")).toBe("matriz de riesgo");
    expect(normalizar("Evaluación")).toBe("evaluacion");
  });
});

describe("parsearMapa", () => {
  it("acepta un concepto que aparece literalmente en la página que cita", () => {
    const mapa = parsearMapa(respuesta(
      [{ termino: "matriz de riesgo", pagina: 2, material_id: "m1" }, { termino: "cuadrantes", pagina: 4, material_id: "m1" }],
      [{ desde: "matriz de riesgo", hasta: "cuadrantes", tipo: "es-parte-de" }],
    ), trozos);
    expect(mapa.conceptos.map((c) => c.termino_normalizado)).toEqual(["matriz de riesgo", "cuadrantes"]);
    expect(mapa.relaciones).toEqual([{ desde: "matriz de riesgo", hasta: "cuadrantes", tipo: "es-parte-de" }]);
  });

  it("descarta un concepto que no está literalmente en el material", () => {
    const mapa = parsearMapa(respuesta(
      [{ termino: "gestión proactiva", pagina: 2, material_id: "m1" }, { termino: "matriz de riesgo", pagina: 2, material_id: "m1" }, { termino: "cuadrantes", pagina: 4, material_id: "m1" }],
      [{ desde: "matriz de riesgo", hasta: "cuadrantes", tipo: "requiere" }],
    ), trozos);
    expect(mapa.conceptos.map((c) => c.termino)).toEqual(["matriz de riesgo", "cuadrantes"]);
    expect(mapa.descartes["sin-frase-literal"]).toBe(1);
  });

  it("descarta un concepto que cita la página equivocada", () => {
    // "cuadrantes" está en la 4, no en la 2. La cita es obligatoria y tiene que ser cierta.
    const mapa = parsearMapa(respuesta(
      [{ termino: "cuadrantes", pagina: 2, material_id: "m1" }, { termino: "matriz de riesgo", pagina: 2, material_id: "m1" }, { termino: "impacto", pagina: 2, material_id: "m1" }],
      [{ desde: "matriz de riesgo", hasta: "impacto", tipo: "es-parte-de" }],
    ), trozos);
    expect(mapa.conceptos.map((c) => c.termino)).toEqual(["matriz de riesgo", "impacto"]);
  });

  it("compara sin mayúsculas ni tildes, pero exige la secuencia de palabras", () => {
    const mapa = parsearMapa(respuesta(
      [{ termino: "Evaluacion de Riesgos", pagina: 31, material_id: "m2" }, { termino: "riesgos evaluación", pagina: 31, material_id: "m2" }, { termino: "auditoría interna", pagina: 31, material_id: "m2" }],
      [{ desde: "Evaluacion de Riesgos", hasta: "auditoría interna", tipo: "se-relaciona-con" }],
    ), trozos);
    expect(mapa.conceptos.map((c) => c.termino_normalizado)).toEqual(["evaluacion de riesgos", "auditoria interna"]);
  });

  it("descarta un concepto sin página", () => {
    const mapa = parsearMapa(respuesta(
      [{ termino: "matriz de riesgo", material_id: "m1" }, { termino: "impacto", pagina: 2, material_id: "m1" }, { termino: "cuadrantes", pagina: 4, material_id: "m1" }],
      [{ desde: "impacto", hasta: "cuadrantes", tipo: "causa" }],
    ), trozos);
    expect(mapa.conceptos.map((c) => c.termino)).toEqual(["impacto", "cuadrantes"]);
    expect(mapa.descartes["sin-pagina"]).toBe(1);
  });

  it("descarta la relación cuyo extremo no sobrevivió", () => {
    const mapa = parsearMapa(respuesta(
      [{ termino: "matriz de riesgo", pagina: 2, material_id: "m1" }, { termino: "impacto", pagina: 2, material_id: "m1" }, { termino: "inventado", pagina: 2, material_id: "m1" }],
      [{ desde: "matriz de riesgo", hasta: "inventado", tipo: "causa" }, { desde: "matriz de riesgo", hasta: "impacto", tipo: "es-parte-de" }],
    ), trozos);
    expect(mapa.relaciones).toHaveLength(1);
    expect(mapa.descartes["relacion-colgante"]).toBe(1);
  });

  it("descarta la relación con un tipo fuera del conjunto y la que va de un concepto a sí mismo", () => {
    const mapa = parsearMapa(respuesta(
      [{ termino: "matriz de riesgo", pagina: 2, material_id: "m1" }, { termino: "impacto", pagina: 2, material_id: "m1" }],
      [{ desde: "matriz de riesgo", hasta: "impacto", tipo: "implica" }, { desde: "impacto", hasta: "impacto", tipo: "causa" }, { desde: "matriz de riesgo", hasta: "impacto", tipo: "es-parte-de" }],
    ), trozos);
    expect(mapa.relaciones).toEqual([{ desde: "matriz de riesgo", hasta: "impacto", tipo: "es-parte-de" }]);
    expect(mapa.descartes["tipo-desconocido"]).toBe(1);
    expect(mapa.descartes["autorreferencia"]).toBe(1);
  });

  it("funde los conceptos repetidos y las relaciones repetidas", () => {
    const mapa = parsearMapa(respuesta(
      [{ termino: "Impacto", pagina: 2, material_id: "m1" }, { termino: "impacto", pagina: 2, material_id: "m1" }, { termino: "cuadrantes", pagina: 4, material_id: "m1" }],
      [{ desde: "impacto", hasta: "cuadrantes", tipo: "causa" }, { desde: "Impacto", hasta: "cuadrantes", tipo: "causa" }],
    ), trozos);
    expect(mapa.conceptos).toHaveLength(2);
    expect(mapa.relaciones).toHaveLength(1);
  });

  it("corta en el tope y conserva el orden del modelo", () => {
    const muchos = Array.from({ length: TOPE_DE_CONCEPTOS + 5 }, (_, i) => ({ termino: `c${i}`, pagina: 1, material_id: "m9" }));
    const trozoConTodos: TrozoParaMapa[] = [{ id: "x", material_id: "m9", page_number: 1, content: muchos.map((c) => c.termino).join(" ") }];
    const mapa = parsearMapa(respuesta(muchos, [{ desde: "c0", hasta: "c1", tipo: "causa" }]), trozoConTodos);
    // Los primeros TOPE en el orden del modelo, y ninguno de los cinco que sobran.
    expect(mapa.conceptos.map((c) => c.termino)).toEqual(
      Array.from({ length: TOPE_DE_CONCEPTOS }, (_, i) => `c${i}`),
    );
    expect(mapa.descartes["tope"]).toBe(5);
  });

  it("sin dos conceptos con relación, no hay mapa", () => {
    const solo = parsearMapa(respuesta([{ termino: "impacto", pagina: 2, material_id: "m1" }]), trozos);
    expect(solo.conceptos).toEqual([]);
    expect(solo.relaciones).toEqual([]);
    const sinRelacion = parsearMapa(respuesta(
      [{ termino: "impacto", pagina: 2, material_id: "m1" }, { termino: "cuadrantes", pagina: 4, material_id: "m1" }],
    ), trozos);
    expect(sinRelacion.conceptos).toEqual([]);
    expect(sinRelacion.descartes["umbral"]).toBe(1);
  });

  it("lanza si la respuesta no trae un objeto JSON", () => {
    expect(() => parsearMapa("no hay nada aquí", trozos)).toThrow();
  });
});
