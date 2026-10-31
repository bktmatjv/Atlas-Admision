import { describe, expect, it } from "vitest";
import { ACIERTO_SIN_DATOS, HORAS_POR_10PP, TOPE_POR_CURSO, planDePuntos } from "./plan";
import { CURSOS } from "./temario";

const conteo = (curso: string, aciertos: number, errores: number, blancos: number) => ({ curso, aciertos, errores, blancos });

describe("planDePuntos", () => {
  it("reparte las horas de la semana sin pasarse, en bloques de media hora", () => {
    const plan = planDePuntos([], "A", 10);
    const total = plan.prioridades.reduce((s, p) => s + p.horas, 0);
    expect(total).toBeLessThanOrEqual(10);
    expect(total).toBeGreaterThanOrEqual(9.5);
    expect(plan.prioridades.every((p) => (p.horas * 2) % 1 === 0)).toBe(true);
  });

  it("ningún curso se lleva más del 35 % (y nunca menos de 2 h de tope)", () => {
    const plan = planDePuntos([], "A", 20);
    expect(Math.max(...plan.prioridades.map((p) => p.horas))).toBeLessThanOrEqual(Math.max(2, 20 * TOPE_POR_CURSO));
  });

  it("sin datos de un curso supone un 40 % y lo dice", () => {
    const bio = planDePuntos([], "A", 10).prioridades.find((p) => p.curso === "biologia")!;
    expect(bio).toMatchObject({ acierto: ACIERTO_SIN_DATOS, sinDatos: true, peso: 8 });
  });

  it("con todo dominado (95 % o más) un curso no recibe horas", () => {
    const plan = planDePuntos([conteo("biologia", 20, 0, 0)], "A", 10);
    expect(plan.prioridades.find((p) => p.curso === "biologia")?.horas ?? 0).toBe(0);
  });

  it("a igual acierto, rinde más el curso con más peso en el área", () => {
    const todos = ["biologia", "trigonometria"].map((c) => conteo(c, 2, 2, 1));
    const plan = planDePuntos(todos, "A", 4);
    const bio = plan.prioridades.find((p) => p.curso === "biologia")!;
    const tri = plan.prioridades.find((p) => p.curso === "trigonometria")!;
    expect(bio.puntosPorHora).toBeGreaterThan(tri.puntosPorHora);
  });

  it("solo los cursos del examen del área, de más horas a menos", () => {
    const plan = planDePuntos([conteo("algebra", 0, 3, 0)], "E", 10);
    expect(plan.prioridades.every((p) => p.peso > 0)).toBe(true);
    expect(plan.prioridades.map((p) => p.horas)).toEqual([...plan.prioridades.map((p) => p.horas)].sort((a, b) => b - a));
  });

  it("hay supuesto de horas para cada curso del temario", () => {
    for (const c of CURSOS) expect(HORAS_POR_10PP[c.id], c.id).toBeGreaterThan(0);
  });
});
