import { describe, expect, it } from "vitest";
import { evolucion, informeDe, nombreDelTema, type PreguntaCorregida, type RespuestaCorregida } from "./informe";

const p = (id: string, curso: string, tema: string, clave: string | null = "A"): PreguntaCorregida => ({ pregunta_id: id, curso, tema, clave });
const bien: RespuestaCorregida = { opcion: "A", correcta: true };
const mal: RespuestaCorregida = { opcion: "B", correcta: false };
const blanco: RespuestaCorregida = { opcion: null, correcta: null };

describe("informeDe", () => {
  const preguntas = [
    p("b1", "biologia", "genetica"), p("b2", "biologia", "genetica"), p("b3", "biologia", "genetica"), p("b4", "biologia", "ecologia"),
    p("t1", "trigonometria", "identidades"), p("t2", "trigonometria", "identidades"),
    p("a1", "actitudinal", "etica-y-valores"), p("x", "fisica", "cinematica", null),
  ];
  const respuestas = { b1: bien, b2: mal, b3: blanco, b4: mal, t1: mal, t2: blanco, a1: mal, x: bien };
  const r = informeDe(preguntas, respuestas, "A");

  it("por curso: aciertos, puntos, lo perdido (20 por cada no acierto + lo que restó cada error) y el peso del molde", () => {
    const bio = r.porCurso.find((c) => c.curso === "biologia")!;
    expect(bio).toMatchObject({ preguntas: 4, aciertos: 1, errores: 2, blancos: 1, puntos: 17.75, perdidos: 62.25, peso: 8 });
    expect(bio.prioridad).toBe(62.25 * 8);
    // La actitudinal no resta: lo perdido es solo lo que no sumó.
    expect(r.porCurso.find((c) => c.curso === "actitudinal")).toMatchObject({ puntos: 0, perdidos: 20, peso: 10 });
  });

  it("ordena los cursos por prioridad (puntos perdidos × peso del curso en su área)", () => {
    expect(r.porCurso.map((c) => c.curso)).toEqual(["biologia", "actitudinal", "trigonometria"]);
  });

  it("una pregunta anulada (sin clave) no cuenta para nada", () => {
    expect(r.porCurso.find((c) => c.curso === "fisica")).toBeUndefined();
    expect(r.falladas.some((f) => f.pregunta_id === "x")).toBe(false);
  });

  it("por tema solo con al menos 3 preguntas, del peor al mejor", () => {
    expect(r.porTema).toEqual([{ curso: "biologia", tema: "genetica", nombre: "Genética", preguntas: 3, aciertos: 1, acierto: 1 / 3 }]);
  });

  it("las falladas incluyen las incorrectas y las en blanco, en el orden del examen", () => {
    expect(r.falladas.map((f) => [f.pregunta_id, f.tipo])).toEqual([
      ["b2", "incorrecta"], ["b3", "blanco"], ["b4", "incorrecta"], ["t1", "incorrecta"], ["t2", "blanco"], ["a1", "incorrecta"],
    ]);
    expect(r.falladas[0]).toMatchObject({ curso: "biologia", indice: 1, opcion: "B", clave: "A" });
  });

  it("Medicina usa el molde del Área A; un curso fuera del molde pesa 0", () => {
    expect(informeDe([p("q", "biologia", "genetica")], { q: mal }, "medicina").porCurso[0].peso).toBe(8);
    expect(informeDe([p("q", "biologia", "genetica")], { q: mal }, "E").porCurso[0].peso).toBe(4);
  });
});

describe("evolucion", () => {
  const intento = (fecha: string, puntaje: number, porCurso: Record<string, { aciertos: number; errores: number; blancos: number }>) => ({
    estado: "entregado", modo: "simulacro", filtro: null, puntaje, created_at: fecha, informe: { maximo: 2000, porCurso },
  });
  it("con un solo intento completo no hay evolución", () => {
    expect(evolucion([intento("2026-10-10", 900, {})])).toBeNull();
  });
  it("desde el segundo: la serie en orden de fecha y cómo cambió cada curso entre los dos últimos", () => {
    const e = evolucion([
      intento("2026-10-12", 1000, { biologia: { aciertos: 6, errores: 1, blancos: 1 } }),
      { ...intento("2026-10-11", 0, {}), filtro: { curso: "algebra" } },
      intento("2026-10-10", 900, { biologia: { aciertos: 4, errores: 2, blancos: 2 } }),
    ])!;
    expect(e.serie.map((s) => s.puntaje)).toEqual([900, 1000]);
    expect(e.cambio).toBe(100);
    expect(e.cursos).toEqual([{ curso: "biologia", antes: 0.5, ahora: 0.75 }]);
  });
});

describe("nombreDelTema", () => {
  it("el nombre del temario, o el id si no está", () => {
    expect(nombreDelTema("biologia", "genetica")).toBe("Genética");
    expect(nombreDelTema("biologia", "no-existe")).toBe("no-existe");
  });
});
