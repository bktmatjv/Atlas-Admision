import { z } from "zod";
import { clavesDe, esClaveDe } from "../seguimiento/actividades.js";
import {
  igualesNumeros,
  normalizarNumero,
  verificarIgualdad,
} from "../seguimiento/numeros.js";
import { PLANTILLAS } from "../seguimiento/plantillas.js";
// Artefactos del turno del agente (diseño §3) y sus cinco capas de validación (§5):
// forma, referencias, matemática, atribución y filtración.
export const MAX_BLOQUES = 6;
export const MAX_OPS = 8;
const txt = (max: number) => z.string().min(1).max(max);
const num = z.number().finite();
const nombrePlantilla = z
  .string()
  .refine(
    (n) => PLANTILLAS.some((p) => p.nombre === n),
    "Plantilla desconocida",
  );
const semilla = z.number().int().min(0).max(1_000_000);
const paso = z
  .object({ texto: txt(500), cuenta: txt(120).optional() })
  .strict();
const visualSchema = z.discriminatedUnion("forma", [
  z
    .object({
      tipo: z.literal("visual"),
      forma: z.literal("cadena_porcentual"),
      pasos: z
        .array(z.object({ op: txt(20).optional(), valor: num }).strict())
        .min(2)
        .max(6),
    })
    .strict(),
  z
    .object({
      tipo: z.literal("visual"),
      forma: z.literal("barra_de_partes"),
      total: num.positive(),
      partes: z.number().int().min(1).max(40),
      marcadas: z.number().int().min(0),
      fraccion: txt(20).optional(),
    })
    .strict(),
  z
    .object({
      tipo: z.literal("visual"),
      forma: z.literal("tabla_proporcion"),
      columnas: z.tuple([txt(40), txt(40)]),
      filas: z
        .array(z.tuple([num, num]))
        .min(2)
        .max(8),
      relacion: z.enum(["directa", "inversa"]),
    })
    .strict(),
  z
    .object({
      tipo: z.literal("visual"),
      forma: z.literal("recta_numerica"),
      min: num,
      max: num,
      puntos: z
        .array(z.object({ valor: num, etiqueta: txt(40).optional() }).strict())
        .min(1)
        .max(8),
    })
    .strict(),
]);
const bloqueBase = [
  z
    .object({
      tipo: z.literal("pregunta_socratica"),
      texto: txt(600),
      respuestas_rapidas: z.array(txt(80)).max(4).optional(),
    })
    .strict(),
  z
    .object({
      tipo: z.literal("contraste"),
      tuyo: z.array(txt(200)).min(1).max(5),
      correcto: z.array(txt(200)).min(1).max(5),
    })
    .strict(),
  z
    .object({
      tipo: z.literal("razonamiento_anotado"),
      pasos: z
        .array(
          z
            .object({
              texto: txt(300),
              estado: z.enum(["ok", "revisar"]),
              cita: txt(300),
            })
            .strict(),
        )
        .min(1)
        .max(6),
    })
    .strict(),
  z
    .object({
      tipo: z.literal("prediccion"),
      pregunta: txt(300),
      plantilla: nombrePlantilla,
      semilla,
    })
    .strict(),
  z
    .object({
      tipo: z.literal("ejemplo_paso_a_paso"),
      pasos: z.array(paso).min(1).max(8),
    })
    .strict(),
  z
    .object({
      tipo: z.literal("practica"),
      plantilla: nombrePlantilla,
      semilla,
      historia: txt(400).optional(),
    })
    .strict(),
  z.object({ tipo: z.literal("en_tus_palabras"), consigna: txt(400) }).strict(),
  z
    .object({ tipo: z.literal("invitacion_comprobar"), texto: txt(300) })
    .strict(),
  z
    .object({ tipo: z.literal("cita"), fragmento_id: z.string().uuid() })
    .strict(),
] as const;
export const bloqueSchema = z.union([...bloqueBase, visualSchema]);
export type Bloque = z.infer<typeof bloqueSchema>;
export const TIPOS_BLOQUE = [
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
] as const;
export const TIPOS_NODO = [
  "concepto",
  "idea",
  "error",
  "ejemplo",
  "pregunta",
] as const;
export const TIPOS_ARISTA = [
  "subtema",
  "requiere",
  "relacionado",
  "contrasta_con",
  "ejemplo_de",
  "confusion_con",
] as const;
const ref = txt(60);
export const opSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("crear_nodo"),
      ref_temporal: txt(40),
      tipo: z.enum(TIPOS_NODO),
      titulo: txt(120),
      resumen: txt(600),
      idea_clave: z.string().max(60).nullable().optional(),
      padre: ref.optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("relacionar"),
      origen: ref,
      destino: ref,
      tipo: z.enum(TIPOS_ARISTA),
    })
    .strict(),
  z
    .object({
      op: z.literal("editar_nodo"),
      nodo: ref,
      titulo: txt(120).optional(),
      resumen: txt(600).optional(),
    })
    .strict()
    .refine((o) => o.titulo !== undefined || o.resumen !== undefined, {
      message: "Indica titulo o resumen",
    }),
  z
    .object({
      op: z.literal("fusionar"),
      nodos: z.array(ref).min(2).max(5),
      en: ref,
    })
    .strict(),
  z.object({ op: z.literal("enfocar"), nodo: ref }).strict(),
]);
export type OpGrafo = z.infer<typeof opSchema>;
export const turnoSchema = z.object({
  mensaje: txt(4000),
  bloques: z.array(z.unknown()).default([]),
  grafo_ops: z.array(z.unknown()).default([]),
});
// Capa 1 para el turno completo: si falla se pide una reparación.
export function validarForma(
  crudo: unknown,
):
  | { ok: true; turno: z.output<typeof turnoSchema> }
  | { ok: false; error: string } {
  const r = turnoSchema.safeParse(crudo);
  return r.success
    ? { ok: true, turno: r.data }
    : {
        ok: false,
        error: r.error.issues
          .map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`)
          .join("; "),
      };
}
export type ContextoValidacion = {
  concepto: string | null;
  // Nodos del actor (ids) y sus aristas actuales.
  nodos: ReadonlySet<string>;
  aristas: { origen: string; destino: string; tipo: string }[];
  totalNodos: number;
  maxNodos: number;
  maxAristas: number;
  // Lo que el estudiante realmente escribió (respuesta, justificación, mensajes).
  textosEstudiante: string[];
  respuestaEstudiante: string | null;
  fragmentos: ReadonlySet<string>;
  // Valor correcto de la comprobación activa, si hay una.
  respuestaActiva: number | null;
};
export type Descarte = {
  tipo: "mensaje" | "bloque" | "op";
  indice: number;
  motivo: string;
};
export type TurnoValidado = {
  mensaje: string;
  bloques: Bloque[];
  grafo_ops: OpGrafo[];
  descartes: Descarte[];
};
export const MENSAJE_FILTRADO =
  "Mientras la comprobación está activa no puedo darte datos de su resolución. Cuando la entregues, lo revisamos juntos.";
export const normalizarTexto = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
// La cita tiene que aparecer literalmente (comparación normalizada) en lo que escribió el estudiante.
export const esLiteral = (textos: string[], cita: string) => {
  const c = normalizarTexto(cita);
  return c.length >= 3 && textos.some((t) => normalizarTexto(t).includes(c));
};
const numerosEn = (t: string) =>
  [...t.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) =>
    Number(m[0].replace(",", ".")),
  );
const contieneRespuesta = (valor: unknown, respuesta: number): boolean =>
  numerosEn(JSON.stringify(valor)).some((n) => igualesNumeros(n, respuesta));
const aprox = (a: number, b: number) => Math.abs(a - b) <= 0.005 + 1e-9;
function verificarVisual(v: z.infer<typeof visualSchema>): string | null {
  switch (v.forma) {
    case "cadena_porcentual": {
      for (let i = 1; i < v.pasos.length; i++) {
        const m = /^([+-])\s*(\d+(?:[.,]\d+)?)\s*%$/.exec(v.pasos[i].op ?? "");
        if (!m)
          return `El paso ${i + 1} no tiene una operación porcentual válida`;
        const p = Number(m[2].replace(",", "."));
        const esperado =
          v.pasos[i - 1].valor * (1 + ((m[1] === "+" ? 1 : -1) * p) / 100);
        if (!aprox(esperado, v.pasos[i].valor))
          return `El paso ${i + 1} no cierra: ${v.pasos[i - 1].valor} ${v.pasos[i].op} da ${esperado}, no ${v.pasos[i].valor}`;
      }
      return null;
    }
    case "barra_de_partes": {
      if (v.marcadas > v.partes) return "Hay más partes marcadas que partes";
      if (v.fraccion) {
        const f = normalizarNumero(v.fraccion);
        if (!f.legible || !igualesNumeros(f.valor, v.marcadas / v.partes))
          return "La fracción no coincide con las partes marcadas";
      }
      return null;
    }
    case "tabla_proporcion": {
      const medida = v.filas.map(([a, b]) =>
        v.relacion === "directa" ? (a === 0 ? NaN : b / a) : a * b,
      );
      return medida.every(
        (m) => Number.isFinite(m) && igualesNumeros(m, medida[0]),
      )
        ? null
        : `La tabla no cumple una relación ${v.relacion}`;
    }
    case "recta_numerica": {
      if (v.min >= v.max) return "El mínimo debe ser menor que el máximo";
      return v.puntos.every((p) => p.valor >= v.min && p.valor <= v.max)
        ? null
        : "Hay puntos fuera del rango de la recta";
    }
  }
}
function verificarCuentas(lineas: string[]): string | null {
  for (const l of lineas)
    if (l.includes("=")) {
      const r = verificarIgualdad(l);
      if (!r.valida) return `La cuenta «${l}» no cierra`;
    }
  return null;
}
// Capas 2 a 4 sobre un bloque ya validado en forma. Devuelve el motivo del descarte o null.
function revisarBloque(b: Bloque, c: ContextoValidacion): string | null {
  switch (b.tipo) {
    case "visual":
      return verificarVisual(b);
    case "contraste": {
      const mate = verificarCuentas(b.correcto);
      if (mate) return mate;
      const resp = c.respuestaEstudiante
        ? normalizarTexto(c.respuestaEstudiante)
        : null;
      const conRespuesta =
        resp !== null && b.tuyo.some((l) => normalizarTexto(l).includes(resp));
      return conRespuesta ||
        b.tuyo.every((l) => esLiteral(c.textosEstudiante, l))
        ? null
        : "Lo atribuido al estudiante no aparece en lo que escribió";
    }
    case "razonamiento_anotado":
      return b.pasos.every((p) => esLiteral(c.textosEstudiante, p.cita))
        ? null
        : "Un paso cita algo que el estudiante no escribió";
    case "ejemplo_paso_a_paso":
      return verificarCuentas(
        b.pasos.flatMap((p) => (p.cuenta ? [p.cuenta] : [])),
      );
    case "cita":
      return c.fragmentos.has(b.fragmento_id)
        ? null
        : "El fragmento no existe o no pertenece al estudiante";
    case "practica":
    case "prediccion": {
      const pl = PLANTILLAS.find((p) => p.nombre === b.plantilla);
      return pl && (!c.concepto || pl.concepto === c.concepto)
        ? null
        : "La plantilla no corresponde al concepto de la exploración";
    }
    default:
      return null;
  }
}
// Una operación puede apuntar a un nodo existente o a una ref_temporal creada antes en el mismo turno.
function revisarOps(
  ops: OpGrafo[],
  c: ContextoValidacion,
  descartes: Descarte[],
  indices: number[],
): OpGrafo[] {
  const conocidos = new Set(c.nodos);
  const aristas = [...c.aristas];
  let nodos = c.totalNodos;
  const aceptadas: OpGrafo[] = [];
  const existe = (r: string) => conocidos.has(r);
  const hayCamino = (de: string, a: string) => {
    const vistos = new Set<string>();
    const pila = [de];
    while (pila.length) {
      const x = pila.pop()!;
      if (x === a) return true;
      if (vistos.has(x)) continue;
      vistos.add(x);
      for (const e of aristas)
        if (e.origen === x && (e.tipo === "subtema" || e.tipo === "requiere"))
          pila.push(e.destino);
    }
    return false;
  };
  ops.forEach((o, k) => {
    const rechazo = (motivo: string) =>
      descartes.push({ tipo: "op", indice: indices[k], motivo });
    switch (o.op) {
      case "crear_nodo": {
        if (nodos >= c.maxNodos)
          return rechazo("Se alcanzó el límite de nodos");
        if (conocidos.has(o.ref_temporal))
          return rechazo("La referencia temporal ya existe");
        if (o.padre && !existe(o.padre))
          return rechazo("El nodo padre no existe");
        conocidos.add(o.ref_temporal);
        nodos++;
        // Una idea clave fuera del catálogo del concepto se ignora, no se persiste.
        const idea = esClaveDe(c.concepto, o.idea_clave) ? o.idea_clave : null;
        return void aceptadas.push({ ...o, idea_clave: idea });
      }
      case "relacionar": {
        if (!existe(o.origen) || !existe(o.destino))
          return rechazo("Un nodo de la relación no existe");
        if (o.origen === o.destino)
          return rechazo("No se relaciona un nodo consigo mismo");
        if (aristas.length >= c.maxAristas)
          return rechazo("Se alcanzó el límite de relaciones");
        if (
          aristas.some(
            (e) =>
              e.origen === o.origen &&
              e.destino === o.destino &&
              e.tipo === o.tipo,
          )
        )
          return rechazo("La relación ya existe");
        if (
          (o.tipo === "subtema" || o.tipo === "requiere") &&
          hayCamino(o.destino, o.origen)
        )
          return rechazo("La relación crearía un ciclo");
        aristas.push({ origen: o.origen, destino: o.destino, tipo: o.tipo });
        return void aceptadas.push(o);
      }
      case "editar_nodo":
      case "enfocar": {
        if (!existe(o.op === "enfocar" ? o.nodo : o.nodo))
          return rechazo("El nodo no existe");
        return void aceptadas.push(o);
      }
      case "fusionar": {
        if (!o.nodos.every(existe) || !existe(o.en))
          return rechazo("Un nodo de la fusión no existe");
        if (!o.nodos.includes(o.en))
          return rechazo("El nodo destino debe estar entre los fusionados");
        return void aceptadas.push(o);
      }
    }
  });
  return aceptadas;
}
export function validarTurno(
  crudo: { mensaje: string; bloques: unknown[]; grafo_ops: unknown[] },
  c: ContextoValidacion,
): TurnoValidado {
  const descartes: Descarte[] = [];
  const filtra = (v: unknown) =>
    c.respuestaActiva !== null && contieneRespuesta(v, c.respuestaActiva);
  let mensaje = crudo.mensaje;
  if (filtra(mensaje)) {
    mensaje = MENSAJE_FILTRADO;
    descartes.push({
      tipo: "mensaje",
      indice: 0,
      motivo: "El mensaje contenía la respuesta de la comprobación activa",
    });
  }
  const bloques: Bloque[] = [];
  crudo.bloques.forEach((raw, i) => {
    if (i >= MAX_BLOQUES)
      return descartes.push({
        tipo: "bloque",
        indice: i,
        motivo: "Demasiados bloques en el turno",
      });
    const p = bloqueSchema.safeParse(raw);
    if (!p.success)
      return descartes.push({
        tipo: "bloque",
        indice: i,
        motivo: "Forma inválida o tipo desconocido",
      });
    if (filtra(p.data))
      return descartes.push({
        tipo: "bloque",
        indice: i,
        motivo: "El bloque contenía la respuesta de la comprobación activa",
      });
    const motivo = revisarBloque(p.data, c);
    if (motivo) return descartes.push({ tipo: "bloque", indice: i, motivo });
    bloques.push(p.data);
  });
  const ops: OpGrafo[] = [];
  const indices: number[] = [];
  crudo.grafo_ops.forEach((raw, i) => {
    if (i >= MAX_OPS)
      return descartes.push({
        tipo: "op",
        indice: i,
        motivo: "Demasiadas operaciones en el turno",
      });
    const p = opSchema.safeParse(raw);
    if (!p.success)
      return descartes.push({
        tipo: "op",
        indice: i,
        motivo: "Forma inválida u operación desconocida",
      });
    if (filtra(p.data))
      return descartes.push({
        tipo: "op",
        indice: i,
        motivo: "La operación contenía la respuesta de la comprobación activa",
      });
    ops.push(p.data);
    indices.push(i);
  });
  return {
    mensaje,
    bloques,
    grafo_ops: revisarOps(ops, c, descartes, indices),
    descartes,
  };
}
// Lectura provisional del texto libre (§4.3): nunca cambia estados ni crea evidencias.
export const lecturaSchema = z
  .object({
    ideas_detectadas: z.array(z.string().max(60)).max(4),
    posible_confusion: z.string().max(60).nullable(),
    cita_del_estudiante: txt(300),
    confianza: z.enum(["baja", "media", "alta"]),
  })
  .strict();
export type Lectura = z.infer<typeof lecturaSchema>;
export function validarLectura(
  crudo: unknown,
  concepto: string | null,
  textosEstudiante: string[],
): Lectura | null {
  const r = lecturaSchema.safeParse(crudo);
  if (!r.success) return null;
  const l = r.data;
  const catalogo = new Set(clavesDe(concepto).map((i) => i.clave));
  if (!l.ideas_detectadas.every((i) => catalogo.has(i))) return null;
  if (l.posible_confusion !== null && !catalogo.has(l.posible_confusion))
    return null;
  return esLiteral(textosEstudiante, l.cita_del_estudiante) ? l : null;
}
