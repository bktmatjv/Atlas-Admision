import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Search,
  Dumbbell,
  ChevronDown,
  ArrowLeft,
  AlertCircle,
  Sparkles,
  FolderTree,
} from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/system/PageHeader";
import { ThemeToggle } from "@/components/system/ThemeToggle";
import { CURSOS } from "@/lib/admision/temario";
import { admisionDb } from "@/integrations/supabase/admision";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { cargarBanco } from "@/integrations/local/datos";
import { cn } from "@/lib/utils";

const CATEGORIAS = [
  { id: "todas", nombre: "Todos los cursos" },
  { id: "habilidades", nombre: "Habilidades" },
  { id: "matematicas", nombre: "Matemáticas" },
  { id: "ciencias", nombre: "Ciencias" },
  { id: "humanidades", nombre: "Humanidades" },
  { id: "actitudinal", nombre: "Actitudinal" },
] as const;

function obtenerCategoria(cursoId: string): string {
  if (cursoId === "actitudinal") return "actitudinal";
  if (cursoId.startsWith("habilidad")) return "habilidades";
  if (["aritmetica", "algebra", "geometria", "trigonometria"].includes(cursoId)) return "matematicas";
  if (["fisica", "quimica", "biologia"].includes(cursoId)) return "ciencias";
  return "humanidades";
}

function nombreCategoria(catId: string): string {
  const c = CATEGORIAS.find((item) => item.id === catId);
  return c ? c.nombre : "General";
}

/**
 * Vista de Temario Oficial (Syllabus) · CALIBRA (/admision/temas)
 *
 * Muestra el directorio completo y estructurado de los 19 cursos oficiales de San Marcos
 * con sus temas evaluados en formato acordeón, conectando con la práctica en Inicio
 * y señalando errores pendientes reales del cuaderno de errores sin inventar métricas.
 */
export default function AdmisionTemas() {
  const navigate = useNavigate();
  const userId = useAuthUserId();

  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<string>("todas");
  const [cursosAbiertos, setCursosAbiertos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    document.title = "Temario oficial · San Marcos | CALIBRA";
  }, []);

  // Carga de errores registrados en el cuaderno de errores del estudiante
  const { data: errores = [] } = useQuery({
    queryKey: ["admision-errores", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error: e } = await admisionDb
        .from("admision_errores")
        .select("pregunta_id, caja, proxima, dominada");
      if (e) throw e;
      return data ?? [];
    },
  });

  // Carga del banco de preguntas para mapear errores con cursos y temas oficiales
  const { data: banco } = useQuery({
    queryKey: ["admision-banco"],
    queryFn: async () => cargarBanco(),
    staleTime: Infinity,
  });

  // Mapeo real de errores pendientes por curso y tema (sin inventar datos ni porcentajes)
  const erroresMap = useMemo(() => {
    const porCurso: Record<string, number> = {};
    const porTema: Record<string, number> = {};
    let total = 0;

    if (!banco || !errores.length) {
      return { porCurso, porTema, total: 0 };
    }

    const pendientes = errores.filter((e) => !e.dominada);
    for (const item of pendientes) {
      const p = banco.preguntaPorId.get(item.pregunta_id);
      if (!p) continue;
      total += 1;
      if (p.curso) {
        porCurso[p.curso] = (porCurso[p.curso] || 0) + 1;
      }
      if (p.curso && p.tema) {
        const key = `${p.curso}:${p.tema}`;
        porTema[key] = (porTema[key] || 0) + 1;
      }
    }

    return { porCurso, porTema, total };
  }, [errores, banco]);

  const totalTemas = useMemo(
    () => CURSOS.reduce((acc, c) => acc + c.temas.length, 0),
    []
  );

  // Filtro de cursos por búsqueda de texto y categoría
  const cursosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return CURSOS.filter((c) => {
      if (categoria !== "todas" && obtenerCategoria(c.id) !== categoria) {
        return false;
      }
      if (!q) return true;
      const coincideNombre = c.nombre.toLowerCase().includes(q);
      const coincideTema = c.temas.some((t) => t.nombre.toLowerCase().includes(q));
      return coincideNombre || coincideTema;
    });
  }, [busqueda, categoria]);

  const alternarCurso = (cursoId: string) => {
    setCursosAbiertos((prev) => ({ ...prev, [cursoId]: !prev[cursoId] }));
  };

  const expandirTodos = () => {
    const todos: Record<string, boolean> = {};
    for (const c of CURSOS) todos[c.id] = true;
    setCursosAbiertos(todos);
  };

  const colapsarTodos = () => {
    setCursosAbiertos({});
  };

  const estaAbierto = (cursoId: string) => {
    if (busqueda.trim() !== "") return true;
    return Boolean(cursosAbiertos[cursoId]);
  };

  const handlePracticarCurso = (cursoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/admision?curso=${encodeURIComponent(cursoId)}`, {
      state: { curso: cursoId, modalidad: "practica" },
    });
  };

  return (
    <ResponsiveLayout>
      <main className="min-w-0 flex-1 overflow-x-hidden p-4 pb-24 md:p-6 lg:p-8 lg:pb-8">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* 1. Cabecera superior y navegación */}
          <div className="space-y-2">
            <PageHeader
              breadcrumb={["CALIBRA", "Admisión", "Temario"]}
              title="Temario oficial · San Marcos"
              actions={<ThemeToggle />}
            />
            <Link
              to="/admision"
              className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md px-1 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Volver a Inicio</span>
            </Link>
          </div>

          {/* 2. Banner de orientación académica */}
          <section
            aria-labelledby="temario-intro-titulo"
            className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors md:p-6"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 space-y-1.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Syllabus Oficial · Universidad Nacional Mayor de San Marcos</span>
                </div>
                <h1
                  id="temario-intro-titulo"
                  className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl"
                >
                  Estructura Oficial de Contenidos
                </h1>
                <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
                  Consulta los 19 cursos oficiales y sus temas clasificados para el examen de admisión de la UNMSM.
                  Usa esta vista como guía de estudio o selecciona un curso para practicar de inmediato.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 shrink-0">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold text-foreground">
                  <FolderTree className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  <span>{CURSOS.length} cursos oficiales</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold text-foreground">
                  <BookOpen className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  <span>{totalTemas} temas evaluados</span>
                </div>
                {erroresMap.total > 0 && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {erroresMap.total}{" "}
                      {erroresMap.total === 1 ? "error pendiente" : "errores pendientes"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 3. Barra de control: Búsqueda, Categorías y Acciones de Acordeón */}
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Buscador reactivo */}
              <div className="relative flex-1 max-w-md">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar curso o tema específico..."
                  className="min-h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Controles de expansión masiva */}
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={expandirTodos}
                  className="min-h-9 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Expandir todos
                </button>
                <button
                  type="button"
                  onClick={colapsarTodos}
                  className="min-h-9 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Colapsar todos
                </button>
              </div>
            </div>

            {/* Chips de filtro por categoría */}
            <div
              className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1"
              role="tablist"
              aria-label="Categorías de cursos"
            >
              {CATEGORIAS.map((cat) => {
                const activo = categoria === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={activo}
                    onClick={() => setCategoria(cat.id)}
                    className={cn(
                      "min-h-9 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                      activo
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {cat.nombre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Lista de Cursos en Formato Acordeón / Directorio */}
          {cursosFiltrados.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
              <p className="font-semibold text-foreground">No se encontraron cursos o temas que coincidan</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Prueba con otro término de búsqueda o selecciona otra categoría.
              </p>
              <button
                type="button"
                onClick={() => {
                  setBusqueda("");
                  setCategoria("todas");
                }}
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary/10 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Restablecer filtros
              </button>
            </div>
          ) : (
            <div className="space-y-3" role="region" aria-label="Directorio de cursos">
              {cursosFiltrados.map((curso) => {
                const abierto = estaAbierto(curso.id);
                const erroresCurso = erroresMap.porCurso[curso.id] ?? 0;
                const panelId = `panel-temas-${curso.id}`;

                return (
                  <article
                    key={curso.id}
                    className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:border-primary/40"
                  >
                    {/* Encabezado del Acordeón */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={abierto}
                      aria-controls={panelId}
                      onClick={() => alternarCurso(curso.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          alternarCurso(curso.id);
                        }
                      }}
                      className="flex min-h-[44px] cursor-pointer flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between select-none md:p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span
                          aria-hidden="true"
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
                        >
                          <BookOpen className="h-5 w-5" />
                        </span>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-extrabold text-foreground sm:text-lg">
                              {curso.nombre}
                            </h2>
                            <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              {curso.temas.length} {curso.temas.length === 1 ? "tema" : "temas"}
                            </span>
                            {erroresCurso > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-bold text-destructive">
                                <AlertCircle className="h-3 w-3" />
                                <span>
                                  {erroresCurso}{" "}
                                  {erroresCurso === 1 ? "error pendiente" : "errores pendientes"}
                                </span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Área: {nombreCategoria(obtenerCategoria(curso.id))}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0 min-h-[44px]">
                        {/* Conexión Inter-vistas: Botón para practicar este curso en Inicio */}
                        <button
                          type="button"
                          onClick={(e) => handlePracticarCurso(curso.id, e)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98]"
                          aria-label={`Practicar curso de ${curso.nombre}`}
                        >
                          <Dumbbell className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Practicar este curso</span>
                        </button>

                        <span
                          className={cn(
                            "grid h-9 w-9 place-items-center rounded-lg border border-border bg-muted/50 text-muted-foreground transition-transform duration-200",
                            abierto && "rotate-180 text-primary"
                          )}
                        >
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </div>
                    </div>

                    {/* Despliegue de Temas del Curso */}
                    {abierto && (
                      <div
                        id={panelId}
                        className="border-t border-border/60 bg-muted/20 p-4 sm:p-5 animate-in fade-in-50 duration-200"
                      >
                        <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          <span>Temas oficiales evaluados</span>
                          <span>{curso.temas.length} en total</span>
                        </div>

                        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          {curso.temas.map((t, idx) => {
                            const claveTema = `${curso.id}:${t.id}`;
                            const erroresTema = erroresMap.porTema[claveTema] ?? 0;

                            return (
                              <li
                                key={t.id}
                                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3 text-sm transition-colors hover:border-primary/30"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="text-xs font-bold text-muted-foreground w-5 text-right shrink-0">
                                    {idx + 1}.
                                  </span>
                                  <span
                                    className="font-medium text-foreground truncate"
                                    title={t.nombre}
                                  >
                                    {t.nombre}
                                  </span>
                                </div>

                                {erroresTema > 0 && (
                                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>
                                      {erroresTema} {erroresTema === 1 ? "error" : "errores"}
                                    </span>
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </ResponsiveLayout>
  );
}
