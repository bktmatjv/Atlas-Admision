import { describe, it, expect } from "vitest";
import { examWindowState, remainingMs, isTimeUp, formatCountdown } from "./exam-time";

const at = (iso: string) => new Date(iso);
const EXAM = {
  opens_at: "2026-08-30T09:00:00Z",
  closes_at: "2026-08-30T10:00:00Z",
  duration_minutes: 60,
};

describe("examWindowState", () => {
  it("está cerrado antes de abrir", () => {
    expect(examWindowState(EXAM, at("2026-08-30T08:59:00Z"))).toBe("no_abierto");
  });

  it("está abierto justo al abrirse", () => {
    expect(examWindowState(EXAM, at("2026-08-30T09:00:00Z"))).toBe("abierto");
  });

  it("está cerrado justo al cerrarse, no un segundo después", () => {
    expect(examWindowState(EXAM, at("2026-08-30T10:00:00Z"))).toBe("cerrado");
  });

  it("un examen sin fechas está siempre abierto", () => {
    expect(examWindowState({ opens_at: null, closes_at: null, duration_minutes: null }, new Date()))
      .toBe("abierto");
  });
});

describe("remainingMs", () => {
  it("cuenta el tiempo del alumno desde que empezó", () => {
    const remaining = remainingMs("2026-08-30T09:00:00Z", EXAM, at("2026-08-30T09:20:00Z"));
    expect(remaining).toBe(40 * 60_000);
  });

  it("el cierre del examen manda si llega antes", () => {
    // Entra a las 9:50 con una hora de duración, pero el examen cierra a las 10.
    const remaining = remainingMs("2026-08-30T09:50:00Z", EXAM, at("2026-08-30T09:50:00Z"));
    expect(remaining).toBe(10 * 60_000);
  });

  it("nunca devuelve negativo", () => {
    expect(remainingMs("2026-08-30T09:00:00Z", EXAM, at("2026-08-30T11:00:00Z"))).toBe(0);
  });

  it("sin duración se rige solo por el cierre", () => {
    const exam = { ...EXAM, duration_minutes: null };
    expect(remainingMs("2026-08-30T09:00:00Z", exam, at("2026-08-30T09:30:00Z"))).toBe(30 * 60_000);
  });

  it("sin duración ni cierre no hay límite", () => {
    const exam = { opens_at: null, closes_at: null, duration_minutes: null };
    expect(remainingMs("2026-08-30T09:00:00Z", exam, new Date())).toBeNull();
  });

  it("sin haber empezado, el límite es el cierre", () => {
    expect(remainingMs(null, EXAM, at("2026-08-30T09:30:00Z"))).toBe(30 * 60_000);
  });
});

describe("isTimeUp", () => {
  it("se acabó cuando no queda tiempo", () => {
    expect(isTimeUp("2026-08-30T09:00:00Z", EXAM, at("2026-08-30T10:30:00Z"))).toBe(true);
  });

  it("no se acaba nunca sin límites", () => {
    const exam = { opens_at: null, closes_at: null, duration_minutes: null };
    expect(isTimeUp("2026-08-30T09:00:00Z", exam, new Date())).toBe(false);
  });
});

describe("formatCountdown", () => {
  it("muestra mm:ss y h:mm:ss según haga falta", () => {
    expect(formatCountdown(59_000)).toBe("00:59");
    expect(formatCountdown(45 * 60_000)).toBe("45:00");
    expect(formatCountdown(90 * 60_000)).toBe("1:30:00");
    expect(formatCountdown(-1)).toBe("00:00");
  });
});
