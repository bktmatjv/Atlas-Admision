import { describe, it, expect } from "vitest";
import {
  PLANTILLAS,
  claveInstancia,
  generar,
  generarNoExpuesta,
  instanciaDesdeClave,
  instancias,
  opciones,
  respuestaDeActividad,
} from "../src/modules/seguimiento/plantillas";
import { esClaveDe } from "../src/modules/seguimiento/actividades";
const nombres = [
  "porcentaje_encadenado",
  "porcentaje_para_volver",
  "complemento_de_fraccion",
  "fraccion_de_cantidad",
  "proporcion_inversa",
  "proporcion_directa",
];
describe("plantillas paramétricas (§4.2)", () => {
  it("define las 6 plantillas mínimas en los 3 conceptos", () => {
    expect(PLANTILLAS.map((p) => p.nombre)).toEqual(nombres);
    expect(new Set(PLANTILLAS.map((p) => p.concepto))).toEqual(
      new Set(["porcentajes", "fracciones", "proporciones"]),
    );
  });
  it("la misma semilla produce el mismo resultado", () => {
    for (const n of nombres)
      for (const s of [0, 1, 7, 42, 1234])
        expect(generar(n, s)).toEqual(generar(n, s));
  });
  it("semillas distintas recorren combinaciones distintas", () => {
    for (const n of nombres) {
      const claves = new Set(
        Array.from({ length: 60 }, (_, s) => claveInstancia(generar(n, s))),
      );
      expect(claves.size, n).toBeGreaterThan(3);
    }
  });
  it("la forma de la instancia es la del diseño", () => {
    for (const n of nombres) {
      const i = generar(n, 3);
      expect(i.plantilla).toBe(n);
      expect(i.concepto).toBeTruthy();
      expect(Number.isFinite(i.respuesta)).toBe(true);
      expect(i.enunciado_base.length).toBeGreaterThan(20);
      expect(i.distractores.length).toBeGreaterThanOrEqual(2);
      for (const v of Object.values(i.parametros))
        expect(typeof v).toBe("number");
    }
  });
  it("ningún distractor coincide con la respuesta ni con otro distractor", () => {
    for (const n of nombres) {
      const todas = instancias(n);
      expect(todas.length, n).toBeGreaterThan(0);
      for (const i of todas) {
        const valores = i.distractores.map((d) => d.valor);
        expect(valores, claveInstancia(i)).not.toContain(i.respuesta);
        expect(new Set(valores).size, claveInstancia(i)).toBe(valores.length);
      }
    }
  });
  it("toda idea_clave existe en el catálogo del concepto", () => {
    for (const n of nombres)
      for (const i of instancias(n))
        for (const d of i.distractores)
          expect(esClaveDe(i.concepto, d.idea_clave), n).toBe(true);
  });
  it("descarta parámetros que colapsan distractores", () => {
    const encadenadas = instancias("porcentaje_encadenado");
    expect(
      encadenadas.every((i) => i.parametros.sube !== i.parametros.baja),
    ).toBe(true);
  });
  it("la respuesta de porcentaje_encadenado es base × (1+sube) × (1−baja)", () => {
    const i = instancias("porcentaje_encadenado").find(
      (x) =>
        x.parametros.base === 200 &&
        x.parametros.sube === 25 &&
        x.parametros.baja === 10,
    )!;
    expect(i.respuesta).toBeCloseTo(225, 9);
    expect(i.distractores.map((d) => d.idea_clave)).toContain("cambio-de-base");
    expect(i.enunciado_base).toContain("200");
  });
  it("las respuestas son cantidades limpias (a lo sumo 2 decimales)", () => {
    for (const n of nombres)
      for (const i of instancias(n)) {
        expect(
          Math.abs(i.respuesta * 100 - Math.round(i.respuesta * 100)),
        ).toBeLessThan(1e-6);
        expect(i.respuesta).toBeGreaterThan(0);
      }
  });
  it("generarNoExpuesta salta lo ya expuesto y devuelve null al agotar", () => {
    const todas = instancias("proporcion_inversa");
    const expuestas = new Set(todas.slice(1).map(claveInstancia));
    const i = generarNoExpuesta("proporciones", 5, (k) => expuestas.has(k), [
      "proporcion_inversa",
    ]);
    expect(i && claveInstancia(i)).toBe(claveInstancia(todas[0]));
    const todo = new Set(todas.map(claveInstancia));
    expect(
      generarNoExpuesta("proporciones", 5, (k) => todo.has(k), [
        "proporcion_inversa",
      ]),
    ).toBeNull();
  });
  it("generarNoExpuesta solo elige plantillas del concepto pedido", () => {
    const i = generarNoExpuesta("fracciones", 11, () => false)!;
    expect(i.concepto).toBe("fracciones");
    expect(generarNoExpuesta("geometria", 1, () => false)).toBeNull();
  });
});

describe("ayudas para actividades de plantilla", () => {
  it("instanciaDesdeClave recupera la instancia y respuestaDeActividad cubre curadas y plantillas", () => {
    const i = generar("fraccion_de_cantidad", 4);
    expect(instanciaDesdeClave(claveInstancia(i))).toEqual(i);
    expect(respuestaDeActividad(claveInstancia(i))).toBe(i.respuesta);
    expect(respuestaDeActividad("porcentajes-1")).toBe(96);
    expect(instanciaDesdeClave("porcentajes-1")).toBeNull();
    expect(instanciaDesdeClave("inventada:{}")).toBeNull();
    expect(respuestaDeActividad("nada")).toBeNull();
  });
  it("opciones incluye la respuesta y los distractores en un orden estable por semilla", () => {
    const i = generar("proporcion_inversa", 9);
    const o = opciones(i, 9);
    expect(o).toEqual(opciones(i, 9));
    expect([...o].sort()).toEqual(
      [i.respuesta, ...i.distractores.map((d) => d.valor)].sort(),
    );
  });
});
