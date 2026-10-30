import { describe, expect, it } from "vitest";
import { CURSOS } from "./temario";
import { FORMULA_UNMSM, puntosDe } from "./formula";
import { PUNTOS, SIN_DESCUENTO, corregir, puntosDelError } from "@/lib/admision/motor/admision-correccion";

/** El servidor corrige y el navegador explica: si las dos fórmulas se separan, el informe miente. */
describe("la fórmula del navegador es la del servidor", () => {
  it("mismos puntos por acierto, error y blanco en cada curso", () => {
    expect([FORMULA_UNMSM.acierto, FORMULA_UNMSM.error, FORMULA_UNMSM.blanco]).toEqual([PUNTOS.acierto, PUNTOS.error, PUNTOS.blanco]);
    expect([...FORMULA_UNMSM.sinDescuento]).toEqual([...SIN_DESCUENTO]);
    for (const c of CURSOS) expect(puntosDe(c.id).error, c.id).toBe(puntosDelError(c.id));
  });

  it("y el mismo puntaje en 200 intentos al azar, sumando curso a curso como el informe", () => {
    let semilla = 7;
    const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n < 200; n++) {
      const preguntas = Array.from({ length: 100 }, (_, i) => ({ id: `q${i}`, clave: "A", curso: CURSOS[Math.floor(azar() * CURSOS.length)].id }));
      const respuestas = preguntas.map((p) => ({ pregunta_id: p.id, opcion: azar() < 0.2 ? null : azar() < 0.6 ? "A" : "B" }));
      const r = corregir(preguntas, respuestas);
      const enElNavegador = Object.values(r.porCurso).reduce((s, c) => s + Math.round(c.puntos * 1000), 0) / 1000;
      const aMano = preguntas.reduce((s, p, i) => {
        const o = respuestas[i].opcion;
        const v = puntosDe(p.curso);
        return s + Math.round((o === null ? v.blanco : o === p.clave ? v.acierto : v.error) * 1000);
      }, 0) / 1000;
      expect(r.puntaje).toBe(aMano);
      expect(enElNavegador).toBe(aMano);
    }
  });
});
