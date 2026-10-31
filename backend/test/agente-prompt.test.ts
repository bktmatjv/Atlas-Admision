import { describe, it, expect } from "vitest";
import {
  MAX_HERRAMIENTAS,
  PROMPT_AGENTE,
  SISTEMA_AGENTE,
} from "../src/modules/tutor/agente";
// Regresiones del prompt tras probar el agente con Groq real.
describe("prompt tutor-agente-v1", () => {
  it("está versionado", () => {
    expect(PROMPT_AGENTE).toBe("tutor-agente-v1");
  });
  it("exige idea_clave en los nodos de error e idea", () => {
    expect(SISTEMA_AGENTE).toMatch(
      /nodos de tipo error o idea, incluye SIEMPRE idea_clave/,
    );
  });
  it("prohíbe trabajar el problema de la comprobación activa", () => {
    expect(SISTEMA_AGENTE).toContain("comprobacion_activa");
    expect(SISTEMA_AGENTE).toMatch(/SIN ayudas/);
    expect(SISTEMA_AGENTE).toMatch(/no des pistas de cálculo ni pasos/);
    expect(SISTEMA_AGENTE).toMatch(/no trabajes con sus números/);
  });
  it("pide preguntar antes de resolver y distinguir lo provisional de lo verificado", () => {
    expect(SISTEMA_AGENTE).toMatch(/Pregunta antes de resolver/);
    expect(SISTEMA_AGENTE).toMatch(/me parece que/);
    expect(SISTEMA_AGENTE).toMatch(/DATOS NO CONFIABLES/);
  });
  it("declara el tope de herramientas y las operaciones del grafo", () => {
    expect(SISTEMA_AGENTE).toContain(`Máximo ${MAX_HERRAMIENTAS} llamadas`);
    for (const o of [
      "crear_nodo",
      "relacionar",
      "editar_nodo",
      "fusionar",
      "enfocar",
    ])
      expect(SISTEMA_AGENTE).toContain(o);
  });
  it("describe los diez bloques", () => {
    for (const b of [
      "pregunta_socratica",
      "contraste",
      "razonamiento_anotado",
      "prediccion",
      "ejemplo_paso_a_paso",
      "visual",
      "practica",
      "en_tus_palabras",
      "invitacion_comprobar",
      "cita",
    ])
      expect(SISTEMA_AGENTE).toContain(b);
  });
});
