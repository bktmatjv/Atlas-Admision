import { describe, expect, it } from "vitest";
import carrerasJson from "../../../scripts/admision/unmsm/carreras.json";
import { carreraDeJson } from "./datos-unmsm";
import { areaDelExamen, buscarEscuelas } from "./buscar-escuela";

const CARRERAS = carrerasJson.map(carreraDeJson);
const ids = (q: string, n = 5) => buscarEscuelas(CARRERAS, q, n).map((c) => c.id);

describe("buscar la escuela", () => {
  it("sin tildes ni mayúsculas, y con las palabras en cualquier orden", () => {
    expect(ids("medicina humana")[0]).toBe("medicina-humana");
    expect(ids("MEDICINA")[0]).toBe("medicina-humana");
    expect(ids("sistemas ingenieria")[0]).toBe("ingenieria-de-sistemas");
    expect(ids("psicologia")).toContain("psicologia");
  });

  it("por el comienzo de cada palabra: «ing sist», «tec med», «psico»", () => {
    expect(ids("ing sist")[0]).toBe("ingenieria-de-sistemas");
    expect(ids("tec med").every((id) => id.startsWith("tec-med-"))).toBe(true);
    expect(ids("psico")).toContain("psicologia");
  });

  it("la sede principal antes que las de provincia", () => {
    expect(ids("derecho")).toEqual(["derecho", "derecho-chilca", "derecho-villa-rica"]);
  });

  it("vacío o sin coincidencias, lista vacía", () => {
    expect(ids("")).toEqual([]);
    expect(ids("   ")).toEqual([]);
    expect(ids("astronautica")).toEqual([]);
  });
});

describe("el área del examen", () => {
  it("Medicina Humana rinde su propio examen; el resto, el de su área", () => {
    expect(areaDelExamen({ id: "medicina-humana", area: "A" })).toBe("medicina");
    expect(areaDelExamen({ id: "enfermeria", area: "A" })).toBe("A");
    expect(areaDelExamen({ id: "derecho", area: "E" })).toBe("E");
  });
});
