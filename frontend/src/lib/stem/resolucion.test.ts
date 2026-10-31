import { describe, expect, it } from "vitest";
import {
  ESTADO_INICIAL,
  avanzarResolucion,
  comprobarMiPaso,
  cuerpoDeResolucion,
  esCursoDeCalculo,
  estadoInicial,
  leerRespuesta,
  medidasReducidas,
  rotuloDeOrigen,
  rutaDeLaFoto,
  textoDeCita,
  textoDelSiguiente,
} from "./resolucion";

const BUENA = {
  ok: true,
  problemaId: "p-1",
  enunciado: "Un bloque de $2\\,\\text{kg}$ en un plano de $30^\\circ$…",
  area: "fisica",
  figura: { tipo: "fisica", plano: { angulo: 30 }, fuerzas: [{ etiqueta: "$P$", angulo: 270, modulo: 2 }], vectores: [] },
  pista: "Dibuja las fuerzas.",
  primeraPregunta: "¿Qué fuerzas actúan sobre el bloque?",
  pasos: [
    { cuenta: "P = m g = 2 \\cdot 10 = 20", porque: "El peso.", comprobado: "cuadra", cita: { material_id: "m1", archivo: "Dinámica.pdf", pagina: 4 } },
    { cuenta: "N = P\\cos 30^\\circ", porque: "La normal.", comprobado: "sin_numeros", cita: null },
  ],
  resultado: "$N \\approx 17{,}3\\,\\text{N}$",
  todasCuadran: true,
  cuentasComprobadas: 1,
  tema: { id: "t1", title: "Dinámica" },
  parecidos: [{ origen: "material", id: "i1", enunciado: "Otro bloque…" }, { origen: "admision", id: "a1", enunciado: "Halle…" }],
};

describe("leerRespuesta", () => {
  it("lee una respuesta buena entera", () => {
    const r = leerRespuesta(BUENA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolucion.pasos).toHaveLength(2);
    expect(r.resolucion.pasos[0].cita).toEqual({ material_id: "m1", archivo: "Dinámica.pdf", pagina: 4 });
    expect(r.resolucion.figura?.tipo).toBe("fisica");
    expect(r.resolucion.tema).toEqual({ id: "t1", title: "Dinámica" });
    expect(r.resolucion.parecidos.map((p) => p.origen)).toEqual(["material", "admision"]);
  });

  it("los fallos suaves traen su motivo y su mensaje", () => {
    const r = leerRespuesta({ ok: false, reason: "ilegible", message: "Prueba con una foto más nítida." });
    expect(r).toEqual({ ok: false, motivo: "ilegible", mensaje: "Prueba con una foto más nítida." });
  });

  it("un fallo suave sin mensaje lleva uno propio", () => {
    const r = leerRespuesta({ ok: false, reason: "sin_solucion" });
    expect(r.ok).toBe(false);
    if (r.ok !== false) return;
    expect(r.mensaje.length).toBeGreaterThan(5);
  });

  it("lo que no tiene la forma del servidor es un error, no una solución vacía", () => {
    expect(leerRespuesta(null).ok).toBe(false);
    expect(leerRespuesta({ ok: true }).ok).toBe(false);
    expect(leerRespuesta({ ...BUENA, pasos: "x" }).ok).toBe(false);
    expect(leerRespuesta({ ...BUENA, enunciado: "" }).ok).toBe(false);
  });

  it("descarta pasos rotos, citas a medias y parecidos sin texto, sin tirar lo demás", () => {
    const r = leerRespuesta({
      ...BUENA,
      pasos: [...BUENA.pasos, { cuenta: 3 }, { cuenta: "x=1", porque: "", comprobado: "raro", cita: { archivo: "a" } }],
      parecidos: [...BUENA.parecidos, { origen: "otro", id: "z", enunciado: "?" }, { origen: "material", id: "y", enunciado: " " }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolucion.pasos).toHaveLength(3);
    expect(r.resolucion.pasos[2]).toEqual({ cuenta: "x=1", porque: "", comprobado: "sin_numeros", cita: null });
    expect(r.resolucion.parecidos).toHaveLength(2);
  });

  it("una figura que no pasa la validación no se pinta", () => {
    const r = leerRespuesta({ ...BUENA, figura: { tipo: "inventada" } });
    expect(r.ok && r.resolucion.figura).toBe(null);
  });

  it("sin el dato de si cuadran todas, se calcula de los pasos", () => {
    const { todasCuadran: _t, ...sin } = BUENA;
    const r = leerRespuesta({ ...sin, pasos: [{ ...BUENA.pasos[0], comprobado: "no_cuadra" }] });
    expect(r.ok && r.resolucion.todasCuadran).toBe(false);
  });
});

describe("el recorrido guiado", () => {
  it("empieza en la pista, sin ningún paso a la vista", () => {
    const e = estadoInicial(3);
    expect(e).toEqual({ ...ESTADO_INICIAL, total: 3 });
    expect(e.fase).toBe("pista");
    expect(e.vistos).toBe(0);
  });

  it("revela los pasos de uno en uno y después el resultado", () => {
    let e = estadoInicial(2);
    expect(textoDelSiguiente(e)).toBe("Ver el primer paso");
    e = avanzarResolucion(e, { tipo: "siguiente" });
    expect(e).toMatchObject({ fase: "pasos", vistos: 1 });
    expect(textoDelSiguiente(e)).toBe("Ver el siguiente paso");
    e = avanzarResolucion(e, { tipo: "siguiente" });
    expect(e).toMatchObject({ fase: "pasos", vistos: 2 });
    expect(textoDelSiguiente(e)).toBe("Ver el resultado");
    e = avanzarResolucion(e, { tipo: "siguiente" });
    expect(e).toMatchObject({ fase: "final", vistos: 2 });
    expect(avanzarResolucion(e, { tipo: "siguiente" })).toBe(e);
  });

  it("«Ver la solución completa» lo abre todo de una vez", () => {
    const e = avanzarResolucion(estadoInicial(4), { tipo: "todo" });
    expect(e).toMatchObject({ fase: "final", vistos: 4 });
  });

  it("sin pasos, de la pista se va al resultado", () => {
    expect(avanzarResolucion(estadoInicial(0), { tipo: "siguiente" })).toMatchObject({ fase: "final", vistos: 0 });
  });

  it("lo que escribe el alumno se guarda y se comprueba sin revelar nada", () => {
    let e = avanzarResolucion(estadoInicial(2), { tipo: "escribir", texto: "2 \\cdot 10 = 20" });
    expect(e.intento).toBe("2 \\cdot 10 = 20");
    expect(e.veredicto).toBe(null);
    e = avanzarResolucion(e, { tipo: "comprobar" });
    expect(e.veredicto).toBe("cuadra");
    expect(e.fase).toBe("pista");
    expect(e.vistos).toBe(0);
    // Al cambiar el texto, el veredicto de antes ya no vale.
    e = avanzarResolucion(e, { tipo: "escribir", texto: "2 \\cdot 10 = 21" });
    expect(e.veredicto).toBe(null);
    expect(avanzarResolucion(e, { tipo: "comprobar" }).veredicto).toBe("revisa");
  });

  it("reiniciar vuelve a la pista con otro total", () => {
    const e = avanzarResolucion(avanzarResolucion(estadoInicial(2), { tipo: "todo" }), { tipo: "reiniciar", total: 5 });
    expect(e).toEqual({ ...ESTADO_INICIAL, total: 5 });
  });
});

describe("comprobarMiPaso", () => {
  it("una cuenta que cuadra", () => {
    expect(comprobarMiPaso("20 / 2 = 10").veredicto).toBe("cuadra");
    expect(comprobarMiPaso("$\\frac{1}{2} + \\frac{1}{2} = 1$").veredicto).toBe("cuadra");
  });

  it("una cuenta que no cuadra", () => {
    expect(comprobarMiPaso("3 \\cdot 4 = 13").veredicto).toBe("revisa");
  });

  it("varias líneas: basta una mala para pedir revisar", () => {
    expect(comprobarMiPaso("2 + 2 = 4\n3 + 3 = 7").veredicto).toBe("revisa");
    expect(comprobarMiPaso("Primero el peso\n2 \\cdot 10 = 20").veredicto).toBe("cuadra");
  });

  it("sin igualdad o sin números, dice qué escribir, no un veredicto", () => {
    expect(comprobarMiPaso("Hay que dibujar las fuerzas").veredicto).toBe("sin_igualdad");
    expect(comprobarMiPaso("N = P \\cos\\theta").veredicto).toBe("sin_numeros");
    expect(comprobarMiPaso("").veredicto).toBe("sin_igualdad");
  });

  it("cada veredicto trae su frase, y ninguna revela la respuesta", () => {
    expect(comprobarMiPaso("2 + 2 = 4").mensaje).toMatch(/^Esa cuenta cuadra/);
    expect(comprobarMiPaso("2 + 2 = 5").mensaje).toMatch(/^Revisa esa cuenta/);
    expect(comprobarMiPaso("2 + 2 = 5").mensaje).not.toMatch(/4/);
  });
});

describe("ayudas", () => {
  it("la foto va a la carpeta del alumno con un nombre único", () => {
    expect(rutaDeLaFoto("u-1", "abc")).toBe("u-1/abc.jpg");
    const a = rutaDeLaFoto("u-1");
    expect(a).toMatch(/^u-1\/[0-9a-f-]{36}\.jpg$/);
    expect(rutaDeLaFoto("u-1")).not.toBe(a);
  });

  it("el cuerpo lleva una sola entrada y la clase solo si hay", () => {
    expect(cuerpoDeResolucion({ tipo: "foto", fotoPath: "u/x.jpg" })).toEqual({ fotoPath: "u/x.jpg" });
    expect(cuerpoDeResolucion({ tipo: "admision", id: "q1" }, "c1")).toEqual({ admisionPreguntaId: "q1", classId: "c1" });
    expect(cuerpoDeResolucion({ tipo: "texto", enunciado: "  2x = 4  " }, null)).toEqual({ enunciado: "2x = 4" });
  });

  it("reduce la foto a 1600 px por el lado mayor sin deformarla", () => {
    expect(medidasReducidas(4000, 3000)).toEqual({ ancho: 1600, alto: 1200 });
    expect(medidasReducidas(3000, 4000)).toEqual({ ancho: 1200, alto: 1600 });
    expect(medidasReducidas(800, 600)).toEqual({ ancho: 800, alto: 600 });
  });

  it("la cita y el origen se leen en palabras", () => {
    expect(textoDeCita({ material_id: "m", archivo: "Dinámica.pdf", pagina: 4 })).toBe("De tu material: Dinámica.pdf · pág. 4");
    expect(textoDeCita({ material_id: "m", archivo: "Apuntes", pagina: null })).toBe("De tu material: Apuntes");
    expect(rotuloDeOrigen("material")).toBe("De tu material");
    expect(rotuloDeOrigen("admision")).toBe("Admisión San Marcos");
  });

  it("los cursos de cálculo de admisión", () => {
    for (const c of ["aritmetica", "algebra", "geometria", "trigonometria", "fisica", "quimica", "habilidad-logico-matematica"]) {
      expect(esCursoDeCalculo(c)).toBe(true);
    }
    for (const c of ["habilidad-verbal", "biologia", "historia-del-peru", null, undefined]) expect(esCursoDeCalculo(c)).toBe(false);
  });
});
