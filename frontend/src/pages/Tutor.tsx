import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/integrations/api/client";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  ChevronLeft,
  History,
  Network,
  Search,
  SquarePen,
  UserRound,
} from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { ConversacionTutor } from "@/components/tutor/ConversacionTutor";
import { GrafoComprension } from "@/components/tutor/GrafoComprension";
import { HistorialPanel } from "@/components/tutor/HistorialPanel";
import { InicioTutor } from "@/components/tutor/InicioTutor";
import { TutorProgress } from "@/components/tutor/TutorProgress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api, post } from "@/integrations/api/client";
import type { Bloque, Conversacion } from "@/lib/tutor/chat";
import { BloqueView } from "@/components/tutor/Bloques";
import { PanelArtefactos } from "@/components/tutor/PanelArtefactos";
import { transicionArtefacto } from "@/lib/tutor/transiciones";
import { claveEvento } from "@/lib/tutor/eventos";
import type {
  ComprobacionActiva,
  ResultadoComprobacion,
} from "@/components/tutor/ComprobacionTutor";
import {
  esArtefactoGrande,
  limitarAnchoPanel,
  planRetropropagacion,
  ultimoFallo,
  type Evidencia,
} from "@/lib/tutor/wow";
import type { Grafo } from "@/lib/tutor/grafo";
import type { ItemHistorial } from "@/lib/tutor/historial";
import {
  TEMAS_SOPORTADOS,
  type TemaId,
  cuerpoDeCreacion,
  opcionesDeContexto,
  ordenarTemas,
  ultimaPracticaFallada,
  type Contexto,
  type Intencion,
  type OpcionDeContexto,
} from "@/lib/tutor/inicio";
import "@/components/tutor/tutor.css";
import "@/components/tutor/tutor-chat.css";
import "@/components/tutor/tutor-wow.css";
type IntentoLite = { id: string; estado: string };
type RespuestaLite = { pregunta_id: string; correcta: boolean | null };
async function cargarUltimaPractica() {
  const intentos = await api<IntentoLite[]>("/intentos");
  const recientes = intentos
    .filter((i) => i.estado === "entregado")
    .slice(0, 3);
  const respuestas = Object.fromEntries(
    await Promise.all(
      recientes.map(
        async (i) =>
          [
            i.id,
            await api<RespuestaLite[]>(`/intentos/${i.id}/respuestas`),
          ] as const,
      ),
    ),
  );
  return ultimaPracticaFallada(recientes, (id) => respuestas[id] ?? []);
}
async function cargarMaterial() {
  const cursos = await api<{ id: string }[]>("/cursos");
  for (const c of cursos) {
    const curso = await api<{
      documentos: { id: string; nombre: string; estado: string }[];
    }>(`/cursos/${c.id}`);
    const doc = curso.documentos.find((d) => d.estado === "listo");
    if (!doc) continue;
    const detalle = await api<{ fragmentos: { id: string }[] }>(
      `/documentos/${doc.id}`,
    );
    if (detalle.fragmentos[0])
      return { fragmento_id: detalle.fragmentos[0].id, nombre: doc.nombre };
  }
  return null;
}
const anchoGrande = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(min-width: 1100px)").matches;
function preferenciaPanel() {
  try {
    const p = JSON.parse(localStorage.getItem("calibra-tutor-panel") ?? "{}");
    return {
      ancho: limitarAnchoPanel(Number(p.ancho ?? 44)),
      activo: typeof p.activo === "string" ? p.activo : "grafo",
    };
  } catch {
    return { ancho: 44, activo: "grafo" };
  }
}
export default function Tutor() {
  const { id } = useParams(),
    [search, setSearch] = useSearchParams(),
    nav = useNavigate(),
    client = useQueryClient();
  const vistaGrafo = search.get("vista") === "grafo" && !id;
  const demo = search.get("demo") === "1";
  const [preferencias, setPreferencias] = useState(preferenciaPanel);
  const [abiertos, setAbiertos] = useState<string[]>(() =>
    preferencias.activo === "grafo" ? [] : [preferencias.activo],
  );
  const [eventoRetro, setEventoRetro] = useState(false);
  const consumirRetro = useCallback(() => setEventoRetro(false), []);
  const cambiarPreferencias = (p: typeof preferencias) => {
    setPreferencias(p);
    try {
      localStorage.setItem("calibra-tutor-panel", JSON.stringify(p));
    } catch {
      /* Preferencias opcionales. */
    }
  };
  const [borrador, setBorrador] = useState(""),
    [inicio, setInicio] = useState(""),
    [intencion, setIntencion] = useState<Intencion["id"] | null>(null),
    [elegido, setElegido] = useState<string | null>(null),
    [busqueda, setBusqueda] = useState(""),
    [mapaAbierto, setMapaAbierto] = useState(() => demo || anchoGrande()),
    [historialAbierto, setHistorialAbierto] = useState(false);
  const deUrl: OpcionDeContexto | null = search.get("fragmento")
    ? {
        clave: "url",
        etiqueta: "Material que elegiste",
        contexto: { fragmento_id: search.get("fragmento")! },
      }
    : search.get("intento") && search.get("pregunta")
      ? {
          clave: "url",
          etiqueta: "Pregunta que elegiste",
          contexto: {
            intento_id: search.get("intento")!,
            pregunta_id: search.get("pregunta")!,
          },
        }
      : null;
  const [contextoClave, setContextoClave] = useState(deUrl ? "url" : "");
  // El tutor sigue el tema global de la app (el botón está en la cabecera).
  const claro = useTheme().resolvedTheme !== "dark";
  const claveCrear = useRef<{ huella: string; key: string } | null>(null);
  const claveEnvio = useRef<{ texto: string; key: string } | null>(null);
  useEffect(() => {
    document.title = "Conversar con el tutor | CALIBRA";
  }, []);
  const conv = useQuery({
    queryKey: ["conversacion", id],
    queryFn: () => api<Conversacion>(`/conversaciones/${id}`),
    enabled: !!id,
  });
  const grafo = useQuery({
    queryKey: ["grafo"],
    queryFn: () => api<Grafo>("/grafo"),
  });
  const activa = useQuery({
    queryKey: ["comprobacion-activa"],
    queryFn: () => api<ComprobacionActiva | null>("/comprobaciones/activa"),
  });
  const evidencias = useQuery({
    queryKey: ["evidencias"],
    queryFn: () => api<Evidencia[]>("/evidencias"),
  });
  const salud = useQuery({
    queryKey: ["salud"],
    queryFn: () => api<{ ia: string; ok: boolean; pruebas: boolean }>("/salud"),
    staleTime: 30000,
  });
  const historial = useQuery({
    queryKey: ["conversaciones"],
    queryFn: () => api<ItemHistorial[]>("/conversaciones"),
  });
  const practica = useQuery({
    queryKey: ["ultima-practica"],
    queryFn: () => cargarUltimaPractica().catch(() => null),
    enabled: !id,
    staleTime: 60000,
  });
  const material = useQuery({
    queryKey: ["material-tutor"],
    queryFn: () => cargarMaterial().catch(() => null),
    enabled: !id,
    staleTime: 60000,
  });
  const foco = grafo.data?.foco ?? null;
  useEffect(() => {
    if (foco) setElegido(foco);
  }, [foco]);
  const base = opcionesDeContexto({
    practica: practica.data,
    material: material.data,
  });
  const contextos = deUrl ? [deUrl, ...base] : base;
  const contextoElegido =
    contextos.find((c) => c.clave === contextoClave)?.contexto ?? null;
  const temas = ordenarTemas(grafo.data);
  const crear = useMutation({
    mutationFn: (v: { texto: string; contexto: Contexto | null }) => {
      // La misma clave en cada reintento del mismo pedido: no se duplica la conversación.
      const huella = JSON.stringify(v);
      if (claveCrear.current?.huella !== huella)
        claveCrear.current = { huella, key: crypto.randomUUID() };
      return post<{ id: string }>(
        "/conversaciones",
        cuerpoDeCreacion(v.contexto, v.texto),
        claveCrear.current.key,
      );
    },
    onSuccess: (r) => {
      claveCrear.current = null;
      setInicio("");
      setIntencion(null);
      void client.invalidateQueries({ queryKey: ["conversaciones"] });
      nav(`/tutor/${r.id}${demo ? "?demo=1" : ""}`);
    },
  });
  const enviar = useMutation({
    mutationFn: (t: string) => {
      if (claveEnvio.current?.texto !== t)
        claveEnvio.current = { texto: t, key: crypto.randomUUID() };
      return post(
        `/conversaciones/${id}/mensajes`,
        { texto: t },
        claveEnvio.current.key,
      );
    },
    onSuccess: (_r, t) => {
      claveEnvio.current = null;
      setBorrador((b) => (b.trim() === t ? "" : b));
      void conv.refetch();
      void grafo.refetch();
      void historial.refetch();
      void evidencias.refetch();
    },
  });
  // Al entregar una comprobación el sistema avisa al agente: reacciona sin que el estudiante escriba.
  const reaccionar = useMutation({
    mutationFn: (comprobacionId: string) =>
      post(
        `/conversaciones/${id}/eventos`,
        { tipo: "comprobacion_entregada", comprobacion_id: comprobacionId },
        claveEvento(comprobacionId),
      ),
    onSuccess: () => {
      void conv.refetch();
      void grafo.refetch();
      void historial.refetch();
      void evidencias.refetch();
    },
  });
  const comprobar = useMutation({
    mutationFn: (tema?: TemaId) =>
      post("/comprobaciones", {
        arbol_id: conv.data!.arbol_id,
        ...(tema ? { tema } : {}),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["comprobacion-activa"] });
      // La comprobación ocurre aquí: el error y su recorrido se ven juntos, sin cambiar de pantalla.
    },
  });
  // Una conversación libre no tiene tema: se le pide uno en línea y se reintenta con el elegido.
  const eligeTema =
    comprobar.error instanceof ApiError &&
    comprobar.error.codigo === "elige_tema";
  const empezar = (texto: string, contexto = contextoElegido) =>
    crear.mutate({ texto: texto.trim(), contexto });
  const alElegirIntencion = (i: Intencion) => {
    setIntencion(i.id);
    if (i.accion === "texto") setInicio(i.precarga);
    else if (i.accion === "grafo") setSearch({ vista: "grafo" });
    else {
      const tema =
        contextoElegido && "tema" in contextoElegido
          ? TEMAS_SOPORTADOS.find((t) => t.id === contextoElegido.tema)
          : temas[0];
      if (tema)
        empezar(
          `Quiero practicar ${tema.nombre}. Dame un ejercicio para empezar.`,
          {
            tema: tema.id,
          },
        );
    }
  };
  const estado = salud.isError
    ? "Sin conexión"
    : !salud.data
      ? "Conectando…"
      : salud.data.pruebas
        ? "Modo de pruebas"
        : salud.data.ia === "disabled"
          ? "IA sin configurar"
          : "IA configurada";
  const listo =
    !!salud.data && !salud.data.pruebas && salud.data.ia !== "disabled";
  const titulo =
    historial.data?.find((c) => c.id === id)?.titulo ?? "Conversación";
  const fallo = ultimoFallo(evidencias.data ?? [], conv.data?.arbol_id ?? "");
  const nodoActual =
    grafo.data?.nodos.find(
      (n) => n.id === elegido && n.arbol_id === conv.data?.arbol_id,
    ) ??
    grafo.data?.nodos.find(
      (n) =>
        n.id === fallo?.detalle.rastro?.nodo_retorno_id &&
        n.arbol_id === conv.data?.arbol_id,
    ) ??
    grafo.data?.nodos.find(
      (n) => n.id === grafo.data?.foco && n.arbol_id === conv.data?.arbol_id,
    ) ??
    grafo.data?.nodos.find((n) => n.arbol_id === conv.data?.arbol_id);
  const plan = useMemo(
    () =>
      grafo.data
        ? planRetropropagacion(grafo.data, fallo?.detalle.rastro ?? null)
        : null,
    [grafo.data, fallo],
  );
  const falloPendiente =
    !!fallo &&
    !(evidencias.data ?? []).some(
      (e) =>
        e.arbol_id === fallo.arbol_id &&
        e.tipo === "corrigio_tras_error" &&
        e.created_at >= fallo.created_at,
    );
  const bloquesDisponibles =
    conv.data?.mensajes.flatMap((m) => m.bloques).filter(esArtefactoGrande) ??
    [];
  const bloquesPanel = bloquesDisponibles.filter((b) =>
    abiertos.includes(b.id),
  );
  const tabActivo = bloquesPanel.some((b) => b.id === preferencias.activo)
    ? preferencias.activo
    : "grafo";
  const abrirArtefacto = (b: Bloque) =>
    transicionArtefacto(() => {
      setAbiertos((ids) => (ids.includes(b.id) ? ids : [...ids, b.id]));
      cambiarPreferencias({ ...preferencias, activo: b.id });
      setMapaAbierto(true);
    }, b.id);
  const cerrarPanel = () =>
    transicionArtefacto(() => {
      setMapaAbierto(false);
      window.setTimeout(
        () =>
          (
            document.getElementById(`abrir-${tabActivo}`) ??
            document.getElementById("tw-toggle-panel")
          )?.focus(),
        0,
      );
    }, tabActivo);
  const actualizarComprobacion = async (
    r?: ResultadoComprobacion,
    comprobacionId?: string,
  ) => {
    await Promise.all([
      activa.refetch(),
      grafo.refetch(),
      evidencias.refetch(),
    ]);
    if (r?.rastro?.idea_clave) {
      setElegido(r.rastro.nodo_retorno_id);
      cambiarPreferencias({ ...preferencias, activo: "grafo" });
      setMapaAbierto(true);
      setEventoRetro(Boolean(r.rastro.nodo_retorno_id));
    }
    if (r && comprobacionId) reaccionar.mutate(comprobacionId);
  };
  const abrirMapa = () => {
    cambiarPreferencias({ ...preferencias, activo: "grafo" });
    setMapaAbierto(true);
  };
  const temaActual =
    nodoActual?.titulo ??
    TEMAS_SOPORTADOS.find((t) => t.id === nodoActual?.concepto)?.nombre ??
    "esta idea";
  const errorHistorial = historial.isError ? historial.error.message : null;
  const panelHistorial = (acople: boolean, alElegir?: () => void) => (
    <HistorialPanel
      items={historial.data}
      activoId={id}
      cargando={historial.isPending}
      error={errorHistorial}
      onReintentar={() => void historial.refetch()}
      onElegir={alElegir}
      acople={acople}
    />
  );
  const botonHistorial = (
    <button
      type="button"
      className="tc-btn tc-btn--line"
      onClick={() => {
        if (!anchoGrande()) setMapaAbierto(false);
        setHistorialAbierto(true);
      }}
    >
      <History size={18} aria-hidden="true" /> Historial
    </button>
  );
  return (
    <ResponsiveLayout
      appearance="tutor"
      sinBarraInferior
      headerTools={
        <>
          <span className="tutor-guest">
            <UserRound size={17} />
            <span>Invitado</span>
          </span>
        </>
      }
    >
      <main className={`tc-page tw-page${demo ? " tw-demo" : ""}`}>
        {claro && <span className="tc-claro" hidden />}
        {vistaGrafo ? (
          <div className="tc-vista-grafo">
            <div className="tc-conv-bar">
              <Link to="/tutor" className="tc-btn tc-btn--line">
                <ChevronLeft size={18} aria-hidden="true" /> Volver al tutor
              </Link>
              <h1>Tu grafo de comprensión</h1>
            </div>
            <section className="tc-map" aria-label="Grafo de comprensión">
              <p>
                Los estados salen de tus comprobaciones, no de lo que diga la
                IA.
              </p>
              {grafo.isError ? (
                <p role="alert">{grafo.error.message}</p>
              ) : grafo.data ? (
                <GrafoComprension
                  grafo={grafo.data}
                  seleccionado={elegido}
                  onSeleccionar={setElegido}
                  plan={plan}
                  demo={demo}
                />
              ) : (
                <p role="status">Preparando tu mapa…</p>
              )}
            </section>
            <TutorProgress grafo={grafo.data} />
          </div>
        ) : !id ? (
          <>
            <div className="tc-only-narrow" style={{ marginBottom: 12 }}>
              {botonHistorial}
            </div>
            <div className="tc-home-grid">
              <InicioTutor
                temas={temas}
                contextos={contextos}
                contextoClave={contextoClave}
                onContexto={setContextoClave}
                valor={inicio}
                onCambio={(v) => {
                  setInicio(v);
                  if (!v) setIntencion(null);
                }}
                onEnviar={() => empezar(inicio)}
                onIntencion={alElegirIntencion}
                intencionActiva={intencion}
                ocupado={crear.isPending}
                error={crear.error?.message ?? null}
                onReintentar={() =>
                  crear.variables && crear.mutate(crear.variables)
                }
              />
              <div className="tc-only-wide">{panelHistorial(true)}</div>
            </div>
          </>
        ) : (
          <>
            <div className="tc-conv-bar">
              <Link to="/tutor" className="tc-btn tc-btn--line">
                <SquarePen size={18} aria-hidden="true" /> Nueva
              </Link>
              <h1 title={titulo}>{titulo}</h1>
              <span className={`tc-status${listo ? " tc-status--ready" : ""}`}>
                <i /> {estado}
              </span>
              {botonHistorial}
              <button
                type="button"
                id="tw-toggle-panel"
                className="tc-btn tc-btn--soft"
                aria-pressed={mapaAbierto}
                onClick={() => setMapaAbierto((a) => !a)}
              >
                <Network size={18} aria-hidden="true" />
                {mapaAbierto ? "Ocultar mapa" : "Ver mapa"}
              </button>
            </div>
            <div
              className={`tc-conv tw-workspace${mapaAbierto ? " tw-workspace--abierto" : ""}`}
              style={
                {
                  "--panel-width": `${preferencias.ancho}%`,
                } as React.CSSProperties
              }
            >
              {conv.isError ? (
                <div className="tc-banner tc-banner--error" role="alert">
                  <span>{conv.error.message}</span>
                  <button type="button" onClick={() => void conv.refetch()}>
                    Reintentar conversación
                  </button>
                </div>
              ) : (
                <ConversacionTutor
                  key={id}
                  conv={conv.data ?? { id: id, arbol_id: "", mensajes: [] }}
                  cargando={conv.isPending}
                  pensando={enviar.isPending || reaccionar.isPending}
                  pendiente={
                    enviar.isPending ? (enviar.variables ?? null) : null
                  }
                  error={
                    enviar.error ??
                    reaccionar.error ??
                    (eligeTema ? null : comprobar.error)
                  }
                  onAbrirMapa={abrirMapa}
                  eligeTema={!enviar.error && eligeTema}
                  onElegirTema={(tema) => comprobar.mutate(tema)}
                  onReintentar={() =>
                    enviar.isError && enviar.variables
                      ? enviar.mutate(enviar.variables)
                      : reaccionar.isError && reaccionar.variables
                        ? reaccionar.mutate(reaccionar.variables)
                        : comprobar.mutate(undefined)
                  }
                  borrador={borrador}
                  onBorrador={setBorrador}
                  onEnviar={(t) => t && enviar.mutate(t)}
                  activa={activa.data ?? null}
                  comprobacion={activa.data ?? null}
                  onActualizarComprobacion={actualizarComprobacion}
                  grafo={grafo.data}
                  nodo={nodoActual}
                  evidencias={evidencias.data}
                  onAbrirArtefacto={abrirArtefacto}
                  artefactoActivo={mapaAbierto ? tabActivo : undefined}
                  onRespuestaBloque={() => {
                    void grafo.refetch();
                  }}
                  demo={demo}
                  ocupado={
                    enviar.isPending ||
                    reaccionar.isPending ||
                    comprobar.isPending ||
                    !conv.data
                  }
                  temaActual={temaActual}
                  onComprobar={() => comprobar.mutate()}
                />
              )}
              {mapaAbierto && (
                <PanelArtefactos
                  ancho={preferencias.ancho}
                  onAncho={(ancho) =>
                    cambiarPreferencias({ ...preferencias, ancho })
                  }
                  activo={tabActivo}
                  onActivo={(activo) =>
                    cambiarPreferencias({ ...preferencias, activo })
                  }
                  bloques={bloquesPanel}
                  onCerrar={cerrarPanel}
                  onCerrarTab={(id) => {
                    setAbiertos((ids) => ids.filter((x) => x !== id));
                    if (tabActivo === id)
                      cambiarPreferencias({ ...preferencias, activo: "grafo" });
                    window.setTimeout(
                      () => document.getElementById(`abrir-${id}`)?.focus(),
                      0,
                    );
                  }}
                  grafo={
                    <section
                      className="tc-map"
                      aria-labelledby="tc-mapa-titulo"
                    >
                      <h2 id="tc-mapa-titulo">Tu mapa de comprensión</h2>
                      <p>
                        Así se conectan tus ideas. El estado de cada nodo sale
                        de tus comprobaciones.
                      </p>
                      <label className="tc-search">
                        <Search size={17} aria-hidden="true" />
                        <span className="sr-only">Buscar ideas en tu mapa</span>
                        <input
                          type="search"
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                          placeholder="Buscar ideas en tu mapa…"
                        />
                      </label>
                      {grafo.isPending ? (
                        <p role="status">Preparando tu mapa…</p>
                      ) : grafo.isError ? (
                        <div role="alert">
                          <p>{grafo.error.message}</p>
                          <button
                            type="button"
                            className="tc-btn tc-btn--line"
                            onClick={() => void grafo.refetch()}
                          >
                            Reintentar mapa
                          </button>
                        </div>
                      ) : (
                        <>
                          {falloPendiente && !plan && (
                            <p className="tw-retro-nota" role="status">
                              {fallo.detalle.rastro?.idea_clave
                                ? "El sistema identificó una idea para revisar, pero no hay una ruta válida de retorno en este mapa. No se dibuja un recorrido inventado."
                                : "Sin evidencia suficiente para señalar una idea. Comparte un paso de tu razonamiento."}
                            </p>
                          )}
                          <GrafoComprension
                            grafo={grafo.data}
                            seleccionado={elegido}
                            onSeleccionar={setElegido}
                            busqueda={busqueda}
                            plan={plan}
                            eventoRetro={eventoRetro}
                            onConsumirRetro={consumirRetro}
                            demo={demo}
                          />
                        </>
                      )}
                    </section>
                  }
                >
                  {bloquesPanel
                    .filter((b) => b.id === tabActivo)
                    .map((b) => (
                      <BloqueView
                        key={b.id}
                        bloque={b}
                        arbolId={conv.data?.arbol_id ?? ""}
                        comprobando={!!activa.data}
                        onComprobar={() => comprobar.mutate()}
                        alResponder={(t) => {
                          void grafo.refetch();
                          if (t) enviar.mutate(t);
                        }}
                      />
                    ))}
                </PanelArtefactos>
              )}
            </div>
          </>
        )}
      </main>
      <Sheet open={historialAbierto} onOpenChange={setHistorialAbierto}>
        <SheetContent
          side="right"
          className={`tc-sheet tutor-layout${claro ? " tc-modo-claro" : ""}`}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Historial de conversaciones</SheetTitle>
            <SheetDescription>
              Tus conversaciones con el tutor, de la más reciente a la más
              antigua.
            </SheetDescription>
          </SheetHeader>
          {panelHistorial(false, () => setHistorialAbierto(false))}
        </SheetContent>
      </Sheet>
    </ResponsiveLayout>
  );
}
