import { describe, expect, it } from "vitest";
import { encolar, estadoDeCelda, faltaLaColumnaConfianza, leerCola, escribirCola, letrasDe, quitarDeLaCola, resumenParaEntregar, sinConfianza } from "./intento";

describe("estadoDeCelda", () => {
  it("en curso: actual, marcada, respondida o en blanco", () => {
    expect(estadoDeCelda({ actual: true, respondida: true, marcada: true, correcta: null })).toBe("actual");
    expect(estadoDeCelda({ actual: false, respondida: true, marcada: true, correcta: null })).toBe("marcada");
    expect(estadoDeCelda({ actual: false, respondida: true, marcada: false, correcta: null })).toBe("respondida");
    expect(estadoDeCelda({ actual: false, respondida: false, marcada: false, correcta: null })).toBe("blanco");
  });
  it("corregida: acierto o fallo, aunque sea la actual; en blanco sigue en blanco", () => {
    expect(estadoDeCelda({ actual: true, respondida: true, marcada: false, correcta: true })).toBe("acierto");
    expect(estadoDeCelda({ actual: false, respondida: true, marcada: true, correcta: false })).toBe("fallo");
    expect(estadoDeCelda({ actual: false, respondida: false, marcada: false, correcta: null })).toBe("blanco");
  });
});

describe("resumenParaEntregar", () => {
  it("cuenta respondidas, en blanco y marcadas solo de las preguntas del intento", () => {
    const r = resumenParaEntregar(["a", "b", "c"], {
      a: { opcion: "B", marcada: true }, b: { opcion: null, marcada: true }, z: { opcion: "A", marcada: false },
    });
    expect(r).toEqual({ respondidas: 1, blancos: 2, marcadas: 2 });
  });
});

describe("letrasDe", () => {
  it("las letras presentes, en orden", () => {
    expect(letrasDe({ D: "4", A: "1", C: "3", B: "2" })).toEqual(["A", "B", "C", "D"]);
    expect(letrasDe({ A: "1", B: "2", C: "3", D: "4", E: "5" })).toEqual(["A", "B", "C", "D", "E"]);
    expect(letrasDe({ A: "1", B: "", C: "3" })).toEqual(["A", "C"]);
  });
});

describe("la cola sin conexión", () => {
  it("la última respuesta de cada pregunta gana", () => {
    let c = encolar([], { pregunta_id: "a", opcion: "A", marcada: false });
    c = encolar(c, { pregunta_id: "b", opcion: "C", marcada: false });
    c = encolar(c, { pregunta_id: "a", opcion: "D", marcada: true });
    expect(c).toEqual([{ pregunta_id: "b", opcion: "C", marcada: false }, { pregunta_id: "a", opcion: "D", marcada: true }]);
  });
  it("quitar solo lo que se guardó con ese mismo valor (si cambió mientras tanto, se queda)", () => {
    const c = [{ pregunta_id: "a", opcion: "D", marcada: false }, { pregunta_id: "b", opcion: "C", marcada: false }];
    expect(quitarDeLaCola(c, [{ pregunta_id: "a", opcion: "A", marcada: false }, { pregunta_id: "b", opcion: "C", marcada: false }]))
      .toEqual([{ pregunta_id: "a", opcion: "D", marcada: false }]);
  });
  it("lee y escribe en un Storage, y un JSON roto es una cola vacía", () => {
    const datos = new Map<string, string>();
    const almacen = { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => void datos.set(k, v), removeItem: (k: string) => void datos.delete(k) };
    expect(leerCola(almacen, "i1")).toEqual([]);
    escribirCola(almacen, "i1", [{ pregunta_id: "a", opcion: "B", marcada: false }]);
    expect(leerCola(almacen, "i1")).toEqual([{ pregunta_id: "a", opcion: "B", marcada: false }]);
    escribirCola(almacen, "i1", []);
    expect(datos.has("admision-cola:i1")).toBe(false);
    datos.set("admision-cola:i2", "{roto");
    expect(leerCola(almacen, "i2")).toEqual([]);
  });
});

describe("la confianza (opcional) en la cola", () => {
  it("cambiar solo la confianza también deja la respuesta por guardar", () => {
    const c = [{ pregunta_id: "a", opcion: "A", marcada: false, confianza: 3 }];
    expect(quitarDeLaCola(c, [{ pregunta_id: "a", opcion: "A", marcada: false, confianza: 1 }])).toEqual(c);
    expect(quitarDeLaCola(c, [{ pregunta_id: "a", opcion: "A", marcada: false, confianza: 3 }])).toEqual([]);
  });
  it("sin la columna en la base (migración sin aplicar), se reenvía sin ella y la respuesta no se pierde", () => {
    expect(faltaLaColumnaConfianza({ code: "PGRST204", message: "Could not find the 'confianza' column of 'admision_respuestas'" })).toBe(true);
    expect(faltaLaColumnaConfianza({ code: "42703", message: 'column "confianza" does not exist' })).toBe(true);
    expect(faltaLaColumnaConfianza({ code: "42501", message: "El intento ya se entregó" })).toBe(false);
    expect(faltaLaColumnaConfianza(null)).toBe(false);
    expect(sinConfianza([{ pregunta_id: "a", opcion: "A", marcada: false, confianza: 2 }])).toEqual([{ pregunta_id: "a", opcion: "A", marcada: false }]);
  });
});
