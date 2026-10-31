import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Upload,
  FileText,
  ArrowRight,
  Plus,
  Trash2,
} from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { ThemeToggle } from "@/components/system/ThemeToggle";
import { MathMarkdown } from "@/components/shared/MathMarkdown";
import { api, post } from "@/integrations/api/client";
const card = "rounded-2xl border border-border bg-card p-5 sm:p-6";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 font-bold text-primary-foreground disabled:opacity-50";
const secondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50";
type Course = {
  id: string;
  titulo: string;
  objetivo: string;
  documentos: Doc[];
};
type Doc = {
  id: string;
  nombre: string;
  estado: string;
  error: string | null;
  temas: { titulo: string; resumen: string; fragmento_id: string }[];
  fragmentos?: { id: string; pagina: number; texto: string }[];
};
type Proposal = {
  id: string;
  intento?: string;
  revelada?: boolean;
  actividad: {
    enunciado: string;
    respuesta_esperada: string;
    criterio: string;
    sustento: string;
  };
  nota: string;
};
const status: Record<string, string> = {
  recibido: "En espera",
  extrayendo: "Extrayendo y organizando",
  requiere_revision: "Revisa el material",
  listo: "Listo para explorar",
  fallido: "No se pudo importar",
  cancelado: "Cancelado",
};
export default function Cursos() {
  const { cursoId, documentoId } = useParams(),
    nav = useNavigate(),
    client = useQueryClient();
  const [titulo, setTitulo] = useState(""),
    [objetivo, setObjetivo] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [consent, setConsent] = useState(false),
    [attempt, setAttempt] = useState(""),
    [showSolution, setShowSolution] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    document.title = "Mis cursos | CALIBRA";
    setShowSolution(false);
    setAttempt("");
    setConfirmDelete(false);
  }, [documentoId]);
  const list = useQuery({
    queryKey: ["cursos"],
    queryFn: () => api<Course[]>("/cursos"),
  });
  const course = useQuery({
    queryKey: ["curso", cursoId],
    queryFn: () => api<Course>(`/cursos/${cursoId}`),
    enabled: !!cursoId,
    refetchInterval: (q) =>
      q.state.data?.documentos.some((d) =>
        ["recibido", "extrayendo"].includes(d.estado),
      )
        ? 2000
        : false,
  });
  const doc = useQuery({
    queryKey: ["documento", documentoId],
    queryFn: () => api<Doc>(`/documentos/${documentoId}`),
    enabled: !!documentoId,
    refetchInterval: (q) =>
      q.state.data && ["recibido", "extrayendo"].includes(q.state.data.estado)
        ? 2000
        : false,
  });
  const create = useMutation({
    mutationFn: () => post<Course>("/cursos", { titulo, objetivo }),
    onSuccess: (c) => {
      void list.refetch();
      nav(`/cursos/${c.id}`);
    },
  });
  const upload = useMutation({
    mutationFn: () => {
      if (!file || !consent)
        throw new Error("Selecciona un archivo y confirma el procesamiento.");
      const data = new FormData();
      data.append("archivo", file);
      return api<{ id: string }>(`/cursos/${cursoId}/documentos`, {
        method: "POST",
        body: data,
      });
    },
    onSuccess: (d) => {
      setFile(null);
      void course.refetch();
      nav(`/cursos/${cursoId}/materiales/${d.id}`);
    },
  });
  const confirm = useMutation({
    mutationFn: () => post(`/documentos/${documentoId}/confirmar`, {}),
    onSuccess: () => {
      void doc.refetch();
      void course.refetch();
    },
  });
  const retry = useMutation({
    mutationFn: () => post(`/documentos/${documentoId}/reintentar`, {}),
    onSuccess: () => void doc.refetch(),
  });
  const remove = useMutation({
    mutationFn: () => api(`/documentos/${documentoId}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["arboles"] });
      void course.refetch();
      nav(`/cursos/${cursoId}`);
    },
  });
  const proposal = useMutation({
    mutationFn: (id: string) => {
      setShowSolution(false);
      setAttempt("");
      return post<Proposal>(
        `/fragmentos/${id}/actividad`,
        {},
        crypto.randomUUID(),
      );
    },
    onSuccess: (p) => {
      setAttempt(p.intento ?? "");
      setShowSolution(p.revelada ?? false);
    },
  });
  const saveAttempt = useMutation({
    mutationFn: () =>
      api(`/actividades-generadas/${proposal.data!.id}/intento`, {
        method: "PUT",
        body: JSON.stringify({ intento: attempt, revelada: true }),
      }),
    onSuccess: () => setShowSolution(true),
  });
  const error =
    list.error ??
    course.error ??
    doc.error ??
    create.error ??
    upload.error ??
    confirm.error ??
    retry.error ??
    remove.error ??
    proposal.error ??
    saveAttempt.error;
  return (
    <ResponsiveLayout>
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <Link
              to="/cursos"
              className="text-xs font-bold uppercase tracking-[0.2em] text-primary"
            >
              CALIBRA · Mis cursos
            </Link>
            <h1 className="mt-3 text-3xl font-extrabold">
              {doc.data?.nombre ??
                course.data?.titulo ??
                "El conocimiento también lo traes tú."}
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Convierte tus apuntes en un punto de partida para explorar,
              preguntar y practicar. Tu material es privado.
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
        {!cursoId && (
          <>
            <section className={card}>
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <Plus className="h-5 w-5 text-primary" />
                Crear un curso personal
              </h2>
              <form
                className="mt-5 grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  create.mutate();
                }}
              >
                <label className="text-sm font-semibold">
                  Nombre del curso
                  <input
                    required
                    maxLength={120}
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className="mt-2 min-h-11 w-full rounded-lg border bg-background px-3"
                    placeholder="Por ejemplo: Aritmética · mis apuntes"
                  />
                </label>
                <label className="text-sm font-semibold">
                  ¿Qué quieres aprender?
                  <textarea
                    value={objetivo}
                    maxLength={1000}
                    onChange={(e) => setObjetivo(e.target.value)}
                    className="mt-2 min-h-24 w-full rounded-lg border bg-background p-3"
                  />
                </label>
                <button
                  className={`${button} justify-self-start`}
                  disabled={create.isPending}
                >
                  Crear curso <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </section>
            <section>
              <h2 className="mb-4 text-xl font-bold">Tu biblioteca</h2>
              {list.isPending ? (
                <p role="status">Cargando cursos…</p>
              ) : !list.data?.length ? (
                <p className={`${card} text-muted-foreground`}>
                  Aún no tienes cursos personales. Crea uno y añade tu primer
                  material.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {list.data.map((c) => (
                    <Link
                      key={c.id}
                      className={`${card} flex items-center gap-3 hover:border-primary/50`}
                      to={`/cursos/${c.id}`}
                    >
                      <BookOpen className="h-6 w-6 shrink-0 text-primary" />
                      <span className="font-bold">{c.titulo}</span>
                      <ArrowRight className="ml-auto h-4 w-4 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
        {cursoId && !documentoId && (
          <>
            <Link to="/cursos" className={secondary}>
              ← Todos mis cursos
            </Link>
            <section className={card}>
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <Upload className="h-5 w-5 text-primary" />
                Añadir material
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                PDF con texto, TXT o Markdown · máximo 10 MB, 50 páginas y
                100.000 caracteres. Los escaneados y OCR todavía no están
                admitidos.
              </p>
              <form
                className="mt-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  upload.mutate();
                }}
              >
                <label className="block text-sm font-semibold">
                  Archivo
                  <input
                    required
                    type="file"
                    accept=".pdf,.txt,.md"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      upload.reset();
                    }}
                    className="mt-2 block min-h-11 w-full min-w-0 rounded-lg border bg-background p-2 text-sm"
                  />
                </label>
                <label className="flex min-h-11 items-start gap-3 text-sm">
                  <input
                    required
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span>
                    Tengo permiso para usar este material y entiendo que sus
                    fragmentos podrán enviarse al proveedor IA configurado para
                    organizarlo y explicarlo. No adjuntaré datos personales
                    sensibles. Puedo eliminar el documento y sus exploraciones
                    desde CALIBRA.
                  </span>
                </label>
                <button
                  className={button}
                  disabled={upload.isPending || !consent || !file}
                >
                  {upload.isPending ? "Subiendo…" : "Importar material"}
                </button>
              </form>
            </section>
            <section>
              <h2 className="mb-4 text-xl font-bold">Materiales del curso</h2>
              {course.isPending ? (
                <p role="status">Cargando materiales…</p>
              ) : !course.data?.documentos.length ? (
                <p className={`${card} text-muted-foreground`}>
                  Sube un archivo para comenzar.
                </p>
              ) : (
                <div className="space-y-3">
                  {course.data.documentos.map((d) => (
                    <Link
                      className={`${card} flex flex-wrap items-center gap-3 hover:border-primary/50`}
                      key={d.id}
                      to={`/cursos/${cursoId}/materiales/${d.id}`}
                    >
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="min-w-0 flex-1 break-words font-semibold">
                        {d.nombre}
                      </span>
                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">
                        {status[d.estado] ?? d.estado}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
        {documentoId && (
          <>
            <Link to={`/cursos/${cursoId}`} className={secondary}>
              ← Materiales del curso
            </Link>
            {doc.isPending ? (
              <p role="status">Cargando documento…</p>
            ) : (
              doc.data && (
                <>
                  <section className={card}>
                    <h2 className="text-xl font-bold">
                      {status[doc.data.estado] ?? doc.data.estado}
                    </h2>
                    {["recibido", "extrayendo"].includes(doc.data.estado) && (
                      <p role="status" className="mt-3">
                        Estamos extrayendo el texto y preparando una propuesta
                        de temas. Puedes salir y volver: el trabajo se guarda en
                        el servidor.
                      </p>
                    )}
                    {doc.data.error && (
                      <p className="mt-3 rounded-lg bg-muted p-3 text-sm">
                        {doc.data.error}
                      </p>
                    )}
                    <p className="mt-3 text-sm text-muted-foreground">
                      Revisar su organización no confirma que el documento o la
                      IA sean académicamente correctos. Las tablas, imágenes y
                      fórmulas pueden necesitar comprobación manual.
                    </p>
                    {doc.data.estado === "requiere_revision" && (
                      <button
                        className={`${button} mt-4`}
                        disabled={confirm.isPending}
                        onClick={() => confirm.mutate()}
                      >
                        Revisé la extracción: usar este material
                      </button>
                    )}
                    {doc.data.estado === "fallido" && (
                      <button
                        className={`${secondary} mt-4`}
                        onClick={() => retry.mutate()}
                        disabled={retry.isPending}
                      >
                        Reintentar extracción
                      </button>
                    )}
                  </section>
                  {!!doc.data.temas.length && (
                    <section className={card}>
                      <h2 className="text-xl font-bold">
                        Organización sugerida por IA
                      </h2>
                      <ul className="mt-4 space-y-4">
                        {doc.data.temas.map((t, n) => (
                          <li key={n}>
                            <h3 className="font-bold">{t.titulo}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {t.resumen}
                            </p>
                            {doc.data!.estado === "listo" && (
                              <Link
                                to={`/aprender?fragmento=${t.fragmento_id}`}
                                className={`${secondary} mt-2`}
                              >
                                Explorar este tema{" "}
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  <section className={card}>
                    <h2 className="text-xl font-bold">
                      Texto recuperado y sus referencias
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Comprueba el texto antes de estudiar. Cada exploración
                      conserva la referencia a su fragmento y versión.
                    </p>
                    <div className="mt-5 space-y-4">
                      {doc.data.fragmentos?.map((f) => (
                        <details key={f.id} className="rounded-xl border p-4">
                          <summary className="min-h-8 cursor-pointer font-semibold">
                            Página {f.pagina} · {f.texto.slice(0, 70)}…
                          </summary>
                          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {f.texto}
                          </p>
                          {doc.data!.estado === "listo" && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Link
                                to={`/aprender?fragmento=${f.id}`}
                                className={secondary}
                              >
                                Entender este fragmento
                              </Link>
                              <button
                                className={secondary}
                                disabled={proposal.isPending}
                                onClick={() => proposal.mutate(f.id)}
                              >
                                Proponer práctica formativa
                              </button>
                            </div>
                          )}
                        </details>
                      ))}
                    </div>
                  </section>
                  {proposal.isPending && (
                    <p role="status">Generando una propuesta de práctica…</p>
                  )}
                  {proposal.data && (
                    <section className={card}>
                      <p className="text-xs font-bold uppercase tracking-wider text-primary">
                        Generada por IA · no revisada
                      </p>
                      <h2 className="mt-2 text-xl font-bold">
                        Intenta aplicar la idea
                      </h2>
                      <div className="mt-4">
                        <MathMarkdown
                          content={proposal.data.actividad.enunciado}
                        />
                      </div>
                      <label className="mt-4 block text-sm font-semibold">
                        Tu intento
                        <textarea
                          value={attempt}
                          onChange={(e) => setAttempt(e.target.value)}
                          className="mt-2 min-h-24 w-full rounded-lg border bg-background p-3"
                        />
                      </label>
                      <button
                        className={`${secondary} mt-3`}
                        disabled={saveAttempt.isPending}
                        onClick={() => saveAttempt.mutate()}
                      >
                        Guardar intento y consultar propuesta de respuesta
                      </button>
                      {showSolution && (
                        <div className="mt-4 space-y-3 rounded-xl bg-muted p-4">
                          <MathMarkdown
                            content={proposal.data.actividad.respuesta_esperada}
                          />
                          <p className="text-sm">
                            Criterio propuesto:{" "}
                            {proposal.data.actividad.criterio}
                          </p>
                          <p className="text-sm">
                            Sustento generado:{" "}
                            {proposal.data.actividad.sustento}
                          </p>
                        </div>
                      )}
                      <p className="mt-4 text-xs text-muted-foreground">
                        {proposal.data.nota}
                      </p>
                    </section>
                  )}
                  <section className={`${card} border-destructive/20`}>
                    {!confirmDelete ? (
                      <button
                        className={`${secondary} text-destructive`}
                        onClick={() => setConfirmDelete(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar material
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <p>
                          ¿Eliminar el documento, sus fragmentos y exploraciones
                          asociadas? No se puede deshacer.
                        </p>
                        <button
                          className={`${secondary} text-destructive`}
                          disabled={remove.isPending}
                          onClick={() => remove.mutate()}
                        >
                          Sí, eliminar material y derivados
                        </button>
                        <button
                          className={`${secondary} ml-2`}
                          onClick={() => setConfirmDelete(false)}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </section>
                </>
              )
            )}
          </>
        )}
      </main>
    </ResponsiveLayout>
  );
}
