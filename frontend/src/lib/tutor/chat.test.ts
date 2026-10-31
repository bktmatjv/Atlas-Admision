import { describe, expect, it } from "vitest";
import {
  TIPOS_BLOQUE,
  admiteRespuesta,
  formatearOpcion,
  respuestaValida,
  reenviaALaCharla,
  textoParaEnviar,
  tituloAccesible,
} from "./chat";
describe("lógica de inputs de los bloques", () => {
  it("lista los diez tipos de bloque del diseño", () => {
    expect([...TIPOS_BLOQUE].sort()).toEqual(
      [
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
      ].sort(),
    );
  });
  it("solo admiten respuesta los bloques con input", () => {
    for (const t of [
      "pregunta_socratica",
      "prediccion",
      "ejemplo_paso_a_paso",
      "practica",
      "en_tus_palabras",
    ] as const)
      expect(admiteRespuesta(t), t).toBe(true);
    for (const t of [
      "contraste",
      "razonamiento_anotado",
      "visual",
      "invitacion_comprobar",
      "cita",
    ] as const)
      expect(admiteRespuesta(t), t).toBe(false);
  });
  it("el texto libre vuelve a la charla; las opciones numéricas no", () => {
    expect(reenviaALaCharla("pregunta_socratica")).toBe(true);
    expect(reenviaALaCharla("en_tus_palabras")).toBe(true);
    expect(reenviaALaCharla("ejemplo_paso_a_paso")).toBe(true);
    expect(reenviaALaCharla("practica")).toBe(false);
    expect(reenviaALaCharla("prediccion")).toBe(false);
  });
  it("textoParaEnviar recorta y rechaza lo vacío o excesivo", () => {
    expect(textoParaEnviar("  hola  ")).toBe("hola");
    expect(textoParaEnviar("   ")).toBeNull();
    expect(textoParaEnviar("x".repeat(2001))).toBeNull();
    expect(respuestaValida("a")).toBe(true);
    expect(respuestaValida("")).toBe(false);
  });
  it("las opciones se muestran con coma decimal", () => {
    expect(formatearOpcion(72)).toBe("72");
    expect(formatearOpcion(112.5)).toBe("112,5");
  });
  it("cada bloque tiene un título accesible", () => {
    for (const t of TIPOS_BLOQUE)
      expect(tituloAccesible(t).length, t).toBeGreaterThan(3);
  });
});
