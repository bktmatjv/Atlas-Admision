import type { ReactNode } from "react";
import { Clock, CloudOff, Send } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatCountdown } from "@/lib/school/exam-time";
import { cn } from "@/lib/utils";

interface Resumen { respondidas: number; blancos: number; marcadas: number }

/**
 * La pregunta antes de entregar, diciendo cuántas quedan en blanco (spec §3). La usan la barra y el
 * botón de la última pregunta, que abren el mismo diálogo.
 */
export function ConfirmarEntrega({ resumen, onEntregar, children }: { resumen: Resumen; onEntregar: () => void; children: ReactNode }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Entregar el examen?</AlertDialogTitle>
          <AlertDialogDescription>
            Respondiste {resumen.respondidas}. {resumen.blancos > 0 ? `Te quedan ${resumen.blancos} en blanco` : "No te queda ninguna en blanco"}
            {resumen.marcadas > 0 ? ` y ${resumen.marcadas} marcadas para revisar` : ""}. Después de entregar ya no podrás cambiar nada.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Seguir respondiendo</AlertDialogCancel>
          <AlertDialogAction onClick={onEntregar}>Entregar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Arriba del examen: el reloj (del servidor), lo que falta por enviar si no hay conexión y el botón de
 * entregar, que antes pregunta diciendo cuántas quedan en blanco (spec §3).
 */
export function BarraDelIntento({ titulo, restante, resumen, pendientes, entregando, onEntregar }: {
  titulo: string;
  restante: number | null;
  resumen: Resumen;
  pendientes: number;
  entregando: boolean;
  onEntregar: () => void;
}) {
  const apurado = restante !== null && restante < 5 * 60_000;
  return (
    // `top-14`: en móvil, debajo de la cabecera «Calibra» (h-14), que también se pega arriba.
    <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6 lg:top-0">
      {/* En móvil, su propia fila (con el reloj y el botón al lado, un `truncate` dejaba «Simul…»); desde sm, al lado. */}
      <p className="line-clamp-2 min-w-0 basis-full font-bold text-foreground sm:basis-0 sm:flex-1">{titulo}</p>
      {pendientes > 0 && (
        <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground" role="status">
          <CloudOff className="h-4 w-4" aria-hidden /> {pendientes} sin enviar
        </span>
      )}
      {restante !== null && (
        <span
          role="timer"
          aria-label={`Tiempo restante ${formatCountdown(restante)}`}
          className={cn("flex items-center gap-1.5 font-mono text-base font-bold tabular-nums", apurado ? "text-destructive" : "text-foreground")}
        >
          <Clock className="h-4 w-4" aria-hidden /> {formatCountdown(restante)}
        </span>
      )}
      <ConfirmarEntrega resumen={resumen} onEntregar={onEntregar}>
        <button type="button" disabled={entregando} className="arc-boton arc-boton-primario flex h-11 items-center gap-2 px-4 text-sm disabled:opacity-60">
          <Send className="h-4 w-4" aria-hidden /> {entregando ? "Entregando…" : "Entregar"}
        </button>
      </ConfirmarEntrega>
    </div>
  );
}
