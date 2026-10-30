/**
 * Los datos oficiales de San Marcos, con la forma de las tablas de Atlas (`admision_carreras`,
 * `admision_procesos`, `admision_resultados`). Los JSON vienen de Audix Admisión
 * (`scripts/admision/unmsm/`, ver su FUENTES.md); aquí solo se traducen los nombres de campo.
 * Sin dependencias: lo importa también `scripts/admision/sql-de-datos-unmsm.mjs`.
 */

export type AreaUnmsm = "A" | "B" | "C" | "D" | "E";

export interface DatoConFuente { fuente: string; verificado: boolean; nota: string | null }

export interface CarreraUnmsm extends DatoConFuente { id: string; nombre: string; area: AreaUnmsm; codigo_oca: string | null }

export interface Jornada { fecha: string; areas: AreaUnmsm[]; detalle?: string }

export interface ProcesoUnmsm extends DatoConFuente {
  ciclo: string; fecha_examen: string; jornadas: Jornada[]; vacantes_totales: number | null;
}

export interface ResultadoUnmsm extends DatoConFuente {
  ciclo: string; carrera_id: string; vacantes: number | null; postulantes: number; asistentes: number | null;
  ingresantes: number; ultimo_ingresante: number | null; maximo: number | null;
}

/* El formato de Audix: «unmsm-A», «unmsm-2026-I», camelCase. */
interface CarreraJson { id: string; areaId: string; nombre: string; codigoOca?: string; fuente: string; verificado: boolean; nota?: string }
interface ProcesoJson { codigo: string; fechaExamen: string; jornadas: { fecha: string; areas: string[]; detalle?: string }[]; vacantesTotales?: number; fuente: string; verificado: boolean; nota?: string }
interface ResultadoJson {
  procesoId: string; carreraId: string; vacantes: number | null; postulantes: number; asistentes?: number | null;
  ingresantes: number; puntajeUltimoIngresante: number | null; puntajeMaximo: number | null; fuente: string; verificado: boolean; nota?: string;
}

const sinPrefijo = (s: string) => s.replace(/^unmsm-/, "");

export function carreraDeJson(c: CarreraJson): CarreraUnmsm {
  return {
    id: c.id, nombre: c.nombre, area: sinPrefijo(c.areaId) as AreaUnmsm, codigo_oca: c.codigoOca ?? null,
    fuente: c.fuente, verificado: c.verificado, nota: c.nota ?? null,
  };
}

export function procesoDeJson(p: ProcesoJson): ProcesoUnmsm {
  return {
    ciclo: p.codigo, fecha_examen: p.fechaExamen, jornadas: p.jornadas as Jornada[], vacantes_totales: p.vacantesTotales ?? null,
    fuente: p.fuente, verificado: p.verificado, nota: p.nota ?? null,
  };
}

export function resultadoDeJson(r: ResultadoJson): ResultadoUnmsm {
  return {
    ciclo: sinPrefijo(r.procesoId), carrera_id: r.carreraId, vacantes: r.vacantes, postulantes: r.postulantes,
    asistentes: r.asistentes ?? null, ingresantes: r.ingresantes, ultimo_ingresante: r.puntajeUltimoIngresante,
    maximo: r.puntajeMaximo, fuente: r.fuente, verificado: r.verificado, nota: r.nota ?? null,
  };
}

export interface ItemDelDia extends DatoConFuente {
  id: string; categoria: "documentos" | "llevar" | "horario" | "prohibido" | "durante"; orden: number; texto: string; detalle: string | null;
}
export interface DistribucionUnmsm { ciclo: string; carrera_id: string; desde: number; ancho: number; conteos: number[]; fuente: string; verificado: boolean }

interface ItemJson { id: string; categoria: string; texto: string; detalle?: string; fuente: string; verificado: boolean; nota?: string }
interface DistribucionJson { procesoId: string; carreraId: string; desde: number; ancho: number; conteos: number[]; fuente: string; verificado: boolean }

export function itemDeJson(x: ItemJson, orden: number): ItemDelDia {
  return { id: x.id, categoria: x.categoria as ItemDelDia["categoria"], orden, texto: x.texto, detalle: x.detalle ?? null, fuente: x.fuente, verificado: x.verificado, nota: x.nota ?? null };
}

export function distribucionDeJson(d: DistribucionJson): DistribucionUnmsm {
  return { ciclo: sinPrefijo(d.procesoId), carrera_id: d.carreraId, desde: d.desde, ancho: d.ancho, conteos: d.conteos, fuente: d.fuente, verificado: d.verificado };
}
