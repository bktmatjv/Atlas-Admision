import { describe, expect, it } from "vitest";
import { armarDiagnostico, armarPractica, armarReal, armarSimulacro, cuotasDiagnostico, duracionMinutos, MINUTOS_DIAGNOSTICO, type PreguntaParaArmar } from "./admision-armado";

let n = 0;
const p = (curso: string, extra: Partial<PreguntaParaArmar> = {}): PreguntaParaArmar =>
  ({ id: `p${++n}`, examen_id: "e1", numero: n, curso, tema: "t", texto_id: null, ...extra });
// Azar determinista para los tests.
const azarFijo = () => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

describe("armarReal", () => {
  it("las de ese examen, por número", () => {
    const b = [p("aritmetica", { numero: 2 }), p("aritmetica", { numero: 1 }), p("aritmetica", { examen_id: "e2", numero: 1 })];
    expect(armarReal(b, "e1")).toEqual([b[1].id, b[0].id]);
  });
});

describe("armarSimulacro", () => {
  // Un banco con 30 de cada curso del molde de A: sobra de todo.
  const banco: PreguntaParaArmar[] = [];
  for (const c of ["habilidad-verbal", "habilidad-logico-matematica", "biologia", "quimica", "lenguaje", "psicologia", "fisica",
    "aritmetica", "literatura", "educacion-civica", "geografia", "economia", "filosofia", "geometria", "algebra",
    "trigonometria", "historia-del-peru", "historia-universal"]) for (let i = 0; i < 30; i++) banco.push(p(c));

  it("respeta el molde: 10 verbal, 10 lógico, y lo del área; sin actitudinales en el banco salen 90", () => {
    const ids = armarSimulacro(banco, "A", new Map(), azarFijo());
    const por = (c: string) => ids.filter((id) => banco.find((x) => x.id === id)!.curso === c).length;
    expect(por("habilidad-verbal")).toBe(10);
    expect(por("habilidad-logico-matematica")).toBe(10);
    expect(por("biologia")).toBe(8);
    expect(por("historia-universal")).toBe(2);
    expect(ids).toHaveLength(90);
    expect(new Set(ids).size).toBe(90);
  });

  it("prefiere las no vistas, y entre las vistas la vista hace más tiempo", () => {
    const pocas = [p("biologia"), p("biologia"), p("biologia")];
    const vistas = new Map([[pocas[0].id, "2026-09-01T00:00:00Z"], [pocas[1].id, "2026-01-01T00:00:00Z"]]);
    const soloBio = armarSimulacro(pocas, "A", vistas, azarFijo()).filter((id) => pocas.some((x) => x.id === id));
    // biología pide 8 y hay 3: entran todas, primero la no vista y luego la vista hace más tiempo.
    expect(soloBio).toEqual([pocas[2].id, pocas[1].id, pocas[0].id]);
  });

  it("las lecturas entran completas: nunca media lectura", () => {
    const lect: PreguntaParaArmar[] = [];
    for (const [t, k] of [["T1", 4], ["T2", 3], ["T3", 3], ["T4", 4]] as const) {
      for (let i = 0; i < k; i++) lect.push(p("habilidad-verbal", { texto_id: t }));
    }
    for (let i = 0; i < 5; i++) lect.push(p("habilidad-verbal"));
    const ids = armarSimulacro(lect, "A", new Map(), azarFijo());
    const elegidas = lect.filter((x) => ids.includes(x.id));
    expect(elegidas).toHaveLength(10);
    for (const t of ["T1", "T2", "T3", "T4"]) {
      const k = elegidas.filter((x) => x.texto_id === t).length;
      expect([0, lect.filter((x) => x.texto_id === t).length]).toContain(k);
    }
  });

  it("las preguntas de una lectura van seguidas", () => {
    const lect = [p("habilidad-verbal", { texto_id: "T1" }), p("habilidad-verbal", { texto_id: "T1" }), p("habilidad-verbal"), p("habilidad-verbal", { texto_id: "T1" })];
    const ids = armarSimulacro(lect, "A", new Map(), azarFijo());
    const pos = lect.filter((x) => x.texto_id === "T1").map((x) => ids.indexOf(x.id)).sort((a, b) => a - b);
    expect(pos[2] - pos[0]).toBe(2);
  });
});

describe("armarPractica", () => {
  it("N de un curso (y tema), primero las no vistas", () => {
    const b = [p("fisica", { tema: "dinamica" }), p("fisica", { tema: "dinamica" }), p("fisica", { tema: "optica" }), p("quimica")];
    const vistas = new Map([[b[0].id, "2026-09-01T00:00:00Z"]]);
    expect(armarPractica(b, { curso: "fisica", tema: "dinamica" }, 1, vistas, azarFijo())).toEqual([b[1].id]);
    expect(armarPractica(b, { curso: "fisica" }, 10, new Map(), azarFijo())).toHaveLength(3);
  });
});

describe("armarPractica · lecturas", () => {
  it("si una pregunta de la lectura es del tema, entra la lectura entera", () => {
    const b = [
      p("habilidad-verbal", { tema: "comprension-de-lectura", texto_id: "T1" }),
      p("habilidad-verbal", { tema: "textos-mixtos", texto_id: "T1" }),
      p("habilidad-verbal", { tema: "textos-mixtos", texto_id: "T2" }),
    ];
    const ids = armarPractica(b, { curso: "habilidad-verbal", tema: "comprension-de-lectura" }, 10, new Map(), azarFijo());
    expect(ids.sort()).toEqual([b[0].id, b[1].id].sort());
  });
});

describe("duracionMinutos", () => {
  it("180 para 100 y proporcional", () => {
    expect(duracionMinutos(100)).toBe(180);
    expect(duracionMinutos(90)).toBe(162);
    expect(duracionMinutos(1)).toBe(2);
  });
});

describe("el diagnóstico (30 preguntas en 30 minutos, traído de Audix)", () => {
  it("reparte 30 con al menos una por curso y el resto por el peso del molde", () => {
    const c = cuotasDiagnostico("A");
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(30);
    expect(Object.keys(c)).toHaveLength(19);
    expect(Math.min(...Object.values(c))).toBe(1);
    expect(c.biologia).toBeGreaterThan(c.trigonometria);
    expect(c["habilidad-verbal"]).toBeGreaterThanOrEqual(2);
  });
  it("Medicina, el reparto del Área A; y es determinista", () => {
    expect(cuotasDiagnostico("medicina")).toEqual(cuotasDiagnostico("A"));
    expect(cuotasDiagnostico("E")["historia-del-peru"]).toBeGreaterThanOrEqual(1);
  });
  it("arma con las cuotas, sin repetir, y si un curso no tiene preguntas, sale con menos", () => {
    const banco: PreguntaParaArmar[] = [];
    for (const curso of Object.keys(cuotasDiagnostico("A"))) if (curso !== "actitudinal") for (let i = 0; i < 5; i++) banco.push(p(curso));
    const ids = armarDiagnostico(banco, "A", new Map(), azarFijo());
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(30 - cuotasDiagnostico("A").actitudinal);
    expect(ids.filter((id) => banco.find((x) => x.id === id)!.curso === "biologia")).toHaveLength(cuotasDiagnostico("A").biologia);
  });
  it("dura 30 minutos", () => {
    expect(MINUTOS_DIAGNOSTICO).toBe(30);
  });
});
