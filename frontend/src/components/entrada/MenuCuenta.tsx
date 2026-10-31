import { UserRound } from "lucide-react";
import { useAcceso } from "./contexto";
const boton =
  "min-h-11 rounded-lg px-3 text-sm font-bold focus-visible:ring-2 focus-visible:ring-primary";
const resumen =
  "flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-border px-3 text-sm font-bold focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden";
const panel =
  "absolute right-0 top-full z-50 mt-2 grid w-48 rounded-xl border border-border bg-card p-2 shadow-xl";
const item =
  "min-h-11 rounded-lg px-3 text-left text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary";
export function MenuCuenta() {
  const acceso = useAcceso();
  if (!acceso) return null;
  if (!acceso.cuenta.usuario)
    return (
      <>
        {/* Anchos chicos: un solo menú, para que la cabecera no desborde ni se solape con el tema. */}
        <details className="relative shrink-0 sm:hidden">
          <summary className={resumen} aria-label="Cuenta">
            <UserRound size={18} aria-hidden="true" />
            Cuenta
          </summary>
          <div className={panel}>
            <button className={item} onClick={() => acceso.abrir("ingreso")}>
              Ingresar
            </button>
            <button className={item} onClick={() => acceso.abrir("registro")}>
              Crear cuenta
            </button>
          </div>
        </details>
        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          <button className={boton} onClick={() => acceso.abrir("ingreso")}>
            Ingresar
          </button>
          <button
            className={`${boton} border border-border`}
            onClick={() => acceso.abrir("registro")}
          >
            Crear cuenta
          </button>
        </div>
      </>
    );
  return (
    <details className="relative shrink-0">
      <summary
        className={`${resumen} max-w-40`}
        aria-label={`Cuenta de ${acceso.cuenta.usuario}`}
      >
        <span className="truncate">{acceso.cuenta.usuario}</span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className={panel}>
        <button
          className={item}
          disabled={acceso.ocupado}
          onClick={() => void acceso.salir()}
        >
          {acceso.ocupado ? "Saliendo…" : "Salir"}
        </button>
      </div>
    </details>
  );
}
