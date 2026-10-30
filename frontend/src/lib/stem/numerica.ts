/**
 * La corrección numérica, del lado de la app: es la misma del servidor (una sola fuente), para
 * corregir al instante y sin red. `tsconfig.app.json` permite importar `.ts` de `supabase/`,
 * como ya hace `src/lib/leccion/bloques.ts`.
 */
export {
  corregirNumerica,
  leerCantidad,
  mismaDimension,
  type CorreccionNumerica,
  type RespuestaNumerica,
} from "@/lib/admision/motor/numerica";
export { comprobarCuenta, evaluar, evaluarLatex, latexAExpresion } from "@/lib/admision/motor/cuentas";
// Cómo parte `evaluate-answer` los pasos del alumno: la pantalla los numera igual que el servidor.
export { pasosDelAlumno, type PasoCorregido } from "@/lib/admision/motor/evaluacion-por-pasos";
export type { PasoResuelto } from "@/lib/admision/motor/formatos-stem";
