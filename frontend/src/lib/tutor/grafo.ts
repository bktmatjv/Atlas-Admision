export type Estado = "sin_explorar" | "explorado" | "fallo" | "aplicado";
export type NodoGrafo = {
  id: string;
  arbol_id: string;
  tipo: string;
  titulo: string;
  resumen: string;
  idea_clave: string | null;
  concepto: string | null;
  estado: Estado;
  senal: string | null;
  origen: string;
  evidencias: number;
};
export type AristaGrafo = {
  id: string;
  origen: string;
  destino: string;
  tipo: string;
  creada_por: string;
};
export type Grafo = {
  version: number;
  foco: string | null;
  camino_error: string[];
  nodos: NodoGrafo[];
  aristas: AristaGrafo[];
};
export const ESTADO_TEXTO: Record<Estado, string> = {
  sin_explorar: "Sin explorar",
  explorado: "Explorado",
  fallo: "Para revisar",
  aplicado: "Aplicado por tu cuenta",
};
// El glifo acompaña al color: el estado nunca depende solo del color.
export const ESTADO_GLIFO: Record<Estado, string> = {
  sin_explorar: "○",
  explorado: "◐",
  fallo: "!",
  aplicado: "✓",
};
export const ESTADO_COLOR: Record<Estado, string> = {
  sin_explorar: "#94a3b8",
  explorado: "#2563eb",
  fallo: "#dc2626",
  aplicado: "#16a34a",
};
export const TIPO_ARISTA_TEXTO: Record<string, string> = {
  subtema: "subtema",
  requiere: "requiere",
  relacionado: "relacionado con",
  contrasta_con: "contrasta con",
  ejemplo_de: "ejemplo de",
  confusion_con: "confusión con",
};
export const radioNodo = (evidencias: number) =>
  6 + Math.min(Math.max(evidencias, 0), 6) * 1.5;
// Claves «origen>destino» de los tramos consecutivos del camino del error.
export function aristasCamino(camino: string[]) {
  const claves = new Set<string>();
  for (let i = 0; i + 1 < camino.length; i++)
    claves.add(`${camino[i]}>${camino[i + 1]}`);
  return claves;
}
export const descripcionNodo = (n: NodoGrafo) =>
  `${n.titulo}. Estado: ${ESTADO_TEXTO[n.estado]}.` +
  (n.senal ? " Posible confusión (lectura provisional)." : "") +
  (n.evidencias ? ` Evidencias: ${n.evidencias}.` : "");
export type NodoArbol = {
  nodo: NodoGrafo;
  profundidad: number;
  hijos: NodoArbol[];
};
// Vista jerárquica para pantallas chicas: sigue las aristas «subtema»; cada nodo aparece una vez.
export function jerarquia(g: Pick<Grafo, "nodos" | "aristas">): NodoArbol[] {
  const porId = new Map(g.nodos.map((n) => [n.id, n]));
  const hijosDe = new Map<string, string[]>();
  const conPadre = new Set<string>();
  for (const a of g.aristas)
    if (a.tipo === "subtema" && porId.has(a.origen) && porId.has(a.destino)) {
      hijosDe.set(a.origen, [...(hijosDe.get(a.origen) ?? []), a.destino]);
      conPadre.add(a.destino);
    }
  const visto = new Set<string>();
  const armar = (id: string, profundidad: number): NodoArbol | null => {
    if (visto.has(id)) return null;
    visto.add(id);
    return {
      nodo: porId.get(id)!,
      profundidad,
      hijos: (hijosDe.get(id) ?? []).flatMap((h) => {
        const x = armar(h, profundidad + 1);
        return x ? [x] : [];
      }),
    };
  };
  const raices = g.nodos.filter((n) => !conPadre.has(n.id));
  const salida = raices.flatMap((n) => {
    const x = armar(n.id, 0);
    return x ? [x] : [];
  });
  // Nodos solo alcanzables por un ciclo: se muestran como raíces para no perderlos.
  for (const n of g.nodos) {
    const x = armar(n.id, 0);
    if (x) salida.push(x);
  }
  return salida;
}
