import { api, capture, post } from "./client";
import type {
  IntentoDeAdmision,
  PreguntaDelIntento,
  RespuestaDeAdmision,
  InformeDeIntento,
  PerfilDeAdmision,
} from "../supabase/admision";
import type {
  CarreraUnmsm,
  ProcesoUnmsm,
  ResultadoUnmsm,
  DistribucionUnmsm,
  ItemDelDia,
} from "@/lib/admision/datos-unmsm";
export type * from "../supabase/admision";
export type DatosUNMSM = {
  carreras: CarreraUnmsm[];
  procesos: ProcesoUnmsm[];
  resultados: ResultadoUnmsm[];
  distribuciones: DistribucionUnmsm[];
  dia_examen: ItemDelDia[];
};
export type ErrorRepaso = {
  pregunta_id: string;
  caja: 1 | 2 | 3;
  proxima: string;
  dominada: boolean;
  veces: number;
  repasos: number;
  agregada_en: string;
};
export type TemaFrecuente = {
  curso: string;
  tema: string;
  preguntas: number;
  procesos: number;
  procesos_del_area: number;
};
export const admision = {
  examenes: () =>
    capture(() =>
      api<{ id: string; ciclo: string; area: string; disponibles: number }[]>(
        "/examenes",
      ),
    ),
  intentos: () => capture(() => api<IntentoDeAdmision[]>("/intentos")),
  crear: (body: Record<string, unknown>) =>
    capture(() =>
      post<{ intento_id: string; preguntas: number }>("/intentos", body),
    ),
  intento: (id: string) =>
    capture(() => api<IntentoDeAdmision>(`/intentos/${id}`)),
  preguntas: (id: string) =>
    capture(() => api<PreguntaDelIntento[]>(`/intentos/${id}/preguntas`)),
  respuestas: (id: string) =>
    capture(() => api<RespuestaDeAdmision[]>(`/intentos/${id}/respuestas`)),
  guardar: (id: string, rows: unknown[]) =>
    capture(() =>
      api<{ guardadas: boolean; versiones: Record<string, number> }>(
        `/intentos/${id}/respuestas`,
        { method: "PUT", body: JSON.stringify(rows) },
      ),
    ),
  entregar: (id: string) =>
    capture(() => post<InformeDeIntento>(`/intentos/${id}/entrega`, {}, id)),
  revelar: (id: string, pid: string) =>
    capture(() =>
      post<{ clave: string; solucion: string }>(
        `/intentos/${id}/preguntas/${pid}/solucion`,
        {},
      ),
    ),
  temas: (area: string) =>
    capture(() =>
      api<TemaFrecuente[]>(
        `/temas-frecuentes?area=${encodeURIComponent(area)}`,
      ),
    ),
  errores: () => capture(() => api<ErrorRepaso[]>("/errores")),
  unmsm: () => capture(() => api<DatosUNMSM>("/unmsm")),
  perfil: () => capture(() => api<PerfilDeAdmision | null>("/perfil")),
  guardarPerfil: (body: unknown) =>
    capture(() =>
      api<PerfilDeAdmision>("/perfil", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    ),
};
