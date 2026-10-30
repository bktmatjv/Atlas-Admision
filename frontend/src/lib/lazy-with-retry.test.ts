import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { olvidarRecarga, recargarUnaVez } from "./lazy-with-retry";

describe("recargarUnaVez", () => {
  let almacen: Map<string, string>;
  let recargar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    almacen = new Map();
    recargar = vi.fn();
    vi.stubGlobal("sessionStorage", {
      getItem: (clave: string) => almacen.get(clave) ?? null,
      setItem: (clave: string, valor: string) => void almacen.set(clave, valor),
      removeItem: (clave: string) => void almacen.delete(clave),
    });
    vi.stubGlobal("window", { location: { reload: recargar } });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("recarga la primera vez y no la segunda, para no entrar en bucle", () => {
    expect(recargarUnaVez()).toBe(true);
    expect(recargarUnaVez()).toBe(false);
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it("vuelve a poder recargar cuando un módulo llegó bien", () => {
    recargarUnaVez();
    olvidarRecarga();
    expect(recargarUnaVez()).toBe(true);
    expect(recargar).toHaveBeenCalledTimes(2);
  });

  it("sin sessionStorage recarga igual en vez de lanzar", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
      removeItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(recargarUnaVez()).toBe(true);
  });
});

describe("pantallas que sobreviven a un despliegue", () => {
  // Se lee el fuente de App.tsx y main.tsx: son reglas sobre el código (ningún `lazy` a secas, el manejador de chunks), y main.tsx monta la app al importarlo.
  const leer = (ruta: string) => readFileSync(join(__dirname, "..", ruta), "utf8");

  it("ninguna ruta de App usa `lazy` a secas: un chunk viejo tumbaría la app", () => {
    expect(leer("App.tsx")).not.toMatch(/=\s*lazy\(/);
  });

  it("main.tsx recarga cuando Vite no encuentra un chunk precargado", () => {
    expect(leer("main.tsx")).toMatch(/addEventListener\("vite:preloadError"/);
  });

});
