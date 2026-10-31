import { describe, expect, it } from "vitest";
import {
  LLAVE_GECKO,
  estadoInicialGecko,
  guardarEstadoGecko,
  leerEstadoGecko,
} from "./preferenciaGecko";

const memoria = (inicial: Record<string, string> = {}) => {
  const datos = { ...inicial };
  return {
    getItem: (k: string) => datos[k] ?? null,
    setItem: (k: string, v: string) => {
      datos[k] = v;
    },
    datos,
  };
};

describe("preferencia del compañero", () => {
  it("en anchos chicos arranca minimizado, también en rutas sin campos", () => {
    expect(estadoInicialGecko(null, 375, "/")).toBe("minimizado");
    expect(estadoInicialGecko(null, 767, "/tutor")).toBe("minimizado");
  });
  it("sobre formularios (Admisión, Mis cursos, Aprender) arranca minimizado", () => {
    for (const ruta of ["/admision", "/admision/temas", "/cursos", "/aprender/x"])
      expect(estadoInicialGecko(null, 1440, ruta)).toBe("minimizado");
  });
  it("en pantallas anchas sin campos arranca abierto", () => {
    expect(estadoInicialGecko(null, 1440, "/")).toBe("abierto");
  });
  it("la elección guardada gana sobre el ancho y la ruta", () => {
    expect(estadoInicialGecko("abierto", 375, "/admision")).toBe("abierto");
    expect(estadoInicialGecko("oculto", 1440, "/")).toBe("oculto");
  });
  it("recuerda la elección y descarta valores desconocidos", () => {
    const s = memoria();
    guardarEstadoGecko(s, "oculto");
    expect(s.datos[LLAVE_GECKO]).toBe("oculto");
    expect(leerEstadoGecko(s)).toBe("oculto");
    expect(leerEstadoGecko(memoria({ [LLAVE_GECKO]: "raro" }))).toBeNull();
  });
  it("si el almacenamiento falla no rompe nada", () => {
    const roto = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(leerEstadoGecko(roto)).toBeNull();
    expect(() => guardarEstadoGecko(roto, "abierto")).not.toThrow();
    expect(leerEstadoGecko(null)).toBeNull();
  });
});
