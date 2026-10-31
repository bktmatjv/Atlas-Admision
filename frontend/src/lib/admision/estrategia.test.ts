import { describe, expect, it } from "vitest";
import { MINIMO_POR_NIVEL, calibracion, wilson } from "./estrategia";
import { consejos } from "./consejos";
import { informeDe } from "./informe";

describe("wilson", () => {
  it("sin datos no sabe nada; con muchos, se estrecha alrededor de la tasa", () => {
    expect(wilson(0, 0)).toEqual([0, 1]);
    const [a, b] = wilson(50, 100);
    expect(a).toBeCloseTo(0.404, 2);
    expect(b).toBeCloseTo(0.596, 2);
  });
});

const r = (curso: string, opcion: string | null, correcta: boolean | null, confianza: number | null = null) => ({ curso, opcion, correcta, confianza });

describe("calibracion", () => {
  it("cuenta el acierto por confianza y no recomienda nada con pocos datos", () => {
    const c = calibracion([r("algebra", "A", true, 3), r("algebra", "B", false, 1), r("algebra", null, null)]);
    expect(c.niveles.find((n) => n.confianza === 3)).toMatchObject({ preguntas: 1, aciertos: 1, recomendacion: "pocos-datos" });
    expect(c.respuestasConConfianza).toBe(2);
  });

  it("recomienda dejar en blanco solo si TODO el intervalo queda bajo el umbral (5,3 %)", () => {
    const muchasMal = Array.from({ length: 80 }, () => r("algebra", "B", false, 1));
    expect(calibracion(muchasMal).niveles[0].recomendacion).toBe("blanco");
    const pocasMal = Array.from({ length: MINIMO_POR_NIVEL }, () => r("algebra", "B", false, 1));
    // 0 de 8: el intervalo llega hasta ~32 %, por encima del umbral: no se puede afirmar que convenga el blanco.
    expect(calibracion(pocasMal).niveles[0].recomendacion).toBe("marcar");
  });

  it("los blancos: cuántos, cuántos en la actitudinal (donde marcar nunca resta) y lo que valían al azar", () => {
    const c = calibracion([r("algebra", null, null), r("actitudinal", null, null)]);
    expect(c).toMatchObject({ blancos: 2, blancosActitudinal: 1 });
    // Al azar entre 5: +3,1 en un curso que resta y +4 en la actitudinal.
    expect(c.puntosRegaladosEnBlanco).toBe(7.1);
  });
});

describe("consejos", () => {
  const preguntas = [
    ...Array.from({ length: 4 }, (_, i) => ({ pregunta_id: `b${i}`, curso: "biologia", tema: "genetica", clave: "A" })),
    { pregunta_id: "a1", curso: "actitudinal", tema: "etica-y-valores", clave: "A" },
  ];
  const resp = { b0: { opcion: "B", correcta: false }, b1: { opcion: null, correcta: null }, b2: { opcion: "A", correcta: true }, b3: { opcion: "C", correcta: false }, a1: { opcion: null, correcta: null } };
  const lista = consejos(informeDe(preguntas, resp, "A"), calibracion(preguntas.map((p) => ({ curso: p.curso, ...resp[p.pregunta_id as keyof typeof resp], confianza: null }))));

  it("como mucho cuatro, y cada uno dice qué hacer", () => {
    expect(lista.length).toBeGreaterThan(0);
    expect(lista.length).toBeLessThanOrEqual(4);
  });
  it("empieza por el curso donde más puntos perdió, con su tema más flojo", () => {
    expect(lista[0].texto).toMatch(/^Empieza por Biología/);
    expect(lista[0].texto).toMatch(/Genética/);
    expect(lista[0].practicar).toEqual({ curso: "biologia", tema: "genetica" });
  });
  it("si dejó la actitudinal en blanco, le dice que ahí siempre marque", () => {
    expect(lista.some((c) => /actitudinal/i.test(c.texto) && /no resta/.test(c.texto))).toBe(true);
  });
  it("no inventa cifras: los números salen del informe", () => {
    expect(lista[0].texto).toMatch(/62,25 puntos/);
  });
});
