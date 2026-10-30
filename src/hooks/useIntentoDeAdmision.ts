import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  admisionDb, BUCKET_DE_GRAFICOS,
  type InformeDeIntento, type IntentoDeAdmision, type PreguntaDelIntento,
} from "@/integrations/supabase/admision";
import { functionErrorReason } from "@/lib/function-error";
import { remainingMs } from "@/lib/school/exam-time";
import { encolar, escribirCola, faltaLaColumnaConfianza, leerCola, quitarDeLaCola, sinConfianza, type EstadoDeRespuesta, type Pendiente } from "@/lib/admision/intento";

export interface RespuestaLocal extends EstadoDeRespuesta { correcta: boolean | null; revelada: boolean; confianza: number | null }
export type Revelado = { clave: string; solucion: string };

/**
 * Un intento de admisión en curso o entregado. Guarda cada respuesta al momento (debounce de 400 ms);
 * lo que no se pudo guardar queda en una cola local y se envía al volver la conexión (spec §3). El reloj
 * sale del `started_at` del servidor y, en cronometrado, al llegar a 0 entrega solo.
 */
export function useIntentoDeAdmision(intentoId: string | undefined) {
  const [intento, setIntento] = useState<IntentoDeAdmision | null>(null);
  const [preguntas, setPreguntas] = useState<PreguntaDelIntento[]>([]);
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaLocal>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [revelados, setRevelados] = useState<Record<string, Revelado>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendientes, setPendientes] = useState(0);
  const [entregando, setEntregando] = useState(false);
  const [ahora, setAhora] = useState(() => new Date());
  const temporizadores = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const entregado = useRef(false);

  const cargar = useCallback(async () => {
    if (!intentoId) return;
    setCargando(true);
    const [{ data: i, error: e1 }, { data: ps, error: e2 }, { data: rs, error: e3 }] = await Promise.all([
      admisionDb.from("admision_intentos").select("*").eq("id", intentoId).maybeSingle(),
      admisionDb.rpc("admision_preguntas_del_intento", { _intento: intentoId }),
      admisionDb.from("admision_respuestas").select("*").eq("intento_id", intentoId),
    ]);
    if (e1 || e2 || e3 || !i) {
      setError(i === null && !e1 ? "Este examen no existe o no es tuyo." : "No se pudo cargar el examen. Revisa tu conexión.");
      setCargando(false);
      return;
    }
    setIntento(i);
    entregado.current = i.estado === "entregado";
    const lista = (ps ?? []) as PreguntaDelIntento[];
    setPreguntas(lista);
    // Lo guardado en el servidor, y encima lo que quedó en la cola local (es más reciente).
    const base: Record<string, RespuestaLocal> = {};
    for (const r of rs ?? []) base[r.pregunta_id] = { opcion: r.opcion, marcada: r.marcada, correcta: r.correcta, revelada: r.revelada, confianza: r.confianza ?? null };
    const cola = leerCola(localStorage, intentoId);
    for (const p of cola) base[p.pregunta_id] = { ...(base[p.pregunta_id] ?? { correcta: null, revelada: false }), opcion: p.opcion, marcada: p.marcada, confianza: p.confianza ?? null };
    setRespuestas(base);
    setPendientes(cola.length);
    const rutas = [...new Set(lista.flatMap((p) => p.graficos))];
    if (rutas.length) {
      // Que la firma dure todo el examen (100 preguntas son 180 min) y una hora más; la práctica, al menos 3 h.
      const segundos = Math.max(3 * 3600, (i.duration_minutes ?? 0) * 60 + 3600);
      const { data: firmadas } = await supabase.storage.from(BUCKET_DE_GRAFICOS).createSignedUrls(rutas, segundos);
      setUrls(Object.fromEntries((firmadas ?? []).filter((f) => f.signedUrl).map((f) => [f.path, f.signedUrl])));
    }
    setCargando(false);
  }, [intentoId]);

  useEffect(() => { void cargar(); }, [cargar]);

  /** Guarda lo que haya en la cola, de una vez. Devuelve si quedó vacía. */
  const vaciarCola = useCallback(async (): Promise<boolean> => {
    if (!intentoId) return true;
    const cola = leerCola(localStorage, intentoId);
    if (!cola.length) return true;
    const subir = (filas: Pendiente[]) => admisionDb.from("admision_respuestas").upsert(
      filas.map((p) => ({ intento_id: intentoId, ...p })), { onConflict: "intento_id,pregunta_id" });
    let { error: e } = await subir(cola);
    // Sin la columna de confianza (el SQL del tramo 2 aún no está), la respuesta va sin ella.
    if (faltaLaColumnaConfianza(e)) ({ error: e } = await subir(sinConfianza(cola)));
    if (e) return false;
    const resto = quitarDeLaCola(leerCola(localStorage, intentoId), cola);
    escribirCola(localStorage, intentoId, resto);
    setPendientes(resto.length);
    return resto.length === 0;
  }, [intentoId]);

  const guardar = useCallback((p: Pendiente) => {
    if (!intentoId) return;
    clearTimeout(temporizadores.current[p.pregunta_id]);
    temporizadores.current[p.pregunta_id] = setTimeout(async () => {
      const cola = encolar(leerCola(localStorage, intentoId), p);
      escribirCola(localStorage, intentoId, cola);
      setPendientes(cola.length);
      await vaciarCola();
    }, 400);
  }, [intentoId, vaciarCola]);

  // Lo que quedó en la cola de una visita anterior (sin conexión y se cerró la pestaña) sale al cargar: no
  // habrá evento `online` que lo empuje, y en cronometrado se perdería al cerrar el plazo.
  const enCursoAlCargar = intento?.estado === "en_curso";
  useEffect(() => {
    if (!cargando && enCursoAlCargar && pendientes > 0) void vaciarCola();
  }, [cargando, enCursoAlCargar, pendientes, vaciarCola]);

  useEffect(() => {
    const alVolver = () => { void vaciarCola(); };
    window.addEventListener("online", alVolver);
    return () => window.removeEventListener("online", alVolver);
  }, [vaciarCola]);

  const enCurso = intento?.estado === "en_curso";

  const responder = useCallback((preguntaId: string, opcion: string | null) => {
    if (!enCurso || respuestas[preguntaId]?.revelada) return;
    const marcada = respuestas[preguntaId]?.marcada ?? false;
    // En blanco no hay de qué estar seguro.
    const confianza = opcion === null ? null : respuestas[preguntaId]?.confianza ?? null;
    setRespuestas((r) => ({ ...r, [preguntaId]: { ...(r[preguntaId] ?? { correcta: null, revelada: false, marcada }), opcion, confianza } }));
    guardar({ pregunta_id: preguntaId, opcion, marcada, confianza });
  }, [enCurso, respuestas, guardar]);

  const marcar = useCallback((preguntaId: string) => {
    if (!enCurso) return;
    const actual = respuestas[preguntaId] ?? { opcion: null, marcada: false, correcta: null, revelada: false, confianza: null };
    const siguiente = { ...actual, marcada: !actual.marcada };
    setRespuestas((r) => ({ ...r, [preguntaId]: siguiente }));
    guardar({ pregunta_id: preguntaId, opcion: siguiente.opcion, marcada: siguiente.marcada, confianza: siguiente.confianza });
  }, [enCurso, respuestas, guardar]);

  /** Qué tan seguro está de la que marcó (1 dudo, 2 más o menos, 3 seguro); otra vez el mismo, la quita. */
  const confiar = useCallback((preguntaId: string, nivel: number) => {
    const actual = respuestas[preguntaId];
    if (!enCurso || !actual?.opcion || actual.revelada) return;
    const confianza = actual.confianza === nivel ? null : nivel;
    setRespuestas((r) => ({ ...r, [preguntaId]: { ...actual, confianza } }));
    guardar({ pregunta_id: preguntaId, opcion: actual.opcion, marcada: actual.marcada, confianza });
  }, [enCurso, respuestas, guardar]);

  const revelar = useCallback(async (preguntaId: string) => {
    if (!intentoId) return;
    // Antes de revelar, lo que el alumno marcó tiene que estar en el servidor.
    clearTimeout(temporizadores.current[preguntaId]);
    const r = respuestas[preguntaId];
    if (r?.opcion) {
      escribirCola(localStorage, intentoId, encolar(leerCola(localStorage, intentoId), { pregunta_id: preguntaId, opcion: r.opcion, marcada: r.marcada, confianza: r.confianza }));
      if (!(await vaciarCola())) { setError("Sin conexión: no se puede ver la solución todavía."); return; }
    }
    const { data } = await admisionDb.rpc("admision_revelar", { _intento: intentoId, _pregunta: preguntaId });
    const fila = (data ?? [])[0];
    if (fila) {
      setRevelados((v) => ({ ...v, [preguntaId]: fila }));
      setRespuestas((x) => ({ ...x, [preguntaId]: { ...(x[preguntaId] ?? { opcion: null, marcada: false, correcta: null, confianza: null }), revelada: true } }));
    }
  }, [intentoId, respuestas, vaciarCola]);

  const [informe, setInforme] = useState<InformeDeIntento | null>(null);
  useEffect(() => { if (intento?.informe) setInforme(intento.informe); }, [intento]);

  const entregar = useCallback(async () => {
    if (!intentoId || entregado.current) return;
    entregado.current = true;
    setEntregando(true);
    for (const t of Object.values(temporizadores.current)) clearTimeout(t);
    // Lo pendiente de los temporizadores pasa a la cola, y la cola al servidor, antes de corregir.
    let cola = leerCola(localStorage, intentoId);
    for (const [id, r] of Object.entries(respuestas)) cola = encolar(cola, { pregunta_id: id, opcion: r.opcion, marcada: r.marcada, confianza: r.confianza });
    escribirCola(localStorage, intentoId, cola);
    await vaciarCola();
    const { data, error: e } = await supabase.functions.invoke("admision-entregar", { body: { intento_id: intentoId } });
    if (e) {
      entregado.current = false;
      setEntregando(false);
      setError(await functionErrorReason(e));
      return;
    }
    setInforme(data as InformeDeIntento);
    await cargar();
    setEntregando(false);
  }, [intentoId, respuestas, vaciarCola, cargar]);

  // El reloj: cada segundo, solo mientras está en curso y es cronometrado.
  const cronometrado = enCurso && intento?.tipo === "cronometrado";
  useEffect(() => {
    if (!cronometrado) return;
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, [cronometrado]);
  const restante = useMemo(
    () => (cronometrado && intento ? remainingMs(intento.started_at, { opens_at: null, closes_at: null, duration_minutes: intento.duration_minutes }, ahora) : null),
    [cronometrado, intento, ahora],
  );
  const entregarRef = useRef(entregar);
  entregarRef.current = entregar;
  useEffect(() => {
    if (restante !== 0) return;
    void entregarRef.current();
    // Si la entrega automática falló sin conexión, `restante` ya no cambia: se reintenta al volver la red.
    const alVolver = () => { void entregarRef.current(); };
    window.addEventListener("online", alVolver);
    return () => window.removeEventListener("online", alVolver);
  }, [restante]);

  return {
    intento, preguntas, respuestas, urls, revelados, informe, cargando, error, pendientes, entregando, restante,
    responder, marcar, confiar, revelar, entregar, descartarError: () => setError(null),
  };
}
