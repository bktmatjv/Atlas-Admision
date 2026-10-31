// Casos propios con clave comprobada aritméticamente. Pendiente revisión pedagógica externa.
// Se muestran como actividades de Calibra, nunca como preguntas oficiales UNMSM.
export const ACTIVIDADES = [
  {
    id: "porcentajes-1",
    concepto: "porcentajes",
    enunciado:
      "Un precio de S/100 sube 20% y luego baja 20%. ¿Cuál es el precio final en soles? Explica sobre qué cantidad calculaste cada porcentaje.",
    respuesta: 96,
    solucion:
      "100 × 1,20 × 0,80 = 96. El segundo porcentaje usa como base 120, no 100.",
  },
  {
    id: "porcentajes-2",
    concepto: "porcentajes",
    enunciado:
      "Un depósito tiene 200 litros. Se consume el 25% y después se repone el 20% de lo que quedó. ¿Cuántos litros hay al final? Explica las dos bases.",
    respuesta: 180,
    solucion:
      "Quedan 200 × 0,75 = 150 litros. Se reponen 150 × 0,20 = 30: total 180.",
  },
  {
    id: "porcentajes-3",
    concepto: "porcentajes",
    enunciado:
      "Una cantidad baja de 100 a 80. ¿Qué porcentaje debe aumentar, sobre 80, para volver a 100? Escribe el porcentaje y justifica.",
    respuesta: 25,
    solucion: "Faltan 20 respecto de una base 80: 20 / 80 × 100 = 25%.",
  },
  {
    id: "proporciones-1",
    concepto: "proporciones",
    enunciado:
      "Tres máquinas iguales completan una tarea en 12 horas. Con seis máquinas iguales y el mismo rendimiento, ¿cuántas horas requiere la misma tarea? Explica la relación.",
    respuesta: 6,
    solucion:
      "Se necesitan 3 × 12 = 36 máquina-horas; 36 / 6 = 6 horas. La relación es inversa.",
  },
  {
    id: "proporciones-2",
    concepto: "proporciones",
    enunciado:
      "Una receta para cuatro personas usa 300 gramos de arroz. Manteniendo la proporción, ¿cuántos gramos se necesitan para diez personas? Justifica.",
    respuesta: 750,
    solucion: "300 / 4 = 75 gramos por persona; 75 × 10 = 750.",
  },
  {
    id: "fracciones-1",
    concepto: "fracciones",
    enunciado:
      "Una cinta mide 24 cm y se utiliza 3/8 de ella. ¿Cuántos centímetros quedan? Explica qué parte representa lo que queda.",
    respuesta: 15,
    solucion: "Quedan 5/8 de la cinta: 24 × 5/8 = 15 cm.",
  },
  {
    id: "fracciones-2",
    concepto: "fracciones",
    enunciado:
      "Una botella contiene 900 ml y se sirve 2/3 de su contenido. ¿Cuántos mililitros quedan? Justifica.",
    respuesta: 300,
    solucion: "Queda 1/3: 900 × 1/3 = 300 ml.",
  },
] as const;
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
