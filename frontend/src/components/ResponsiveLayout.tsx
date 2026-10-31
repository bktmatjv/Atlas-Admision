import { ReactNode, useState } from "react";
import { NavLink } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CalibraBrand } from "@/components/brand/CalibraBrand";
import { CalibraGeckoCompanion } from "@/components/companion/CalibraGeckoCompanion";
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
import { MenuCuenta } from "@/components/entrada/MenuCuenta";

interface ResponsiveLayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
  appearance?: "default" | "tutor";
  headerTools?: ReactNode;
}

const enlace = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition-colors",
    isActive
      ? "bg-muted text-foreground"
      : "text-muted-foreground hover:text-foreground",
  );

/**
 * En CALIBRA, la barra lateral de toda la app. Aquí la app es solo Admisión: una cabecera con la marca
 * y las dos secciones, y el pie que recuerda dónde se guarda el progreso.
 */
export function ResponsiveLayout({
  children,
  appearance = "default",
  headerTools,
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
      <header className="sticky top-0 z-40 border-b border-border/30 bg-card/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-xl dark:shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
        <div className="px-4 md:px-6 lg:px-8">
          <div
            className={
              tutorMode
                ? "tutor-header-row mx-auto flex max-w-[1600px] items-center"
                : "mx-auto flex h-14 max-w-5xl items-center justify-between gap-3"
            }
          >
            <NavLink
              to="/admision"
              end
              className={cn(
                "flex items-center",
                tutorMode && "tutor-header-brand",
              )}
            >
              <CalibraBrand
                size={tutorMode ? "md" : "sm"}
                subtitle={tutorMode ? undefined : "Admisión"}
                textClassName={
                  tutorMode ? "text-xl font-semibold tracking-wide" : undefined
                }
              />
            </NavLink>
            <nav aria-label="Secciones" className="flex items-center gap-1">
              <NavLink to="/tutor" className={enlace}>
                Tutor
              </NavLink>
              <NavLink to="/aprender" className={enlace}>
                Aprender
              </NavLink>
              <NavLink to="/cursos" className={enlace}>
                Mis cursos
              </NavLink>
              <NavLink to="/admision" end className={enlace}>
                Admisión
              </NavLink>
              <NavLink to="/admision/temas" className={enlace}>
                Temas
              </NavLink>
            </nav>
            <MenuCuenta />
            {headerTools && (
              <div className="tutor-header-tools">{headerTools}</div>
            )}
          </div>
        </div>
      </header>

      <div className="atlas-pagina flex flex-1 flex-col overflow-x-clip">
        {children}
      </div>

      {/* El tutor ya tiene avatar: la mascota flotante no debe tapar el chat ni la hoja móvil. */}
      {!tutorMode && <CalibraGeckoCompanion />}

      <footer className="border-t border-border/40 bg-card/20">
        <div className="px-4 md:px-6 lg:px-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <AlertDialog>
              <p className="max-w-md text-xs text-muted-foreground leading-relaxed">
                Tu progreso se guarda en este navegador. Si cambias de
                dispositivo o borras sus datos,{" "}
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    className="font-bold text-foreground underline underline-offset-4 decoration-primary/60 hover:text-primary hover:decoration-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-0.5 inline cursor-pointer"
                  >
                    {borrando
                      ? "eliminando…"
                      : borrado
                        ? "progreso borrado"
                        : "empiezas de cero"}
                  </button>
                </AlertDialogTrigger>
                .
              </p>
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Borrar todo tu progreso?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se borran tus intentos, tu carrera y tu cuaderno de errores
                    de este navegador. No se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={borrando}
                    onClick={() => void borrar()}
                  >
                    Borrar todo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Identidad de marca CALIBRA destacando el logotipo oficial sobre la tipografía */}
            <div className="flex items-center gap-3 sm:justify-end">
              <CalibraBrand
                size="xl"
                tagline="APRENDE A PENSAR"
                className="select-none"
                isotypeClassName="h-14 w-14 sm:h-16 sm:w-16"
                textClassName="text-sm sm:text-base font-bold tracking-[0.16em] text-foreground/90"
                taglineClassName="text-[0.6rem] sm:text-[0.66rem] font-semibold tracking-[0.18em] text-primary"
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
