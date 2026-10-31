import { ReactNode, useState } from "react";
import { NavLink } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { FolderOpen, Home, ListChecks, MessageCircle, Moon, Network, Sun } from "lucide-react";
import { CalibraBrand } from "@/components/brand/CalibraBrand";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { borrarTodo } from "@/integrations/local/almacen";
import { api } from "@/integrations/api/client";
import { cn } from "@/lib/utils";

interface ResponsiveLayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
  appearance?: "default" | "tutor";
  headerTools?: ReactNode;
  /** Oculta la barra inferior del móvil: el examen y el tutor tienen sus propios controles abajo. */
  sinBarraInferior?: boolean;
}

const SECCIONES = [
  { to: "/admision", end: true, label: "Inicio", Icon: Home },
  { to: "/admision/temas", end: false, label: "Temario", Icon: ListChecks },
  { to: "/tutor", end: false, label: "Tutor", Icon: MessageCircle },
  { to: "/aprender", end: false, label: "Explorar", Icon: Network },
  { to: "/cursos", end: false, label: "Mis apuntes", corto: "Apuntes", Icon: FolderOpen },
] as const;

const enlace = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative flex items-center px-3 text-[0.9375rem] font-semibold transition-colors",
    "after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-sm after:transition-colors",
    "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ambar",
    isActive ? "text-white after:bg-ambar" : "text-white/70 after:bg-transparent hover:text-white",
  );

const enlaceCompacto = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex min-h-9 items-center justify-center rounded-md px-1 text-center text-[0.8125rem] font-semibold leading-tight",
    isActive ? "bg-white/15 text-white" : "text-white/75",
  );

const pestana = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold transition-colors",
    "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
    isActive ? "text-primary" : "text-muted-foreground",
  );

/** Cambia entre claro y oscuro desde la cabecera, en toda la app. */
function BotonTema() {
  const { resolvedTheme, setTheme } = useTheme();
  const oscuro = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(oscuro ? "light" : "dark")}
      aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={oscuro ? "Modo claro" : "Modo oscuro"}
      className="grid h-10 w-10 place-items-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ambar"
    >
      {oscuro ? <Sun className="h-[18px] w-[18px]" aria-hidden="true" /> : <Moon className="h-[18px] w-[18px]" aria-hidden="true" />}
    </button>
  );
}

/**
 * La cáscara de toda la app: barra superior verde cancha con la marca y las cinco secciones,
 * pestañas abajo en el móvil y un pie corto que recuerda dónde vive el progreso.
 */
export function ResponsiveLayout({
  children,
  appearance = "default",
  headerTools,
  sinBarraInferior = false,
}: ResponsiveLayoutProps) {
  const tutorMode = appearance === "tutor";
  const cliente = useQueryClient();
  const [borrado, setBorrado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  async function borrar() {
    setBorrando(true);
    setError(null);
    try {
      borrarTodo();
      try {
        const cursos = await api<{ id: string }[]>("/cursos");
        for (const c of cursos) {
          const curso = await api<{ documentos: { id: string }[] }>(
            `/cursos/${c.id}`,
          );
          for (const d of curso.documentos)
            await api(`/documentos/${d.id}`, { method: "DELETE" });
        }
        await api("/sesion", { method: "DELETE" });
      } catch {
        // En modo local o si no hay conexión a API, el borrado local se mantiene efectivo
      }
      cliente.clear();
      setBorrado(true);
      window.location.assign("/admision");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron eliminar los datos.",
      );
    } finally {
      setBorrando(false);
    }
  }
  return (
    // `overflow-x-clip` y no `-hidden`: con `hidden` la barra del examen (sticky, con su reloj) no se pega.
    <div
      className={cn(
        "flex min-h-screen w-full flex-col overflow-x-clip bg-background text-foreground",
        tutorMode && "tutor-layout",
      )}
    >
      <header className="atlas-cabecera sticky top-0 z-40 bg-cancha text-white dark:border-b dark:border-white/10">
        <div className="mx-auto flex h-14 max-w-6xl items-stretch gap-3 px-4 md:gap-6 md:px-6">
          <NavLink
            to="/admision"
            end
            aria-label="CALIBRA, inicio"
            className="flex shrink-0 items-center self-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ambar"
          >
            <CalibraBrand size="sm" />
          </NavLink>
          <nav aria-label="Secciones" className="hidden items-stretch md:flex">
            {SECCIONES.map(({ to, end, label }) => (
              <NavLink key={to} to={to} end={end} className={enlace}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {headerTools && <div className="tutor-header-tools">{headerTools}</div>}
            <BotonTema />
          </div>
        </div>
        {sinBarraInferior && (
          <nav aria-label="Secciones" className="grid grid-cols-5 gap-1 px-2 pb-2 md:hidden">
            {SECCIONES.map((sec) => (
              <NavLink key={sec.to} to={sec.to} end={sec.end} className={enlaceCompacto} aria-label={sec.label}>
                {"corto" in sec ? sec.corto : sec.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <div className="atlas-pagina flex flex-1 flex-col overflow-x-clip">
        {children}
      </div>

      {!sinBarraInferior && (
        <nav
          aria-label="Secciones"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {SECCIONES.map((sec) => (
            <NavLink key={sec.to} to={sec.to} end={sec.end} className={pestana} aria-label={sec.label}>
              <sec.Icon className="h-5 w-5" aria-hidden="true" />
              <span>{"corto" in sec ? sec.corto : sec.label}</span>
            </NavLink>
          ))}
        </nav>
      )}

      <footer className={cn("border-t border-border", !sinBarraInferior && "mb-16 md:mb-0")}>
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <AlertDialog>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Tu progreso se guarda en este navegador. Si cambias de dispositivo o borras sus datos,{" "}
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="inline rounded font-semibold text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {borrando ? "eliminando…" : borrado ? "progreso borrado" : "empiezas de cero"}
                </button>
              </AlertDialogTrigger>
              .
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Borrar todo tu progreso?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se borran tus intentos, tu carrera y tu cuaderno de errores de este navegador. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction disabled={borrando} onClick={() => void borrar()}>
                  Borrar todo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <p className="font-display text-lg font-bold uppercase tracking-[0.04em] text-muted-foreground">
            Calibra · Aprende a pensar
          </p>
        </div>
      </footer>
    </div>
  );
}
