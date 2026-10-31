import type { Grafo, NodoGrafo } from "./grafo";

/** Son estados observados de nodos, no una medida ni un porcentaje de comprensión. */
export function resumenDelMapa(grafo: Grafo, arbolId?: string) {
  const nodos = arbolId
    ? grafo.nodos.filter((n) => n.arbol_id === arbolId)
    : grafo.nodos;
  return {
    total: nodos.length,
    aplicados: nodos.filter((n) => n.estado === "aplicado").length,
    explorados: nodos.filter((n) => n.estado === "explorado").length,
    revisar: nodos.filter((n) => n.estado === "fallo").length,
    sinExplorar: nodos.filter((n) => n.estado === "sin_explorar").length,
  };
}

export function buscarNodos(nodos: NodoGrafo[], consulta: string) {
  const normalizar = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const q = normalizar(consulta);
  return q
    ? nodos.filter((n) => normalizar(`${n.titulo} ${n.resumen}`).includes(q))
    : nodos;
}

/** Mapa local estable: conexiones reales, hasta ocho vecinos; la lista conserva todos. */
export function disponerMapa(grafo: Grafo, elegido: string | null) {
  const centro =
    grafo.nodos.find((n) => n.id === elegido) ??
    grafo.nodos.find((n) => n.id === grafo.foco) ??
    grafo.nodos[0];
  if (!centro) return { nodos: [], aristas: [], omitidos: 0 };
  const vecinos = new Set(
    grafo.aristas.flatMap((a) =>
      a.origen === centro.id
        ? [a.destino]
        : a.destino === centro.id
          ? [a.origen]
          : [],
    ),
  );
  const relacionados = grafo.nodos.filter(
    (n) => vecinos.has(n.id) && n.id !== centro.id,
  );
  const visibles = [centro, ...relacionados.slice(0, 8)];
  const ids = new Set(visibles.map((n) => n.id));
  const nodos = visibles.map((n, i) => {
    const angulo =
      -Math.PI / 2 + ((i - 1) * 2 * Math.PI) / Math.max(1, visibles.length - 1);
    return {
      ...n,
      x: i === 0 ? 240 : 240 + Math.sin(angulo) * 157,
      y: i === 0 ? 234 : 234 + Math.cos(angulo) * 154,
      central: i === 0,
    };
  });
  return {
    nodos,
    aristas: grafo.aristas.filter(
      (a) => ids.has(a.origen) && ids.has(a.destino),
    ),
    omitidos: grafo.nodos.length - visibles.length,
  };
}
