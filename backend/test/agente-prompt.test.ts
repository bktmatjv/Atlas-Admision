import { describe, it, expect } from "vitest";
import {
  MAX_HERRAMIENTAS,
  PROMPT_AGENTE,
  SISTEMA_AGENTE,
} from "../src/modules/tutor/agente";
// Regresiones del prompt tras probar el agente con Groq real.
describe("prompt tutor-agente-v5", () => {
  it("está versionado", () => {
    expect(PROMPT_AGENTE).toBe("tutor-agente-v5");
  });
  it("no promete bloques por nombre ni con abajo o arriba en el texto", () => {
    expect(SISTEMA_AGENTE).toMatch(/no menciones los bloques por su nombre/);
    expect(SISTEMA_AGENTE).toContain("«abajo», «arriba»");
    expect(SISTEMA_AGENTE).toMatch(/descartar un bloque que no pase la verificación/);
  });
  it("se presenta como CALIBRA", () => {
    expect(SISTEMA_AGENTE).toMatch(/^Eres CALIBRA,/);
    expect(SISTEMA_AGENTE).not.toMatch(/Atlas/);
  });
  it("pide acompañar la respuesta con un bloque pertinente, sin forzarlo en cada turno", () => {
    expect(SISTEMA_AGENTE).toMatch(/acompaña tu respuesta con al menos un bloque/);
    expect(SISTEMA_AGENTE).toMatch(/pregunta_socratica con respuestas_rapidas/);
    expect(SISTEMA_AGENTE).toMatch(/contraste y un visual/);
    expect(SISTEMA_AGENTE).toMatch(/Sin forzar bloques en cada turno/);
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
  it("usa el perfil declarado sin asumir San Marcos ni inventar diagnósticos", () => {
    expect(SISTEMA_AGENTE).toContain("universitarios y escolares");
    expect(SISTEMA_AGENTE).toContain("perfil declarado");
    expect(SISTEMA_AGENTE).toContain("no presupongas que todos preparan San Marcos");
    expect(SISTEMA_AGENTE).toContain("ni inventes diagnósticos");
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
