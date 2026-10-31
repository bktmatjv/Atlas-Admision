import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/system/PageHeader";
import { ThemeToggle } from "@/components/system/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { admisionDb, type AreaDeAdmision, type IntentoDeAdmision } from "@/integrations/supabase/admision";
import { leerTabla, escribirTabla } from "@/integrations/local/almacen";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { functionErrorReason } from "@/lib/function-error";
import { CURSOS } from "@/lib/admision/temario";
import { TuCarrera } from "@/components/admision/TuCarrera";
import { CuadernoDeErrores } from "@/components/admision/CuadernoDeErrores";
import { UltimaSemana } from "@/components/admision/UltimaSemana";
import { Progreso } from "@/components/admision/Progreso";
import { Ingresaba } from "@/components/admision/Ingresaba";
import {
  BienvenidaContextual,
  type EstadoContextualEstudiante,
} from "@/components/admision/BienvenidaContextual";
import { MainActionHero } from "@/components/MainActionHero";
import { CardTemasFrecuentes } from "@/components/admision/CardTemasFrecuentes";
import { ExploracionEntrenamiento } from "@/components/admision/ExploracionEntrenamiento";
import { HistorialIntentos } from "@/components/admision/HistorialIntentos";
import { useDatosDeSanMarcos, usePerfilDeAdmision } from "@/hooks/useAdmisionDatos";
import { areaDelExamen } from "@/lib/admision/buscar-escuela";
import { ingresabaDelArea } from "@/lib/admision/ingresaba-del-area";
import { siguientePasoDeAdmision } from "@/lib/admision/siguiente-paso";
import { AREAS_DEL_EXAMEN } from "@/lib/admision/areas";
import { jornadaDe, diasHasta } from "@/lib/admision/ultima-semana";
import { racha } from "@/lib/admision/progreso";
import { diaDeLima } from "@/lib/admision/motor/admision-leitner";

const AREAS = AREAS_DEL_EXAMEN;
const CURSOS_DE_PRACTICA = CURSOS.filter((c) => c.id !== "actitudinal");

/**
 * Portada principal de CALIBRA (/admision):
 * Layout asimétrico de escritorio (2/3 columna principal de entrenamiento + 1/3 barra lateral de seguimiento),
 * con modalidades de entrenamiento colapsables, bienvenida contextual y un único Hero condicional.
 */
export default function Admision() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useAuthUserId();
  const [area, setArea] = useState<AreaDeAdmision>("A");
  const [examenId, setExamenId] = useState("");
  const [cronometrado, setCronometrado] = useState(true);
  const [curso, setCurso] = useState(CURSOS_DE_PRACTICA[0]?.id ?? "");
  const [tema, setTema] = useState("");
  const [n, setN] = useState(10);
  const [verSoluciones, setVerSoluciones] = useState(true);
  const [armando, setArmando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Admisión | CALIBRA";
  }, []);

  const { data: examenes = [] } = useQuery({
    queryKey: ["admision-examenes"],
    queryFn: async () => {
      const { data, error: e } = await admisionDb
        .from("admision_examenes")
        .select("*")
        .order("ciclo", { ascending: false });
      if (e) throw e;
      return data ?? [];
    },
  });

  const { data: intentos = [] } = useQuery({
    queryKey: ["admision-intentos", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error: e } = await admisionDb
        .from("admision_intentos")
        .select("id, modo, tipo, area, filtro, estado, puntaje, informe, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (e) throw e;
      return data ?? [];
    },
  });

  const examenesOrdenados = useMemo(() => examenes, [examenes]);

  // Perfil del estudiante y datos oficiales de San Marcos
  const perfil = usePerfilDeAdmision(userId);
  const datos = useDatosDeSanMarcos(!!userId);
  const escuela = datos.data?.carreras.find((c) => c.id === perfil.data?.carrera_id) ?? null;
  const areaDeSuEscuela = escuela ? areaDelExamen(escuela) : null;

  useEffect(() => {
    if (areaDeSuEscuela) setArea(areaDeSuEscuela);
  }, [areaDeSuEscuela]);

  // «¿Ingresaba?» con su último examen o simulacro completo de su área o proyección de diagnóstico
  const ingresaba = useMemo(() => {
    if (perfil.data?.carrera_id && !escuela) return null;
    return ingresabaDelArea(intentos, areaDeSuEscuela, escuela?.nombre);
  }, [intentos, perfil.data?.carrera_id, escuela, areaDeSuEscuela]);

  const paso = useMemo(() => siguientePasoDeAdmision(intentos), [intentos]);

  // Cálculo de fechas y racha
  const hoy = diaDeLima(new Date());
  const jornada = datos.data ? jornadaDe(datos.data.procesos, area, hoy) : null;
  const diasParaExamen = jornada ? diasHasta(hoy, jornada.fecha) : null;

  const entregados = useMemo(() => intentos.filter((i) => i.estado === "entregado"), [intentos]);
  const r = useMemo(() => racha(entregados.map((i) => i.created_at), hoy), [entregados, hoy]);

  // Determinación del estado contextual del estudiante
  const tieneIntentoBase = useMemo(
    () =>
      intentos.some(
        (i) =>
          i.estado === "entregado" &&
          !i.filtro &&
          ["diagnostico", "simulacro", "real"].includes(i.modo)
      ),
    [intentos]
  );
  const intentoEnCurso = useMemo(
    () => intentos.some((i) => i.estado === "en_curso"),
    [intentos]
  );

  const estadoContextual: EstadoContextualEstudiante = useMemo(() => {
    if (!perfil.data?.carrera_id && intentos.length === 0) return "nuevo";
    if (!tieneIntentoBase && !intentoEnCurso) return "sin_diagnostico";
    return "con_actividad";
  }, [perfil.data?.carrera_id, intentos.length, tieneIntentoBase, intentoEnCurso]);

  const nombreDelArea = AREAS.find((a) => a.id === area)?.nombre ?? area;
  const hayIntentoEnCurso = paso.tipo === "continuar" || intentos.some((i) => i.estado === "en_curso");

  async function armar(clave: string, body: Record<string, unknown>) {
    setArmando(clave);
    setError(null);
    const { data, error: e } = await supabase.functions.invoke("admision-armar", { body });
    setArmando(null);
    if (e) {
      setError(await functionErrorReason(e));
      return;
    }
    navigate(`/admision/intento/${(data as { intento_id: string }).intento_id}`);
  }

  /**
   * Interceptor de Nuevos Intentos (UX Logic):
   * Si ya existe un intento en curso, previene la colisión alertando al estudiante.
   * Si confirma continuar, marca el intento previo como "abandonado" antes de iniciar el nuevo.
   */
  async function iniciarIntentoConValidacion(clave: string, body: Record<string, unknown>) {
    const intentoPendiente = intentos.find((i) => i.estado === "en_curso");
    if (intentoPendiente) {
      const confirma = window.confirm(
        "Tienes una evaluación en curso. Si empiezas una nueva, perderás el progreso de la anterior. ¿Deseas continuar?"
      );
      if (!confirma) {
        return;
      }

      try {
        const guardados = leerTabla<IntentoDeAdmision>("admision_intentos");
        const actualizados = guardados.map((it) =>
          it.id === intentoPendiente.id || it.estado === "en_curso"
            ? { ...it, estado: "abandonado" as const }
            : it
        );
        escribirTabla("admision_intentos", actualizados);
        await queryClient.invalidateQueries({ queryKey: ["admision-intentos"] });
      } catch (err) {
        console.error("Error al actualizar estado del intento anterior:", err);
      }
    }

    await armar(clave, body);
  }

  return (
    <ResponsiveLayout>
      <main className="min-w-0 flex-1 overflow-x-hidden p-4 pb-24 md:p-6 lg:p-8 lg:pb-8">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* 1. Encabezado superior */}
          <PageHeader
            breadcrumb={["CALIBRA", "Admisión"]}
            title="Examen de admisión · San Marcos"
            actions={<ThemeToggle />}
          />

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/5 p-3.5 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          {/* 2. Grid Asimétrico con orden lógico mobile-first:
              Mobile (< 1024px): Hero -> Modalidades -> Accesos Rápidos laterales (abajo) -> Historial.
              Desktop (>= 1024px): 8 columnas izquierda (Hero + Modalidades + Historial) y 4 columnas derecha (Aside). */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Bloque 1: Hero + Modalidades (Mobile: orden 1; Desktop: col 1-8 fila 1) */}
            <div className="order-1 lg:col-span-8 lg:order-1 space-y-6">
              {/* Lógica de Renderizado del Hero (Fusión):
                  SI existe un intento en curso: renderiza SOLO la tarjeta "Retoma tu simulacro".
                  Se elimina el bloque superior genérico ("Continúa con tu plan...").
                  SI NO hay intento en curso: muestra la bienvenida/plan de preparación que invite a usar las modalidades de abajo. */}
              {hayIntentoEnCurso ? (
                <MainActionHero
                  paso={paso}
                  carreraId={perfil.data?.carrera_id}
                  userId={userId}
                  area={area}
                  areaNombre={nombreDelArea}
                  armando={armando}
                  onEmpezar={iniciarIntentoConValidacion}
                />
              ) : (
                <>
                  <BienvenidaContextual
                    estado={estadoContextual}
                    carreraNombre={escuela?.nombre ?? null}
                    areaNombre={nombreDelArea}
                    diasParaExamen={diasParaExamen}
                    cicloExamen={jornada?.ciclo}
                    rachaDias={r.actual}
                  />

                  <MainActionHero
                    paso={paso}
                    carreraId={perfil.data?.carrera_id}
                    userId={userId}
                    area={area}
                    areaNombre={nombreDelArea}
                    armando={armando}
                    onEmpezar={iniciarIntentoConValidacion}
                  />
                </>
              )}

              {/* Modalidades de entrenamiento colapsables */}
              <ExploracionEntrenamiento
                area={area}
                onAreaChange={setArea}
                examenes={examenesOrdenados}
                examenId={examenId}
                onExamenIdChange={setExamenId}
                cronometrado={cronometrado}
                onCronometradoChange={setCronometrado}
                curso={curso}
                onCursoChange={setCurso}
                tema={tema}
                onTemaChange={setTema}
                n={n}
                onNChange={setN}
                verSoluciones={verSoluciones}
                onVerSolucionesChange={setVerSoluciones}
                armando={armando}
                onEmpezar={iniciarIntentoConValidacion}
                esSimulacroPasoRecomendado={paso.tipo === "simulacro"}
              />

              {/* Veredicto de corte ¿Ingresabas? si corresponde */}
              {ingresaba?.tipo === "veredicto" && perfil.data?.carrera_id && (
                <Ingresaba
                  userId={userId}
                  puntaje={ingresaba.puntaje}
                  aviso={ingresaba.aviso}
                  area={ingresaba.area}
                />
              )}
              {ingresaba?.tipo === "falta-area" &&
                (!perfil.data?.universidad || perfil.data.universidad === "unmsm") && (
                <p className="rounded-2xl border border-border bg-card p-5 text-sm font-semibold text-foreground">
                  {ingresaba.texto}
                </p>
              )}
            </div>

            {/* Bloque 2: Accesos Rápidos laterales (Mobile: orden 2; Desktop: col 9-12, ocupando el lateral derecho) */}
            <aside
              className="order-2 lg:col-span-4 lg:order-2 lg:row-span-2 space-y-6"
              aria-label="Seguimiento y apoyo"
            >
              {/* Tu cuaderno de errores (Leitner 1, 3, 7 días) */}
              <CuadernoDeErrores userId={userId} area={area} />

              {/* Temas que más vienen en San Marcos */}
              <CardTemasFrecuentes />

              {/* Racha y progreso (últimos 7 días + percentil OCA) */}
              <Progreso userId={userId} intentos={intentos} />

              {/* Si la carrera ya está configurada y no hay intento en curso, mostrar carrera y calendario */}
              {perfil.data?.carrera_id && !hayIntentoEnCurso && (
                <div className="space-y-4">
                  <TuCarrera userId={userId} />
                  <UltimaSemana userId={userId} area={area} />
                </div>
              )}
            </aside>

            {/* Bloque 3: Historial de Intentos (Mobile: orden 3, al final de la pantalla; Desktop: col 1-8 fila 2) */}
            <div className="order-3 lg:col-span-8 lg:order-3 space-y-6">
              <HistorialIntentos intentos={intentos} />
            </div>
          </div>
        </div>
      </main>
    </ResponsiveLayout>
  );
}
