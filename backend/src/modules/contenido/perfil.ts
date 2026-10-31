import { BadRequestException, NotFoundException } from "@nestjs/common";
import { z } from "zod";
import type { Database } from "../../database/database.js";
import { validate } from "../../http.js";
export const perfilSchema = z.object({
  etapa: z.enum(["postulante", "universitario", "escolar", "otro"]).optional(),
  universidad: z.string().trim().min(1).max(100).optional(),
  area: z.enum(["A", "B", "C", "D", "E"]).nullable().optional(),
  carrera_id: z.string().max(100).nullable().optional(),
  proceso: z.string().max(30).nullable().optional(),
  objetivos: z.array(z.enum(["entender", "examen", "errores", "material"])).max(4).optional(),
  cursos_dificiles: z.array(z.string().max(100)).max(25).optional(),
  carrera_texto: z.string().trim().max(120).optional(),
  horas_semana: z.number().int().min(1).max(80).nullable().optional(),
  onboarding_completo: z.boolean().optional(),
  onboarding_omitido: z.boolean().optional(),
}).strict();
export async function guardarPerfil(db: Database, actor: string, input: unknown) {
  const p = validate(perfilSchema, input);
  return db.transaction(async (m) => {
    await m.query("SELECT id FROM actores WHERE id=$1 FOR UPDATE", [actor]);
    const [anterior] = await db.query<{ data: Record<string, unknown> }>("SELECT data FROM perfiles WHERE actor_id=$1", [actor], m);
    const data: Record<string, unknown> = { user_id: actor, universidad: "unmsm", carrera_id: null, horas_semana: null, origen: "alumno", ...anterior?.data, ...p, updated_at: new Date().toISOString() };
    if (p.universidad && p.universidad !== "unmsm") {
      if (p.carrera_id || p.area || p.proceso) throw new BadRequestException("El catálogo de admisión solo corresponde a San Marcos.");
      data.carrera_id = null; data.area = null; data.proceso = null;
    }
    if (data.carrera_id) {
      const [c] = await db.query<{ data: { area: string } }>("SELECT data FROM carreras WHERE id=$1", [data.carrera_id], m);
      if (!c) throw new NotFoundException("Carrera no encontrada.");
      if (p.area && p.area !== c.data.area) throw new BadRequestException("La carrera no pertenece al área elegida.");
      data.area = c.data.area;
    }
    if (data.area && !(await db.query("SELECT id FROM carreras WHERE data->>'area'=$1 LIMIT 1", [data.area], m)).length) throw new NotFoundException("Área no encontrada.");
    if (data.proceso && !(await db.query("SELECT ciclo FROM procesos WHERE ciclo=$1", [data.proceso], m)).length) throw new NotFoundException("Proceso no encontrado.");
    if (p.cursos_dificiles?.length) {
      const cursos = await db.query<{ id: string }>("SELECT id FROM cursos WHERE id=ANY($1::text[])", [p.cursos_dificiles], m);
      if (new Set(p.cursos_dificiles).size !== cursos.length) throw new NotFoundException("Curso no encontrado.");
    }
    if (p.objetivos) data.objetivos = [...new Set(p.objetivos)];
    if (p.cursos_dificiles) data.cursos_dificiles = [...new Set(p.cursos_dificiles)];
    if (p.onboarding_completo) {
      if (!data.etapa || !Array.isArray(data.objetivos) || !data.objetivos.length) throw new BadRequestException("Completa tu etapa y al menos un objetivo.");
      if (data.etapa === "postulante" && data.universidad === "unmsm" && (!data.carrera_id || !data.proceso)) throw new BadRequestException("Elige tu carrera y proceso de San Marcos.");
      data.onboarding_omitido = false;
    }
    await m.query("INSERT INTO perfiles(actor_id,data) VALUES($1,$2) ON CONFLICT(actor_id) DO UPDATE SET data=EXCLUDED.data", [actor, data]);
    return data;
  });
}
/** Lista blanca: nunca cuentas, tokens, códigos ni campos arbitrarios del perfil. */
export async function resumenPerfil(db: Database, actor: string) {
  const [fila] = await db.query<{ data: Record<string, unknown>; carrera: string | null }>("SELECT p.data,c.data->>'nombre' AS carrera FROM perfiles p LEFT JOIN carreras c ON c.id=p.data->>'carrera_id' WHERE actor_id=$1", [actor]);
  if (!fila) return null;
  const { etapa, universidad, area, objetivos, cursos_dificiles, carrera_texto } = fila.data;
  return { etapa, universidad, area, carrera: fila.carrera || carrera_texto, objetivos, cursos_dificiles };
}
