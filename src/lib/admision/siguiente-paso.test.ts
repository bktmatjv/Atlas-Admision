import { describe, expect, it } from "vitest";
import { siguientePasoDeAdmision } from "./siguiente-paso";

const intento = (modo: string, estado: string, id = "i1") => ({ id, modo, estado });

describe("siguientePasoDeAdmision: un solo botón principal en /admision", () => {
  it("sin nada hecho: el diagnóstico", () => {
    expect(siguientePasoDeAdmision([])).toEqual({ tipo: "diagnostico" });
  });
  it("con un intento a medias: seguir con él, antes que nada", () => {
    expect(siguientePasoDeAdmision([intento("simulacro", "en_curso", "s1"), intento("diagnostico", "entregado")]))
      .toEqual({ tipo: "continuar", intentoId: "s1", modo: "simulacro" });
  });
  it("con el diagnóstico hecho: un simulacro de su área", () => {
    expect(siguientePasoDeAdmision([intento("diagnostico", "entregado")])).toEqual({ tipo: "simulacro" });
  });
  it("un simulacro o examen entregado también cuenta como punto de partida", () => {
    expect(siguientePasoDeAdmision([intento("real", "entregado")])).toEqual({ tipo: "simulacro" });
  });
  it("una práctica sola no sustituye al diagnóstico", () => {
    expect(siguientePasoDeAdmision([intento("practica", "entregado")])).toEqual({ tipo: "diagnostico" });
  });
});

describe("siguientePasoDeAdmision con prácticas de verdad", () => {
  it("una práctica se guarda como simulacro con filtro: tampoco sustituye al diagnóstico", () => {
    expect(siguientePasoDeAdmision([{ id: "p", modo: "simulacro", estado: "entregado", filtro: { curso: "aritmetica" } }])).toEqual({ tipo: "diagnostico" });
  });
});
