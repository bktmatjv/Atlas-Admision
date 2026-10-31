import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FolderOpen, FolderPlus } from "lucide-react";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { useDatosDeSanMarcos, usePerfilDeAdmision } from "@/hooks/useAdmisionDatos";
import { areaDelExamen } from "@/lib/admision/buscar-escuela";
import { AREAS_DEL_EXAMEN } from "@/lib/admision/areas";
import { moldeDe } from "@/lib/admision/motor/admision-molde";
import { CURSOS } from "@/lib/admision/temario";
import { mismoCurso } from "@/lib/admision/mismo-curso";

export interface CursoPersonal {
  id: string;
  titulo: string;
}

/**
 * Los cursos que el postulante rinde en su área, ordenados por cuántas preguntas valen en su
 * examen. Cada uno tiene su carpeta de apuntes: la primera vez que la abre se crea como curso
 * personal con el nombre oficial, así que no hace falta un modelo nuevo en el servidor.
 */
export function CursosDeMiArea({
  personales,
  onAbrir,
  creando,
}: {
  personales: CursoPersonal[];
  onAbrir: (nombre: string, existente: CursoPersonal | undefined) => void;
  creando: boolean;
}) {
  const userId = useAuthUserId();
  const perfil = usePerfilDeAdmision(userId);
  const datos = useDatosDeSanMarcos(!!userId);
  const escuela = datos.data?.carreras.find((c) => c.id === perfil.data?.carrera_id) ?? null;
  const area = escuela ? areaDelExamen(escuela) : null;
  const [pulsado, setPulsado] = useState<string | null>(null);

  const cursos = area
    ? moldeDe(area)
        .filter((h) => h.curso !== "actitudinal")
        .sort((a, b) => b.preguntas - a.preguntas)
        .map((h) => ({ id: h.curso, nombre: CURSOS.find((c) => c.id === h.curso)?.nombre ?? h.curso, preguntas: h.preguntas as number | null }))
    : CURSOS.filter((c) => c.id !== "actitudinal").map((c) => ({ id: c.id, nombre: c.nombre, preguntas: null as number | null }));
  const nombreArea = area ? AREAS_DEL_EXAMEN.find((a) => a.id === area)?.nombre ?? area : null;

  return (
    <section aria-labelledby="mis-cursos-sm" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="mis-cursos-sm" className="font-display text-[1.75rem] font-extrabold uppercase leading-none text-foreground">
            Tus cursos para San Marcos
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {escuela
              ? `${escuela.nombre} · ${nombreArea}. Ordenados por cuántas preguntas valen en tu examen.`
              : "Aún no eligiste carrera, así que ves todos los cursos del examen."}
          </p>
        </div>
        {!escuela && (
          <Link to="/admision" className="text-sm font-semibold text-primary underline underline-offset-4">
            Elegir mi carrera
          </Link>
        )}
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
        {cursos.map((c) => {
          const existente = personales.find((p) => mismoCurso(p.titulo, c.nombre));
          const ocupado = creando && pulsado === c.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={creando}
                onClick={() => {
                  setPulsado(c.id);
                  onAbrir(c.nombre, existente);
                }}
                className="group flex min-h-16 w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/60 disabled:cursor-wait focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5"
              >
                {c.preguntas !== null && (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-grafito font-display text-2xl font-extrabold tabular-nums text-ambar" aria-hidden="true">
                    {c.preguntas}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">{c.nombre}</span>
                  <span className="block text-sm text-muted-foreground">
                    {c.preguntas !== null ? `${c.preguntas} ${c.preguntas === 1 ? "pregunta" : "preguntas"} en tu examen · ` : ""}
                    {existente ? "Ya tienes su carpeta" : "Sin apuntes todavía"}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary">
                  {ocupado ? (
                    "Abriendo…"
                  ) : existente ? (
                    <>
                      <FolderOpen className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Abrir</span>
                    </>
                  ) : (
                    <>
                      <FolderPlus className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Añadir apuntes</span>
                    </>
                  )}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
