import { useState, type FormEvent } from "react";
import { post } from "@/integrations/api/client";
import { EntradaFrame } from "./EntradaFrame";
import type { CuentaActual, VistaAcceso } from "./contexto";
export type RespuestaCuenta = CuentaActual & { codigo_recuperacion?: string };
export function CuentaForm({ modo, abrir, completar }: { modo: "ingreso" | "registro" | "recuperar"; abrir: (v: VistaAcceso) => void; completar: (c: RespuestaCuenta) => void }) {
  const [usuario, setUsuario] = useState(""), [contrasena, setContrasena] = useState(""), [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false), [error, setError] = useState("");
  const titulo = modo === "registro" ? "Crea tu cuenta" : modo === "recuperar" ? "Recupera tu cuenta" : "Qué bueno verte de nuevo";
  async function enviar(e: FormEvent) {
    e.preventDefault(); setOcupado(true); setError("");
    try {
      const r = await post<RespuestaCuenta>(`/cuenta/${modo}`, { usuario, contrasena, ...(modo === "recuperar" ? { codigo: codigo.trim() } : {}) });
      setContrasena(""); setCodigo(""); completar(r);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar. Reintenta."); }
    finally { setOcupado(false); }
  }
  return <EntradaFrame titulo={titulo}><p className="mb-6 text-sm leading-relaxed text-muted-foreground">{modo === "registro" ? "Conservas todo lo que hiciste como invitado. Solo necesitas un alias y una contraseña: no pedimos correo ni datos personales." : modo === "recuperar" ? "Usa el código que guardaste. Se cerrarán tus sesiones anteriores y recibirás un código nuevo." : "Continúa donde te quedaste, desde cualquier dispositivo. Si estabas como invitado, ese progreso no se combina con otra cuenta."}</p><form onSubmit={e => void enviar(e)} className="space-y-5"><fieldset disabled={ocupado} className="space-y-5"><div><label htmlFor="usuario">Usuario</label><input id="usuario" aria-invalid={error ? true : undefined} name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={30} pattern="[a-z0-9_.]{3,30}" required value={usuario} onChange={e => setUsuario(e.target.value.toLowerCase())} aria-describedby={`usuario-ayuda${error ? " cuenta-error" : ""}`} /><p id="usuario-ayuda" className="mt-2 text-xs text-muted-foreground">3–30 letras minúsculas, números, puntos o guiones bajos.</p></div>{modo === "recuperar" && <div><label htmlFor="recuperacion">Código de recuperación</label><input id="recuperacion" name="recovery-code" autoComplete="off" spellCheck={false} minLength={48} maxLength={48} pattern="[a-f0-9]{48}" required value={codigo} onChange={e => setCodigo(e.target.value)} aria-describedby={error ? "cuenta-error" : undefined} /></div>}<div><label htmlFor="contrasena">{modo === "recuperar" ? "Contraseña nueva" : "Contraseña"}</label><input id="contrasena" aria-invalid={error ? true : undefined} type="password" name="password" autoComplete={modo === "ingreso" ? "current-password" : "new-password"} required minLength={8} maxLength={128} value={contrasena} onChange={e => setContrasena(e.target.value)} aria-describedby={`clave-ayuda${error ? " cuenta-error" : ""}`} /><p id="clave-ayuda" className="mt-2 text-xs text-muted-foreground">Al menos 8 caracteres. Usa una contraseña que no uses en otros sitios.</p></div></fieldset>{error && <p id="cuenta-error" role="alert" className="text-sm text-destructive">{error}</p>}<button type="submit" className="entrada-primario w-full" disabled={ocupado}>{ocupado ? "Un momento…" : modo === "registro" ? "Crear cuenta" : modo === "recuperar" ? "Cambiar contraseña" : "Ingresar"}</button><div className="flex flex-wrap gap-2"><button type="button" disabled={ocupado} className="entrada-secundario" onClick={() => abrir("auto")}>Atrás</button>{modo === "ingreso" && <button type="button" className="entrada-secundario" disabled={ocupado} onClick={() => abrir("recuperar")}>Olvidé mi contraseña</button>}</div></form></EntradaFrame>;
}
export function GuardarCodigo({ codigo, confirmar }: { codigo: string; confirmar: () => void }) {
  const [mensaje, setMensaje] = useState("");
  async function copiar() {
    try { await navigator.clipboard.writeText(codigo); setMensaje("Código copiado. Guárdalo en un lugar seguro."); }
    catch { setMensaje("No se pudo copiar. Selecciona el código y guárdalo manualmente."); }
  }
  return <EntradaFrame titulo="Guarda tu código de recuperación"><p className="mb-5 leading-relaxed text-muted-foreground">Solo se muestra ahora. Sin este código y sin tu contraseña no podremos recuperar tu cuenta. No lo compartas.</p><code className="block select-all break-all rounded-xl border border-primary/30 bg-primary/5 p-4 font-mono text-lg" aria-label="Tu código de recuperación">{codigo}</code><p className="mt-4 text-sm text-muted-foreground">Si cierras esta pantalla, no podrás volver a ver este código.</p><div className="mt-6 flex flex-wrap gap-3"><button className="entrada-secundario" onClick={() => void copiar()}>Copiar</button><button className="entrada-primario" onClick={confirmar}>Ya lo guardé</button></div><p role="status" className="mt-4 text-sm">{mensaje}</p></EntradaFrame>;
}
