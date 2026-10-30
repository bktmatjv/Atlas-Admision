import { describe, expect, it } from "vitest";
import carreras from "../../../../backend/data/fuentes/unmsm/carreras.json";
import resultados from "../../../../backend/data/fuentes/unmsm/resultados.json";
import procesos from "../../../../backend/data/fuentes/unmsm/procesos.json";
import { carreraDeJson, procesoDeJson, resultadoDeJson } from "./datos-unmsm";

/**
 * Los datos de San Marcos traídos de Audix (scripts/admision/unmsm/). Si alguien los regenera con
 * importar-oca.mjs y algo se tuerce —un resultado sin escuela, un dato sin fuente—, salta aquí.
 */
describe("datos de San Marcos", () => {
  const cs = carreras.map(carreraDeJson);
  const rs = resultados.map(resultadoDeJson);
  const ps = procesos.map(procesoDeJson);

  it("trae las 120 escuelas, los 206 resultados y los 3 procesos", () => {
    expect(cs).toHaveLength(120);
    expect(rs).toHaveLength(206);
    expect(ps.map((p) => p.ciclo)).toEqual(["2026-I", "2026-II", "2027-I"]);
  });

  it("cada fila lleva fuente y verificado", () => {
    for (const x of [...cs, ...rs, ...ps]) {
      expect(x.fuente.length).toBeGreaterThan(10);
      expect(typeof x.verificado).toBe("boolean");
    }
  });

  it("las áreas son A–E y los ids no se repiten", () => {
    expect(new Set(cs.map((c) => c.id)).size).toBe(cs.length);
    expect(cs.every((c) => ["A", "B", "C", "D", "E"].includes(c.area))).toBe(true);
  });

  it("todo resultado apunta a una escuela y a un proceso que existen", () => {
    const ids = new Set(cs.map((c) => c.id));
    const ciclos = new Set(ps.map((p) => p.ciclo));
    for (const r of rs) {
      expect(ids.has(r.carrera_id), r.carrera_id).toBe(true);
      expect(ciclos.has(r.ciclo), r.ciclo).toBe(true);
    }
  });

  it("Geofísica sigue por verificar (no figura en la API de carreras)", () => {
    expect(cs.find((c) => c.id === "geofisica")?.verificado).toBe(false);
  });

  it("Medicina Humana 2026-I coincide con lo publicado (4 709 postulantes, 55 ingresantes, máximo 1679,125)", () => {
    const r = rs.find((x) => x.ciclo === "2026-I" && x.carrera_id === "medicina-humana");
    expect(r).toMatchObject({ postulantes: 4709, ingresantes: 55, maximo: 1679.125 });
  });

  it("solo agregados: ningún campo con nombres ni códigos de postulantes", () => {
    const campos = new Set(resultados.flatMap((r) => Object.keys(r)));
    expect([...campos].sort()).toEqual(
      ["asistentes", "carreraId", "fuente", "ingresantes", "nota", "postulantes", "procesoId", "puntajeMaximo", "puntajeMinimo", "puntajeUltimoIngresante", "vacantes", "verificado"],
    );
  });
});
