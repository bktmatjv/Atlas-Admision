import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// El banco real de public/datos, servido como lo haría la web.
const PUBLICO = join(__dirname, "..", "..", "..", "public");
vi.stubGlobal("fetch", async (url: string) => {
  const ruta = join(PUBLICO, String(url).replace(/^\//, ""));
  return new Response(readFileSync(ruta, "utf8"), { status: 200 });
});
const guardado = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => guardado.get(k) ?? null,
  setItem: (k: string, v: string) => void guardado.set(k, v),
  removeItem: (k: string) => void guardado.delete(k),
});

const { supabase } = await import("@/integrations/supabase/client");
const { admisionDb } = await import("@/integrations/supabase/admision");
const { cargarBanco } = await import("./datos");

type Banco = Awaited<ReturnType<typeof cargarBanco>>;
let banco: Banco;
beforeAll(async () => { banco = await cargarBanco(); });
beforeEach(() => guardado.clear());

async function armar(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admision-armar", { body });
  if (error) throw error;
  return (data as { intento_id: string }).intento_id;
}

describe("el banco", () => {
  it("trae los 26 exámenes y más de 2.000 preguntas, todas con clave y opciones", () => {
    expect(banco.examenes).toHaveLength(26);
    expect(banco.preguntas.length).toBeGreaterThan(2000);
    for (const p of banco.preguntas) {
      expect(Object.keys(p.opciones).length).toBeGreaterThanOrEqual(4);
      expect(p.clave === null || p.clave in p.opciones).toBe(true);
    }
  });
});

describe("armar", () => {
  it("un examen real trae sus preguntas en orden, cronometrado", async () => {
    const examen = banco.examenes[0];
    const id = await armar({ modo: "real", examen_id: examen.id, tipo: "cronometrado" });
    const { data: intento } = await admisionDb.from("admision_intentos").select("*").eq("id", id).maybeSingle();
    expect(intento?.tipo).toBe("cronometrado");
    expect(intento?.duration_minutes).toBeGreaterThan(0);
    expect(intento?.preguntas.every((p) => p.startsWith(examen.id + "-"))).toBe(true);
  });

  it("un simulacro del área A mezcla exámenes", async () => {
    const id = await armar({ modo: "simulacro", area: "A", tipo: "cronometrado" });
    const { data: ps } = await supabase.rpc("admision_preguntas_del_intento", { _intento: id });
    expect(ps!.length).toBeGreaterThan(50);
    expect(new Set(ps!.map((p) => p.pregunta_id.split("-").slice(0, 4).join("-"))).size).toBeGreaterThan(1);
    // En curso no viaja la clave.
    expect(ps!.every((p) => p.clave === null && p.solucion === null)).toBe(true);
  });

  it("una práctica respeta curso y número", async () => {
    const curso = banco.preguntas.find((p) => p.curso)!.curso!;
    const id = await armar({ modo: "practica", area: "A", curso, n: 7, ver_soluciones: true });
    const { data: ps } = await supabase.rpc("admision_preguntas_del_intento", { _intento: id });
    expect(ps).toHaveLength(7);
    expect(ps!.every((p) => p.curso === curso)).toBe(true);
  });

  it("el diagnóstico son 30 preguntas en 30 minutos", async () => {
    const id = await armar({ modo: "diagnostico", area: "B" });
    const { data: i } = await admisionDb.from("admision_intentos").select("*").eq("id", id).single();
    expect(i.preguntas).toHaveLength(30);
    expect(i.duration_minutes).toBe(30);
  });

  it("sin nada en el cuaderno, el repaso avisa con un motivo legible", async () => {
    const { error } = await supabase.functions.invoke("admision-armar", { body: { modo: "repaso" } });
    const cuerpo = await error!.context!.json();
    expect(cuerpo.error).toBe("No tienes preguntas por repasar hoy");
  });
});

describe("responder, revelar y entregar", () => {
  it("corrige con +20 / −1,125 / 0, guarda el informe y anota los fallos en el cuaderno", async () => {
    const examen = banco.examenes[0];
    const id = await armar({ modo: "real", examen_id: examen.id, tipo: "cronometrado" });
    const { data: ps } = await supabase.rpc("admision_preguntas_del_intento", { _intento: id });
    const [bien, mal] = ps!.filter((p) => banco.preguntaPorId.get(p.pregunta_id)!.clave);
    const claveDe = (pid: string) => banco.preguntaPorId.get(pid)!.clave!;
    const otra = (pid: string) => Object.keys(banco.preguntaPorId.get(pid)!.opciones).find((l) => l !== claveDe(pid))!;
    await admisionDb.from("admision_respuestas").upsert([
      { intento_id: id, pregunta_id: bien.pregunta_id, opcion: claveDe(bien.pregunta_id), marcada: false },
      { intento_id: id, pregunta_id: mal.pregunta_id, opcion: otra(mal.pregunta_id), marcada: true },
    ], { onConflict: "intento_id,pregunta_id" });

    const { data: informe, error } = await supabase.functions.invoke("admision-entregar", { body: { intento_id: id } });
    expect(error).toBeNull();
    expect(informe).toMatchObject({ aciertos: 1, errores: 1, puntaje: 20 - 1.125 });

    const { data: i } = await admisionDb.from("admision_intentos").select("*").eq("id", id).single();
    expect(i.estado).toBe("entregado");
    const { data: rs } = await admisionDb.from("admision_respuestas").select("*").eq("intento_id", id);
    expect(rs!.find((r) => r.pregunta_id === bien.pregunta_id)?.correcta).toBe(true);
    expect(rs!.find((r) => r.pregunta_id === mal.pregunta_id)).toMatchObject({ correcta: false, marcada: true });
    // Entregado, ya viaja la clave.
    const { data: despues } = await supabase.rpc("admision_preguntas_del_intento", { _intento: id });
    expect(despues!.find((p) => p.pregunta_id === bien.pregunta_id)?.clave).toBe(claveDe(bien.pregunta_id));

    const { data: cuaderno } = await admisionDb.from("admision_errores").select("pregunta_id, caja, proxima, dominada");
    expect(cuaderno!.map((x) => x.pregunta_id)).toEqual([mal.pregunta_id]);
    expect(cuaderno![0].caja).toBe(1);
  });

  it("revelar solo funciona en una práctica con soluciones y tras responder", async () => {
    const curso = banco.preguntas.find((p) => p.curso)!.curso!;
    const id = await armar({ modo: "practica", curso, n: 3, ver_soluciones: true });
    const { data: ps } = await supabase.rpc("admision_preguntas_del_intento", { _intento: id });
    const pid = ps![0].pregunta_id;
    expect((await supabase.rpc("admision_revelar", { _intento: id, _pregunta: pid })).data).toEqual([]);
    await admisionDb.from("admision_respuestas").upsert({ intento_id: id, pregunta_id: pid, opcion: "A" }, { onConflict: "intento_id,pregunta_id" });
    const { data } = await supabase.rpc("admision_revelar", { _intento: id, _pregunta: pid });
    expect(data![0].clave).toBe(banco.preguntaPorId.get(pid)!.clave);
  });

  it("entregar dos veces devuelve el mismo informe", async () => {
    const id = await armar({ modo: "diagnostico", area: "A" });
    const a = await supabase.functions.invoke("admision-entregar", { body: { intento_id: id } });
    const b = await supabase.functions.invoke("admision-entregar", { body: { intento_id: id } });
    expect(b.data).toEqual(a.data);
  });
});

describe("temas frecuentes", () => {
  it("por curso, con los procesos del área", async () => {
    const { data } = await supabase.rpc("admision_temas_frecuentes", { _area: "A" });
    expect(data!.length).toBeGreaterThan(10);
    expect(data!.every((t) => t.procesos <= t.procesos_del_area && t.preguntas >= t.procesos)).toBe(true);
  });
});

describe("el perfil", () => {
  it("se crea con upsert y se vuelve a leer", async () => {
    const { data } = await admisionDb.from("admision_perfil")
      .upsert({ user_id: "local", universidad: "unmsm", carrera_id: "x" }, { onConflict: "user_id" }).select("*").single();
    expect(data.carrera_id).toBe("x");
    const { data: otra } = await admisionDb.from("admision_perfil")
      .upsert({ user_id: "local", horas_semana: 10 }, { onConflict: "user_id" }).select("*").single();
    expect(otra).toMatchObject({ carrera_id: "x", horas_semana: 10 });
    const { data: leida } = await admisionDb.from("admision_perfil").select("*").maybeSingle();
    expect(leida?.horas_semana).toBe(10);
  });
});
