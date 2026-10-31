import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { admision, type PerfilDeAdmision } from '@/integrations/api/admision';
import { cargarUnmsm } from "@/integrations/local/datos";
import { leerTabla, escribirTabla } from "@/integrations/local/almacen";
import type { CarreraUnmsm, ProcesoUnmsm, ResultadoUnmsm } from "@/lib/admision/datos-unmsm";

export interface DatosDeSanMarcos { carreras: CarreraUnmsm[]; procesos: ProcesoUnmsm[]; resultados: ResultadoUnmsm[] }

/**
 * Escuelas, procesos y resultados oficiales de San Marcos (20261015120000). Cambian una vez por
 * proceso: se piden una vez por sesión. Si las tablas aún no existen (migración sin aplicar), la
 * consulta falla sin reintentos y quien la usa no pinta nada: mejor nada que un «¿Ingresaba?» vacío.
 */
export function useDatosDeSanMarcos(activo = true) {
  return useQuery({
    queryKey: ["admision-datos-unmsm"],
    enabled: activo,
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<DatosDeSanMarcos> => {
      try {
        const result = await admision.unmsm();
        if (result.error) {
          const local = await cargarUnmsm();
          return {
            carreras: local.carreras ?? [],
            procesos: local.procesos ?? [],
            resultados: local.resultados ?? [],
          };
        }
        const c = {data: result.data?.carreras}, p = {data: result.data?.procesos}, r = {data: result.data?.resultados};
        const num = (x: unknown) => (x === null || x === undefined ? null : Number(x));
        return {
          carreras: c.data ?? [],
          procesos: p.data ?? [],
          resultados: (r.data ?? []).map((x) => ({ ...x, ultimo_ingresante: num(x.ultimo_ingresante), maximo: num(x.maximo) })),
        };
      } catch {
        try {
          const local = await cargarUnmsm();
          return {
            carreras: local.carreras ?? [],
            procesos: local.procesos ?? [],
            resultados: local.resultados ?? [],
          };
        } catch {
          return { carreras: [], procesos: [], resultados: [] };
        }
      }
    },
  });
}

/** La universidad y la escuela del alumno. `null` si aún no las dijo. */
export function usePerfilDeAdmision(userId: string | null) {
  const cliente = useQueryClient();
  const clave = ["admision-perfil", userId];
  const consulta = useQuery({
    queryKey: clave,
    enabled: !!userId,
    retry: false,
    queryFn: async (): Promise<PerfilDeAdmision | null> => {
      try {
        const { data, error } = await admision.perfil();
        if (error) {
          return leerTabla<PerfilDeAdmision>("admision_perfil")[0] ?? null;
        }
        return data;
      } catch {
        return leerTabla<PerfilDeAdmision>("admision_perfil")[0] ?? null;
      }
    },
  });
  const guardar = useMutation({
    /** Sin perfil todavía hace falta la universidad; con perfil, basta lo que cambia (p. ej. las horas). */
    mutationFn: async (cambio: { universidad?: string; carrera_id?: string | null; horas_semana?: number | null }) => {
      if (!userId) throw new Error("Sin sesión");
      try {
        const { data, error } = await admision.guardarPerfil(cambio);
        if (error) throw error;
        return data;
      } catch {
        // Fallback local
        const anterior: PerfilDeAdmision = leerTabla<PerfilDeAdmision>("admision_perfil")[0] ?? {
          user_id: userId,
          universidad: "unmsm",
          carrera_id: null,
          horas_semana: null,
          origen: "alumno",
          updated_at: new Date().toISOString(),
        };
        const nuevo: PerfilDeAdmision = {
          ...anterior,
          ...cambio,
          updated_at: new Date().toISOString(),
        };
        escribirTabla("admision_perfil", [nuevo]);
        return nuevo;
      }
    },
    onSuccess: (perfil) => {
      cliente.setQueryData(clave, perfil);
      void cliente.invalidateQueries({ queryKey: ["admision-perfil-inicio"] });
    },
  });
  return { ...consulta, guardar };
}
