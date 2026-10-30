import { describe, expect, it } from "vitest";
import { agruparTemas, categoria } from "./temas";

describe("categoria", () => {
  it("siempre (≥ 75 % de los procesos), a veces (≥ 35 %), rara vez", () => {
    expect(categoria(1)).toBe("siempre");
    expect(categoria(0.75)).toBe("siempre");
    expect(categoria(0.5)).toBe("a-veces");
    expect(categoria(0.35)).toBe("a-veces");
    expect(categoria(0.2)).toBe("rara-vez");
    expect(categoria(0)).toBe("nunca");
  });
});

describe("agruparTemas", () => {
  const filas = [
    { curso: "biologia", tema: "genetica", procesos: 8, preguntas: 14, procesos_del_area: 8 },
    { curso: "biologia", tema: "ecologia", procesos: 3, preguntas: 3, procesos_del_area: 8 },
    { curso: "trigonometria", tema: "identidades", procesos: 2, preguntas: 2, procesos_del_area: 8 },
  ];
  const r = agruparTemas(filas);

  it("cuántos procesos lo respaldan, y el porcentaje sobre los del área", () => {
    expect(r.procesos).toBe(8);
    const gen = r.cursos[0].temas[0];
    expect(gen).toMatchObject({ tema: "genetica", nombre: "Genética", procesos: 8, frecuencia: 1, porProceso: 1.8, categoria: "siempre" });
  });

  it("cursos de más preguntas a menos; dentro, temas de más frecuentes a menos", () => {
    expect(r.cursos.map((c) => c.curso)).toEqual(["biologia", "trigonometria"]);
    expect(r.cursos[0].temas.slice(0, 2).map((t) => t.tema)).toEqual(["genetica", "ecologia"]);
  });

  it("incluye los temas del temario que nunca vinieron: también es información", () => {
    const nunca = r.cursos[0].temas.filter((t) => t.categoria === "nunca");
    expect(nunca.length).toBeGreaterThan(0);
    expect(nunca.every((t) => t.procesos === 0)).toBe(true);
  });

  it("sin filas, sin procesos (la pantalla lo dice y no inventa)", () => {
    expect(agruparTemas([])).toEqual({ procesos: 0, cursos: [] });
  });
});
