// Casos propios con clave comprobada aritméticamente. Pendiente revisión pedagógica externa.
// Se muestran como actividades de Atlas, nunca como preguntas oficiales UNMSM.
export type IdeaClave = {
  concepto: string;
  clave: string;
  descripcion: string;
};
// Catálogo fijo y curado: la IA solo puede etiquetar nodos con estas claves.
export const IDEAS_CLAVE: readonly IdeaClave[] = [
  {
    concepto: "porcentajes",
    clave: "base-del-porcentaje",
    descripcion:
      "Un porcentaje se calcula sobre una cantidad concreta (la base).",
  },
  {
    concepto: "porcentajes",
    clave: "cambio-de-base",
    descripcion:
      "Tras un aumento o un descuento, la base del siguiente cambia.",
  },
  {
    concepto: "proporciones",
    clave: "directa-vs-inversa",
    descripcion:
      "Distinguir si al aumentar una magnitud la otra aumenta o disminuye.",
  },
  {
    concepto: "proporciones",
    clave: "valor-unitario",
    descripcion: "Reducir a «por unidad» antes de escalar a otra cantidad.",
  },
  {
    concepto: "fracciones",
    clave: "parte-vs-complemento",
    descripcion: "Distinguir la parte usada de la parte que queda.",
  },
  {
    concepto: "fracciones",
    clave: "fraccion-de-cantidad",
    descripcion: "Calcular una fracción de una cantidad concreta.",
  },
];
export const clavesDe = (concepto: string | null | undefined) =>
  concepto ? IDEAS_CLAVE.filter((i) => i.concepto === concepto) : [];
export const esClaveDe = (
  concepto: string | null | undefined,
  clave: string | null | undefined,
) => Boolean(clave) && clavesDe(concepto).some((i) => i.clave === clave);
export const ideaPorClave = (clave: string | null | undefined) =>
  IDEAS_CLAVE.find((i) => i.clave === clave);
export type ErrorTipico = {
  respuesta: number;
  idea_clave: string;
  explicacion: string;
  pista: string;
};
export type Actividad = {
  id: string;
  concepto: string;
  enunciado: string;
  respuesta: number;
  solucion: string;
  errores: readonly ErrorTipico[];
};
export const buscarError = (a: Actividad, respuesta: number) =>
  Number.isFinite(respuesta)
    ? a.errores.find((e) => e.respuesta === respuesta)
    : undefined;
export const ACTIVIDADES: readonly Actividad[] = [
  {
    id: "porcentajes-1",
    concepto: "porcentajes",
    enunciado:
      "Un precio de S/100 sube 20% y luego baja 20%. ¿Cuál es el precio final en soles? Explica sobre qué cantidad calculaste cada porcentaje.",
    respuesta: 96,
    solucion:
      "100 × 1,20 × 0,80 = 96. El segundo porcentaje usa como base 120, no 100.",
    errores: [
      {
        respuesta: 100,
        idea_clave: "cambio-de-base",
        explicacion:
          "Esa respuesta es la que sale al tratar +20% y −20% como si se compensaran. Después de subir 20%, la cantidad ya no es 100.",
        pista:
          "Después de subir 20%, ¿sobre qué cantidad se calcula el descuento del 20%?",
      },
    ],
  },
  {
    id: "porcentajes-2",
    concepto: "porcentajes",
    enunciado:
      "Un depósito tiene 200 litros. Se consume el 25% y después se repone el 20% de lo que quedó. ¿Cuántos litros hay al final? Explica las dos bases.",
    respuesta: 180,
    solucion:
      "Quedan 200 × 0,75 = 150 litros. Se reponen 150 × 0,20 = 30: total 180.",
    errores: [
      {
        respuesta: 190,
        idea_clave: "cambio-de-base",
        explicacion:
          "Esa respuesta sale de combinar −25% y +20% como si fueran −5% sobre 200. Cada porcentaje usa una base distinta.",
        pista:
          "Después de consumir el 25%, ¿cuántos litros quedan? ¿Sobre cuál de las dos cantidades se calcula el 20%?",
      },
    ],
  },
  {
    id: "porcentajes-3",
    concepto: "porcentajes",
    enunciado:
      "Una cantidad baja de 100 a 80. ¿Qué porcentaje debe aumentar, sobre 80, para volver a 100? Escribe el porcentaje y justifica.",
    respuesta: 25,
    solucion: "Faltan 20 respecto de una base 80: 20 / 80 × 100 = 25%.",
    errores: [
      {
        respuesta: 20,
        idea_clave: "base-del-porcentaje",
        explicacion:
          "Esa respuesta sale de calcular 20 sobre 100. Lo que se pide es el porcentaje respecto de la cantidad actual.",
        pista:
          "El aumento parte de 80. ¿Qué parte de 80 son los 20 que faltan?",
      },
    ],
  },
  {
    id: "proporciones-1",
    concepto: "proporciones",
    enunciado:
      "Tres máquinas iguales completan una tarea en 12 horas. Con seis máquinas iguales y el mismo rendimiento, ¿cuántas horas requiere la misma tarea? Explica la relación.",
    respuesta: 6,
    solucion:
      "Se necesitan 3 × 12 = 36 máquina-horas; 36 / 6 = 6 horas. La relación es inversa.",
    errores: [
      {
        respuesta: 24,
        idea_clave: "directa-vs-inversa",
        explicacion:
          "Esa respuesta sale de duplicar las horas al duplicar las máquinas, es decir, de tratar la relación como directa.",
        pista:
          "Si hay más máquinas trabajando a la vez, ¿la tarea tarda más o menos horas?",
      },
    ],
  },
  {
    id: "proporciones-2",
    concepto: "proporciones",
    enunciado:
      "Una receta para cuatro personas usa 300 gramos de arroz. Manteniendo la proporción, ¿cuántos gramos se necesitan para diez personas? Justifica.",
    respuesta: 750,
    solucion: "300 / 4 = 75 gramos por persona; 75 × 10 = 750.",
    errores: [],
  },
  {
    id: "fracciones-1",
    concepto: "fracciones",
    enunciado:
      "Una cinta mide 24 cm y se utiliza 3/8 de ella. ¿Cuántos centímetros quedan? Explica qué parte representa lo que queda.",
    respuesta: 15,
    solucion: "Quedan 5/8 de la cinta: 24 × 5/8 = 15 cm.",
    errores: [
      {
        respuesta: 9,
        idea_clave: "parte-vs-complemento",
        explicacion:
          "Esa respuesta es lo que se usó (3/8 de 24), no lo que queda de la cinta.",
        pista:
          "3/8 es la parte usada. ¿Qué fracción de la cinta representa lo que queda?",
      },
    ],
  },
  {
    id: "fracciones-2",
    concepto: "fracciones",
    enunciado:
      "Una botella contiene 900 ml y se sirve 2/3 de su contenido. ¿Cuántos mililitros quedan? Justifica.",
    respuesta: 300,
    solucion: "Queda 1/3: 900 × 1/3 = 300 ml.",
    errores: [
      {
        respuesta: 600,
        idea_clave: "parte-vs-complemento",
        explicacion:
          "Esa respuesta es lo que se sirvió (2/3 de 900), no lo que queda en la botella.",
        pista:
          "2/3 es la parte servida. ¿Qué fracción del contenido sigue en la botella?",
      },
    ],
  },
];
export function conceptoDe(
  curso: string,
  tema: string,
  enunciado = "",
): string | null {
  if (curso !== "aritmetica") return null;
  if (tema === "fracciones") return "fracciones";
  if (
    tema === "regla-de-tres" &&
    /porcent|%|descuento/.test(enunciado.toLowerCase())
  )
    return "porcentajes";
  if (["razones-y-proporciones", "regla-de-tres"].includes(tema))
    return "proporciones";
  return null;
}
