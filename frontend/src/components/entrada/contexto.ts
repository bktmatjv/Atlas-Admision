import { createContext, useContext } from "react";
export type CuentaActual = { actorId: string; usuario: string | null };
export type VistaAcceso = "auto" | "ingreso" | "registro" | "recuperar";
export const ContextoAcceso = createContext<{
  cuenta: CuentaActual;
  abrir: (vista: VistaAcceso) => void;
  salir: () => Promise<void>;
  ocupado: boolean;
} | null>(null);
export const useAcceso = () => useContext(ContextoAcceso);
