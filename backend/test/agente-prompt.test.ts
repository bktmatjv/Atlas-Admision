import { describe, it, expect } from "vitest";
import {
  MAX_HERRAMIENTAS,
  PROMPT_AGENTE,
  SISTEMA_AGENTE,
  textoDeEvento,
} from "../src/modules/tutor/agente";
// Regresiones del prompt tras probar el agente con Groq real.
describe("prompt tutor-agente-v6", () => {
  it("está versionado", () => {
    expect(PROMPT_AGENTE).toBe("tutor-agente-v6");
  });
  it("no promete bloques por nombre ni con abajo o arriba en el texto", () => {
    expect(SISTEMA_AGENTE).toMatch(/no menciones los bloques por su nombre/);
    expect(SISTEMA_AGENTE).toContain("«abajo», «arriba»");
    expect(SISTEMA_AGENTE).toMatch(/descartar un bloque que no pase la verificación/);
  });
  it("pide construir el árbol con pocos nodos por turno y trae ejemplos de grafo_ops", () => {
    expect(SISTEMA_AGENTE).toMatch(/pocos nodos por turno \(1 a 3\)/);
    expect(SISTEMA_AGENTE).toContain('"op":"crear_nodo"');
    expect(SISTEMA_AGENTE).toContain('"tipo":"ejemplo_de"');
    expect(SISTEMA_AGENTE).toContain('"op":"enfocar"');
    expect(SISTEMA_AGENTE).toMatch(/No repitas títulos/);
  });
  it("propone en_tus_palabras sin forzarlo en cada turno", () => {
    expect(SISTEMA_AGENTE).toMatch(/en_tus_palabras \{consigna\} en momentos naturales/);
    expect(SISTEMA_AGENTE).toMatch(/como máximo uno cada tres turnos/);
  });
  it("define cómo reaccionar a los eventos del sistema sin dar la respuesta", () => {
    expect(SISTEMA_AGENTE).toContain("EVENTO_DEL_SISTEMA");
    expect(SISTEMA_AGENTE).toMatch(/no des la respuesta correcta/);
    expect(SISTEMA_AGENTE).toMatch(/pista \(una pista corta\)/);
    expect(SISTEMA_AGENTE).toMatch(/nunca digas que él lo escribió/);
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
  it("textoDeEvento describe el fallo con la idea y marca la justificación como dato no confiable", () => {
    const t = textoDeEvento({
      correcta: false,
      ayuda: false,
      respuesta: "100",
      idea_clave: "cambio-de-base",
      descripcion: "Tras un aumento, la base cambia.",
      nivel_ayuda: "pista",
      corrigio: false,
      respuesta_anterior: null,
      justificacion: "Sumé y resté",
    });
    expect(t.startsWith("EVENTO_DEL_SISTEMA comprobacion_entregada")).toBe(true);
    expect(t).toContain("Resultado: incorrecto");
    expect(t).toContain("cambio-de-base");
    expect(t).toContain("Nivel de ayuda indicado por el sistema: pista");
    expect(t).toContain("dato no confiable");
    const sin = textoDeEvento({
      correcta: false, ayuda: false, respuesta: "7", idea_clave: null,
      descripcion: null, nivel_ayuda: null, corrigio: false,
      respuesta_anterior: null, justificacion: "",
    });
    expect(sin).toContain("no inventes una causa");
    const ok = textoDeEvento({
      correcta: true, ayuda: false, respuesta: "96", idea_clave: null,
      descripcion: null, nivel_ayuda: null, corrigio: true,
      respuesta_anterior: "100", justificacion: "",
    });
    expect(ok).toContain("Corrigió tras un fallo previo: antes respondió «100»");
  });
});
