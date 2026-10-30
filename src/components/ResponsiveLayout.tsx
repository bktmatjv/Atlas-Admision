import { ReactNode, useState } from "react";
import { NavLink } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AtlasLogo } from "@/components/AtlasLogo";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { borrarTodo } from "@/integrations/local/almacen";
import { cn } from "@/lib/utils";

interface ResponsiveLayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
}

const enlace = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition-colors",
    isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
  );

/**
 * En Atlas, la barra lateral de toda la app. Aquí la app es solo Admisión: una cabecera con la marca
 * y las dos secciones, y el pie que recuerda dónde se guarda el progreso.
 */
export function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const cliente = useQueryClient();
  const [borrado, setBorrado] = useState(false);
  return (
    // `overflow-x-clip` y no `-hidden`: con `hidden` la barra del examen (sticky, con su reloj) no se pega.
    <div className="flex min-h-screen w-full flex-col overflow-x-clip bg-background">
      <header className="sticky top-0 z-40 border-b border-border/30 bg-card/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-xl dark:shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
        <div className="px-4 md:px-6 lg:px-8"><div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3">
          <NavLink to="/admision" end className="flex items-center gap-2">
            <AtlasLogo size="sm" />
            <span className="text-sm font-extrabold tracking-tight">Atlas <span className="text-primary">Admisión</span></span>
          </NavLink>
          <nav aria-label="Secciones" className="flex items-center gap-1">
            <NavLink to="/admision" end className={enlace}>Inicio</NavLink>
            <NavLink to="/admision/temas" className={enlace}>Temas</NavLink>
          </nav>
        </div></div>
      </header>

      <div className="atlas-pagina flex flex-1 flex-col overflow-x-clip">{children}</div>

      <footer className="border-t border-border/40">
        <div className="px-4 md:px-6 lg:px-8"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 py-4 text-xs text-muted-foreground">
          <p>Tu progreso se guarda en este navegador. Si cambias de dispositivo o borras sus datos, empiezas de cero.</p>
          <AlertDialog>
            <AlertDialogTrigger className="min-h-11 rounded-lg px-3 font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              {borrado ? "Progreso borrado" : "Empezar de cero"}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Borrar todo tu progreso?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se borran tus intentos, tu escuela y tu cuaderno de errores de este navegador. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    borrarTodo();
                    cliente.clear();
                    setBorrado(true);
                    window.location.assign("/admision");
                  }}
                >
                  Borrar todo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div></div>
      </footer>
    </div>
  );
}
