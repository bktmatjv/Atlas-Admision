import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { BloqueView } from "./Bloques";
import { VisualView } from "./Visual";
import {
  TIPOS_BLOQUE,
  tituloAccesible,
  type Bloque,
  type Visual,
} from "@/lib/tutor/chat";
const render = (el: ReactElement) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, el));
const vista = (bloque: Bloque, extra: Partial<{ comprobando: boolean }> = {}) =>
  render(
    createElement(BloqueView, {
      bloque,
      arbolId: "arbol-1",
      alResponder: () => undefined,
      comprobando: false,
      onComprobar: () => undefined,
      ...extra,
    }),
  );
const id = "b1";
const bloques: Record<string, Bloque> = {
  pregunta_socratica: {
    id,
    tipo: "pregunta_socratica",
    texto: "¿Sobre qué cantidad se calcula la baja?",
    respuestas_rapidas: ["Sobre 100", "Sobre 120"],
  },
  contraste: {
    id,
    tipo: "contraste",
    tuyo: ["Respondí 100"],
    correcto: ["100 × 1,20 × 0,80 = 96"],
  },
  razonamiento_anotado: {
    id,
    tipo: "razonamiento_anotado",
    pasos: [
      { texto: "Asumes que se anulan", estado: "revisar", cita: "se cancelan" },
      { texto: "Subir 20% da 120", estado: "ok", cita: "sube 20" },
    ],
  },
  prediccion: {
    id,
    tipo: "prediccion",
    pregunta: "¿Qué pasará con el precio?",
    enunciado: "Un precio de S/80 sube 20% y luego baja 25%.",
    opciones: [71, 72, 80, 112.5],
  },
  ejemplo_paso_a_paso: {
    id,
    tipo: "ejemplo_paso_a_paso",
    pasos: [
      { texto: "Calcula el aumento", cuenta: "100 × 20% = 20" },
      {
        texto: "Calcula la baja sobre la nueva base",
        cuenta: "120 × 20% = 24",
      },
    ],
  },
  visual: {
    id,
    tipo: "visual",
    forma: "barra_de_partes",
    total: 24,
    partes: 8,
    marcadas: 3,
  },
  practica: {
    id,
    tipo: "practica",
    enunciado: "Una cantidad baja de 500 a 125.",
    opciones: [300, 375, 75],
    historia: "Una tienda ajusta sus precios.",
  },
  en_tus_palabras: {
    id,
    tipo: "en_tus_palabras",
    consigna: "Explica con tus palabras por qué cambia la base",
  },
  invitacion_comprobar: {
    id,
    tipo: "invitacion_comprobar",
    texto: "Cuando quieras, puedes hacer una comprobación sin ayudas.",
  },
  cita: {
    id,
    tipo: "cita",
    fragmento_id: "11111111-1111-4111-8111-111111111111",
  },
};
describe("render de los diez bloques", () => {
  it("hay un caso por cada tipo de bloque", () => {
    expect(Object.keys(bloques).sort()).toEqual([...TIPOS_BLOQUE].sort());
  });
  it("todos se dibujan con su título accesible", () => {
    for (const t of TIPOS_BLOQUE) {
      const html = vista(bloques[t]);
      expect(html, t).toContain(`aria-label="${tituloAccesible(t)}"`);
    }
  });
  it("pregunta_socratica muestra el texto, las respuestas rápidas y un campo", () => {
    const html = vista(bloques.pregunta_socratica);
    expect(html).toContain("¿Sobre qué cantidad se calcula la baja?");
    expect(html).toContain("Sobre 100");
    expect(html).toContain("Sobre 120");
    expect(html).toContain("<textarea");
  });
  it("contraste separa lo que hizo el estudiante de lo correcto", () => {
    const html = vista(bloques.contraste);
    expect(html).toContain("Lo que hiciste");
    expect(html).toContain("Respondí 100");
    expect(html).toContain("Lo correcto");
    expect(html).toContain("100 × 1,20 × 0,80 = 96");
    expect(html).not.toContain("<textarea");
  });
  it("razonamiento_anotado dice el estado con palabras y cita lo que escribió", () => {
    const html = vista(bloques.razonamiento_anotado);
    expect(html).toContain("Para revisar");
    expect(html).toContain("Bien");
    expect(html).toContain("Escribiste: «se cancelan»");
  });
  it("prediccion y practica muestran las opciones con coma decimal y no marcan la correcta", () => {
    for (const t of ["prediccion", "practica"] as const) {
      const html = vista(bloques[t]);
      expect(html).toContain('type="radio"');
      expect(html).toContain("<button");
      expect(html).not.toMatch(/correct|checked/i);
    }
    expect(vista(bloques.prediccion)).toContain("112,5");
    expect(vista(bloques.practica)).toContain("Una tienda ajusta sus precios.");
    expect(vista(bloques.practica)).toContain("verificada por CALIBRA");
  });
  it("ejemplo_paso_a_paso revela solo el primer paso y ofrece un intento opcional", () => {
    const html = vista(bloques.ejemplo_paso_a_paso);
    expect(html).toContain("Calcula el aumento");
    expect(html).toContain("100 × 20% = 20");
    expect(html).not.toContain("Calcula la baja sobre la nueva base");
    expect(html).toContain("Mostrar el siguiente paso (1 de 2)");
    expect(html).toContain("(opcional)");
  });
  it("en_tus_palabras pide texto libre", () => {
    const html = vista(bloques.en_tus_palabras);
    expect(html).toContain("Explica con tus palabras");
    expect(html).toContain("<textarea");
  });
  it("invitacion_comprobar ofrece empezar o retomar según haya una comprobación activa", () => {
    expect(vista(bloques.invitacion_comprobar)).toContain(
      "Empezar comprobación sin ayudas",
    );
    const activa = vista(bloques.invitacion_comprobar, { comprobando: true });
    expect(activa).toContain("Ir a mi comprobación");
    expect(activa).toContain('href="/aprender/arbol-1"');
  });
  it("cita enlaza al fragmento propio", () => {
    const html = vista(bloques.cita);
    expect(html).toContain("Ver el original");
    expect(html).toContain("fragmento=11111111-1111-4111-8111-111111111111");
  });
});
const visual = (v: Visual) => render(createElement(VisualView, { v }));
describe("render de las cuatro formas de visual", () => {
  it("cadena_porcentual dibuja cada valor y operación", () => {
    const html = visual({
      forma: "cadena_porcentual",
      pasos: [
        { valor: 100 },
        { op: "+20%", valor: 120 },
        { op: "-20%", valor: 96 },
      ],
    });
    for (const t of ["100", "+20%", "120", "-20%", "96"])
      expect(html).toContain(t);
    expect(html).toContain("Cadena de cambios porcentuales");
  });
  it("barra_de_partes marca las partes y las describe en texto", () => {
    const html = visual({
      forma: "barra_de_partes",
      total: 24,
      partes: 8,
      marcadas: 3,
      fraccion: "3/8",
    });
    expect(html.match(/bg-primary/g)).toHaveLength(3);
    expect(html).toContain("3 de 8 partes marcadas");
    expect(html).toContain("(3/8)");
  });
  it("tabla_proporcion muestra columnas, filas y la relación", () => {
    const html = visual({
      forma: "tabla_proporcion",
      columnas: ["Máquinas", "Horas"],
      filas: [
        [3, 12],
        [6, 6],
      ],
      relacion: "inversa",
    });
    expect(html).toContain("Máquinas");
    expect(html).toContain("Horas");
    expect(html).toContain("Relación inversa");
    expect(html.match(/<tr>/g)).toHaveLength(3);
  });
  it("recta_numerica ubica los puntos y tiene descripción accesible", () => {
    const html = visual({
      forma: "recta_numerica",
      min: 0,
      max: 10,
      puntos: [{ valor: 5, etiqueta: "mitad" }],
    });
    expect(html).toContain("<svg");
    expect(html).toContain("mitad (5)");
    expect(html).toContain("Recta numérica de 0 a 10");
    expect(html).toContain("<circle");
  });
});
