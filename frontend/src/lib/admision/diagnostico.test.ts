import { describe, expect, it } from "vitest";
import { proyectarAlExamen, puntajeParaIngresaba } from "./diagnostico";

const c = (aciertos: number, errores: number, blancos: number) => ({ aciertos, errores, blancos });

describe("proyectarAlExamen", () => {
  it("todo bien en el diagnóstico proyecta 2000; todo en blanco, 0", () => {
    expect(proyectarAlExamen({ biologia: c(3, 0, 0), algebra: c(2, 0, 0) }, "A").estimado).toBe(2000);
    expect(proyectarAlExamen({ biologia: c(0, 0, 3) }, "A").estimado).toBe(0);
  });
  it("cada curso con su propio acierto, y los no vistos con el acierto global", () => {
    // Biología al 100 % (8 preguntas en A) y el resto (92) al 50 % sin errores: 160 + 92 × 10 = 1080.
    const p = proyectarAlExamen({ biologia: c(2, 0, 0), algebra: c(1, 0, 1), fisica: c(1, 0, 1) }, "A");
    expect(p.porCurso.biologia).toBe(160);
    expect(p.muestra).toBe(6);
    expect(p.estimado).toBeGreaterThan(1000);
    expect(p.minimo).toBeLessThanOrEqual(p.estimado);
    expect(p.maximo).toBeGreaterThanOrEqual(p.estimado);
    expect(p.maximo).toBeLessThanOrEqual(2000);
  });
  it("los errores de la actitudinal no restan en la proyección", () => {
    expect(proyectarAlExamen({ actitudinal: c(0, 1, 0), biologia: c(1, 0, 0) }, "A").porCurso.actitudinal).toBe(0);
  });
});

describe("puntajeParaIngresaba", () => {
  const base = { estado: "entregado", filtro: null, created_at: "2026-10-15" };
  it("un simulacro completo, tal cual y sin aviso", () => {
    expect(puntajeParaIngresaba({ ...base, modo: "simulacro", puntaje: 1200, informe: { maximo: 2000 } }, "A")).toEqual({ puntaje: 1200, aviso: null });
  });
  it("un examen con preguntas anuladas, proyectado y avisado", () => {
    expect(puntajeParaIngresaba({ ...base, modo: "real", puntaje: 590, informe: { maximo: 1180 } }, "A")?.aviso).toMatch(/menos de 100 preguntas/);
  });
  it("un diagnóstico, estimado al examen completo con su rango", () => {
    const r = puntajeParaIngresaba({ ...base, modo: "diagnostico", puntaje: 300, informe: { maximo: 600, porCurso: { biologia: c(3, 0, 0), algebra: c(0, 0, 3) } } }, "A");
    expect(r?.aviso).toMatch(/^Es una estimación: tu diagnóstico tuvo 6 preguntas/);
    expect(r?.puntaje).toBeGreaterThan(0);
  });
  it("una práctica o un repaso, no", () => {
    expect(puntajeParaIngresaba({ ...base, modo: "repaso", puntaje: 20, informe: { maximo: 60 } }, "A")).toBeNull();
    expect(puntajeParaIngresaba({ ...base, modo: "simulacro", filtro: { curso: "algebra" }, puntaje: 20, informe: { maximo: 2000 } }, "A")).toBeNull();
  });
});
