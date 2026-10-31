import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  admision,
  type IntentoDeAdmision,
  type PreguntaDelIntento,
  type InformeDeIntento,
} from "@/integrations/api/admision";
import { remainingMs } from "@/lib/school/exam-time";
import type { EstadoDeRespuesta } from "@/lib/admision/intento";
export interface RespuestaLocal extends EstadoDeRespuesta {
  correcta: boolean | null;
  revelada: boolean;
  confianza: number | null;
}
export type Revelado = { clave: string; solucion: string };
type Pending = {
  pregunta_id: string;
  opcion: string | null;
  marcada: boolean;
  confianza: number | null;
  version: number;
};
const message = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo guardar la operación.";
export function useIntentoDeAdmision(intentoId: string | undefined) {
  const [intento, setIntento] = useState<IntentoDeAdmision | null>(null);
  const [preguntas, setPreguntas] = useState<PreguntaDelIntento[]>([]);
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaLocal>>(
    {},
  );
  const [revelados, setRevelados] = useState<Record<string, Revelado>>({});
  const [cargando, setCargando] = useState(true),
    [error, setError] = useState<string | null>(null);
  const [pendientes, setPendientes] = useState(0),
    [entregando, setEntregando] = useState(false),
    [ahora, setAhora] = useState(new Date());
  const queue = useRef<Pending[]>([]),
    flight = useRef<Promise<boolean> | null>(null),
    delivering = useRef(false),
    version = useRef(0);
  const key = `atlas-api-cola:${intentoId}`;
  const persist = useCallback(() => {
    setPendientes(queue.current.length);
    try {
      localStorage.setItem(key, JSON.stringify(queue.current));
    } catch {
      setError(
        "El navegador no permite respaldar respuestas pendientes. Mantén esta pestaña abierta hasta guardarlas.",
      );
    }
  }, [key]);
  const cargar = useCallback(async () => {
    if (!intentoId) return;
    setCargando(true);
    const [i, p, r] = await Promise.all([
      admision.intento(intentoId),
      admision.preguntas(intentoId),
      admision.respuestas(intentoId),
    ]);
    if (i.error || p.error || r.error) {
      setError(message(i.error || p.error || r.error));
      setCargando(false);
      return;
    }
    setIntento(i.data);
    setPreguntas(p.data ?? []);
    const base: Record<string, RespuestaLocal> = {};
    for (const row of r.data ?? [])
      base[row.pregunta_id] = {
        opcion: row.opcion,
        marcada: row.marcada,
        correcta: row.correcta,
        revelada: row.revelada,
        confianza: row.confianza ?? null,
      };
    try {
      queue.current = JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {
      queue.current = [];
    }
    if (i.data?.estado === "entregado") queue.current = [];
    queue.current = queue.current.filter(
      (row) => !base[row.pregunta_id]?.revelada,
    );
    for (const row of queue.current)
      base[row.pregunta_id] = {
        ...base[row.pregunta_id],
        ...row,
        correcta: null,
        revelada: false,
      };
    setRespuestas(base);
    setPendientes(queue.current.length);
    setCargando(false);
  }, [intentoId, key]);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  const vaciarCola = useCallback(async (): Promise<boolean> => {
    if (!intentoId) return false;
    if (flight.current) return flight.current;
    const work = (async () => {
      while (queue.current.length) {
        const sent = [...queue.current];
        const result = await admision.guardar(intentoId, sent);
        if (result.error) {
          setError(result.error.message);
          return false;
        }
        if (result.data && !result.data.guardadas) {
          version.current = Math.max(
            version.current,
            ...Object.values(result.data.versiones),
          );
          setError(
            "Otra pestaña guardó una versión más reciente. Revisa tu respuesta y vuelve a marcarla antes de entregar.",
          );
          return false;
        }
        queue.current = queue.current.filter(
          (row) =>
            !sent.some(
              (s) =>
                s.pregunta_id === row.pregunta_id && s.version === row.version,
            ),
        );
        persist();
      }
      return true;
    })();
    flight.current = work;
    try {
      return await work;
    } finally {
      flight.current = null;
    }
  }, [intentoId, persist]);
  useEffect(() => {
    if (!cargando && intento?.estado === "en_curso" && queue.current.length)
      void vaciarCola();
    const online = () => void vaciarCola();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [cargando, intento?.estado, vaciarCola]);
  const guardar = useCallback(
    (id: string, next: RespuestaLocal) => {
      version.current = Math.max(Date.now() * 1000, version.current + 1);
      const pending: Pending = {
        pregunta_id: id,
        opcion: next.opcion,
        marcada: next.marcada,
        confianza: next.confianza,
        version: version.current,
      };
      queue.current = [
        ...queue.current.filter((r) => r.pregunta_id !== id),
        pending,
      ];
      persist();
      void vaciarCola();
    },
    [persist, vaciarCola],
  );
  const cambiar = useCallback(
    (id: string, change: Partial<RespuestaLocal>) => {
      if (
        intento?.estado !== "en_curso" ||
        respuestas[id]?.revelada ||
        delivering.current
      )
        return;
      const row = {
        opcion: null,
        marcada: false,
        correcta: null,
        revelada: false,
        confianza: null,
        ...respuestas[id],
        ...change,
      };
      setRespuestas((x) => ({ ...x, [id]: row }));
      guardar(id, row);
    },
    [intento, respuestas, guardar],
  );
  const revelar = useCallback(
    async (id: string) => {
      if (!intentoId || !(await vaciarCola())) return;
      const r = await admision.revelar(intentoId, id);
      if (r.error) {
        setError(r.error.message);
        return;
      }
      setRevelados((v) => ({ ...v, [id]: r.data! }));
      setRespuestas((v) => ({ ...v, [id]: { ...v[id], revelada: true } }));
    },
    [intentoId, vaciarCola],
  );
  const entregar = useCallback(
    async (soloGuardadas = false) => {
      if (!intentoId || delivering.current || intento?.estado === "entregado")
        return;
      delivering.current = true;
      setEntregando(true);
      try {
        if (!soloGuardadas && !(await vaciarCola())) {
          setError(
            "Hay respuestas pendientes. Reintenta el guardado. Si terminó el tiempo, puedes entregar únicamente las ya confirmadas.",
          );
          return;
        }
        const result = await admision.entregar(intentoId);
        if (result.error) {
          setError(result.error.message);
          return;
        }
        queue.current = [];
        persist();
        await cargar();
      } finally {
        delivering.current = false;
        setEntregando(false);
      }
    },
    [intentoId, intento?.estado, vaciarCola, persist, cargar],
  );
  const cronometrado =
    intento?.estado === "en_curso" && intento.tipo === "cronometrado";
  useEffect(() => {
    if (!cronometrado) return;
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, [cronometrado]);
  const restante = useMemo(
    () =>
      cronometrado && intento
        ? remainingMs(
            intento.started_at,
            {
              opens_at: null,
              closes_at: null,
              duration_minutes: intento.duration_minutes,
            },
            ahora,
          )
        : null,
    [cronometrado, intento, ahora],
  );
  const submit = useRef(entregar);
  submit.current = entregar;
  useEffect(() => {
    if (restante === 0) void submit.current();
  }, [restante]);
  const urls = useMemo(
    () =>
      Object.fromEntries(
        preguntas.flatMap((p) =>
          p.graficos.map((g) => [
            g,
            `${import.meta.env.BASE_URL}graficos/${encodeURIComponent(g)}`,
          ]),
        ),
      ),
    [preguntas],
  );
  return {
    intento,
    preguntas,
    respuestas,
    urls,
    revelados,
    informe: intento?.informe as InformeDeIntento | null,
    cargando,
    error,
    pendientes,
    entregando,
    restante,
    responder: (id: string, opcion: string | null) =>
      cambiar(id, { opcion, ...(opcion === null ? { confianza: null } : {}) }),
    marcar: (id: string) => cambiar(id, { marcada: !respuestas[id]?.marcada }),
    confiar: (id: string, nivel: number) =>
      cambiar(id, {
        confianza: respuestas[id]?.confianza === nivel ? null : nivel,
      }),
    revelar,
    entregar,
    descartarError: () => setError(null),
  };
}
