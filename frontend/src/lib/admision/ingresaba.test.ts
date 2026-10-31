import { describe, expect, it } from "vitest";
import carrerasJson from "../../../../backend/data/fuentes/unmsm/carreras.json";
import procesosJson from "../../../../backend/data/fuentes/unmsm/procesos.json";
import resultadosJson from "../../../../backend/data/fuentes/unmsm/resultados.json";
import { carreraDeJson, procesoDeJson, resultadoDeJson, type ResultadoUnmsm } from "./datos-unmsm";
import { carrerasAlternativas, evaluarCarrera, evaluarProceso, puntajeComparable } from "./ingresaba";
import { preguntasParaSubir, umbralMarcar, valorDeMarcar } from "./formula";

const CARRERAS = carrerasJson.map(carreraDeJson);
const PROCESOS = procesosJson.map(procesoDeJson);
const RESULTADOS = resultadosJson.map(resultadoDeJson);

const resultado = (extra: Partial<ResultadoUnmsm> = {}): ResultadoUnmsm => ({
  ciclo: "2026-II", carrera_id: "medicina-humana", vacantes: 100, postulantes: 4000, asistentes: 3900, ingresantes: 100,
  ultimo_ingresante: 1329.125, maximo: 1624.875, fuente: "oca", verificado: true, nota: null, ...extra,
});

describe("la fórmula", () => {
  it("cada correcta (en lugar de un blanco) vale 20 puntos", () => {
    expect(preguntasParaSubir(0)).toBe(0);
    expect(preguntasParaSubir(20)).toBe(1);
    expect(preguntasParaSubir(20.001)).toBe(2);
    expect(preguntasParaSubir(69)).toBe(4);
  });
  it("marcar conviene desde un 5,3 % de acierto; en la actitudinal, siempre", () => {
    expect(umbralMarcar("algebra")).toBeCloseTo(1.125 / 21.125, 6);
    expect(umbralMarcar("actitudinal")).toBe(0);
    expect(valorDeMarcar(1 / 5, "algebra")).toBeCloseTo(3.1, 6);
  });
});

describe("evaluarProceso", () => {
  it("por encima del último ingresante: ingresaba, sin preguntas pendientes", () => {
    expect(evaluarProceso(1400, resultado())).toMatchObject({ ingresaba: true, empate: false, diferencia: 70.875, preguntasQueFaltan: 0, postulantesPorVacante: 40 });
  });
  it("empate exacto con el último ingresante: ingresa (en San Marcos ingresan todos los empatados)", () => {
    expect(evaluarProceso(1329.125, resultado())).toMatchObject({ ingresaba: true, empate: true, diferencia: 0, preguntasQueFaltan: 0 });
  });
  it("por debajo: dice cuántos puntos y cuántas correctas faltaban", () => {
    expect(evaluarProceso(1290, resultado())).toMatchObject({ ingresaba: false, diferencia: -39.125, preguntasQueFaltan: 2 });
  });
  it("todo en blanco (0 puntos) nunca ingresa: San Marcos exige puntaje positivo", () => {
    expect(evaluarProceso(0, resultado({ ultimo_ingresante: 0 }))).toMatchObject({ ingresaba: false, empate: true, cumpleRequisitoGeneral: false, preguntasQueFaltan: 1 });
  });
  it("sin último ingresante publicado no da veredicto", () => {
    expect(evaluarProceso(1500, resultado({ ultimo_ingresante: null, maximo: null }))).toMatchObject({ ingresaba: null, diferencia: null, preguntasQueFaltan: null });
  });
  it("sin vacantes publicadas calcula la competencia con los ingresantes", () => {
    expect(evaluarProceso(1500, resultado({ vacantes: null, ingresantes: 88, postulantes: 4350 })).postulantesPorVacante).toBe(49.4);
    expect(evaluarProceso(1500, resultado({ vacantes: 0, ingresantes: 0 })).postulantesPorVacante).toBeNull();
  });
});

describe("evaluarCarrera con los datos oficiales", () => {
  it("Medicina Humana: 1400 ingresaba en 2026-II (último 1329,125) y no en 2026-I (último 1469): le faltaban 4 preguntas", () => {
    const v = evaluarCarrera(1400, "medicina-humana", RESULTADOS, PROCESOS);
    expect(v.procesos.map((p) => [p.ciclo, p.ingresaba])).toEqual([["2026-II", true], ["2026-I", false]]);
    expect(v).toMatchObject({ veces: 1, conDato: 2, sinDatos: false });
    expect(v.procesos[1].preguntasQueFaltan).toBe(4);
  });
  it("una escuela sin resultados lo dice sin romper", () => {
    expect(evaluarCarrera(1500, "no-existe", RESULTADOS, PROCESOS)).toMatchObject({ procesos: [], veces: 0, conDato: 0, sinDatos: true });
    expect(evaluarCarrera(1500, "medicina-humana", [], PROCESOS).sinDatos).toBe(true);
  });
});

describe("carrerasAlternativas", () => {
  it("con 1100 en el Área A sugiere escuelas alcanzables del área, de la más exigente a la menos", () => {
    const alt = carrerasAlternativas(1100, "A", CARRERAS, RESULTADOS, PROCESOS, ["medicina-humana"]);
    expect(alt.length).toBeGreaterThan(0);
    expect(alt.every((a) => a.carrera.area === "A" && a.ultimo <= 1100 && a.margen >= 0)).toBe(true);
    expect(alt.map((a) => a.ultimo)).toEqual([...alt.map((a) => a.ultimo)].sort((a, b) => b - a));
    expect(alt.some((a) => a.carrera.id === "medicina-humana")).toBe(false);
  });
  it("con puntaje 0 o negativo no sugiere nada", () => {
    expect(carrerasAlternativas(0, "A", CARRERAS, RESULTADOS, PROCESOS)).toEqual([]);
  });
  it("con 2000 alcanza todas las del área con datos (hasta el límite)", () => {
    const conDatos = CARRERAS.filter((c) => c.area === "B" && RESULTADOS.some((r) => r.carrera_id === c.id && r.ultimo_ingresante !== null));
    expect(carrerasAlternativas(2000, "B", CARRERAS, RESULTADOS, PROCESOS, [], 50).length).toBe(conDatos.length);
  });
});

describe("puntajeComparable: qué intentos sirven para «¿Ingresaba?»", () => {
  const base = { estado: "entregado", modo: "simulacro", filtro: null, puntaje: 1200, informe: { maximo: 2000 } } as const;
  it("un simulacro o examen completo, tal cual", () => {
    expect(puntajeComparable(base)).toEqual({ puntaje: 1200, proyectado: false });
    expect(puntajeComparable({ ...base, modo: "real" })).toEqual({ puntaje: 1200, proyectado: false });
  });
  it("con menos de 100 preguntas válidas, se proyecta a 2000 y se dice", () => {
    expect(puntajeComparable({ ...base, puntaje: 590, informe: { maximo: 1180 } })).toEqual({ puntaje: 1000, proyectado: true });
  });
  it("una práctica, un intento a medias o uno con menos de 50 preguntas no sirve", () => {
    expect(puntajeComparable({ ...base, filtro: { curso: "algebra" } })).toBeNull();
    expect(puntajeComparable({ ...base, estado: "en_curso" })).toBeNull();
    expect(puntajeComparable({ ...base, informe: { maximo: 980 } })).toBeNull();
    expect(puntajeComparable({ ...base, puntaje: null })).toBeNull();
  });
});
