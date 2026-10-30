import { Consulta } from "@/integrations/local/consulta";
import { armar, entregar, FalloDeFuncion, preguntasDelIntento, revelar, temasFrecuentes } from "@/integrations/local/servidor";
import { urlDeGrafico } from "@/integrations/local/datos";

/**
 * En Atlas, el cliente de Supabase. Aquí no hay servidor: el mismo nombre y la misma forma
 * (`from`, `rpc`, `functions.invoke`, `storage`) sobre los datos locales, para que las pantallas
 * copiadas del módulo de admisión no cambien.
 */

type Respuesta<T> = Promise<{ data: T | null; error: (Error & { context?: Response }) | null }>;

async function capturar<T>(f: () => Promise<T>): Respuesta<T> {
  try {
    return { data: await f(), error: null };
  } catch (e) {
    return { data: null, error: e instanceof FalloDeFuncion ? e : new FalloDeFuncion(e instanceof Error ? e.message : String(e), 500) };
  }
}

const RPC = {
  admision_preguntas_del_intento: (a: { _intento: string }) => preguntasDelIntento(a._intento),
  admision_revelar: (a: { _intento: string; _pregunta: string }) => revelar(a._intento, a._pregunta),
  admision_temas_frecuentes: (a: { _area: string }) => temasFrecuentes(a._area),
} as const;

const FUNCIONES: Record<string, (body: never) => Promise<unknown>> = {
  "admision-armar": armar,
  "admision-entregar": entregar,
};

export const supabase = {
  from: <T = Record<string, unknown>>(tabla: string) => new Consulta<T>(tabla),
  rpc: <N extends keyof typeof RPC>(nombre: N, args: Parameters<(typeof RPC)[N]>[0]) =>
    capturar(() => (RPC[nombre] as (a: typeof args) => Promise<unknown>)(args)) as Respuesta<Awaited<ReturnType<(typeof RPC)[N]>>>,
  functions: {
    invoke: (nombre: string, opciones?: { body?: unknown }) => {
      const f = FUNCIONES[nombre];
      if (!f) return capturar(() => Promise.reject(new FalloDeFuncion(`No existe la función ${nombre}`, 404)));
      return capturar(() => f((opciones?.body ?? {}) as never));
    },
  },
  storage: {
    from: (_bucket: string) => ({
      // Los gráficos son ficheros estáticos de la web: la «firma» es su ruta.
      createSignedUrls: async (rutas: string[], _segundos: number) => ({
        data: rutas.map((path) => ({ path, signedUrl: urlDeGrafico(path), error: null })),
        error: null,
      }),
    }),
  },
};
