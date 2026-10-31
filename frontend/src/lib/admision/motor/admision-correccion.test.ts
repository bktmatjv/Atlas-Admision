import { describe, expect, it } from "vitest";
import { corregir } from "@/lib/admision/motor/admision-correccion";

const P = [
  { id: "a", clave: "B", curso: "biologia" },
  { id: "b", clave: "C", curso: "biologia" },
  { id: "c", clave: "A", curso: "fisica" },
  { id: "d", clave: "D", curso: "fisica" },
];

describe("corregir", () => {
  it("+20 por acierto, −1,125 por error, 0 en blanco; el máximo es 20 por pregunta", () => {
    const r = corregir(P, [{ pregunta_id: "a", opcion: "B" }, { pregunta_id: "b", opcion: "A" }, { pregunta_id: "c", opcion: null }]);
    expect(r).toMatchObject({ aciertos: 1, errores: 1, blancos: 2, puntaje: 18.875, maximo: 80 });
    expect(r.porPregunta).toEqual([
      { pregunta_id: "a", correcta: true }, { pregunta_id: "b", correcta: false },
      { pregunta_id: "c", correcta: null }, { pregunta_id: "d", correcta: null },
    ]);
    expect(r.porCurso).toEqual({ biologia: { aciertos: 1, errores: 1, blancos: 0, puntos: 18.875 }, fisica: { aciertos: 0, errores: 0, blancos: 2, puntos: 0 } });
  });
  it("ignora respuestas a preguntas que no son del intento", () => {
    expect(corregir(P, [{ pregunta_id: "zzz", opcion: "A" }]).blancos).toBe(4);
  });
  it("una pregunta sin clave (descartada después de armar) queda anulada: ni cuenta ni suma al máximo", () => {
    const r = corregir([...P, { id: "e", clave: null, curso: "fisica" }], [{ pregunta_id: "e", opcion: "A" }]);
    expect(r.porPregunta.at(-1)).toEqual({ pregunta_id: "e", correcta: null });
    expect(r).toMatchObject({ aciertos: 0, errores: 0, blancos: 4, anuladas: 1, maximo: 80 });
  });
  it("el puntaje no sale con decimales de coma flotante", () => {
    const muchos = Array.from({ length: 8 }, (_, i) => ({ id: `x${i}`, clave: "A", curso: null }));
    expect(corregir(muchos, muchos.map((m) => ({ pregunta_id: m.id, opcion: "B" }))).puntaje).toBe(-9);
  });
  it("la sección actitudinal no descuenta (reglamento 2026-I, por verificar)", () => {
    const act = [{ id: "a1", clave: "A", curso: "actitudinal" }, { id: "a2", clave: "B", curso: "actitudinal" }, { id: "m", clave: "C", curso: "algebra" }];
    const r = corregir(act, [{ pregunta_id: "a1", opcion: "C" }, { pregunta_id: "a2", opcion: "B" }, { pregunta_id: "m", opcion: "A" }]);
    expect(r).toMatchObject({ aciertos: 1, errores: 2, blancos: 0, puntaje: 18.875, maximo: 60 });
    expect(r.porCurso.actitudinal).toEqual({ aciertos: 1, errores: 1, blancos: 0, puntos: 20 });
    expect(r.porCurso.algebra.puntos).toBe(-1.125);
  });
  it("todo mal en un examen de 100 da −101,25: las 10 actitudinales no restan", () => {
    const examen = Array.from({ length: 100 }, (_, i) => ({ id: `q${i}`, clave: "A", curso: i < 10 ? "actitudinal" : "algebra" }));
    expect(corregir(examen, examen.map((q) => ({ pregunta_id: q.id, opcion: "B" }))).puntaje).toBe(-101.25);
  });
});
