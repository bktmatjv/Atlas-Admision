import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ensureSession, post, resetSession } from "@/integrations/api/client";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { ContextoAcceso, type CuentaActual, type VistaAcceso } from "./contexto";
import { CuentaForm, GuardarCodigo, type RespuestaCuenta } from "./CuentaForm";

/** Ingreso, registro y recuperación de cuenta. Sin cuenta, la app funciona igual que antes (invitado). */
export function EntradaGate({ children }: { children: ReactNode }) {
  const actor = useAuthUserId(), cliente = useQueryClient();
  const cuenta = useQuery({ queryKey: ["cuenta", actor], enabled: !!actor, queryFn: () => api<CuentaActual>("/cuenta"), staleTime: Infinity });
  const [vista, abrir] = useState<VistaAcceso>("auto"), [codigo, setCodigo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false), [error, setError] = useState("");
  function cambiarCuenta(c: RespuestaCuenta) {
    // Las consultas privadas anteriores se destruyen, no solo se invalidan.
    resetSession(c.actorId); cliente.clear();
    cliente.setQueryData(["sesion"], { actorId: c.actorId });
    cliente.setQueryData(["cuenta", c.actorId], { actorId: c.actorId, usuario: c.usuario });
    setCodigo(c.codigo_recuperacion ?? null); abrir("auto");
  }
  async function salir() {
    setOcupado(true); setError("");
    try {
      await post("/cuenta/salida", {});
      resetSession(); cliente.clear();
      cliente.setQueryData(["sesion"], await ensureSession());
      window.location.assign("/");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo salir. Reintenta."); }
    finally { setOcupado(false); }
  }
  let pantalla: ReactNode;
  if (codigo) pantalla = <GuardarCodigo codigo={codigo} confirmar={() => setCodigo(null)} />;
  else if (vista !== "auto") pantalla = <CuentaForm key={vista} modo={vista} abrir={abrir} completar={cambiarCuenta} />;
  else pantalla = children;
  return (
    <ContextoAcceso.Provider value={{ cuenta: cuenta.data ?? { actorId: actor ?? "", usuario: null }, abrir, salir, ocupado }}>
      {error && <p role="alert" className="bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
      {pantalla}
    </ContextoAcceso.Provider>
  );
}
