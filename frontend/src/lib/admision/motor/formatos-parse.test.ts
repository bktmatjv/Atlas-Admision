// supabase/functions/_shared/formatos-parse.test.ts
import { describe, expect, it } from "vitest";
import { parsearItems } from "@/lib/admision/motor/items-parse";

/** Dos fragmentos de material, numerados como se le enseñan al modelo: [F1], [F2]. */
const TEXTOS = [
  "La fotosíntesis ocurre en los cloroplastos de las células vegetales. La clorofila absorbe la luz.",
  "Fases de la mitosis: profase, metafase, anafase y telofase.",
];
const ctx = { textos: TEXTOS };
const json = (x: unknown) => JSON.stringify(Array.isArray(x) ? x : [x]);

describe("completar", () => {
  const base = {
    question: "La fotosíntesis ocurre en los ____ de las células vegetales.",
    options: ["cloroplastos", "mitocondrias", "ribosomas", "núcleos"],
    correctAnswer: "cloroplastos",
    explanation: "El material dice que ocurre en los cloroplastos.",
    difficulty: "basic",
    fragmento: 1,
  };

  it("acepta una frase que, rellena, está tal cual en el fragmento citado", () => {
    const [item] = parsearItems(json(base), "completar", 2, ctx);
    expect(item.question).toBe(base.question);
    expect(item.options).toEqual(base.options);
    expect(item.correct_answer).toBe("cloroplastos");
    expect(item.fragmento).toBe(1);
  });

  it("descarta la frase reescrita: la cita es la frase, y reescrita ya no lo es", () => {
    const reescrita = { ...base, question: "La fotosíntesis sucede en los ____ de las células vegetales." };
    expect(() => parsearItems(json(reescrita), "completar", 2, ctx)).toThrow();
  });

  it("descarta la frase sin cita", () => {
    expect(() => parsearItems(json({ ...base, fragmento: null }), "completar", 2, ctx)).toThrow();
  });

  it("descarta la frase si se busca en otro fragmento", () => {
    expect(() => parsearItems(json({ ...base, fragmento: 2 }), "completar", 2, ctx)).toThrow();
  });

  it("descarta si la correcta no está entre las opciones", () => {
    expect(() => parsearItems(json({ ...base, correctAnswer: "plastos" }), "completar", 2, ctx)).toThrow();
  });

  it("rellena el hueco con la correcta tal cual, aunque lleve `$'`", () => {
    // Con `replace(HUECO, correcta)` el `$'` se expande al resto de la frase, y la frase rellena
    // deja de estar en el material.
    const precio = {
      ...base,
      question: "El precio es ____ de verdad.",
      options: ["$'", "alto", "bajo"],
      correctAnswer: "$'",
    };
    const [item] = parsearItems(json(precio), "completar", 1, { textos: ["El precio es $' de verdad."] });
    expect(item.correct_answer).toBe("$'");
  });

  it("descarta dos huecos", () => {
    const dos = { ...base, question: "La ____ ocurre en los ____ de las células vegetales." };
    expect(() => parsearItems(json(dos), "completar", 2, ctx)).toThrow();
  });

  it("acepta tres guiones bajos y los escribe como cuatro", () => {
    const tres = { ...base, question: "La fotosíntesis ocurre en los ___ de las células vegetales." };
    const [item] = parsearItems(json(tres), "completar", 2, ctx);
    expect(item.question).toContain("____");
  });
});

describe("varias_correctas", () => {
  const base = {
    question: "¿Qué dice el material de la fotosíntesis? Marca todas las correctas.",
    options: ["Ocurre en los cloroplastos", "La clorofila absorbe la luz", "Ocurre en el núcleo", "Produce mitosis", "Es de células animales"],
    correctAnswers: ["Ocurre en los cloroplastos", "La clorofila absorbe la luz"],
    explanation: "Las dos primeras están en el material; las otras no.",
    difficulty: "intermediate",
    fragmento: 1,
  };

  it("acepta y guarda opciones y correctas juntas", () => {
    const [item] = parsearItems(json(base), "varias_correctas", 2, ctx);
    expect(item.options).toEqual({ opciones: base.options, correctas: base.correctAnswers });
    expect(item.correct_answer).toBe("Ocurre en los cloroplastos · La clorofila absorbe la luz");
  });

  it("descarta una sola correcta: eso es opción múltiple", () => {
    const una = { ...base, correctAnswers: ["Ocurre en los cloroplastos"] };
    expect(() => parsearItems(json(una), "varias_correctas", 2, ctx)).toThrow();
  });

  it("descarta todas correctas: no hay nada que distinguir", () => {
    expect(() => parsearItems(json({ ...base, correctAnswers: base.options }), "varias_correctas", 2, ctx)).toThrow();
  });

  it("descarta una correcta que no está entre las opciones", () => {
    const fuera = { ...base, correctAnswers: ["Ocurre en los cloroplastos", "Otra cosa"] };
    expect(() => parsearItems(json(fuera), "varias_correctas", 2, ctx)).toThrow();
  });
});

describe("relacionar", () => {
  const base = {
    question: "Relaciona cada concepto con su descripción",
    pairs: [
      { concepto: "fotosíntesis", descripcion: "Proceso que ocurre en los cloroplastos" },
      { concepto: "clorofila", descripcion: "Pigmento que absorbe la luz" },
      { concepto: "cloroplastos", descripcion: "Orgánulos de las células vegetales" },
    ],
    explanation: "Son las tres piezas de la fotosíntesis.",
    difficulty: "basic",
    fragmento: 1,
  };

  it("acepta y escribe la solución para el alumno", () => {
    const [item] = parsearItems(json(base), "relacionar", 2, ctx);
    expect(item.options).toEqual({ pares: base.pairs });
    expect(item.correct_answer).toBe(
      "fotosíntesis → Proceso que ocurre en los cloroplastos · clorofila → Pigmento que absorbe la luz · cloroplastos → Orgánulos de las células vegetales",
    );
  });

  it("descarta un concepto que no aparece en el material", () => {
    const inventado = { ...base, pairs: [...base.pairs.slice(0, 2), { concepto: "ATP", descripcion: "Moneda energética" }] };
    expect(() => parsearItems(json(inventado), "relacionar", 2, ctx)).toThrow();
  });

  it("descarta el ejercicio entero si un par viene roto", () => {
    const roto = { ...base, pairs: [...base.pairs, { concepto: "luz", descripcion: "" }] };
    expect(() => parsearItems(json(roto), "relacionar", 2, ctx)).toThrow();
  });

  it("descarta menos de tres pares", () => {
    expect(() => parsearItems(json({ ...base, pairs: base.pairs.slice(0, 2) }), "relacionar", 2, ctx)).toThrow();
  });
});

describe("ordenar", () => {
  const base = {
    question: "Ordena las fases de la mitosis",
    steps: ["profase", "metafase", "anafase", "telofase"],
    explanation: "Es el orden en que el material las enumera.",
    difficulty: "basic",
    fragmento: 2,
  };

  it("acepta y numera la solución", () => {
    const [item] = parsearItems(json(base), "ordenar", 2, ctx);
    expect(item.options).toEqual({ pasos: base.steps });
    expect(item.correct_answer).toBe("1. profase · 2. metafase · 3. anafase · 4. telofase");
  });

  it("descarta un paso que no está en el material", () => {
    const inventado = { ...base, steps: [...base.steps, "citocinesis"] };
    expect(() => parsearItems(json(inventado), "ordenar", 2, ctx)).toThrow();
  });

  it("descarta los pasos reales en un orden que el material no da", () => {
    const barajado = { ...base, steps: ["metafase", "profase", "anafase", "telofase"] };
    expect(() => parsearItems(json(barajado), "ordenar", 2, ctx)).toThrow();
  });

  it("con permitirVacio, un array vacío no lanza: el material no tenía secuencia", () => {
    expect(parsearItems("[]", "ordenar", 2, { ...ctx, permitirVacio: true })).toEqual([]);
  });

  it("sin permitirVacio, un array vacío sigue lanzando", () => {
    expect(() => parsearItems("[]", "ordenar", 2, ctx)).toThrow();
  });
});
