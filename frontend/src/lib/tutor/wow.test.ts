import { describe, expect, it } from "vitest";
import type { Grafo, NodoGrafo } from "./grafo";
import {
  caminoComprension,
  etiquetasPasos,
  limitarAnchoPanel,
  momentoComprension,
  planRetropropagacion,
  type Evidencia,
  type Rastro,
} from "./wow";
const nodo: NodoGrafo = {
  id: "idea",
  arbol_id: "a",
  tipo: "idea",
  titulo: "Cambio de base",
  resumen: "",
  idea_clave: "cambio-de-base",
  concepto: "porcentajes",
  estado: "fallo",
  senal: null,
  origen: "sistema",
  evidencias: 1,
};
const grafo: Grafo = {
  version: 1,
  foco: "idea",
  camino_error: ["raiz", "idea"],
  nodos: [
    { ...nodo, id: "raiz", tipo: "concepto" },
    nodo,
    { ...nodo, id: "error", tipo: "error" },
  ],
  aristas: [
    {
      id: "padre",
      origen: "raiz",
      destino: "idea",
      tipo: "subtema",
      creada_por: "sistema",
    },
    {
      id: "confusion",
      origen: "error",
      destino: "idea",
      tipo: "confusion_con",
      creada_por: "sistema",
    },
  ],
};
const rastro: Rastro = {
  respuesta: "100",
  idea_clave: "cambio-de-base",
  nodo_retorno_id: "idea",
  motivo: "mapa_error",
};
const ev = (
  id: string,
  tipo: string,
  detalle: Evidencia["detalle"],
  fecha: string,
  comprobacion = id,
): Evidencia => ({
  id,
  tipo,
  detalle,
  arbol_id: "a",
  comprobacion_id: comprobacion,
  created_at: fecha,
});
const evidencias = [
  ev("fallo", "aplicacion_por_reforzar", { rastro }, "2026-01-01"),
  ev(
    "bien",
    "resolvio_sin_ayuda",
    { correcta: true, ayuda: false, solucion: "200 × 1,2 × 0,75 = 180" },
    "2026-01-02",
    "check",
  ),
  ev(
    "correccion",
    "corrigio_tras_error",
    { idea_clave: "cambio-de-base" },
    "2026-01-02",
    "check",
  ),
];
describe("plan determinista de retropropagación", () => {
  it("viaja por la confusión real hasta la idea, con tiempos acotados", () => {
    const p = planRetropropagacion(grafo, rastro)!;
    expect(p).toMatchObject({
      origen: "error",
      retorno: "idea",
      llegada: 1300,
      total: 1800,
    });
    expect(p.tramos).toEqual([
      {
        arista: "confusion",
        desde: "error",
        hasta: "idea",
        inicio: 400,
        duracion: 900,
      },
    ]);
  });
  it("respeta la ruta raíz-retorno, no invierte la llegada hacia la raíz", () => {
    expect(
      planRetropropagacion(
        { ...grafo, aristas: grafo.aristas.slice(0, 1) },
        rastro,
      )?.tramos[0],
    ).toMatchObject({ desde: "raiz", hasta: "idea" });
  });
  it("no inventa nodos, aristas ni causas y no anima un fallo corregido", () => {
    for (const [g, r] of [
      [{ ...grafo, camino_error: [] }, rastro],
      [grafo, null],
      [grafo, { ...rastro, motivo: "sin_evidencia" }],
      [grafo, { ...rastro, nodo_retorno_id: "ajeno" }],
      [{ ...grafo, aristas: [] }, rastro],
      [
        {
          ...grafo,
          nodos: grafo.nodos.map((n) => ({
            ...n,
            estado: "aplicado" as const,
          })),
        },
        rastro,
      ],
    ] as [Grafo, Rastro | null][])
      expect(planRetropropagacion(g, r)).toBeNull();
  });
  it("no muta el contrato recibido", () => {
    const antes = JSON.stringify(grafo);
    planRetropropagacion(grafo, rastro);
    expect(JSON.stringify(grafo)).toBe(antes);
  });
});
describe("camino y momento de comprensión sin evidencia inventada", () => {
  it("no usa señales ni mensajes del modelo como progreso", () => {
    expect(
      caminoComprension({ ...nodo, senal: "posible_confusion" }, []).every(
        (e) => !e.hecho,
      ),
    ).toBe(true);
    expect(
      caminoComprension(nodo, [])
        .slice(1, 3)
        .every((e) => !e.disponible),
    ).toBe(true);
  });
  it("marca aplicación solo con evidencia de la misma idea y árbol", () => {
    const aplicada = { ...nodo, estado: "aplicado" as const };
    expect(
      caminoComprension(aplicada, evidencias)
        .slice(3)
        .map((e) => e.hecho),
    ).toEqual([true, true]);
    expect(
      caminoComprension(
        aplicada,
        evidencias.map((e) => ({ ...e, arbol_id: "otro" })),
      ).every((e) => !e.hecho),
    ).toBe(true);
    expect(
      caminoComprension(nodo, evidencias)
        .slice(3)
        .every((e) => !e.hecho),
    ).toBe(true);
  });
  it("muestra ambos lados guardados, no calcula una respuesta del estudiante", () => {
    expect(
      momentoComprension({ ...nodo, estado: "aplicado" }, evidencias),
    ).toMatchObject({ antes: "100", ahora: "200 × 1,2 × 0,75 = 180" });
    for (const es of [
      [],
      evidencias.slice(1),
      evidencias.filter((e) => e.tipo !== "resolvio_sin_ayuda"),
      evidencias.map((e) => ({ ...e, detalle: { ...e.detalle, ayuda: true } })),
    ])
      expect(
        momentoComprension({ ...nodo, estado: "aplicado" }, es),
      ).toBeNull();
    expect(momentoComprension(nodo, evidencias)).toBeNull();
  });
});
it("etiqueta solo los pasos entregados, conserva orden y repeticiones", () => {
  expect(etiquetasPasos()).toEqual([]);
  expect(etiquetasPasos(["leer_grafo", "leer_grafo", "desconocida"])).toEqual([
    "Revisé tu mapa de comprensión",
    "Revisé tu mapa de comprensión",
    "Herramienta utilizada: desconocida",
  ]);
});
it("limita preferencias de ancho corruptas o fuera de rango", () => {
  expect([NaN, -2, 100, 42].map(limitarAnchoPanel)).toEqual([44, 30, 68, 42]);
});
