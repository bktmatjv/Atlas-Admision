import { describe, expect, it } from "vitest";
import {
  caracteresVisibles,
  duracionEscritura,
  prefijoSeguro,
} from "./escritura";

describe("duracionEscritura", () => {
  it("es proporcional al largo con un piso y un techo", () => {
    expect(duracionEscritura(10)).toBe(700);
    expect(duracionEscritura(200)).toBe(1800);
    expect(duracionEscritura(5000)).toBe(3600);
  });
  it("en modo presentación es un 25% más lenta", () => {
    expect(duracionEscritura(200, true)).toBe(2250);
  });
});

describe("caracteresVisibles", () => {
  it("avanza de forma lineal y termina exactamente en el largo", () => {
    expect(caracteresVisibles(100, 0, 1000)).toBe(0);
    expect(caracteresVisibles(100, 500, 1000)).toBe(50);
    expect(caracteresVisibles(100, 1000, 1000)).toBe(100);
    expect(caracteresVisibles(100, 5000, 1000)).toBe(100);
  });
  it("sin duración muestra todo", () => {
    expect(caracteresVisibles(40, 0, 0)).toBe(40);
  });
});

describe("prefijoSeguro", () => {
  it("no parte palabras", () => {
    expect(prefijoSeguro("hola mundo cruel", 7)).toBe("hola mundo");
  });
  it("devuelve todo o nada en los extremos", () => {
    expect(prefijoSeguro("abc def", 0)).toBe("");
    expect(prefijoSeguro("abc def", 99)).toBe("abc def");
  });
  it("no deja una fórmula a medias", () => {
    const t = "Calcula $x^2 + 1$ y sigue";
    const p = prefijoSeguro(t, 12);
    expect(p).toBe("Calcula $x^2 + 1$");
    expect((p.match(/\$/g) ?? []).length % 2).toBe(0);
  });
  it("no deja un énfasis ni un código abiertos", () => {
    expect(prefijoSeguro("Esto es **muy importante** hoy", 12)).toBe(
      "Esto es **muy importante**",
    );
    expect(prefijoSeguro("Usa `a + b` siempre", 8)).toBe("Usa `a + b`");
  });
  it("un dólar escapado no cuenta como fórmula", () => {
    expect(prefijoSeguro("Cuesta \\$5 en total", 12)).toBe("Cuesta \\$5 en");
  });
  it("si la marca nunca cierra, muestra el resto en vez de dejarla abierta", () => {
    expect(prefijoSeguro("Mira $x + y sin cerrar", 8)).toBe(
      "Mira $x + y sin cerrar",
    );
  });
});
