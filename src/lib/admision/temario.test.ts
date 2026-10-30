import { describe, expect, it } from "vitest";
import { AREAS, COMMON_SECTIONS } from "@/lib/onboarding/catalog";
import { CURSOS, cursoPorId, temaValido, temarioParaPrompt } from "./temario";

describe("temario de San Marcos", () => {
  it("tiene un curso por cada asignatura del molde y cada bloque común", () => {
    const nombres = new Set(CURSOS.map((c) => c.nombre));
    for (const s of COMMON_SECTIONS) expect(nombres, s.name).toContain(s.name);
    for (const area of Object.values(AREAS)) {
      for (const s of area.subjects) expect(nombres, s.name).toContain(s.name);
    }
  });

  it("los ids de curso y de tema son únicos y en kebab-case", () => {
    const ids = CURSOS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CURSOS) {
      expect(c.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(c.temas.length, c.id).toBeGreaterThanOrEqual(3);
      const temas = c.temas.map((t) => t.id);
      expect(new Set(temas).size, c.id).toBe(temas.length);
      for (const t of temas) expect(t).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("valida curso y tema juntos", () => {
    expect(temaValido("biologia", "genetica")).toBe(true);
    expect(temaValido("biologia", "estequiometria")).toBe(false);
    expect(temaValido("no-existe", "genetica")).toBe(false);
    expect(cursoPorId("quimica")?.bloque).toBe("conocimientos");
    expect(cursoPorId("habilidad-verbal")?.bloque).toBe("verbal");
  });

  it("el texto para el prompt lista cada curso con sus temas", () => {
    const texto = temarioParaPrompt();
    expect(texto).toMatch(/^biologia: (.+, )?genetica(,|$)/m);
    expect(texto.split("\n").length).toBe(CURSOS.length);
  });
});
