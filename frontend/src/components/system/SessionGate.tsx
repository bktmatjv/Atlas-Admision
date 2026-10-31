import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ensureSession } from "@/integrations/api/client";

export function SessionGate({ children }: { children: ReactNode }) {
  const session = useQuery({
    queryKey: ["sesion"],
    queryFn: ensureSession,
    staleTime: Infinity,
    retry: false,
  });
  const health = useQuery({
    queryKey: ["salud"],
    queryFn: () => api<{ ia: string; pruebas: boolean }>("/salud"),
    enabled: session.isSuccess,
    staleTime: 30000,
  });

  // =========================================================================
  // BYPASS TEMPORAL DE SESIÓN:
  // Permite la previsualización del rediseño UX/UI sin requerir el backend
  // activo en el puerto 3000. Para restaurar el bloqueo estricto de producción,
  // descomentar los bloques if (session.isPending) e if (session.isError).
  // =========================================================================
  /*
  if (session.isPending)
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground">
        <p role="status">Preparando tu espacio de aprendizaje…</p>
      </main>
    );
  if (session.isError)
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
        <section className="max-w-lg space-y-4 rounded-2xl border bg-card p-8">
          <h1 className="text-2xl font-bold">No pudimos conectar con Atlas</h1>
          <p role="alert">{session.error.message}</p>
          <p className="text-sm text-muted-foreground">
            El progreso del servidor no se sustituirá por una demo local.
          </p>
          <button
            className="min-h-11 rounded-lg bg-primary px-5 font-bold text-primary-foreground"
            onClick={() => void session.refetch()}
          >
            Reintentar conexión
          </button>
        </section>
      </main>
    );
  */

  return (
    <>
      {health.data?.pruebas && (
        <p
          role="status"
          className="bg-amber-100 p-3 text-center text-sm font-bold text-amber-950"
        >
          ENTORNO DE PRUEBAS: respuestas fijas para verificar el sistema, no IA
          real.
        </p>
      )}
      {health.data?.ia === "disabled" && (
        <p role="status" className="bg-muted p-3 text-center text-sm">
          Práctica disponible · El tutor necesita credenciales de IA en el
          servidor.
        </p>
      )}
      {children}
    </>
  );
}
