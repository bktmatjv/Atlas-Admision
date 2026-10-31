import type { Grafo } from "./grafo";
// Pantalla inicial del tutor: solo ofrece lo que el backend soporta hoy.
export const TEMAS_SOPORTADOS = [
  { id: "porcentajes", nombre: "Porcentajes" },
  { id: "proporciones", nombre: "Proporciones" },
  { id: "fracciones", nombre: "Fracciones" },
] as const;
export type TemaId = (typeof TEMAS_SOPORTADOS)[number]["id"];
export type Intencion = {
  id: "duda" | "analizar" | "practicar" | "grafo";
  titulo: string;
  descripcion: string;
  // «texto» precarga el campo; «practica» pide un ejercicio del tema elegido; «grafo» abre el mapa.
  accion: "texto" | "practica" | "grafo";
  precarga: string;
};
export const INTENCIONES: readonly Intencion[] = [
  {
    id: "duda",
    titulo: "Resolver una duda",
    descripcion: "Explica un tema o ejercicio",
    accion: "texto",
    precarga: "Tengo una duda sobre ",
  },
  {
    id: "analizar",
    titulo: "Analizar un ejercicio",
    descripcion: "Revisemos tu razonamiento",
    accion: "texto",
    precarga: "Quiero que analicemos este ejercicio y cómo lo pensé: ",
  },
  {
    id: "practicar",
    titulo: "Practicar por tema",
    descripcion: "Ejercicios guiados",
    accion: "practica",
    precarga: "",
  },
  {
    id: "grafo",
    titulo: "Explorar mi grafo",
    descripcion: "Revisa tu comprensión",
    accion: "grafo",
    precarga: "",
  },
];
export type TemaOrdenado = {
  id: TemaId;
  nombre: string;
  // Tiene un fallo pendiente en el mapa: se recomienda primero.
  pendiente: boolean;
};
export function ordenarTemas(grafo?: Grafo): TemaOrdenado[] {
  const conFallo = new Set(
    (grafo?.nodos ?? [])
      .filter((n) => n.estado === "fallo" && n.concepto)
      .map((n) => n.concepto),
  );
  const temas = TEMAS_SOPORTADOS.map((t) => ({
    ...t,
    pendiente: conFallo.has(t.id),
  }));
  return [
    ...temas.filter((t) => t.pendiente),
    ...temas.filter((t) => !t.pendiente),
  ];
}
export type Contexto =
  | { tema: TemaId }
  | { intento_id: string; pregunta_id: string }
  | { fragmento_id: string };
export type OpcionDeContexto = {
  clave: string;
  etiqueta: string;
  contexto: Contexto;
};
export function opcionesDeContexto(o: {
  practica?: { intento_id: string; pregunta_id: string } | null;
  material?: { fragmento_id: string; nombre: string } | null;
}): OpcionDeContexto[] {
  return [
    ...TEMAS_SOPORTADOS.map((t) => ({
      clave: `tema:${t.id}`,
      etiqueta: t.nombre,
      contexto: { tema: t.id } as Contexto,
    })),
    ...(o.practica
      ? [
          {
            clave: "practica",
            etiqueta: "Mi última práctica",
            contexto: {
              intento_id: o.practica.intento_id,
              pregunta_id: o.practica.pregunta_id,
            } as Contexto,
          },
        ]
      : []),
    ...(o.material
      ? [
          {
            clave: "material",
            etiqueta: `Material: ${o.material.nombre}`,
            contexto: { fragmento_id: o.material.fragmento_id } as Contexto,
          },
        ]
      : []),
  ];
}
// Cuerpo de POST /conversaciones: crea la conversación y manda el primer turno.
export const cuerpoDeCreacion = (
  contexto: Contexto | null,
  mensaje: string,
) => ({
  ...(contexto ?? {}),
  mensaje_inicial: mensaje.trim(),
});
type IntentoLite = { id: string; estado: string };
type RespuestaLite = { pregunta_id: string; correcta: boolean | null };
// Primera práctica entregada (la más reciente) con una pregunta fallada.
export function ultimaPracticaFallada(
  intentos: IntentoLite[],
  respuestasDe: (intentoId: string) => RespuestaLite[],
) {
  for (const i of intentos.filter((x) => x.estado === "entregado")) {
    const fallada = respuestasDe(i.id).find((r) => r.correcta === false);
    if (fallada) return { intento_id: i.id, pregunta_id: fallada.pregunta_id };
  }
  return null;
}
