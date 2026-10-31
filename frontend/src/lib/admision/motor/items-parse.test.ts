import { describe, expect, it } from "vitest";
import { parsearItems } from "@/lib/admision/motor/items-parse";

/** Un item de opción múltiple bien formado, como lo devuelve el modelo. */
const OM = {
  question: "¿Qué mide el valor ganado?",
  options: ["El coste real", "El trabajo completado en presupuesto", "El plazo", "El riesgo"],
  correctAnswer: "El trabajo completado en presupuesto",
  explanation: "El valor ganado traduce el avance físico a unidades de presupuesto.",
  difficulty: "intermediate",
};

const VF = {
  question: "El valor ganado se mide en unidades de tiempo.",
  correctAnswer: "falso",
  explanation: "Se mide en unidades de presupuesto, no de tiempo.",
  difficulty: "basic",
};

describe("parsearItems", () => {
  it("saca el array aunque el modelo lo envuelva en prosa y en vallas de código", () => {
    const bruto = "Aquí van:\n```json\n" + JSON.stringify([OM]) + "\n```\nEspero que sirvan.";
    const items = parsearItems(bruto, "opcion_multiple");
    expect(items).toHaveLength(1);
    expect(items[0].question).toBe(OM.question);
    expect(items[0].correct_answer).toBe(OM.correctAnswer);
    expect(items[0].options).toEqual(OM.options);
  });

  it("sin ningún array JSON, lanza en vez de devolver vacío", () => {
    expect(() => parsearItems("Lo siento, no puedo ayudarte con eso.", "opcion_multiple")).toThrow();
  });

  it("un array que no es JSON válido lanza", () => {
    expect(() => parsearItems("[{question: sin comillas}]", "opcion_multiple")).toThrow();
  });

  it("un item sin explicación se descarta: el spec exige poder explicar el error", () => {
    const items = parsearItems(JSON.stringify([OM, { ...OM, explanation: "  " }]), "opcion_multiple");
    expect(items).toHaveLength(1);
  });

  it("un item sin pregunta o sin respuesta correcta se descarta", () => {
    const bruto = JSON.stringify([OM, { ...OM, question: "" }, { ...OM, correctAnswer: "" }]);
    expect(parsearItems(bruto, "opcion_multiple")).toHaveLength(1);
  });

  it("en opción múltiple, una correcta que NO está entre las opciones se descarta", () => {
    // Es el error del modelo que más duele: la pregunta se pinta, el alumno elige bien y
    // el sistema la cuenta como fallo, bajándole el dominio por un fallo ajeno.
    const bruto = JSON.stringify([OM, { ...OM, correctAnswer: "Ninguna de las anteriores" }]);
    expect(parsearItems(bruto, "opcion_multiple")).toHaveLength(1);
  });

  it("en opción múltiple, menos de dos opciones se descarta", () => {
    const bruto = JSON.stringify([{ ...OM, options: [OM.correctAnswer] }]);
    expect(() => parsearItems(bruto, "opcion_multiple")).toThrow();
  });

  it("en verdadero/falso, la correcta se normaliza a 'verdadero' o 'falso'", () => {
    const bruto = JSON.stringify([
      { ...VF, correctAnswer: "Falso" },
      { ...VF, correctAnswer: "FALSE" },
      { ...VF, correctAnswer: "true" },
    ]);
    expect(parsearItems(bruto, "verdadero_falso").map((i) => i.correct_answer)).toEqual([
      "falso",
      "falso",
      "verdadero",
    ]);
  });

  it("en verdadero/falso, una correcta que no es ni una ni otra se descarta", () => {
    const bruto = JSON.stringify([VF, { ...VF, correctAnswer: "depende del contexto" }]);
    expect(parsearItems(bruto, "verdadero_falso")).toHaveLength(1);
  });

  it("en verdadero/falso las opciones son siempre null, aunque el modelo las mande", () => {
    const bruto = JSON.stringify([{ ...VF, options: ["verdadero", "falso"] }]);
    expect(parsearItems(bruto, "verdadero_falso")[0].options).toBeNull();
  });

  it("en el examen las preguntas son abiertas: options null y no se exige lista", () => {
    const abierta = { ...VF, correctAnswer: "Porque traduce el avance a presupuesto." };
    const items = parsearItems(JSON.stringify([abierta]), "examen");
    expect(items).toHaveLength(1);
    expect(items[0].options).toBeNull();
  });

  it("una dificultad que el CHECK de la tabla no acepta cae a 'intermediate'", () => {
    const items = parsearItems(JSON.stringify([{ ...OM, difficulty: "imposible" }]), "opcion_multiple");
    expect(items[0].difficulty).toBe("intermediate");
  });

  it("recorta los espacios de los textos, que el modelo mete a menudo", () => {
    const items = parsearItems(JSON.stringify([{ ...OM, question: "  ¿Qué mide?  " }]), "opcion_multiple");
    expect(items[0].question).toBe("¿Qué mide?");
  });

  it("si TODOS los items son inválidos, lanza: cero items dejaría el nodo abrible y vacío", () => {
    const bruto = JSON.stringify([{ ...OM, question: "" }, { ...OM, explanation: "" }]);
    expect(() => parsearItems(bruto, "opcion_multiple")).toThrow();
  });

  it("acepta correct_answer además de correctAnswer: el modelo alterna entre las dos", () => {
    const bruto = JSON.stringify([{ ...OM, correctAnswer: undefined, correct_answer: OM.correctAnswer }]);
    expect(parsearItems(bruto, "opcion_multiple")).toHaveLength(1);
  });
});

/**
 * La cita: de qué fragmento del material salió cada item.
 *
 * El modelo no ve ids ni páginas de base de datos. Ve una lista numerada —[F1], [F2]…— y
 * devuelve el número. Traducirlo a `material_id` y página es cosa del servidor, que tiene
 * la lista delante, así que lo único que hay que validar aquí es que el número señale a un
 * fragmento que de verdad se le enseñó.
 */
describe("parsearItems · la cita del fragmento", () => {
  it("guarda el fragmento citado cuando está dentro de lo que se le enseñó", () => {
    const items = parsearItems(JSON.stringify([{ ...VF, fragmento: 3 }]), "verdadero_falso", 5);
    expect(items[0].fragmento).toBe(3);
  });

  it("un fragmento fuera de rango se descarta, pero el item se conserva", () => {
    // La alternativa sería tirar el item entero. Una pregunta sin cita se puede contestar;
    // lo que no puede pasar es guardar una cita que apunte a una página que no existe.
    const items = parsearItems(JSON.stringify([{ ...VF, fragmento: 9 }]), "verdadero_falso", 5);
    expect(items).toHaveLength(1);
    expect(items[0].fragmento).toBeNull();
  });

  it("el 0 no vale: la lista que se le enseña empieza en 1", () => {
    const items = parsearItems(JSON.stringify([{ ...VF, fragmento: 0 }]), "verdadero_falso", 5);
    expect(items[0].fragmento).toBeNull();
  });

  it("un fragmento que no es entero se descarta", () => {
    // "2.5" no es ningún fragmento, y redondearlo sería elegir una cita por él.
    const items = parsearItems(JSON.stringify([{ ...VF, fragmento: 2.5 }]), "verdadero_falso", 5);
    expect(items[0].fragmento).toBeNull();
  });

  it("acepta el número escrito como texto, que el modelo alterna", () => {
    const items = parsearItems(JSON.stringify([{ ...VF, fragmento: "3" }]), "verdadero_falso", 5);
    expect(items[0].fragmento).toBe(3);
  });

  it("sin fragmento, el item entra sin cita", () => {
    const items = parsearItems(JSON.stringify([VF]), "verdadero_falso", 5);
    expect(items[0].fragmento).toBeNull();
  });

  it("sin lista de fragmentos, ninguna cita es válida", () => {
    // Es el caso de un llamador que no numeró el material: entonces el número del modelo no
    // se refiere a nada, y aceptarlo sería inventarse la cita.
    const items = parsearItems(JSON.stringify([{ ...VF, fragmento: 1 }]), "verdadero_falso");
    expect(items[0].fragmento).toBeNull();
  });
});

/**
 * La cita tal y como la escribe el modelo de verdad.
 *
 * En producción, el 13-09-2026, `material_id` salió NULL en las ocho preguntas generadas
 * mientras las ocho explicaciones decían «El fragmento [F3]…». El modelo no piensa en «3»:
 * piensa en «F3», que es como se le enseñó la lista, y así es como devuelve la cita. El
 * validador solo aceptaba el entero pelado, de modo que tiraba TODAS las citas.
 *
 * Se acepta la forma con etiqueta porque el número sigue siendo verificable contra la misma
 * lista: no se está creyendo nada, solo leyendo lo mismo escrito como el modelo lo escribe.
 */
describe("parsearItems · la cita como la escribe el modelo", () => {
  it("acepta la etiqueta con F delante", () => {
    const items = parsearItems(JSON.stringify([{ ...VF, fragmento: "F3" }]), "verdadero_falso", 5);
    expect(items[0].fragmento).toBe(3);
  });

  it("acepta la etiqueta entre corchetes, como aparece en el material", () => {
    const items = parsearItems(JSON.stringify([{ ...VF, fragmento: "[F3]" }]), "verdadero_falso", 5);
    expect(items[0].fragmento).toBe(3);
  });

  it("acepta la etiqueta completa, con su página al lado", () => {
    // Es la etiqueta literal que lee en el prompt: si la copia entera, el número sigue ahí.
    const items = parsearItems(
      JSON.stringify([{ ...VF, fragmento: "[F3 · página 7]" }]),
      "verdadero_falso",
      5,
    );
    expect(items[0].fragmento).toBe(3);
  });

  it("acepta la palabra fragmento escrita delante", () => {
    const items = parsearItems(
      JSON.stringify([{ ...VF, fragmento: "Fragmento 3" }]),
      "verdadero_falso",
      5,
    );
    expect(items[0].fragmento).toBe(3);
  });

  it("una etiqueta fuera de rango se sigue descartando", () => {
    // Tolerar la forma no es tolerar el contenido: el rango es lo que impide una cita falsa.
    const items = parsearItems(JSON.stringify([{ ...VF, fragmento: "F9" }]), "verdadero_falso", 5);
    expect(items[0].fragmento).toBeNull();
  });

  it("una página suelta no es una cita: el modelo no cita páginas", () => {
    // `página 7` no señala ningún fragmento. Leerlo como el fragmento 7 sería inventarse la
    // cita usando un número que significa otra cosa.
    const items = parsearItems(
      JSON.stringify([{ ...VF, fragmento: "página 7" }]),
      "verdadero_falso",
      8,
    );
    expect(items[0].fragmento).toBeNull();
  });
});
