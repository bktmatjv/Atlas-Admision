import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { CURSOS } from "@atlas/motor/temario";
import { createDataSource } from "./database.js";
import type { Settings } from "../config.js";
const question = z
  .object({
    id: z.string(),
    examen_id: z.string(),
    texto_id: z.string().nullable(),
    curso: z.string(),
    tema: z.string(),
    enunciado: z.string(),
    opciones: z.record(z.string(), z.string()),
    clave: z.string(),
    solucion: z.string(),
    graficos: z.array(z.string()),
  })
  .passthrough();
const bankSchema = z.object({
  examenes: z.array(z.object({ id: z.string() }).passthrough()),
  textos: z.array(
    z.object({ id: z.string(), examen_id: z.string() }).passthrough(),
  ),
  preguntas: z.array(question),
});
const metadataSchema = z.object({
  carreras: z.array(z.object({ id: z.string() }).passthrough()),
  procesos: z.array(z.object({ ciclo: z.string() }).passthrough()),
  resultados: z.array(
    z.object({ ciclo: z.string(), carrera_id: z.string() }).passthrough(),
  ),
  distribuciones: z.array(
    z.object({ ciclo: z.string(), carrera_id: z.string() }).passthrough(),
  ),
  dia_examen: z.array(z.object({ id: z.string() }).passthrough()),
});
function parseJson<S extends z.ZodType>(
  raw: string,
  label: string,
  schema: S,
): z.output<S> {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    throw new Error(`JSON inválido o incompatible: ${label}`);
  }
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + stable(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export async function importBank(cfg: Settings, dryRun = false) {
  const dir = resolve(cfg.DATA_DIR),
    raw = await readFile(resolve(dir, "banco.json"), "utf8");
  const metaRaw = await readFile(resolve(dir, "unmsm.json"), "utf8");
  const b = parseJson(raw, "banco.json", bankSchema),
    u = parseJson(metaRaw, "unmsm.json", metadataSchema);
  const unique = (rows: { id: string }[], name: string) => {
    if (new Set(rows.map((r) => r.id)).size !== rows.length)
      throw new Error(`IDs duplicados: ${name}`);
  };
  unique(b.preguntas, "preguntas");
  unique(b.examenes, "exámenes");
  unique(b.textos, "lecturas");
  unique(u.carreras, "carreras");
  for (const p of b.preguntas) {
    if (
      !b.examenes.some((e) => e.id === p.examen_id) ||
      (p.texto_id && !b.textos.some((t) => t.id === p.texto_id))
    )
      throw new Error("Referencia huérfana: " + p.id);
    if (
      !Object.hasOwn(p.opciones, p.clave) ||
      !CURSOS.find((c) => c.id === p.curso)?.temas.some((t) => t.id === p.tema)
    )
      throw new Error("Contenido inválido: " + p.id);
  }
  for (const r of [...u.resultados, ...u.distribuciones])
    if (
      !u.carreras.some((c) => c.id === r.carrera_id) ||
      !u.procesos.some((p) => p.ciclo === r.ciclo)
    )
      throw new Error("Metadato con referencia huérfana.");
  const hash = createHash("sha256").update(raw).update(metaRaw).digest("hex");
  const report = {
    examenes: b.examenes.length,
    preguntas: b.preguntas.length,
    lecturas: b.textos.length,
    carreras: u.carreras.length,
    resultados: u.resultados.length,
    hash,
  };
  if (dryRun) return report;
  const ds = createDataSource(cfg.DATABASE_URL);
  try {
    await ds.initialize();
    await ds.transaction(async (m) => {
      await m.query("SELECT pg_advisory_xact_lock(1770000001)");
      if (
        (
          await m.query("SELECT hash FROM importaciones_banco WHERE hash=$1", [
            hash,
          ])
        ).length
      )
        return;
      for (const c of CURSOS) {
        await m.query(
          "INSERT INTO cursos VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [c.id, c.nombre, c.bloque],
        );
        for (const t of c.temas)
          await m.query(
            "INSERT INTO temas VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
            [c.id, t.id, t.nombre],
          );
      }
      // Tabla y claves son un contrato cerrado, jamás nombres proporcionados por HTTP o IA.
      type Table =
        | "examenes"
        | "lecturas"
        | "preguntas"
        | "carreras"
        | "procesos"
        | "resultados"
        | "distribuciones"
        | "items_dia_examen";
      async function insert(
        table: Table,
        keys: Record<string, string>,
        values: Record<string, unknown>,
      ) {
        const old = await m
          .createQueryBuilder()
          .select("row.data", "data")
          .from(table, "row")
          .where(keys)
          .getRawOne<{ data: unknown }>();
        if (old && stable(old.data) !== stable(values.data))
          throw new Error(
            "Colisión incompatible en " +
              table +
              ": " +
              Object.values(keys).join("/"),
          );
        await m
          .createQueryBuilder()
          .insert()
          .into(table)
          .values(values)
          .orIgnore()
          .execute();
      }
      for (const e of b.examenes)
        await insert("examenes", { id: e.id }, { id: e.id, data: e });
      for (const t of b.textos)
        await insert(
          "lecturas",
          { id: t.id },
          { id: t.id, examen_id: t.examen_id, data: t },
        );
      for (const p of b.preguntas) {
        const familia = createHash("sha256")
          .update(
            p.enunciado.toLowerCase().replace(/\s+/g, " ").trim() +
              "|" +
              stable(p.opciones),
          )
          .digest("hex");
        await insert(
          "preguntas",
          { id: p.id },
          {
            id: p.id,
            examen_id: p.examen_id,
            texto_id: p.texto_id,
            curso_id: p.curso,
            tema_id: p.tema,
            familia,
            data: p,
          },
        );
      }
      for (const c of u.carreras)
        await insert("carreras", { id: c.id }, { id: c.id, data: c });
      for (const p of u.procesos)
        await insert(
          "procesos",
          { ciclo: p.ciclo },
          { ciclo: p.ciclo, data: p },
        );
      for (const r of u.resultados)
        await insert(
          "resultados",
          { ciclo: r.ciclo, carrera_id: r.carrera_id },
          { ciclo: r.ciclo, carrera_id: r.carrera_id, data: r },
        );
      for (const r of u.distribuciones)
        await insert(
          "distribuciones",
          { ciclo: r.ciclo, carrera_id: r.carrera_id },
          { ciclo: r.ciclo, carrera_id: r.carrera_id, data: r },
        );
      for (const i of u.dia_examen)
        await insert("items_dia_examen", { id: i.id }, { id: i.id, data: i });
      await m.query("INSERT INTO importaciones_banco VALUES($1,$2,now())", [
        hash,
        report,
      ]);
    });
    const [{ n }] = await ds.query("SELECT count(*)::int AS n FROM preguntas");
    if (n < b.preguntas.length)
      throw new Error("El conteo importado es menor que el snapshot.");
    return report;
  } finally {
    if (ds.isInitialized) await ds.destroy();
  }
}
