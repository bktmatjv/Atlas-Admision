/**
 * Las gráficas, del lado de la app: la especificación, su validación y el muestreo son los del
 * servidor (`supabase/functions/_shared/grafica.ts`), una sola fuente. Lo que se ve es lo que
 * se comprobó con código al generarlo.
 */
export {
  leerBloquesDeGrafica,
  muestrear,
  textoAlternativo,
  validarGrafica,
  type Grafica,
  type GraficaDeFisica,
  type GraficaDeFunciones,
  type GraficaDeGeometria,
  type Par,
  type TrozoConGrafica,
} from "@/lib/admision/motor/grafica";
