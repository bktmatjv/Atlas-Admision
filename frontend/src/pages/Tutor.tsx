import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  FlaskConical,
  Lightbulb,
  MessageCircle,
  Network,
  Paperclip,
  Search,
  Send,
  Sparkles,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { ThemeToggle } from "@/components/system/ThemeToggle";
import { MathMarkdown } from "@/components/shared/MathMarkdown";
import { BloqueView } from "@/components/tutor/Bloques";
import { GrafoComprension } from "@/components/tutor/GrafoComprension";
import { TutorAvatar } from "@/components/tutor/TutorAvatar";
import { TutorProgress } from "@/components/tutor/TutorProgress";
import { api, post } from "@/integrations/api/client";
import type { Bloque, Conversacion } from "@/lib/tutor/chat";
import type { Grafo } from "@/lib/tutor/grafo";
import mountainTrail from "@/assets/tutor/mountain-trail.svg";
import "@/components/tutor/tutor.css";

const TEMAS = [
  { id: "porcentajes", nombre: "Porcentajes" },
  { id: "proporciones", nombre: "Proporciones" },
  { id: "fracciones", nombre: "Fracciones" },
];
const FRAME: Partial<
  Record<
    Bloque["tipo"],
    { titulo: string; icon: typeof BookOpen; tono: string }
  >
> = {
  contraste: {
    titulo: "Tu razonamiento vs. el correcto",
    icon: TriangleAlert,
    tono: "wine",
  },
  visual: { titulo: "Visual matemático", icon: FlaskConical, tono: "violet" },
  ejemplo_paso_a_paso: {
    titulo: "Una idea, paso a paso",
    icon: Lightbulb,
    tono: "amber",
  },
  razonamiento_anotado: {
    titulo: "La evidencia en tus pasos",
    icon: Search,
    tono: "wine",
  },
  practica: {
    titulo: "Ahora, intenta aplicarlo",
    icon: BookOpen,
    tono: "violet",
  },
};
export default function Tutor() {
  const { id } = useParams(),
    [search] = useSearchParams(),
    nav = useNavigate(),
    client = useQueryClient();
  const [tema, setTema] = useState("porcentajes"),
    [texto, setTexto] = useState(""),
    [elegido, setElegido] = useState<string | null>(null),
    [busqueda, setBusqueda] = useState("");
  const clave = useRef<{ texto: string; key: string } | null>(null);
  const historial = useRef<HTMLDivElement>(null);
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
    queryFn: () =>
      api<{ id: string; arbol_id: string } | null>("/comprobaciones/activa"),
  });
  const salud = useQuery({
    queryKey: ["salud"],
    queryFn: () => api<{ ia: string; ok: boolean; pruebas: boolean }>("/salud"),
    staleTime: 30000,
  });
  const foco = grafo.data?.foco ?? null;
  useEffect(() => {
    if (foco) setElegido(foco);
  }, [foco]);
  const crear = useMutation({
    mutationFn: () =>
      post<{ id: string }>(
        "/conversaciones",
        search.get("fragmento")
          ? { fragmento_id: search.get("fragmento") }
          : search.get("intento") && search.get("pregunta")
            ? {
                intento_id: search.get("intento"),
                pregunta_id: search.get("pregunta"),
              }
            : { tema },
      ),
    onSuccess: (r) => nav(`/tutor/${r.id}`),
  });
  const enviar = useMutation({
    mutationFn: (t: string) => {
      if (clave.current?.texto !== t)
        clave.current = { texto: t, key: crypto.randomUUID() };
      return post(
        `/conversaciones/${id}/mensajes`,
        { texto: t },
        clave.current.key,
      );
    },
    onSuccess: () => {
      clave.current = null;
      setTexto("");
      void conv.refetch();
      void grafo.refetch();
    },
  });
  const comprobar = useMutation({
    mutationFn: () =>
      post("/comprobaciones", { arbol_id: conv.data!.arbol_id }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["comprobacion-activa"] });
      nav(`/aprender/${conv.data!.arbol_id}`);
    },
  });
  const mensajes = conv.data?.mensajes ?? [];
  useEffect(() => {
    const el = historial.current;
    if (el)
      el.scrollTo?.({
        top: el.scrollHeight,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [mensajes.length, enviar.isPending]);
  const error = crear.error ?? enviar.error ?? comprobar.error ?? conv.error;
  const pensando = enviar.isPending;
  const ocupado = pensando || comprobar.isPending;
  const puedeActuar = !!conv.data && !ocupado && !activa.data;
  const temaActual =
    grafo.data?.nodos.find((n) => n.id === elegido)?.titulo ??
    TEMAS.find((t) => t.id === tema)?.nombre ??
    "esta idea";
  const estado = salud.isError
    ? "Sin conexión"
    : !salud.data
      ? "Conectando…"
      : salud.data.pruebas
        ? "Modo de pruebas"
        : salud.data.ia === "disabled"
          ? "IA sin configurar"
          : "IA configurada";
  const tonoEstado =
    salud.data?.pruebas || salud.data?.ia === "disabled" || salud.isError
      ? "muted"
      : "ready";
  const contextual = Boolean(search.get("fragmento") || search.get("intento"));
  return (
    <ResponsiveLayout
      appearance="tutor"
      headerTools={
        <>
          <label className="tutor-header-search">
            <Search size={17} />
            <span className="sr-only">Buscar en tu mapa de comprensión</span>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar ideas en tu mapa…"
            />
          </label>
          <ThemeToggle />
          <span className="tutor-guest">
            <UserRound size={17} />
            <span>Invitado</span>
          </span>
        </>
      }
    >
      <main className="tutor-page">
        <header className="tutor-hero">
          <img
            src={mountainTrail}
            className="tutor-hero-art"
            alt=""
            aria-hidden="true"
          />
          <div className="tutor-hero-copy">
            <p className="tutor-eyebrow">CALIBRA · conversar para comprender</p>
            <h1>Entiende el porqué de tus errores</h1>
            <p>
              Conversa con tu tutor, analiza tu razonamiento y conecta lo que
              aprendes.
              <br className="tutor-desktop-break" /> Una pregunta abre el
              camino. Lo que haces después aporta la evidencia.
            </p>
          </div>
          <blockquote className="tutor-hero-quote">
            <span aria-hidden="true">“</span>
            <div>
              <p>
                No se trata de tener todas las respuestas, sino de hacer mejores
                preguntas y entender tu razonamiento.
              </p>
              <cite>CALIBRA</cite>
            </div>
          </blockquote>
        </header>
        {error && (
          <div role="alert" className="tutor-page-error">
            <TriangleAlert size={19} />
            <p>{error.message}</p>
            {conv.isError && (
              <button type="button" onClick={() => void conv.refetch()}>
                Reintentar conversación
              </button>
            )}
          </div>
        )}
        <div className="tutor-workspace">
          <section
            className="tutor-panel tutor-chat"
            aria-labelledby="chat-title"
          >
            <header className="tutor-panel-header tutor-chat-header">
              <TutorAvatar />
              <div className="tutor-chat-heading">
                <div className="tutor-heading-line">
                  <h2 id="chat-title">Charla con tu tutor</h2>
                  <span
                    className={`tutor-connection tutor-connection--${tonoEstado}`}
                  >
                    <i />
                    {estado}
                  </span>
                </div>
                <p>Una ayuda para entender, no solo para resolver.</p>
              </div>
              <div className="tutor-chat-actions">
                <button
                  type="button"
                  disabled={!puedeActuar}
                  onClick={() =>
                    enviar.mutate(
                      "Ayúdame a analizar mi error y el razonamiento que compartí, sin asumir causas que no puedas observar.",
                    )
                  }
                >
                  <Search />
                  <span>
                    Analizar
                    <br />
                    error
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!puedeActuar}
                  onClick={() =>
                    enviar.mutate(
                      `Explícame el concepto de ${temaActual} de una forma más sencilla.`,
                    )
                  }
                >
                  <BookOpen />
                  <span>
                    Explicar
                    <br />
                    concepto
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!puedeActuar}
                  onClick={() => comprobar.mutate()}
                >
                  <Lightbulb />
                  <span>
                    Dame una
                    <br />
                    comprobación
                  </span>
                </button>
              </div>
            </header>
            {activa.data && (
              <p className="tutor-active-check" role="status">
                Hay una comprobación sin ayudas en curso. El tutor no resolverá
                ni confirmará su resultado y no habrá prácticas.{" "}
                <Link to={`/aprender/${activa.data.arbol_id}`}>
                  Ir a la comprobación <ArrowRight size={14} />
                </Link>
              </p>
            )}
            <div
              ref={historial}
              role="log"
              aria-live="polite"
              aria-label="Mensajes de la charla"
              className="tutor-chat-log"
            >
              {!id && (
                <div className="tutor-start">
                  <div className="tutor-message tutor-message--tutor">
                    <TutorAvatar small />
                    <div className="tutor-message-bubble">
                      <span className="tutor-message-label">Para empezar</span>
                      <p>
                        ¡Hola! Soy tu tutor de CALIBRA. Podemos explorar una
                        idea, revisar un ejercicio o descubrir en qué paso te
                        trabaste.
                      </p>
                      <p>También puedes decir «no sé por dónde empezar».</p>
                    </div>
                  </div>
                  <div className="tutor-start-options">
                    <h3>¿Sobre qué quieres conversar?</h3>
                    {contextual ? (
                      <p>
                        Usaremos{" "}
                        {search.get("fragmento")
                          ? "el fragmento de tu material"
                          : "la pregunta y tu intento"}{" "}
                        que elegiste como punto de partida.
                      </p>
                    ) : (
                      <fieldset>
                        <legend className="sr-only">
                          Tema de la conversación
                        </legend>
                        {TEMAS.map((t) => (
                          <label key={t.id}>
                            <input
                              type="radio"
                              name="tema"
                              checked={tema === t.id}
                              onChange={() => setTema(t.id)}
                            />
                            <span>{t.nombre}</span>
                          </label>
                        ))}
                      </fieldset>
                    )}
                    <button
                      type="button"
                      className="tutor-button"
                      disabled={crear.isPending}
                      onClick={() => crear.mutate()}
                    >
                      {crear.isPending ? (
                        <Sparkles size={17} />
                      ) : (
                        <MessageCircle size={17} />
                      )}{" "}
                      {crear.isPending
                        ? "Preparando conversación…"
                        : "Empezar a conversar"}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}
              {id && conv.isPending && (
                <p role="status" className="tutor-chat-notice">
                  Cargando tu conversación…
                </p>
              )}
              {id && conv.isSuccess && !mensajes.length && !pensando && (
                <div className="tutor-message tutor-message--tutor">
                  <TutorAvatar small />
                  <div className="tutor-message-bubble">
                    <span className="tutor-message-label">
                      Tu espacio para preguntar
                    </span>
                    <p>
                      Cuéntame qué quieres entender, cómo pensaste tu ejercicio
                      y en qué parte te resultó difícil.
                    </p>
                    <p>
                      Las explicaciones, los ejemplos y las comprobaciones
                      aparecerán aquí según lo que necesites.
                    </p>
                  </div>
                </div>
              )}
              {mensajes.map((m) => (
                <div
                  key={m.id}
                  className={`tutor-message tutor-message--${m.rol}`}
                >
                  {m.rol === "tutor" ? (
                    <TutorAvatar small />
                  ) : (
                    <span className="tutor-student-avatar" aria-hidden="true">
                      Tú
                    </span>
                  )}
                  <div className="tutor-message-content">
                    <div className="tutor-message-bubble">
                      <span className="tutor-message-label">
                        {m.rol === "estudiante"
                          ? "Tu razonamiento"
                          : "Tutor de CALIBRA"}
                      </span>
                      {m.rol === "tutor" ? (
                        <MathMarkdown content={m.texto} />
                      ) : (
                        <p>{m.texto}</p>
                      )}
                    </div>
                    {m.degradado && (
                      <p className="tutor-chat-notice">
                        Respuesta simplificada: solo se pudo preparar el texto,
                        sin ejercicios ni cambios en el mapa.
                      </p>
                    )}
                    {m.rol === "tutor" && m.bloques.length > 0 && (
                      <div className="tutor-rich-blocks">
                        {m.bloques.map((b) => {
                          const frame = FRAME[b.tipo],
                            Icon = frame?.icon;
                          return (
                            <div
                              key={b.id}
                              className={`tutor-block tutor-block--${b.tipo}`}
                            >
                              {frame && Icon && (
                                <h3
                                  className={`tutor-block-heading tutor-block-heading--${frame.tono}`}
                                >
                                  <span>
                                    <Icon size={20} />
                                  </span>
                                  {frame.titulo}
                                </h3>
                              )}
                              <BloqueView
                                bloque={b}
                                arbolId={conv.data!.arbol_id}
                                comprobando={!!activa.data}
                                alResponder={(t) => {
                                  void grafo.refetch();
                                  if (t) enviar.mutate(t);
                                }}
                                onComprobar={() => comprobar.mutate()}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {pensando && (
                <div className="tutor-message tutor-message--tutor">
                  <TutorAvatar small />
                  <p role="status" className="tutor-typing">
                    <span />
                    <span />
                    <span />
                    <span className="sr-only">
                      El tutor está pensando… tu mensaje queda guardado.
                    </span>
                  </p>
                </div>
              )}
            </div>
            {id && conv.data && (
              <div className="tutor-quick-check">
                <span className="tutor-quick-icon">
                  <BookOpen size={22} />
                </span>
                <div>
                  <h3>Comprobación rápida</h3>
                  <p>
                    Pon a prueba la idea con una situación diferente, sin ayudas
                    de CALIBRA.
                  </p>
                </div>
                <button
                  type="button"
                  className="tutor-button tutor-button--soft"
                  disabled={!puedeActuar}
                  onClick={() => comprobar.mutate()}
                >
                  Resolver ejercicio <ArrowRight size={17} />
                </button>
              </div>
            )}
            <form
              className="tutor-composer"
              onSubmit={(e) => {
                e.preventDefault();
                if (id && texto.trim()) enviar.mutate(texto.trim());
              }}
            >
              <label className="sr-only" htmlFor="tutor-message">
                Tu mensaje
              </label>
              <div className="tutor-composer-input">
                <Link
                  to="/cursos"
                  aria-label="Importar material en Mis cursos"
                  title="Importar material en Mis cursos"
                >
                  <Paperclip size={20} />
                </Link>
                <textarea
                  id="tutor-message"
                  rows={1}
                  value={texto}
                  maxLength={2000}
                  disabled={!id || conv.isPending}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      (e.ctrlKey || e.metaKey) &&
                      e.key === "Enter" &&
                      texto.trim() &&
                      !ocupado
                    ) {
                      e.preventDefault();
                      enviar.mutate(texto.trim());
                    }
                  }}
                  placeholder={
                    id
                      ? "Escribe tu mensaje aquí…"
                      : "Elige un tema para iniciar la conversación"
                  }
                />
              </div>
              <button
                type="submit"
                className="tutor-button"
                disabled={!id || ocupado || !texto.trim()}
              >
                <Send size={18} />
                <span>Enviar</span>
              </button>
            </form>
            {texto.length > 1800 && (
              <p className="tutor-composer-count">
                {texto.length} / 2000 caracteres
              </p>
            )}
          </section>
          <section
            className="tutor-panel tutor-map-panel"
            aria-labelledby="mapa-title"
          >
            <header className="tutor-panel-header">
              <span className="tutor-icon-tile">
                <Network size={29} />
              </span>
              <div>
                <h2 id="mapa-title">Tu mapa de comprensión</h2>
                <p>
                  Así se conectan tus ideas. Explora cada nodo para ver más
                  detalles.
                </p>
              </div>
            </header>
            {grafo.isPending ? (
              <div className="tutor-map-empty" role="status">
                <Network size={40} />
                <p>Preparando tu mapa…</p>
              </div>
            ) : grafo.isError ? (
              <div className="tutor-map-empty">
                <TriangleAlert size={30} />
                <h3>No pudimos consultar tu mapa</h3>
                <p role="alert">{grafo.error.message}</p>
                <button
                  type="button"
                  className="tutor-button tutor-button--secondary"
                  onClick={() => void grafo.refetch()}
                >
                  Reintentar mapa
                </button>
              </div>
            ) : (
              grafo.data && (
                <GrafoComprension
                  grafo={grafo.data}
                  seleccionado={elegido}
                  onSeleccionar={setElegido}
                  busqueda={busqueda}
                />
              )
            )}
          </section>
        </div>
        <TutorProgress grafo={grafo.data} arbolId={conv.data?.arbol_id} />
        {id && (
          <Link to="/tutor" className="tutor-new-conversation">
            <ChevronLeft size={15} />
            Empezar otra conversación
          </Link>
        )}
      </main>
    </ResponsiveLayout>
  );
}
