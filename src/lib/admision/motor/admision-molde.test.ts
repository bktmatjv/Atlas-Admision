import { describe, expect, it } from "vitest";
import { AREAS, COMMON_SECTIONS } from "@/lib/onboarding/catalog";
import { CURSOS } from "@/lib/admision/temario";
import { MOLDES, MOLDE_COMUN, moldeDe } from "@/lib/admision/motor/admision-molde";

const idDe = (nombre: string) => {
  const c = CURSOS.find((x) => x.nombre === nombre);
  if (!c) throw new Error(`curso sin id: ${nombre}`);
  return c.id;
};
const LETRA = { A: "salud", B: "basicas", C: "ingenieria", D: "economicas", E: "humanidades" } as const;

describe("admision-molde", () => {
  it("la copia coincide con catalog.ts (src/ no se despliega con las funciones)", () => {
    expect(MOLDE_COMUN).toEqual(COMMON_SECTIONS.map((s) => ({ curso: idDe(s.name), preguntas: s.questions })));
    for (const [letra, area] of Object.entries(LETRA)) {
      expect(MOLDES[letra as keyof typeof LETRA], letra).toEqual(AREAS[area].subjects.map((s) => ({ curso: idDe(s.name), preguntas: s.questions })));
    }
  });
  it("cada área suma 70 y el examen 100; medicina usa el molde de A", () => {
    for (const m of Object.values(MOLDES)) expect(m.reduce((s, x) => s + x.preguntas, 0)).toBe(70);
    expect(moldeDe("B").reduce((s, x) => s + x.preguntas, 0)).toBe(100);
    expect(moldeDe("medicina")).toEqual(moldeDe("A"));
  });
});
