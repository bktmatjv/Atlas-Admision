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
  GitBranch,
  Sparkles,
  CornerDownRight,
  Compass,
  CheckCircle2,
} from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { MathMarkdown } from "@/components/shared/MathMarkdown";
import { api, post, ApiError } from "@/integrations/api/client";
const card = "rounded-[10px] border border-border bg-card p-5 sm:p-6";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 font-bold text-primary-foreground disabled:opacity-50";
const secondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50";
type Node = {
  id: string;
  padre_id: string | null;
  profundidad: number;
  titulo: string;
  contenido: string;
  procedencia: string;
  citas: {
    tipo: string;
    nombre?: string;
    pagina?: number;
    pregunta_id?: string;
  }[];
  idea_clave?: string | null;
};
const NIVELES_DE_AYUDA = {
  pista: "pista breve",
  ejemplo: "ejemplo resuelto",
  explicacion_completa: "explicación completa",
} as const;
type Rastro = {
  respuesta: string;
  idea_clave: string | null;
  descripcion: string | null;
  explicacion: string;
  pista: string;
  nodo_retorno_id: string | null;
  nivel_ayuda: "pista" | "ejemplo" | "explicacion_completa";
  motivo: "sin_evidencia" | null;
};
type Tree = {
  id: string;
  titulo: string;
  concepto: string | null;
  nodos: Node[];
  ultimo_rastro?: (Rastro & { camino: string[]; corregido?: boolean }) | null;
};
type Ayuda = {
  texto: string;
  nodoId?: string;
  modo?: "aclarar" | "expandir";
  idea?: string;
};
type Check = {
  id: string;
  enunciado: string;
  arbol_id?: string;
  origen?: "curada" | "plantilla";
};
type Result = {
  correcta: boolean;
  solucion: string;
  nota: string;
  ayuda: boolean;
  rastro?: Rastro | null;
};
type Evidence = {
  id: string;
  tipo: string;
  created_at: string;
  detalle: { nota?: string; concepto?: string; correcta?: boolean };
};
const labels: Record<string, string> = {
  resolvio_sin_ayuda: "Resultado correcto sin ayudas de CALIBRA",
  corrigio_tras_error:
    "Corregiste tras un error: resolviste una variante nueva sin ayuda",
  resolvio_con_ayuda: "Resolución con apoyo",
  aplicacion_por_reforzar: "Aplicación por reforzar",
  intento_entregado: "Práctica entregada",
  consulto_solucion: "Solución consultada",
};
export default function Aprender() {
  const { id } = useParams(),
    [search] = useSearchParams(),
    nav = useNavigate(),
    client = useQueryClient();
  const [tema, setTema] = useState("porcentajes"),
    [solicitud, setSolicitud] = useState(
      "No sé por dónde empezar. Ayúdame a comprender la idea.",
    );
  const [selected, setSelected] = useState<string | null>(null),
    [duda, setDuda] = useState(""),
    [respuesta, setRespuesta] = useState(""),
    [justificacion, setJustificacion] = useState(""),
    [result, setResult] = useState<Result | null>(null);
  const stableKey = useRef<{ payload: string; key: string } | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = "Aprender | CALIBRA";
    setSelected(null);
    setResult(null);
  }, [id]);
  useEffect(() => {
    if (selected) titleRef.current?.focus();
  }, [selected]);
  const list = useQuery({
    queryKey: ["arboles"],
    queryFn: () =>
      api<{ id: string; titulo: string; created_at: string }[]>("/arboles"),
  });
  const tree = useQuery({
    queryKey: ["arbol", id],
    queryFn: () => api<Tree>(`/arboles/${id}`),
    enabled: !!id,
  });
  const active = useQuery({
    queryKey: ["comprobacion-activa"],
    queryFn: () => api<Check | null>("/comprobaciones/activa"),
  });
  const evidence = useQuery({
    queryKey: ["evidencias"],
    queryFn: () => api<Evidence[]>("/evidencias"),
  });
  async function send(path: string, b: unknown) {
    const payload = JSON.stringify({ path, b });
    if (stableKey.current?.payload !== payload)
      stableKey.current = { payload, key: crypto.randomUUID() };
    try {
      const response = await post<{ id: string }>(
        path,
        b,
        stableKey.current.key,
      );
      stableKey.current = null;
      return response;
    } catch (e) {
      if (e instanceof ApiError && e.status !== 0) stableKey.current = null;
      throw e;
    }
  }
  const create = useMutation({
    mutationFn: () =>
      send("/arboles", {
        solicitud,
        ...(search.get("fragmento")
          ? { fragmento_id: search.get("fragmento") }
          : search.get("intento") && search.get("pregunta")
            ? {
                intento_id: search.get("intento"),
                pregunta_id: search.get("pregunta"),
              }
            : { tema }),
      }),
    onSuccess: (r) => {
      void client.invalidateQueries({ queryKey: ["arboles"] });
      nav(`/aprender/${r.id}`);
    },
  });
  const node =
    tree.data?.nodos.find((n) => n.id === selected) ?? tree.data?.nodos[0];
  const expand = useMutation({
    mutationFn: (a: Ayuda) =>
      send(
        `/arboles/${id}/nodos/${a.nodoId ?? node!.id}/${(a.modo ?? (a.texto === "Explícalo más sencillo" ? "aclarar" : "expandir")) === "aclarar" ? "aclarar" : "expandir"}`,
        { solicitud: a.texto, ...(a.idea ? { idea_clave: a.idea } : {}) },
      ),
    onSuccess: (_r, a) => {
      setDuda("");
      if (a.nodoId) setSelected(a.nodoId);
      void tree.refetch();
    },
  });
  const start = useMutation({
    mutationFn: () => post<Check>("/comprobaciones", { arbol_id: id }),
    onSuccess: () => {
      setResult(null);
      setRespuesta("");
      setJustificacion("");
      void active.refetch();
    },
  });
  const answer = useMutation({
    mutationFn: () =>
      api<Result>(`/comprobaciones/${active.data!.id}/respuesta`, {
        method: "PUT",
        body: JSON.stringify({ respuesta, justificacion }),
      }),
    onSuccess: (r) => {
      setResult(r);
      if (r.rastro?.nodo_retorno_id) setSelected(r.rastro.nodo_retorno_id);
      void active.refetch();
      void evidence.refetch();
      void tree.refetch();
    },
  });
  const cancel = useMutation({
    mutationFn: () => post(`/comprobaciones/${active.data!.id}/cancelar`, {}),
    onSuccess: () => {
      void active.refetch();
    },
  });
  const error =
    create.error ??
    expand.error ??
    start.error ??
    answer.error ??
    cancel.error ??
    tree.error ??
    list.error;
  const busy = create.isPending || expand.isPending;
  // Tras una entrega manda su resultado; si no, el último fallo aún no corregido que guarda el servidor.
  const persistido = tree.data?.ultimo_rastro;
  const panel = result
    ? result.rastro
    : persistido && !persistido.corregido
      ? persistido
      : null;
  // El camino solo se resalta con evidencia suficiente.
  const rastro = panel && !panel.motivo ? panel : null;
  const camino = new Set(rastro ? (persistido?.camino ?? []) : []);
  const volverA = rastro?.nodo_retorno_id ?? null;
  const raiz = tree.data?.nodos[0];
  const nivel = panel?.nivel_ayuda;
  const panelDeRastro = panel && (
    <div
      className="mt-4 space-y-3 rounded-xl bg-primary/5 p-4"
      role="group"
      aria-labelledby="rastro-title"
    >
      <h3 id="rastro-title" className="font-bold">
        {panel.motivo
          ? `Tu respuesta ${panel.respuesta}`
          : `Tu respuesta ${panel.respuesta} apunta a una idea para revisar`}
      </h3>
      {panel.descripcion && (
        <p className="text-sm font-semibold">Idea: {panel.descripcion}</p>
      )}
      <p>{panel.explicacion}</p>
      <p className="text-sm">
        <span className="font-semibold">Pista: </span>
        {panel.pista}
      </p>
      {!panel.motivo && nivel && (
        <p className="text-sm text-muted-foreground">
          Ayuda sugerida: <strong>{NIVELES_DE_AYUDA[nivel]}</strong>. Sube si
          vuelves a fallar en esta idea; puedes pedir más cuando quieras.
        </p>
      )}
      {!panel.motivo && panel.idea_clave && (
        <div className="flex flex-wrap gap-2">
          {volverA ? (
            <>
              <button
                className={secondary}
                disabled={busy}
                onClick={() => setSelected(volverA)}
              >
                Volver al nodo
              </button>
              <button
                className={nivel === "ejemplo" ? button : secondary}
                disabled={busy}
                onClick={() =>
                  expand.mutate({
                    texto:
                      "Muéstrame un ejemplo resuelto, con otros números, de esta idea",
                    nodoId: volverA,
                    modo: "expandir",
                    idea: panel.idea_clave ?? undefined,
                  })
                }
              >
                Ver ejemplo resuelto
              </button>
              <button
                className={
                  nivel === "explicacion_completa" ? button : secondary
                }
                disabled={busy}
                onClick={() =>
                  expand.mutate({
                    texto:
                      "Dame la explicación completa de esta idea, paso a paso",
                    nodoId: volverA,
                    modo: "aclarar",
                  })
                }
              >
                Explicación completa
              </button>
            </>
          ) : (
            raiz && (
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  expand.mutate({
                    texto: "Explícame esta idea clave con un ejemplo distinto",
                    nodoId: raiz.id,
                    modo: "expandir",
                    idea: panel.idea_clave ?? undefined,
                  })
                }
              >
                Explicar esta idea
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
  return (
    <ResponsiveLayout>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-7 sm:px-6 sm:py-10">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-balance">
              {tree.data?.titulo ?? "No solo entiendas la respuesta."}
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              {id
                ? "Explora una idea a la vez. Después, descubre qué puedes aplicar por tu cuenta."
                : "Descubre qué puedes hacer con lo que aprendes. Parte de una duda, conecta ideas y ponlas a prueba."}
            </p>
            <Link
              to="/tutor"
              className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline"
            >
              Conversar con el tutor y ver tu mapa de comprensión
            </Link>
          </div>
        </header>
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/5 p-4"
          >
            {error.message}
          </p>
        )}
        {busy && (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Sparkles className="h-4 w-4 animate-pulse" />
            CALIBRA está preparando la explicación. Tu exploración queda guardada.
          </p>
        )}
        {active.data && (
          <section
            className={`${card} border-primary/40`}
            aria-labelledby="check-title"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Ahora, por tu cuenta
            </p>
            <h2 id="check-title" className="mt-2 text-xl font-bold">
              Una situación diferente
            </h2>
            <p className="mt-3">{active.data.enunciado}</p>
            {active.data.origen === "plantilla" && (
              <p className="mt-2 text-xs font-semibold text-muted-foreground">
                Problema generado y verificado por CALIBRA
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Sin ayudas de CALIBRA hasta entregar. No detectamos herramientas
              externas; la justificación queda guardada sin calificación
              automática.
            </p>
            <form
              className="mt-5 grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                answer.mutate();
              }}
            >
              <label className="text-sm font-semibold">
                Resultado numérico
                <input
                  required
                  value={respuesta}
                  onChange={(e) => setRespuesta(e.target.value)}
                  inputMode="decimal"
                  className="mt-2 min-h-11 w-full rounded-lg border bg-background px-3"
                  placeholder="Escribe solo el número"
                />
              </label>
              <label className="text-sm font-semibold">
                ¿Cómo lo pensaste?
                <textarea
                  value={justificacion}
                  maxLength={3000}
                  onChange={(e) => setJustificacion(e.target.value)}
                  className="mt-2 min-h-24 w-full rounded-lg border bg-background p-3"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button className={button} disabled={answer.isPending}>
                  Entregar mi aplicación
                </button>
                <button
                  type="button"
                  className={secondary}
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate()}
                >
                  Necesito ayuda: volver a explorar
                </button>
              </div>
            </form>
          </section>
        )}
        {result && (
          <section className={card}>
            <h2 className="text-xl font-bold">
              {result.correcta
                ? "El resultado coincide."
                : "Hay una idea que podemos reforzar."}
            </h2>
            <p className="mt-3">{result.solucion}</p>
            {panelDeRastro}
            <p className="mt-3 text-sm text-muted-foreground">{result.nota}</p>
          </section>
        )}
        {!result && panelDeRastro && (
          <section className={card}>
            <h2 className="text-xl font-bold">
              Hay una idea que podemos reforzar.
            </h2>
            {panelDeRastro}
          </section>
        )}
        {!id && (
          <>
            <div className="grid divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card lg:grid-cols-[1.35fr_1fr] lg:divide-x lg:divide-y-0">
              <section className="relative p-5 sm:p-6">
                <h2 className="text-2xl font-bold">¿Qué quieres comprender?</h2>
                <form
                  className="relative mt-5 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    create.mutate();
                  }}
                >
                  {!search.get("intento") && !search.get("fragmento") ? (
                    <label className="block text-sm font-semibold">
                      Punto de partida
                      <select
                        value={tema}
                        onChange={(e) => setTema(e.target.value)}
                        className="mt-2 min-h-11 w-full rounded-lg border bg-background px-3"
                      >
                        <option value="porcentajes">
                          Porcentajes y cambios de base
                        </option>
                        <option value="proporciones">Proporcionalidad</option>
                        <option value="fracciones">
                          Fracciones y equivalencias
                        </option>
                      </select>
                    </label>
                  ) : (
                    <p className="rounded-lg bg-muted p-3 text-sm">
                      El tutor usará{" "}
                      {search.get("fragmento")
                        ? "el fragmento de tu documento"
                        : "la pregunta y tu intento"}{" "}
                      como contexto. No hace falta copiarlo aquí.
                    </p>
                  )}
                  <label className="block text-sm font-semibold">
                    Tu duda
                    <textarea
                      required
                      value={solicitud}
                      maxLength={2000}
                      onChange={(e) => setSolicitud(e.target.value)}
                      className="mt-2 min-h-28 w-full rounded-lg border bg-background p-3"
                    />
                  </label>
                  <button disabled={busy || !!active.data} className={button}>
                    Crear mi exploración <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              </section>
              <section className="flex flex-col justify-between p-5 sm:p-6">
                <div>
                  <h2 className="text-2xl font-bold">
                    Tu material, tu punto de partida.
                  </h2>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    Importa apuntes o un PDF con texto. Revisa sus temas y
                    explóralos con el mismo tutor, sin depender solo del banco.
                  </p>
                </div>
                <Link className={`${secondary} mt-6`} to="/cursos">
                  Abrir Mis apuntes <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/admision"
                  className="mt-4 text-sm font-semibold text-primary underline underline-offset-4"
                >
                  Practicar con preguntas de San Marcos
                </Link>
              </section>
            </div>
            <section>
              <h2 className="mb-4 text-xl font-bold">Tus exploraciones</h2>
              {list.isPending ? (
                <p role="status">Cargando exploraciones…</p>
              ) : !list.data?.length ? (
                <p className={`${card} text-muted-foreground`}>
                  Tu primer mapa comienza con una pregunta. Aún no tienes
                  exploraciones guardadas.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {list.data.map((t) => (
                    <Link
                      key={t.id}
                      to={`/aprender/${t.id}`}
                      className={`${card} flex items-center gap-4 hover:border-primary/50`}
                    >
                      <GitBranch className="h-6 w-6 shrink-0 text-primary" />
                      <span className="font-semibold">{t.titulo}</span>
                      <ArrowRight className="ml-auto h-4 w-4 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
        {id && tree.isPending && <p role="status">Cargando mapa…</p>}
        {id && tree.data && node && !active.data && (
          <div className="grid items-start gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className={`${card} lg:sticky lg:top-20`}>
              <h2 className="flex items-center gap-2 font-bold">
                <GitBranch className="h-5 w-5 text-primary" />
                Tu mapa de ideas
              </h2>
              <p className="mt-2 text-xs text-muted-foreground">
                Las ramas son exploración, no una lista de temas dominados.
              </p>
              <nav aria-label="Árbol de comprensión" className="mt-4 space-y-1">
                {tree.data.nodos.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setSelected(n.id);
                      expand.reset();
                    }}
                    aria-current={node.id === n.id ? "true" : undefined}
                    className={`flex min-h-11 w-full items-start gap-2 rounded-lg py-3 pr-2 text-left text-sm ${node.id === n.id ? "bg-primary/10 font-bold text-primary" : "hover:bg-muted"} ${camino.has(n.id) ? "border-l-4 border-primary" : ""}`}
                    style={{ paddingLeft: 8 + Math.min(n.profundidad, 4) * 12 }}
                  >
                    {n.padre_id ? (
                      <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <Compass className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <span>
                      {n.titulo}
                      {camino.has(n.id) && (
                        <span className="sr-only">
                          {" "}
                          (en el camino de la idea)
                        </span>
                      )}
                    </span>
                    {n.id === volverA && (
                      <span className="ml-auto shrink-0 rounded-md bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                        Volver aquí
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </aside>
            <article className={`${card} min-w-0 space-y-5`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {node.procedencia}
              </p>
              <h2
                ref={titleRef}
                tabIndex={-1}
                className="text-2xl font-extrabold outline-none"
              >
                {node.titulo}
              </h2>
              <div className="leading-relaxed">
                <MathMarkdown content={node.contenido} />
              </div>
              <ul
                className="space-y-1 border-t pt-3 text-xs text-muted-foreground"
                aria-label="Procedencia del contexto"
              >
                {node.citas.map((c, n) => (
                  <li key={n}>
                    {c.tipo === "documento"
                      ? `${c.nombre} · página ${c.pagina} · fragmento de tu material`
                      : c.tipo === "banco"
                        ? `Pregunta ${c.pregunta_id} · banco de CALIBRA`
                        : "Concepto de CALIBRA · contenido generado"}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {[
                  "Explícalo más sencillo",
                  "Dame un ejemplo diferente",
                  "¿Por qué ocurre esto?",
                ].map((t) => (
                  <button
                    key={t}
                    disabled={busy || !!active.data}
                    onClick={() => expand.mutate({ texto: t })}
                    className={secondary}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  expand.mutate({ texto: duda });
                }}
                className="space-y-3"
              >
                <label className="block text-sm font-semibold">
                  Pregunta sobre esta rama
                  <textarea
                    required
                    maxLength={2000}
                    value={duda}
                    onChange={(e) => setDuda(e.target.value)}
                    className="mt-2 min-h-24 w-full rounded-lg border bg-background p-3"
                    placeholder="¿Qué parte necesitas aclarar?"
                  />
                </label>
                <button className={secondary} disabled={busy || !!active.data}>
                  Explorar mi duda <ArrowRight className="h-4 w-4" />
                </button>
              </form>
              <section className="rounded-xl bg-primary/5 p-4">
                <h3 className="font-bold">
                  Leer no es lo mismo que poder aplicarlo.
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tree.data.concepto
                    ? "Cuando quieras, prueba una situación nueva. No necesitas terminar todas las ramas."
                    : "Este material aún no tiene una comprobación revisada preparada. Puedes generar una práctica formativa desde Mis cursos."}
                </p>
                {tree.data.concepto && (
                  <button
                    className={`${button} mt-4`}
                    disabled={busy || start.isPending || !!active.data}
                    onClick={() => start.mutate()}
                  >
                    Quiero ponerlo a prueba <CheckCircle2 className="h-4 w-4" />
                  </button>
                )}
              </section>
            </article>
          </div>
        )}
        <section className={card}>
          <h2 className="text-xl font-bold">
            Lo que tus intentos permiten observar
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No es un porcentaje de comprensión ni una garantía de ingreso.
          </p>
          {evidence.isError ? (
            <p role="alert" className="mt-4">
              {evidence.error.message}
            </p>
          ) : (
            <ol className="mt-4 divide-y">
              {evidence.data?.slice(0, 8).map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                >
                  <span>
                    {labels[e.tipo] ?? e.tipo.replace(/_/g, " ")}
                    {e.detalle.concepto && ` · ${e.detalle.concepto}`}
                  </span>
                  <time className="text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("es-PE")}
                  </time>
                </li>
              ))}
            </ol>
          )}
          {!evidence.data?.length && (
            <p className="mt-4 text-sm text-muted-foreground">
              Tus aplicaciones y consultas de soluciones aparecerán aquí. Abrir
              ramas no se registra como aprendizaje demostrado.
            </p>
          )}
        </section>
      </main>
    </ResponsiveLayout>
  );
}
