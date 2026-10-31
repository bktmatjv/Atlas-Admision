import { useAcceso } from "./contexto";
const boton = "min-h-11 rounded-lg px-3 text-sm font-bold focus-visible:ring-2 focus-visible:ring-primary";
export function MenuCuenta() {
  const acceso = useAcceso();
  if (!acceso) return null;
  if (!acceso.cuenta.usuario)
    return (
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button className={boton} onClick={() => acceso.abrir("ingreso")}>Ingresar</button>
        <button className={`${boton} border border-border`} onClick={() => acceso.abrir("registro")}>Crear cuenta</button>
      </div>
    );
  return (
    <details className="relative ml-auto shrink-0">
      <summary className="flex min-h-11 max-w-40 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm font-bold focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Cuenta de ${acceso.cuenta.usuario}`}>
        <span className="truncate">{acceso.cuenta.usuario}</span><span aria-hidden="true">⌄</span>
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 grid w-44 rounded-xl border border-border bg-card p-2 shadow-xl">
        <button className="min-h-11 rounded-lg px-3 text-left text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary" disabled={acceso.ocupado} onClick={() => void acceso.salir()}>
          {acceso.ocupado ? "Saliendo…" : "Salir"}
        </button>
      </div>
    </details>
  );
}
