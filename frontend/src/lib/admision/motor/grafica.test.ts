import { describe, expect, it } from "vitest";
import { leerBloquesDeGrafica, muestrear, textoAlternativo, validarGrafica } from "@/lib/admision/motor/grafica";

const PARABOLA = {
  tipo: "funciones",
  titulo: "f(x) = x² − 4",
  x: [-4, 4],
  funciones: [{ expresion: "x^2 - 4", etiqueta: "$f(x)$" }],
  puntos: [
    { x: 2, y: 0, etiqueta: "raíz", sobre: 0 },
    { x: 0, y: -4, etiqueta: "vértice", sobre: 0 },
  ],
  asintotas: [],
};

describe("funciones", () => {
  it("una parábola con sus puntos sobre la curva es válida", () => {
    const r = validarGrafica(PARABOLA);
    expect(r.descartes).toEqual([]);
    expect(r.grafica).toMatchObject({ tipo: "funciones", x: [-4, 4] });
  });

  it("un punto marcado que no está en la curva se descarta, y la gráfica sigue", () => {
    const r = validarGrafica({ ...PARABOLA, puntos: [{ x: 1, y: 0, etiqueta: "raíz", sobre: 0 }] });
    expect(r.descartes).toEqual(["punto_fuera_de_la_curva"]);
    expect(r.grafica && r.grafica.tipo === "funciones" && r.grafica.puntos).toEqual([]);
  });

  it("acepta la expresión en LaTeX", () => {
    const r = validarGrafica({ ...PARABOLA, funciones: [{ expresion: "\\frac{1}{x}" }], puntos: [], asintotas: [{ eje: "x", valor: 0 }] });
    expect(r.grafica).not.toBeNull();
  });

  it("una expresión que no se puede calcular tumba la gráfica", () => {
    expect(validarGrafica({ ...PARABOLA, funciones: [{ expresion: "\\int x dx" }] }).grafica).toBeNull();
  });

  it("un dominio al revés o infinito tumba la gráfica", () => {
    expect(validarGrafica({ ...PARABOLA, x: [4, -4] }).grafica).toBeNull();
    expect(validarGrafica({ ...PARABOLA, x: [0, 1e9] }).grafica).toBeNull();
  });

  it("muestrear corta la curva donde no existe (asíntotas y raíces de negativos)", () => {
    const tramos = muestrear("1/x", [-1, 1], 40);
    expect(tramos.length).toBe(2);
    const raiz = muestrear("sqrt(x)", [-1, 1], 40);
    expect(raiz.flat().every(([x]) => x >= 0)).toBe(true);
  });
});

const TRIANGULO = {
  tipo: "geometria",
  puntos: [
    { id: "A", x: 0, y: 0 },
    { id: "B", x: 4, y: 0 },
    { id: "C", x: 0, y: 3 },
  ],
  segmentos: [
    { desde: "A", hasta: "B", etiqueta: "4" },
    { desde: "B", hasta: "C", etiqueta: "5" },
    { desde: "C", hasta: "A", etiqueta: "3" },
  ],
  poligonos: [{ vertices: ["A", "B", "C"] }],
  angulos: [{ vertice: "A", desde: "B", hasta: "C", medida: 90 }],
  circunferencias: [],
};

describe("geometria", () => {
  it("un triángulo rectángulo con su ángulo recto bien medido", () => {
    expect(validarGrafica(TRIANGULO).descartes).toEqual([]);
  });

  it("un ángulo cuya medida no casa con el dibujo se descarta", () => {
    const r = validarGrafica({ ...TRIANGULO, angulos: [{ vertice: "A", desde: "B", hasta: "C", medida: 60 }] });
    expect(r.descartes).toEqual(["angulo_no_cuadra"]);
  });

  it("los tres ángulos de un triángulo suman 180°", () => {
    const r = validarGrafica({
      ...TRIANGULO,
      angulos: [
        { vertice: "A", desde: "B", hasta: "C", medida: 90 },
        { vertice: "B", desde: "C", hasta: "A", medida: 36.87 },
        { vertice: "C", desde: "A", hasta: "B", medida: 53.13 },
      ],
    });
    expect(r.descartes).toEqual([]);
    const mal = validarGrafica({
      ...TRIANGULO,
      angulos: [
        { vertice: "A", desde: "B", hasta: "C", medida: 90 },
        { vertice: "B", desde: "C", hasta: "A", medida: 40 },
        { vertice: "C", desde: "A", hasta: "B", medida: 60 },
      ],
    });
    expect(mal.descartes).toContain("triangulo_no_suma_180");
  });

  it("una longitud rotulada que no casa con el dibujo se descarta", () => {
    const r = validarGrafica({ ...TRIANGULO, segmentos: [{ desde: "A", hasta: "B", etiqueta: "7" }] });
    expect(r.descartes).toEqual(["longitud_no_cuadra"]);
  });

  it("una referencia a un punto que no existe tumba la gráfica", () => {
    expect(validarGrafica({ ...TRIANGULO, segmentos: [{ desde: "A", hasta: "Z" }] }).grafica).toBeNull();
  });
});

describe("fisica", () => {
  it("un plano inclinado con su diagrama de cuerpo libre", () => {
    const r = validarGrafica({
      tipo: "fisica",
      plano: { angulo: 30 },
      fuerzas: [
        { etiqueta: "$P$", angulo: 270, modulo: 2 },
        { etiqueta: "$N$", angulo: 120, modulo: 1.7 },
      ],
      vectores: [],
    });
    expect(r.descartes).toEqual([]);
    expect(r.grafica).toMatchObject({ tipo: "fisica", plano: { angulo: 30 } });
  });

  it("un plano de 0° o de 90° no es un plano inclinado", () => {
    expect(validarGrafica({ tipo: "fisica", plano: { angulo: 95 }, fuerzas: [], vectores: [] }).grafica).toBeNull();
  });

  it("una fuerza sin módulo se descarta", () => {
    const r = validarGrafica({ tipo: "fisica", fuerzas: [{ etiqueta: "F", angulo: 0, modulo: 0 }], vectores: [] });
    expect(r.descartes).toContain("fuerza_sin_modulo");
  });
});

describe("textoAlternativo", () => {
  it("describe la gráfica para quien no la ve", () => {
    expect(textoAlternativo(validarGrafica(PARABOLA).grafica!)).toMatch(/Gráfica de x\^2 - 4 entre x = -4 y x = 4.*raíz \(2, 0\)/);
    expect(textoAlternativo(validarGrafica(TRIANGULO).grafica!)).toMatch(/Figura con 3 puntos.*polígono A-B-C.*ángulo en A de 90°/);
  });
});

describe("leerBloquesDeGrafica", () => {
  it("separa un bloque ```grafica``` del texto del chat", () => {
    const texto = "Mira:\n\n```grafica\n" + JSON.stringify(PARABOLA) + "\n```\n\nY sigue.";
    const trozos = leerBloquesDeGrafica(texto);
    expect(trozos.map((t) => t.tipo)).toEqual(["texto", "grafica", "texto"]);
  });

  it("un bloque roto se queda como texto", () => {
    expect(leerBloquesDeGrafica("```grafica\n{roto\n```").map((t) => t.tipo)).toEqual(["texto"]);
  });
});
