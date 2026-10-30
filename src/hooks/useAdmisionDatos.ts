import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { admisionDb, type PerfilDeAdmision } from "@/integrations/supabase/admision";
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
      const [c, p, r] = await Promise.all([
        admisionDb.from("admision_carreras").select("id, nombre, area, codigo_oca, fuente, verificado, nota").order("nombre"),
        admisionDb.from("admision_procesos").select("ciclo, fecha_examen, jornadas, vacantes_totales, fuente, verificado, nota").order("fecha_examen", { ascending: false }),
        admisionDb.from("admision_resultados").select("ciclo, carrera_id, vacantes, postulantes, asistentes, ingresantes, ultimo_ingresante, maximo, fuente, verificado, nota"),
      ]);
      const error = c.error ?? p.error ?? r.error;
      if (error) throw error;
      // `numeric` llega como texto o número según la versión de PostgREST.
      const num = (x: unknown) => (x === null || x === undefined ? null : Number(x));
      return {
        carreras: c.data ?? [],
        procesos: p.data ?? [],
        resultados: (r.data ?? []).map((x) => ({ ...x, ultimo_ingresante: num(x.ultimo_ingresante), maximo: num(x.maximo) })),
      };
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
      const { data, error } = await admisionDb.from("admision_perfil").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const guardar = useMutation({
    /** Sin perfil todavía hace falta la universidad; con perfil, basta lo que cambia (p. ej. las horas). */
    mutationFn: async (cambio: { universidad?: string; carrera_id?: string | null; horas_semana?: number | null }) => {
      if (!userId) throw new Error("Sin sesión");
      const { data, error } = await admisionDb.from("admision_perfil")
        .upsert({ user_id: userId, ...cambio, origen: "alumno", updated_at: new Date().toISOString() }, { onConflict: "user_id" })
        .select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (perfil) => {
      cliente.setQueryData(clave, perfil);
      void cliente.invalidateQueries({ queryKey: ["admision-perfil-inicio"] });
    },
  });
  return { ...consulta, guardar };
}
