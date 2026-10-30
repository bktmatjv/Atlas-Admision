import { describe, expect, it } from "vitest";
import { formatearStem } from "@/lib/admision/motor/formatos-stem";
import { parsearItems } from "@/lib/admision/motor/items-parse";

const NUMERICA = {
  question: "Un móvil recorre $100\\,\\text{m}$ en $20\\,\\text{s}$ con velocidad constante. ¿Cuál es su velocidad?",
  planteamiento: "\\frac{100}{20}",
  answer: 5,
  unit: "m/s",
  explanation: "$v = \\frac{d}{t}$",
  difficulty: "basic",
  fragmento: 1,
};

describe("numerica", () => {
  it("un item cuya cuenta cuadra se guarda con valor, unidad, tolerancia y planteamiento", () => {
    const r = formatearStem(NUMERICA, "numerica");
    expect(r).toEqual({
      question: NUMERICA.question,
      options: { valor: 5, unidad: "m/s", tolerancia: 0.01, planteamiento: "\\frac{100}{20}" },
      correct_answer: "5 m/s",
    });
  });

  it("la respuesta puede venir como texto con coma", () => {
    const r = formatearStem({ ...NUMERICA, planteamiento: "\\frac{10}{4}", answer: "2,5", question: "Reparte $10$ entre $4$." , unit: null }, "numerica");
    expect(r).toMatchObject({ options: { valor: 2.5, unidad: null }, correct_answer: "2,5" });
  });

  it("si el planteamiento no da la respuesta, se descarta: la cuenta la hace el código", () => {
    expect(formatearStem({ ...NUMERICA, answer: 4 }, "numerica")).toEqual({ descarte: "cuenta_no_cuadra" });
  });

  it("sin planteamiento calculable, se descarta", () => {
    expect(formatearStem({ ...NUMERICA, planteamiento: "d / t" }, "numerica")).toEqual({ descarte: "sin_planteamiento" });
    expect(formatearStem({ ...NUMERICA, planteamiento: undefined }, "numerica")).toEqual({ descarte: "sin_planteamiento" });
  });

  it("un enunciado sin datos no es un problema numérico", () => {
    expect(formatearStem({ ...NUMERICA, question: "¿Cuál es la velocidad?" }, "numerica")).toEqual({ descarte: "sin_datos" });
  });

  it("los números del planteamiento salen del enunciado (o son constantes conocidas)", () => {
    expect(formatearStem({ ...NUMERICA, planteamiento: "\\frac{300}{60}" }, "numerica")).toEqual({ descarte: "dato_inventado" });
    const conG = formatearStem(
      { ...NUMERICA, question: "Un cuerpo de $2\\,\\text{kg}$ cae. ¿Cuánto pesa?", planteamiento: "2 \\cdot 9{,}8", answer: 19.6, unit: "N" },
      "numerica",
    );
    expect(conG).toMatchObject({ correct_answer: "19,6 N" });
  });

  it("una unidad que no se conoce se descarta (no se podría corregir)", () => {
    expect(formatearStem({ ...NUMERICA, unit: "furlongs" }, "numerica")).toEqual({ descarte: "unidad_desconocida" });
  });
});

const PROCEDIMIENTO = {
  question: "Resuelve $2x + 3 = 11$.",
  steps: [
    { cuenta: "2x = 11 - 3 = 8", porque: "Paso el 3 restando al otro lado." },
    { cuenta: "x = \\frac{8}{2} = 4", porque: "Divido entre el coeficiente de $x$." },
  ],
  answer: "$x = 4$",
  explanation: "Despejar es deshacer las operaciones en orden inverso.",
  difficulty: "basic",
  fragmento: 1,
};

describe("procedimiento", () => {
  it("guarda los pasos con su cuenta y su porqué", () => {
    expect(formatearStem(PROCEDIMIENTO, "procedimiento")).toEqual({
      question: PROCEDIMIENTO.question,
      options: { pasos: PROCEDIMIENTO.steps },
      correct_answer: "$x = 4$",
    });
  });

  it("un paso cuya cuenta no cuadra tumba el ejercicio", () => {
    const malo = { ...PROCEDIMIENTO, steps: [PROCEDIMIENTO.steps[0], { cuenta: "x = \\frac{8}{2} = 3", porque: "x" }] };
    expect(formatearStem(malo, "procedimiento")).toEqual({ descarte: "paso_no_cuadra" });
  });

  it("entre 2 y 8 pasos, cada uno con su porqué", () => {
    expect(formatearStem({ ...PROCEDIMIENTO, steps: [PROCEDIMIENTO.steps[0]] }, "procedimiento")).toEqual({ descarte: "forma" });
    expect(formatearStem({ ...PROCEDIMIENTO, steps: [{ cuenta: "a", porque: "" }, PROCEDIMIENTO.steps[1]] }, "procedimiento")).toEqual({ descarte: "forma" });
  });
});

const LECTURA = {
  question: "¿En qué valores de $x$ corta la parábola al eje $x$?",
  figura: { tipo: "funciones", x: [-4, 4], funciones: [{ expresion: "x^2 - 4" }], puntos: [], asintotas: [] },
  options: ["$x = 2$ y $x = -2$", "$x = 4$", "$x = 0$", "No lo corta"],
  correctAnswer: "$x = 2$ y $x = -2$",
  explanation: "Donde $f(x) = 0$.",
  difficulty: "basic",
  fragmento: 1,
};

describe("lectura_de_grafica", () => {
  it("guarda la pregunta con sus opciones y la figura validada", () => {
    const r = formatearStem(LECTURA, "lectura_de_grafica");
    expect(r).toMatchObject({ options: LECTURA.options, correct_answer: LECTURA.correctAnswer, figura: { tipo: "funciones" } });
  });

  it("sin una gráfica que se pueda dibujar, no hay pregunta", () => {
    expect(formatearStem({ ...LECTURA, figura: { tipo: "funciones", x: [3, 1] } }, "lectura_de_grafica")).toEqual({ descarte: "sin_grafica" });
  });

  it("la correcta tiene que estar entre las opciones", () => {
    expect(formatearStem({ ...LECTURA, correctAnswer: "$x = 3$" }, "lectura_de_grafica")).toEqual({ descarte: "forma" });
  });
});

describe("parsearItems con los formatos STEM", () => {
  it("cuenta los descartes por motivo", () => {
    const descartes: Record<string, number> = {};
    const bruto = JSON.stringify([NUMERICA, { ...NUMERICA, answer: 7 }, { ...NUMERICA, answer: 9 }]);
    const items = parsearItems(bruto, "numerica", 1, { textos: ["material"], descartes });
    expect(items).toHaveLength(1);
    expect(items[0].options).toMatchObject({ valor: 5 });
    expect(descartes).toEqual({ cuenta_no_cuadra: 2 });
  });

  it("un JSON con \\frac sin doblar llega reparado", () => {
    const bruto = '[{"question":"Reparte $10$ entre $4$.","planteamiento":"\\frac{10}{4}","answer":2.5,"unit":null,"explanation":"e","fragmento":1}]';
    const items = parsearItems(bruto, "numerica", 1, { textos: ["m"] });
    expect(items[0].options).toMatchObject({ planteamiento: "\\frac{10}{4}" });
  });
});
