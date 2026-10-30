import { describe, expect, it } from "vitest";
import { DIAS_POR_CAJA, anotarFallos, aplicarRepaso, diaDeLima, paraHoy, resumenDelCuaderno, sumarDias, type EntradaDeErrores } from "@/lib/admision/motor/admision-leitner";

const e = (extra: Partial<EntradaDeErrores> = {}): EntradaDeErrores => ({
  pregunta_id: "p", caja: 1, proxima: "2026-10-16", veces: 1, repasos: 0, dominada: false, agregada_en: "2026-10-15", ...extra,
});

describe("fechas en Lima", () => {
  it("el día de Lima, no el de Greenwich (a las 2 de la mañana UTC aún es el día anterior)", () => {
    expect(diaDeLima("2026-10-16T02:00:00Z")).toBe("2026-10-15");
    expect(diaDeLima("2026-10-16T06:00:00Z")).toBe("2026-10-16");
  });
  it("sumar días cruza meses", () => {
    expect(sumarDias("2026-10-30", 3)).toBe("2026-11-02");
  });
});

describe("anotarFallos", () => {
  it("un error nuevo entra a la caja 1 con repaso mañana", () => {
    expect(anotarFallos(new Map(), ["a"], "2026-10-15")).toEqual([
      { pregunta_id: "a", caja: 1, proxima: "2026-10-16", veces: 1, repasos: 0, dominada: false, agregada_en: "2026-10-15" },
    ]);
  });
  it("volver a fallar una que ya estaba (aunque dominada) la devuelve a la caja 1 y suma la vez", () => {
    const previas = new Map([["a", e({ pregunta_id: "a", caja: 3, dominada: true, veces: 2, agregada_en: "2026-10-01" })]]);
    expect(anotarFallos(previas, ["a"], "2026-10-15")[0]).toMatchObject({ caja: 1, proxima: "2026-10-16", veces: 3, dominada: false, agregada_en: "2026-10-01" });
  });
  it("una pregunta repetida en la lista se anota una vez", () => {
    expect(anotarFallos(new Map(), ["a", "a"], "2026-10-15")).toHaveLength(1);
  });
});

describe("aplicarRepaso (1, 3 y 7 días)", () => {
  it("acertar sube de caja y aleja el repaso", () => {
    expect(aplicarRepaso(e(), true, "2026-10-16")).toMatchObject({ caja: 2, proxima: "2026-10-19", repasos: 1 });
    expect(aplicarRepaso(e({ caja: 2 }), true, "2026-10-16")).toMatchObject({ caja: 3, proxima: "2026-10-23" });
  });
  it("acertar en la caja 3 la da por dominada", () => {
    expect(aplicarRepaso(e({ caja: 3 }), true, "2026-10-16")).toMatchObject({ caja: 3, dominada: true, repasos: 1 });
  });
  it("fallar (o dejarla en blanco) la devuelve a la caja 1", () => {
    expect(aplicarRepaso(e({ caja: 3, veces: 2 }), false, "2026-10-16")).toMatchObject({ caja: 1, proxima: "2026-10-17", veces: 3, dominada: false });
  });
  it("los días de cada caja son 1, 3 y 7", () => {
    expect(DIAS_POR_CAJA).toEqual({ 1: 1, 2: 3, 3: 7 });
  });
});

describe("lo que toca hoy", () => {
  const cuaderno = [
    e({ pregunta_id: "atrasada", proxima: "2026-10-10", caja: 2 }),
    e({ pregunta_id: "hoy", proxima: "2026-10-15", caja: 1 }),
    e({ pregunta_id: "manana", proxima: "2026-10-16" }),
    e({ pregunta_id: "dominada", proxima: "2026-10-01", dominada: true }),
  ];
  it("las de hoy y las atrasadas, primero las más atrasadas; nunca las dominadas", () => {
    expect(paraHoy(cuaderno, "2026-10-15").map((x) => x.pregunta_id)).toEqual(["atrasada", "hoy"]);
  });
  it("el resumen: para hoy, por caja, dominadas y el próximo repaso", () => {
    expect(resumenDelCuaderno(cuaderno, "2026-10-15")).toEqual({ hoy: 2, porCaja: { 1: 2, 2: 1, 3: 0 }, dominadas: 1, proxima: "2026-10-16", total: 4 });
  });
});
