/**
 * La pregunta de respuesta numérica, corregida sin IA.
 *
 * El alumno escribe «72 km/h», «20», «2·10^1 m/s» o «$9{,}8\,\text{m/s}^2$» y todo eso tiene que
 * casar con un 20 m/s. Se corrige igual en el cliente (al instante, sin red) y en el servidor:
 * el cliente reexporta este fichero (`src/lib/stem/numerica.ts`), así que no hay dos copias.
 *
 * Reglas:
 * - Coma o punto decimal; miles con espacio («1 200») o con varios puntos («1.200.000»). Un solo
 *   punto con tres cifras («1.200») es decimal: en duda, lo que escribe un alumno de ciencias.
 * - Notación científica: «1,2e3», «1,2 × 10^3», «1.2x10^3», «6,02·10^{23}».
 * - Sin unidad, el número va en la unidad del enunciado (la pantalla la enseña junto al campo).
 * - Con unidad, se convierte por una tabla pequeña (SI y las de colegio). Una unidad que no mide
 *   lo mismo es un fallo distinto del de la cuenta, con su propia pista.
 *
 * Desde el 17-10-2026 es una capa fina sobre `numeros/` (la política formativa): el lector en
 * `numeros/leer.ts`, las unidades en `numeros/unidades.ts` y la corrección en `numeros/politicas.ts`.
 * La API no cambia: `src/lib/stem/numerica.ts` y `formatos-stem.ts` siguen importando de aquí.
 */
export { leerCantidad } from "@/lib/admision/motor/numeros/leer";
export { mismaDimension } from "@/lib/admision/motor/numeros/unidades";
export {
  corregirFormativa as corregirNumerica,
  type CorreccionNumerica,
  type RespuestaNumerica,
} from "@/lib/admision/motor/numeros/politicas";
