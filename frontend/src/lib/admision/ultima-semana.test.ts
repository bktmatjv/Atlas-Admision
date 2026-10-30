import { describe, expect, it } from "vitest";
import procesosJson from "../../../../backend/data/fuentes/unmsm/procesos.json";
import { procesoDeJson, type DistribucionUnmsm } from "./datos-unmsm";
import { diasHasta, enUltimaSemana, jornadaDe, planUltimaSemana } from "./ultima-semana";
import { percentil, racha } from "./progreso";

const PROCESOS = procesosJson.map(procesoDeJson);

describe("jornadaDe: el día de SU examen", () => {
  it("2027-I: D y E el 17, B y C el 18, A el 24 y Medicina Humana el 25 de octubre", () => {
    expect(jornadaDe(PROCESOS, "D", "2026-10-16")).toMatchObject({ ciclo: "2027-I", fecha: "2026-10-17", verificado: false });
    expect(jornadaDe(PROCESOS, "C", "2026-10-16")?.fecha).toBe("2026-10-18");
    expect(jornadaDe(PROCESOS, "A", "2026-10-16")?.fecha).toBe("2026-10-24");
    expect(jornadaDe(PROCESOS, "medicina", "2026-10-16")?.fecha).toBe("2026-10-25");
  });
  it("el mismo día del examen todavía es su jornada; al día siguiente, ya no hay próxima conocida", () => {
    expect(jornadaDe(PROCESOS, "E", "2026-10-17")?.fecha).toBe("2026-10-17");
    expect(jornadaDe(PROCESOS, "E", "2026-10-18")).toBeNull();
  });
});

describe("la cuenta atrás", () => {
  it("días en Lima y la última semana es de 7 a 0", () => {
    expect(diasHasta("2026-10-16", "2026-10-24")).toBe(8);
    expect(enUltimaSemana(8)).toBe(false);
    expect(enUltimaSemana(7)).toBe(true);
    expect(enUltimaSemana(0)).toBe(true);
    expect(enUltimaSemana(-1)).toBe(false);
  });
});

describe("planUltimaSemana", () => {
  it("de hoy al examen: temas y errores, un simulacro entre 5 y 3 días antes, el día anterior descanso, y el examen", () => {
    const plan = planUltimaSemana("2026-10-18", "2026-10-24", 4);
    expect(plan.map((d) => d.diasAlExamen)).toEqual([6, 5, 4, 3, 2, 1, 0]);
    expect(plan.find((d) => d.diasAlExamen === 5)!.actividades.map((a) => a.tipo)).toEqual(["simulacro"]);
    expect(plan.find((d) => d.diasAlExamen === 1)!.actividades.map((a) => a.tipo)).toEqual(["errores", "checklist", "descanso"]);
    expect(plan.at(-1)!.actividades[0].tipo).toBe("examen");
    expect(plan[0].actividades.find((a) => a.tipo === "errores")!.detalle).toMatch(/4 por repasar/);
  });
  it("a menos de 3 días no hay simulacro; a más de 7, no hay plan", () => {
    expect(planUltimaSemana("2026-10-15", "2026-10-17", 0).some((d) => d.actividades.some((a) => a.tipo === "simulacro"))).toBe(false);
    expect(planUltimaSemana("2026-10-10", "2026-10-24", 0)).toEqual([]);
  });
});

describe("progreso", () => {
  it("la racha cuenta días de Lima seguidos hasta hoy o ayer", () => {
    const r = racha(["2026-10-14T15:00:00Z", "2026-10-15T15:00:00Z", "2026-10-16T02:00:00Z", "2026-10-10T15:00:00Z"], "2026-10-16");
    // 16T02:00Z es el 15 en Lima: días 14 y 15, hoy (16) aún no.
    expect(r).toMatchObject({ actual: 2, mejor: 2 });
    // Del 10 al 16: el 10 (suelto), el 14 y el 15.
    expect(r.ultimos7).toEqual([true, false, false, false, true, true, false]);
  });
  it("el percentil frente a los postulantes reales, interpolando dentro del tramo", () => {
    const d: DistribucionUnmsm = { ciclo: "2026-II", carrera_id: "x", desde: 0, ancho: 100, conteos: [10, 10], fuente: "oca", verificado: true };
    expect(percentil(d, 0)).toBe(0);
    expect(percentil(d, 50)).toBe(25);
    expect(percentil(d, 150)).toBe(75);
    expect(percentil(d, 500)).toBe(100);
  });
});
