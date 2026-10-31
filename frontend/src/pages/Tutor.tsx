import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, Send } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { ThemeToggle } from "@/components/system/ThemeToggle";
import { MathMarkdown } from "@/components/shared/MathMarkdown";
import { BloqueView } from "@/components/tutor/Bloques";
import { GrafoComprension } from "@/components/tutor/GrafoComprension";
import { api, post } from "@/integrations/api/client";
import type { Conversacion } from "@/lib/tutor/chat";
import type { Grafo } from "@/lib/tutor/grafo";
const card = "rounded-2xl border border-border bg-card p-5 sm:p-6";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 font-bold text-primary-foreground disabled:opacity-50";
const TEMAS = [
  { id: "porcentajes", nombre: "Porcentajes" },
  { id: "proporciones", nombre: "Proporciones" },
  { id: "fracciones", nombre: "Fracciones" },
];
export default function Tutor() {
  const { id } = useParams(),
    [search] = useSearchParams(),
    nav = useNavigate(),
    client = useQueryClient();
  const [tema, setTema] = useState("porcentajes"),
    [texto, setTexto] = useState(""),
    [elegido, setElegido] = useState<string | null>(null);
  const clave = useRef<{ texto: string; key: string } | null>(null);
  const fin = useRef<HTMLDivElement>(null);
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
  // El foco lo decide el agente (operación enfocar); el estudiante también puede elegir un nodo.
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
      // La misma clave en cada reintento del mismo texto: el turno no se duplica.
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
    fin.current?.scrollIntoView?.({ block: "end" });
  }, [mensajes.length, enviar.isPending]);
  const error = crear.error ?? enviar.error ?? comprobar.error ?? conv.error;
  return (
    <ResponsiveLayout>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-7 sm:px-6 sm:py-10">
        <header className="flex items-start justify-between gap-4">
          <div>
            <Link
              to="/aprender"
              className="text-xs font-bold uppercase tracking-[0.2em] text-primary"
            >
              CALIBRA · conversar para comprender
            </Link>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Entiende el porqué de tus errores
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Conversa con el tutor. Tu mapa se arma con lo que exploras; el
              estado de cada idea lo calcula CALIBRA desde tus comprobaciones, no
              desde lo que diga la IA.
            </p>
          </div>
          <ThemeToggle />
        </header>
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/5 p-4"
          >
            {error.message}
          </p>
        )}
        {!id ? (
          <section className={card} aria-labelledby="empezar">
            <h2 id="empezar" className="text-xl font-bold">
              ¿Sobre qué quieres conversar?
            </h2>
            {search.get("fragmento") || search.get("intento") ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Empezaremos desde el material o la pregunta que elegiste.
              </p>
            ) : (
              <fieldset className="mt-4 flex flex-wrap gap-3">
                <legend className="sr-only">Tema</legend>
                {TEMAS.map((t) => (
                  <label
                    key={t.id}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-4"
                  >
                    <input
                      type="radio"
                      name="tema"
                      checked={tema === t.id}
                      onChange={() => setTema(t.id)}
                    />
                    {t.nombre}
                  </label>
                ))}
              </fieldset>
            )}
            <button
              className={`${button} mt-5`}
              disabled={crear.isPending}
              onClick={() => crear.mutate()}
            >
              <MessagesSquare className="h-4 w-4" /> Empezar a conversar
            </button>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section
              className={`${card} flex flex-col`}
              aria-labelledby="chat-title"
            >
              <h2 id="chat-title" className="text-xl font-bold">
                Charla con el tutor
              </h2>
              {activa.data && (
                <p
                  className="mt-3 rounded-xl bg-primary/5 p-3 text-sm"
                  role="status"
                >
                  Hay una comprobación sin ayudas en curso. Mientras dure, el
                  tutor no resolverá ni confirmará su resultado y no habrá
                  prácticas.{" "}
                  <Link
                    className="font-semibold underline"
                    to={`/aprender/${activa.data.arbol_id}`}
                  >
                    Ir a la comprobación
                  </Link>
                </p>
              )}
              <div
                role="log"
                aria-live="polite"
                aria-label="Mensajes de la charla"
                className="mt-4 max-h-[60vh] min-h-48 space-y-4 overflow-y-auto pr-1"
              >
                {mensajes.length === 0 && !enviar.isPending && (
                  <p className="text-sm text-muted-foreground">
                    Cuéntame qué quieres entender o en qué te trabaste. Puedes
                    decir «no sé por dónde empezar».
                  </p>
                )}
                {mensajes.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.rol === "estudiante"
                        ? "ml-auto max-w-[90%] rounded-2xl bg-primary/10 p-3"
                        : "space-y-3"
                    }
                  >
                    <p className="sr-only">
                      {m.rol === "estudiante" ? "Tú" : "Tutor"}:
                    </p>
                    {m.rol === "tutor" ? (
                      <>
                        <MathMarkdown content={m.texto} />
                        {m.degradado && (
                          <p className="text-xs text-muted-foreground">
                            Respuesta simplificada: esta vez solo pude armar el
                            texto, sin ejercicios ni cambios en tu mapa.
                          </p>
                        )}
                        {m.bloques.map((b) => (
                          <BloqueView
                            key={b.id}
                            bloque={b}
                            arbolId={conv.data!.arbol_id}
                            comprobando={!!activa.data}
                            alResponder={(t) => {
                              void grafo.refetch();
                              if (t) enviar.mutate(t);
                            }}
                            onComprobar={() => comprobar.mutate()}
                          />
                        ))}
                      </>
                    ) : (
                      <p>{m.texto}</p>
                    )}
                  </div>
                ))}
                {enviar.isPending && (
                  <p role="status" className="text-sm text-muted-foreground">
                    El tutor está pensando… tu mensaje queda guardado.
                  </p>
                )}
                <div ref={fin} />
              </div>
              <form
                className="mt-4 flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (texto.trim()) enviar.mutate(texto.trim());
                }}
              >
                <label className="text-sm font-semibold">
                  Tu mensaje
                  <textarea
                    value={texto}
                    maxLength={2000}
                    onChange={(e) => setTexto(e.target.value)}
                    className="mt-2 min-h-20 w-full rounded-lg border bg-background p-3 font-normal"
                  />
                </label>
                <button
                  className={button}
                  disabled={enviar.isPending || !texto.trim()}
                >
                  <Send className="h-4 w-4" /> Enviar
                </button>
              </form>
            </section>
            <section className={card} aria-labelledby="mapa-title">
              <h2 id="mapa-title" className="text-xl font-bold">
                Tu mapa de comprensión
              </h2>
              <div className="mt-4">
                {grafo.data ? (
                  <GrafoComprension
                    grafo={grafo.data}
                    seleccionado={elegido}
                    onSeleccionar={setElegido}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Cargando tu mapa…
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </ResponsiveLayout>
  );
}
