import { esClaveDe } from "./actividades.js";
// Plantillas paramétricas: el sistema genera números, respuesta y distractores
// (con su idea clave); el enunciado base es texto fijo del sistema, sin IA.
export type Parametros = Record<string, number>;
export type Instancia = {
  plantilla: string;
  concepto: string;
  parametros: Parametros;
  enunciado_base: string;
  respuesta: number;
  distractores: { valor: number; idea_clave: string }[];
};
type Calculo = Pick<Instancia, "enunciado_base" | "respuesta" | "distractores">;
export type Plantilla = {
  nombre: string;
  concepto: string;
  espacio: Parametros[];
  calcular: (p: Parametros) => Calculo;
};
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const producto = <K extends string>(
  dominio: Record<K, readonly number[]>,
): Record<K, number>[] => {
  let acc: Record<string, number>[] = [{}];
  for (const [k, vals] of Object.entries<readonly number[]>(dominio))
    acc = acc.flatMap((a) => vals.map((v) => ({ ...a, [k]: v })));
  return acc as Record<K, number>[];
};
const dist = (valor: number, idea_clave: string) => ({
  valor: r4(valor),
  idea_clave,
});
const brutas: Plantilla[] = [
  {
    nombre: "porcentaje_encadenado",
    concepto: "porcentajes",
    espacio: producto({
      base: [80, 100, 150, 200, 250],
      sube: [10, 20, 25],
      baja: [10, 20, 25],
    }),
    calcular: ({ base, sube, baja }) => ({
      enunciado_base: `Un precio de S/${base} sube ${sube}% y luego baja ${baja}%. ¿Cuál es el precio final en soles?`,
      respuesta: r4((base * (100 + sube) * (100 - baja)) / 10000),
      distractores: [
        dist(base * (1 + (sube - baja) / 100), "cambio-de-base"),
        dist(base, "cambio-de-base"),
        dist(base * (1 + sube / 100) - baja, "base-del-porcentaje"),
      ],
    }),
  },
  {
    nombre: "porcentaje_para_volver",
    concepto: "porcentajes",
    espacio: producto({
      inicial: [100, 200, 400, 500],
      baja: [20, 50, 60, 75, 80],
    }),
    calcular: ({ inicial, baja }) => {
      const final = (inicial * (100 - baja)) / 100;
      return {
        enunciado_base: `Una cantidad baja de ${inicial} a ${final}. ¿Qué porcentaje debe aumentar, sobre ${final}, para volver a ${inicial}? Escribe solo el porcentaje.`,
        respuesta: r4(((inicial - final) / final) * 100),
        distractores: [
          dist(baja, "base-del-porcentaje"),
          dist(inicial - final, "base-del-porcentaje"),
        ],
      };
    },
  },
  {
    nombre: "complemento_de_fraccion",
    concepto: "fracciones",
    espacio: producto({
      total: [24, 40, 48, 60, 72, 120],
      num: [1, 2, 3],
      den: [4, 5, 8],
    }).filter((p) => p.num < p.den && p.total % p.den === 0),
    calcular: ({ total, num, den }) => ({
      enunciado_base: `Una cinta mide ${total} cm y se utiliza ${num}/${den} de ella. ¿Cuántos centímetros quedan?`,
      respuesta: r4((total * (den - num)) / den),
      distractores: [
        dist((total * num) / den, "parte-vs-complemento"),
        dist(total - num, "fraccion-de-cantidad"),
      ],
    }),
  },
  {
    nombre: "fraccion_de_cantidad",
    concepto: "fracciones",
    espacio: producto({
      total: [24, 36, 40, 60, 90, 120],
      num: [2, 3, 5],
      den: [4, 6, 8],
    }).filter((p) => p.num < p.den && p.total % p.den === 0),
    calcular: ({ total, num, den }) => ({
      enunciado_base: `Una caja tiene ${total} lápices y ${num}/${den} de ellos son rojos. ¿Cuántos lápices rojos hay?`,
      respuesta: r4((total * num) / den),
      distractores: [
        dist((total * (den - num)) / den, "parte-vs-complemento"),
        dist(total / den, "fraccion-de-cantidad"),
      ],
    }),
  },
  {
    nombre: "proporcion_inversa",
    concepto: "proporciones",
    espacio: producto({
      obreros: [3, 4, 6, 8],
      dias: [10, 12, 15, 24],
      nuevos: [2, 5, 6, 12],
    }).filter(
      (p) => p.obreros !== p.nuevos && (p.obreros * p.dias) % p.nuevos === 0,
    ),
    calcular: ({ obreros, dias, nuevos }) => ({
      enunciado_base: `${obreros} obreros con el mismo rendimiento terminan una obra en ${dias} días. ¿En cuántos días la terminarán ${nuevos} obreros?`,
      respuesta: r4((obreros * dias) / nuevos),
      distractores: [
        dist((dias * nuevos) / obreros, "directa-vs-inversa"),
        dist(obreros * dias, "valor-unitario"),
      ],
    }),
  },
  {
    nombre: "proporcion_directa",
    concepto: "proporciones",
    espacio: producto({
      personas: [4, 5, 6],
      gramos: [200, 300, 360, 450],
      nuevas: [8, 10, 12, 15],
    }).filter(
      (p) =>
        p.personas !== p.nuevas && (p.gramos * p.nuevas) % p.personas === 0,
    ),
    calcular: ({ personas, gramos, nuevas }) => ({
      enunciado_base: `Una receta para ${personas} personas usa ${gramos} gramos de arroz. Manteniendo la proporción, ¿cuántos gramos se necesitan para ${nuevas} personas?`,
      respuesta: r4((gramos * nuevas) / personas),
      distractores: [
        dist((gramos * personas) / nuevas, "directa-vs-inversa"),
        dist(gramos / personas, "valor-unitario"),
      ],
    }),
  },
];
const limpia = (n: number) =>
  Number.isFinite(n) && n > 0 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
const armar = (pl: Plantilla, p: Parametros): Instancia | null => {
  const c = pl.calcular(p);
  const valores = c.distractores.map((d) => d.valor);
  const valida =
    limpia(c.respuesta) &&
    valores.every(limpia) &&
    !valores.includes(c.respuesta) &&
    new Set(valores).size === valores.length &&
    c.distractores.every((d) => esClaveDe(pl.concepto, d.idea_clave));
  return valida
    ? { plantilla: pl.nombre, concepto: pl.concepto, parametros: p, ...c }
    : null;
};
const cache = new Map<string, Instancia[]>();
export const PLANTILLAS: readonly Plantilla[] = brutas;
// Solo las combinaciones cuyos distractores no colisionan con la respuesta ni entre sí.
export function instancias(nombre: string): Instancia[] {
  const hit = cache.get(nombre);
  if (hit) return hit;
  const pl = brutas.find((x) => x.nombre === nombre);
  if (!pl) throw new Error(`Plantilla desconocida: ${nombre}`);
  const out = pl.espacio
    .map((p) => armar(pl, p))
    .filter((i): i is Instancia => i !== null);
  cache.set(nombre, out);
  return out;
}
export const claveInstancia = (
  i: Pick<Instancia, "plantilla" | "parametros">,
) =>
  `${i.plantilla}:${JSON.stringify(
    Object.fromEntries(
      Object.entries(i.parametros).sort(([a], [b]) => (a < b ? -1 : 1)),
    ),
  )}`;
// PRNG determinista (mulberry32): la misma semilla elige siempre la misma combinación.
const aleatorio = (semilla: number) => {
  let a = (semilla | 0) + 0x6d2b79f5;
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
};
export function generar(nombre: string, semilla: number): Instancia {
  const todas = instancias(nombre);
  return todas[Math.floor(aleatorio(semilla) * todas.length)];
}
// Primera instancia no expuesta, recorriendo el espacio desde un punto elegido por la semilla.
export function generarNoExpuesta(
  concepto: string,
  semilla: number,
  expuesta: (clave: string) => boolean,
  solo?: string[],
): Instancia | null {
  const nombres = brutas
    .filter(
      (p) => p.concepto === concepto && (!solo || solo.includes(p.nombre)),
    )
    .map((p) => p.nombre);
  if (!nombres.length) return null;
  const orden = nombres.flatMap((n) => instancias(n));
  if (!orden.length) return null;
  const inicio = Math.floor(aleatorio(semilla) * orden.length);
  for (let k = 0; k < orden.length; k++) {
    const i = orden[(inicio + k) % orden.length];
    if (!expuesta(claveInstancia(i))) return i;
  }
  return null;
}
