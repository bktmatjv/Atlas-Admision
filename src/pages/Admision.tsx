import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/system/PageHeader";
import { ThemeToggle } from "@/components/system/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { admisionDb, type AreaDeAdmision } from "@/integrations/supabase/admision";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { functionErrorReason } from "@/lib/function-error";
import { CURSOS } from "@/lib/admision/temario";
import { TuCarrera } from "@/components/admision/TuCarrera";
import { CuadernoDeErrores } from "@/components/admision/CuadernoDeErrores";
import { UltimaSemana } from "@/components/admision/UltimaSemana";
import { Progreso } from "@/components/admision/Progreso";
import { Ingresaba } from "@/components/admision/Ingresaba";
import { useDatosDeSanMarcos, usePerfilDeAdmision } from "@/hooks/useAdmisionDatos";
import { areaDelExamen } from "@/lib/admision/buscar-escuela";
import { ingresabaDelArea } from "@/lib/admision/ingresaba-del-area";
import { siguientePasoDeAdmision } from "@/lib/admision/siguiente-paso";
import { AREAS_DEL_EXAMEN } from "@/lib/admision/areas";

const AREAS = AREAS_DEL_EXAMEN;
const CURSOS_DE_PRACTICA = CURSOS.filter((c) => c.id !== "actitudinal");

const campo = "mt-1 block min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm";
const tarjeta = "space-y-3 rounded-2xl border border-border bg-card p-5";
const boton = "min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60";
// Un solo principal por pantalla (`siguientePasoDeAdmision`): los demás «Empezar», así.
const botonSecundario = "min-h-11 w-full rounded-lg border border-border bg-card px-4 text-sm font-bold text-primary hover:bg-muted disabled:opacity-60";
const NOMBRE_DEL_MODO: Record<string, string> = { diagnostico: "diagnóstico", simulacro: "simulacro", real: "examen", repaso: "repaso" };

/**
 * `/admision`, versión mínima: empezar un examen real, un simulacro o una práctica por curso, y el
 * historial. La portada completa (tarjeta del Inicio, área según la carrera, evolución) es del plan 3.
 */
export default function Admision() {
  const navigate = useNavigate();
  const userId = useAuthUserId();
  const [area, setArea] = useState<AreaDeAdmision>("A");
  const [examenId, setExamenId] = useState("");
  const [cronometrado, setCronometrado] = useState(true);
  const [curso, setCurso] = useState(CURSOS_DE_PRACTICA[0]?.id ?? "");
  // Práctica por tema (tramo 4 de Audix): vacío = todo el curso.
  const [tema, setTema] = useState("");
  const temasDelCurso = CURSOS.find((c) => c.id === curso)?.temas ?? [];
  const [n, setN] = useState(10);
  const [verSoluciones, setVerSoluciones] = useState(true);
  const [armando, setArmando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { document.title = "Admisión | Atlas"; }, []);

  const { data: examenes = [] } = useQuery({
    queryKey: ["admision-examenes"],
    queryFn: async () => {
      const { data, error: e } = await admisionDb.from("admision_examenes").select("*").order("ciclo", { ascending: false });
      if (e) throw e;
      return data ?? [];
    },
  });
  const { data: intentos = [] } = useQuery({
    queryKey: ["admision-intentos", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error: e } = await admisionDb.from("admision_intentos")
        .select("id, modo, tipo, area, filtro, estado, puntaje, informe, created_at").order("created_at", { ascending: false }).limit(20);
      if (e) throw e;
      return data ?? [];
    },
  });
  const examenesOrdenados = useMemo(() => examenes, [examenes]);

  // El área del simulacro sale de su escuela (Medicina Humana rinde su propio examen); se puede cambiar.
  const perfil = usePerfilDeAdmision(userId);
  const datos = useDatosDeSanMarcos(!!userId);
  const escuela = datos.data?.carreras.find((c) => c.id === perfil.data?.carrera_id) ?? null;
  const areaDeSuEscuela = escuela ? areaDelExamen(escuela) : null;
  useEffect(() => { if (areaDeSuEscuela) setArea(areaDeSuEscuela); }, [areaDeSuEscuela]);
  // «¿Ingresaba?» con su último examen o simulacro completo de SU área, o con la proyección de su último
  // diagnóstico. Mientras no se sabe su escuela, nada: no vale el veredicto de otra área.
  const ingresaba = useMemo(() => {
    if (perfil.data?.carrera_id && !escuela) return null;
    return ingresabaDelArea(intentos, areaDeSuEscuela, escuela?.nombre);
  }, [intentos, perfil.data?.carrera_id, escuela, areaDeSuEscuela]);

  const paso = useMemo(() => siguientePasoDeAdmision(intentos), [intentos]);

  async function armar(clave: string, body: Record<string, unknown>) {
    setArmando(clave);
    setError(null);
    const { data, error: e } = await supabase.functions.invoke("admision-armar", { body });
    setArmando(null);
    if (e) { setError(await functionErrorReason(e)); return; }
    navigate(`/admision/intento/${(data as { intento_id: string }).intento_id}`);
  }

  return (
    <ResponsiveLayout>
      <main className="min-w-0 flex-1 p-4 pb-24 md:p-6 lg:p-8 lg:pb-8">
        <div className="mx-auto max-w-5xl space-y-5">
          <PageHeader breadcrumb={["Atlas", "Admisión"]} title="Examen de admisión · San Marcos" actions={<ThemeToggle />} />
          {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}

          <TuCarrera userId={userId} />
          <UltimaSemana userId={userId} area={area} />
          <CuadernoDeErrores userId={userId} area={area} />
          <nav aria-label="Más de Admisión" className="flex flex-wrap gap-2">
            <Link to="/admision/temas" className="flex min-h-11 items-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-primary hover:bg-muted">
              Temas que más vienen
            </Link>
          </nav>
          {ingresaba?.tipo === "veredicto" && perfil.data?.carrera_id && (
            <Ingresaba userId={userId} puntaje={ingresaba.puntaje} aviso={ingresaba.aviso} area={ingresaba.area} />
          )}
          {ingresaba?.tipo === "falta-area" && (!perfil.data?.universidad || perfil.data.universidad === "unmsm") && (
            <p className="rounded-2xl border border-border bg-card p-5 text-sm font-semibold text-foreground">{ingresaba.texto}</p>
          )}
          <Progreso userId={userId} intentos={intentos} />

          {paso.tipo === "continuar" && (
            <section aria-labelledby="t-a-medias" className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/40 bg-card p-5">
              <div className="min-w-0 flex-1">
                <h2 id="t-a-medias" className="text-lg font-extrabold">Tienes un {NOMBRE_DEL_MODO[paso.modo] ?? "intento"} a medias</h2>
                <p className="text-sm text-muted-foreground">Termínalo antes de empezar otro: así su puntaje cuenta para «¿Ingresaba?» y tu progreso.</p>
              </div>
              <Link to={`/admision/intento/${paso.intentoId}`} className={`${boton} flex items-center justify-center sm:w-auto`}>Seguir donde lo dejaste</Link>
            </section>
          )}

          <section aria-labelledby="t-diagnostico" className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-5">
            <div className="min-w-0 flex-1">
              <h2 id="t-diagnostico" className="text-lg font-extrabold">Diagnóstico · 30 preguntas en 30 minutos</h2>
              <p className="text-sm text-muted-foreground">Con el peso de cada curso en tu área. Al terminar, tu puntaje estimado, si ingresabas y por dónde empezar.</p>
            </div>
            <button type="button" className={`${paso.tipo === "diagnostico" ? boton : botonSecundario} sm:w-auto`} disabled={armando !== null}
              onClick={() => void armar("diagnostico", { modo: "diagnostico", area })}>
              {armando === "diagnostico" ? "Preparando…" : "Empezar diagnóstico"}
            </button>
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            <section className={tarjeta} aria-labelledby="t-real">
              <h2 id="t-real" className="text-lg font-extrabold">Examen real</h2>
              <p className="text-sm text-muted-foreground">Un examen pasado, tal cual, con su tiempo.</p>
              <label className="block text-sm font-semibold">Examen
                <select className={campo} value={examenId} onChange={(e) => setExamenId(e.target.value)}>
                  <option value="">Elige uno</option>
                  {examenesOrdenados.map((x) => (
                    <option key={x.id} value={x.id}>{x.ciclo} · {AREAS.find((a) => a.id === x.area)?.nombre ?? x.area}</option>
                  ))}
                </select>
              </label>
              <button type="button" className={botonSecundario} disabled={!examenId || armando !== null}
                onClick={() => void armar("real", { modo: "real", examen_id: examenId, tipo: "cronometrado" })}>
                {armando === "real" ? "Preparando…" : "Empezar"}
              </button>
            </section>

            <section className={tarjeta} aria-labelledby="t-simulacro">
              <h2 id="t-simulacro" className="text-lg font-extrabold">Simulacro nuevo</h2>
              <p className="text-sm text-muted-foreground">Preguntas reales mezcladas con el molde de tu área; primero las que no has visto.</p>
              <label className="block text-sm font-semibold">Área
                <select className={campo} value={area} onChange={(e) => setArea(e.target.value as AreaDeAdmision)}>
                  {AREAS.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={cronometrado} onChange={(e) => setCronometrado(e.target.checked)} className="h-4 w-4" />
                Con el tiempo del examen
              </label>
              <button type="button" className={paso.tipo === "simulacro" ? boton : botonSecundario} disabled={armando !== null}
                onClick={() => void armar("simulacro", { modo: "simulacro", area, tipo: cronometrado ? "cronometrado" : "practica" })}>
                {armando === "simulacro" ? "Preparando…" : "Empezar"}
              </button>
            </section>

            <section className={tarjeta} aria-labelledby="t-practica">
              <h2 id="t-practica" className="text-lg font-extrabold">Practicar un curso o un tema</h2>
              <p className="text-sm text-muted-foreground">Sin reloj. Puedes ver la solución después de cada pregunta.</p>
              <label className="block text-sm font-semibold">Curso
                <select className={campo} value={curso} onChange={(e) => { setCurso(e.target.value); setTema(""); }}>
                  {CURSOS_DE_PRACTICA.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold">Tema
                <select className={campo} value={tema} onChange={(e) => setTema(e.target.value)}>
                  <option value="">Todo el curso</option>
                  {temasDelCurso.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold">Preguntas
                <input type="number" min={1} max={50} value={n} onChange={(e) => setN(Number(e.target.value) || 10)} className={campo} />
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={verSoluciones} onChange={(e) => setVerSoluciones(e.target.checked)} className="h-4 w-4" />
                Ver la solución tras cada pregunta
              </label>
              <button type="button" className={botonSecundario} disabled={armando !== null}
                onClick={() => void armar("practica", { modo: "practica", area, curso, ...(tema ? { tema } : {}), n, ver_soluciones: verSoluciones })}>
                {armando === "practica" ? "Preparando…" : "Empezar"}
              </button>
            </section>
          </div>

          <section aria-labelledby="t-historial" className="space-y-2">
            <h2 id="t-historial" className="text-lg font-extrabold">Tus intentos</h2>
            {intentos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no has hecho ninguno.</p>
            ) : (
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                {intentos.map((i) => (
                  <li key={i.id}>
                    <Link to={`/admision/intento/${i.id}`} className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-4 py-2 hover:bg-muted">
                      <span className="font-semibold">
                        {i.modo === "real" ? "Examen real" : i.modo === "repaso" ? "Repaso del cuaderno" : i.modo === "diagnostico" ? "Diagnóstico" : i.filtro ? `Práctica · ${CURSOS.find((c) => c.id === i.filtro?.curso)?.nombre ?? ""}` : "Simulacro"}
                        {" · "}{AREAS.find((a) => a.id === i.area)?.nombre ?? i.area}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {i.estado === "en_curso" ? "En curso" : `${(i.puntaje ?? 0).toLocaleString("es", { maximumFractionDigits: 3 })} / ${i.informe?.maximo ?? "—"}`}
                        {" · "}{new Date(i.created_at).toLocaleDateString("es-PE")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </ResponsiveLayout>
  );
}
