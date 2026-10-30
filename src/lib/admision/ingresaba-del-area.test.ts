import { describe, expect, it } from "vitest";
import { ingresabaDelArea, intentoValidoParaIngresaba, pasoParaSuArea, soloDeSuArea, type IntentoConArea } from "./ingresaba-del-area";

const simulacro = (area: IntentoConArea["area"], puntaje: number, created_at: string): IntentoConArea => ({
  modo: "simulacro", filtro: null, area, estado: "entregado", puntaje, created_at,
  informe: { maximo: 2000 },
});

describe("ingresabaDelArea", () => {
  it("con escuela del Área E no usa un simulacro del Área A: dice qué simulacro hacer", () => {
    const r = ingresabaDelArea([simulacro("A", 1290, "2026-10-16")], "E");
    expect(r).toEqual({ tipo: "falta-area", area: "E", texto: "Haz un simulacro del Área E para saber si ingresabas en tu escuela." });
  });

  it("con escuela del Área E usa el último simulacro del Área E aunque haya uno más nuevo de otra área", () => {
    const r = ingresabaDelArea([simulacro("A", 1290, "2026-10-16"), simulacro("E", 900, "2026-10-10")], "E");
    expect(r).toMatchObject({ tipo: "veredicto", puntaje: 900, fecha: "2026-10-10" });
  });

  it("Medicina Humana solo vale con su propio examen", () => {
    const r = ingresabaDelArea([simulacro("A", 1500, "2026-10-16")], "medicina");
    expect(r).toEqual({ tipo: "falta-area", area: "medicina", texto: "Haz un simulacro de Medicina Humana para saber si ingresabas en tu escuela." });
  });

  it("sin escuela elegida se queda como estaba: el primer intento completo de cualquier área", () => {
    const r = ingresabaDelArea([simulacro("A", 1290, "2026-10-16")], null);
    expect(r).toMatchObject({ tipo: "veredicto", puntaje: 1290 });
  });

  it("sin ningún intento completo no dice nada", () => {
    expect(ingresabaDelArea([], "E")).toBeNull();
    expect(ingresabaDelArea([], null)).toBeNull();
  });
});

describe("ingresabaDelArea con el nombre de la escuela", () => {
  it("lo pone en el siguiente paso", () => {
    expect(ingresabaDelArea([simulacro("A", 1290, "2026-10-16")], "E", "Derecho")).toMatchObject({
      texto: "Haz un simulacro del Área E para saber si ingresabas en Derecho.",
    });
  });
});

describe("pasoParaSuArea", () => {
  it("dice qué simulacro hacer, no lo que falló", () => {
    expect(pasoParaSuArea("C", "Ingeniería de Sistemas")).toBe("Haz un simulacro del Área C para saber si ingresabas en Ingeniería de Sistemas.");
  });
});

describe("soloDeSuArea (el progreso y el percentil)", () => {
  it("con escuela, deja solo los de su área", () => {
    const xs = [simulacro("A", 1290, "2026-10-16"), simulacro("E", 900, "2026-10-10")];
    expect(soloDeSuArea(xs, "E").map((x) => x.puntaje)).toEqual([900]);
  });
  it("sin escuela, todos", () => {
    expect(soloDeSuArea([simulacro("A", 1290, "2026-10-16")], null)).toHaveLength(1);
  });
});

describe("intentoValidoParaIngresaba", () => {
  it("vale el de su área, no el de otra; sin escuela, cualquiera", () => {
    expect(intentoValidoParaIngresaba({ area: "E" }, "E")).toBe(true);
    expect(intentoValidoParaIngresaba({ area: "A" }, "E")).toBe(false);
    expect(intentoValidoParaIngresaba({ area: "A" }, "medicina")).toBe(false);
    expect(intentoValidoParaIngresaba({ area: "A" }, null)).toBe(true);
  });
});
