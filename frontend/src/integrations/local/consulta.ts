import { cargarBanco, cargarUnmsm } from "./datos";
import { escribirTabla, leerTabla, TABLAS_DEL_ALUMNO, type TablaDelAlumno } from "./almacen";

/**
 * Lo poco de supabase-js que usa el módulo de admisión (`from().select().eq().order()…`, `upsert`,
 * `insert`, `update`), sobre los datos locales. Así las pantallas copiadas de CALIBRA no cambian.
 *
 * Las columnas de `select` no recortan la fila: quien pide menos columnas recibe la fila entera.
 */

type Fila = Record<string, unknown>;
export type Resultado<T> = { data: T; error: Error | null };

export const ID_DEL_ALUMNO = "local";

/** La clave de cada tabla del alumno, para `upsert`. */
const CLAVES: Record<TablaDelAlumno, string[]> = {
  admision_intentos: ["id"],
  admision_respuestas: ["intento_id", "pregunta_id"],
  admision_perfil: ["user_id"],
  admision_errores: ["user_id", "pregunta_id"],
};

const ahora = () => new Date().toISOString();

/** Lo que pondría la base por defecto al insertar. */
function conValoresPorDefecto(tabla: TablaDelAlumno, fila: Fila): Fila {
  switch (tabla) {
    case "admision_intentos":
      return {
        id: crypto.randomUUID(), user_id: ID_DEL_ALUMNO, examen_id: null, filtro: null, ver_soluciones: false,
        started_at: ahora(), duration_minutes: null, estado: "en_curso", entregado_at: null, puntaje: null,
        informe: null, created_at: ahora(), ...fila,
      };
    case "admision_respuestas":
      return { opcion: null, marcada: false, segundos: 0, revelada: false, correcta: null, confianza: null, updated_at: ahora(), ...fila };
    case "admision_perfil":
      return { user_id: ID_DEL_ALUMNO, universidad: "unmsm", carrera_id: null, horas_semana: null, origen: "alumno", updated_at: ahora(), ...fila };
    case "admision_errores":
      return { user_id: ID_DEL_ALUMNO, updated_at: ahora(), ...fila };
  }
}

/** Las tablas fijas, de los JSON de public/datos. */
async function leerFija(tabla: string): Promise<Fila[]> {
  switch (tabla) {
    case "admision_examenes": return (await cargarBanco()).examenes as unknown as Fila[];
    case "admision_preguntas": return (await cargarBanco()).preguntas as unknown as Fila[];
    case "admision_textos": return (await cargarBanco()).textos as unknown as Fila[];
    case "admision_carreras": return (await cargarUnmsm()).carreras as unknown as Fila[];
    case "admision_procesos": return (await cargarUnmsm()).procesos as unknown as Fila[];
    case "admision_resultados": return (await cargarUnmsm()).resultados as unknown as Fila[];
    case "admision_dia_examen": return (await cargarUnmsm()).dia_examen as unknown as Fila[];
    case "admision_distribuciones": return (await cargarUnmsm()).distribuciones as unknown as Fila[];
    default: throw new Error(`Tabla desconocida: ${tabla}`);
  }
}

const esDelAlumno = (t: string): t is TablaDelAlumno => (TABLAS_DEL_ALUMNO as readonly string[]).includes(t);

type Operacion =
  | { tipo: "select" }
  | { tipo: "upsert"; filas: Fila[]; claves: string[] }
  | { tipo: "insert"; filas: Fila[] }
  | { tipo: "update"; cambio: Fila };

function comparar(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return a < b ? -1 : 1;
}

export class Consulta<T = Fila> implements PromiseLike<Resultado<T[]>> {
  private filtros: ((f: Fila) => boolean)[] = [];
  private orden: { columna: string; ascendente: boolean }[] = [];
  private tope: number | null = null;
  private operacion: Operacion = { tipo: "select" };

  constructor(private readonly tabla: string) {}

  select(_columnas?: string): this { return this; }
  eq(columna: string, valor: unknown): this { this.filtros.push((f) => f[columna] === valor); return this; }
  neq(columna: string, valor: unknown): this { this.filtros.push((f) => f[columna] !== valor); return this; }
  in(columna: string, valores: readonly unknown[]): this { const s = new Set(valores); this.filtros.push((f) => s.has(f[columna])); return this; }
  lte(columna: string, valor: unknown): this { this.filtros.push((f) => comparar(f[columna], valor) <= 0); return this; }
  gte(columna: string, valor: unknown): this { this.filtros.push((f) => comparar(f[columna], valor) >= 0); return this; }
  order(columna: string, opciones?: { ascending?: boolean }): this { this.orden.push({ columna, ascendente: opciones?.ascending ?? true }); return this; }
  limit(n: number): this { this.tope = n; return this; }

  upsert(filas: Partial<T> | Partial<T>[], opciones?: { onConflict?: string }): this {
    const tabla = this.tabla as TablaDelAlumno;
    const claves = opciones?.onConflict?.split(",").map((s) => s.trim()) ?? CLAVES[tabla];
    this.operacion = { tipo: "upsert", filas: ([] as Fila[]).concat(filas as Fila | Fila[]), claves };
    return this;
  }
  insert(filas: Partial<T> | Partial<T>[]): this {
    this.operacion = { tipo: "insert", filas: ([] as Fila[]).concat(filas as Fila | Fila[]) };
    return this;
  }
  update(cambio: Partial<T>): this {
    this.operacion = { tipo: "update", cambio: cambio as Fila };
    return this;
  }

  /** La primera fila, o error si no hay ninguna. */
  async single(): Promise<Resultado<T>> {
    const { data, error } = await this.ejecutar();
    if (error) return { data: null as T, error };
    if (!data.length) return { data: null as T, error: new Error("No se encontró la fila") };
    return { data: data[0], error: null };
  }
  /** La primera fila, o null. */
  async maybeSingle(): Promise<Resultado<T | null>> {
    const { data, error } = await this.ejecutar();
    return { data: error ? null : data[0] ?? null, error };
  }

  then<A = Resultado<T[]>, B = never>(
    bien?: ((valor: Resultado<T[]>) => A | PromiseLike<A>) | null,
    mal?: ((motivo: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.ejecutar().then(bien, mal);
  }

  private pasa = (f: Fila) => this.filtros.every((p) => p(f));

  private async ejecutar(): Promise<Resultado<T[]>> {
    try {
      const filas = this.operacion.tipo === "select" ? await this.leer() : this.escribir();
      return { data: filas as T[], error: null };
    } catch (e) {
      return { data: null as unknown as T[], error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  private async leer(): Promise<Fila[]> {
    const todas = esDelAlumno(this.tabla) ? leerTabla<Fila>(this.tabla) : await leerFija(this.tabla);
    let filas = todas.filter(this.pasa);
    if (this.orden.length) {
      filas = [...filas].sort((a, b) => {
        for (const { columna, ascendente } of this.orden) {
          const c = comparar(a[columna], b[columna]);
          if (c) return ascendente ? c : -c;
        }
        return 0;
      });
    }
    // Copias: quien recibe la fila puede mutarla sin tocar lo guardado.
    return (this.tope === null ? filas : filas.slice(0, this.tope)).map((f) => structuredClone(f));
  }

  /** Las escrituras van solo a las tablas del alumno; devuelven las filas tocadas. */
  private escribir(): Fila[] {
    if (!esDelAlumno(this.tabla)) throw new Error(`${this.tabla} es de solo lectura`);
    const tabla = this.tabla;
    const filas = leerTabla<Fila>(tabla);
    const tocadas: Fila[] = [];
    const op = this.operacion;
    if (op.tipo === "insert") {
      for (const f of op.filas) {
        const nueva = conValoresPorDefecto(tabla, f);
        filas.push(nueva);
        tocadas.push(nueva);
      }
    } else if (op.tipo === "upsert") {
      for (const f of op.filas) {
        const i = filas.findIndex((x) => op.claves.every((k) => x[k] === (f[k] ?? (k === "user_id" ? ID_DEL_ALUMNO : undefined))));
        // Como ON CONFLICT DO UPDATE: las columnas que no vienen se quedan como estaban.
        const fila = i >= 0 ? { ...filas[i], ...f } : conValoresPorDefecto(tabla, f);
        if (i >= 0) filas[i] = fila; else filas.push(fila);
        tocadas.push(fila);
      }
    } else if (op.tipo === "update") {
      filas.forEach((f, i) => {
        if (!this.pasa(f)) return;
        filas[i] = { ...f, ...op.cambio };
        tocadas.push(filas[i]);
      });
    }
    escribirTabla(tabla, filas);
    return tocadas.map((f) => structuredClone(f));
  }
}
