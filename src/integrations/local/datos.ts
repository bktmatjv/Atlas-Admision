import type { CarreraUnmsm, DistribucionUnmsm, ItemDelDia, ProcesoUnmsm, ResultadoUnmsm } from "@/lib/admision/datos-unmsm";
import type { AreaDeAdmision, ExamenDeAdmision } from "@/integrations/supabase/admision";

/**
 * Los datos fijos de la web: el banco de San Marcos y las cifras oficiales. Los genera
 * `npm run banco` en public/datos; aquí se piden una vez y se guardan en memoria.
 */

export interface PreguntaDelBanco {
  id: string; examen_id: string; numero: number; texto_id: string | null;
  bloque: string | null; curso: string | null; tema: string | null;
  enunciado: string; opciones: Record<string, string>; clave: string | null;
  graficos: string[]; solucion: string | null; dificultad: number | null; origen: "real";
}
export interface TextoDelBanco { id: string; examen_id: string; etiqueta: string; cuerpo: string }

export interface Banco {
  examenes: (ExamenDeAdmision & { area: AreaDeAdmision })[];
  textos: TextoDelBanco[];
  preguntas: PreguntaDelBanco[];
}
export interface DatosUnmsm {
  carreras: CarreraUnmsm[]; procesos: ProcesoUnmsm[]; resultados: ResultadoUnmsm[];
  dia_examen: ItemDelDia[]; distribuciones: DistribucionUnmsm[];
}

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

async function pedir<T>(fichero: string): Promise<T> {
  const r = await fetch(`${base}/datos/${fichero}`);
  if (!r.ok) throw new Error(`No se pudo cargar ${fichero} (${r.status})`);
  return r.json() as Promise<T>;
}

let banco: Promise<Banco & { preguntaPorId: Map<string, PreguntaDelBanco>; textoPorId: Map<string, TextoDelBanco> }> | null = null;
let unmsm: Promise<DatosUnmsm> | null = null;

export function cargarBanco() {
  // Si falla (sin conexión), la próxima llamada lo vuelve a intentar.
  banco ??= pedir<Banco>("banco.json")
    .then((b) => ({
      ...b,
      preguntaPorId: new Map(b.preguntas.map((p) => [p.id, p])),
      textoPorId: new Map(b.textos.map((t) => [t.id, t])),
    }))
    .catch((e) => { banco = null; throw e; });
  return banco;
}

export function cargarUnmsm() {
  unmsm ??= pedir<DatosUnmsm>("unmsm.json").catch((e) => { unmsm = null; throw e; });
  return unmsm;
}

/** Dónde se sirve un gráfico del banco. */
export const urlDeGrafico = (ruta: string) => `${base}/graficos/${ruta}`;
