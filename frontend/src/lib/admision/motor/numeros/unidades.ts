/**
 * Las unidades de una respuesta numérica. Hay DOS sistemas, uno por política, y cada uno se queda con
 * el suyo hasta que se decida la política (docs/calidad/MOTOR-NUMERICO.md, sección 4):
 *
 * - **Formativa (STEM):** dimensiones SI con factor (`leerUnidad`): «72 km/h» = 20 m/s, °C con su
 *   desplazamiento, unidades compuestas (kg·m/s²). Una unidad que no mide lo mismo es un fallo propio.
 * - **Sumativa (Predictor):** solo prefijos sobre la unidad escrita de la clave (`factorDeUnidad`):
 *   «cm/s» = 0,01 m/s, «cm²» = 10⁻⁴ m². Lo que no es un prefijo de la misma unidad no casa y va a la IA.
 *
 * Sacadas sin cambiar nada de `numerica.ts` y de `predictor/corrector.ts` (17-10-2026): la
 * caracterización (`caracterizacion.test.ts`) da los mismos veredictos.
 */

// ─────────────────────────── Formativa: dimensiones SI ───────────────────────────


export type Base = "m" | "kg" | "s" | "A" | "K" | "mol" | "rad";
export type Dimension = Partial<Record<Base, number>>;
export interface Unidad {
  factor: number;
  dim: Dimension;
  /** Solo el °C: K = °C + 273,15. En una unidad compuesta no se aplica. */
  desplazamiento?: number;
}

const d = (dim: Dimension, factor = 1, desplazamiento?: number): Unidad => ({ factor, dim, desplazamiento });
const FUERZA: Dimension = { kg: 1, m: 1, s: -2 };
const ENERGIA: Dimension = { kg: 1, m: 2, s: -2 };
const POTENCIA: Dimension = { kg: 1, m: 2, s: -3 };
const PRESION: Dimension = { kg: 1, m: -1, s: -2 };
const VOLTAJE: Dimension = { kg: 1, m: 2, s: -3, A: -1 };

const ATOMICAS: Record<string, Unidad> = {
  m: d({ m: 1 }), km: d({ m: 1 }, 1e3), dm: d({ m: 1 }, 0.1), cm: d({ m: 1 }, 1e-2), mm: d({ m: 1 }, 1e-3),
  µm: d({ m: 1 }, 1e-6), um: d({ m: 1 }, 1e-6), nm: d({ m: 1 }, 1e-9),
  kg: d({ kg: 1 }), g: d({ kg: 1 }, 1e-3), mg: d({ kg: 1 }, 1e-6), t: d({ kg: 1 }, 1e3),
  s: d({ s: 1 }), ms: d({ s: 1 }, 1e-3), min: d({ s: 1 }, 60), h: d({ s: 1 }, 3600),
  N: d(FUERZA), kN: d(FUERZA, 1e3), dyn: d(FUERZA, 1e-5),
  J: d(ENERGIA), kJ: d(ENERGIA, 1e3), cal: d(ENERGIA, 4.184), kcal: d(ENERGIA, 4184), eV: d(ENERGIA, 1.602176634e-19),
  W: d(POTENCIA), kW: d(POTENCIA, 1e3),
  Pa: d(PRESION), kPa: d(PRESION, 1e3), atm: d(PRESION, 101325), mmHg: d(PRESION, 133.322), bar: d(PRESION, 1e5),
  L: d({ m: 3 }, 1e-3), l: d({ m: 3 }, 1e-3), mL: d({ m: 3 }, 1e-6), ml: d({ m: 3 }, 1e-6),
  A: d({ A: 1 }), mA: d({ A: 1 }, 1e-3), C: d({ A: 1, s: 1 }),
  V: d(VOLTAJE), kV: d(VOLTAJE, 1e3), Ω: d({ kg: 1, m: 2, s: -3, A: -2 }), ohm: d({ kg: 1, m: 2, s: -3, A: -2 }),
  Hz: d({ s: -1 }), kHz: d({ s: -1 }, 1e3),
  mol: d({ mol: 1 }), mmol: d({ mol: 1 }, 1e-3), M: d({ mol: 1, m: -3 }, 1e3),
  K: d({ K: 1 }), "°C": d({ K: 1 }, 1, 273.15),
  rad: d({ rad: 1 }), "°": d({ rad: 1 }, Math.PI / 180),
  "%": d({}, 0.01),
};

/** La unidad escrita de una forma canónica: sin espacios, `²` → `^2`, `·` → `*`. */
export function canonica(u: string): string {
  return u
    // El modelo puede escribir la unidad como fórmula: «$\text{m/s}^2$».
    .replace(/\$/g, "")
    .replace(/\\(?:text|mathrm)\s*\{([^{}]*)\}/g, "$1")
    .replace(/[{}\s]/g, "")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/[·⋅×]/g, "*")
    .replace(/\\cdot/g, "*")
    .replace(/μ/g, "µ")
    .replace(/^º/, "°");
}

export function leerUnidad(escrita: string): Unidad | null {
  const u = canonica(escrita).replace(/[()]/g, "");
  if (!u) return null;
  if (ATOMICAS[u]) return ATOMICAS[u];
  const [num, ...dens] = u.split("/");
  const factores = [
    ...num.split("*").filter(Boolean).map((f) => [f, 1] as const),
    ...dens.flatMap((den) => den.split("*").filter(Boolean).map((f) => [f, -1] as const)),
  ];
  if (factores.length === 0) return null;
  const total: Unidad = { factor: 1, dim: {} };
  for (const [factor, signo] of factores) {
    const m = factor.match(/^([A-Za-zµΩ°%]+)(?:\^(-?\d+))?$/);
    if (!m || !ATOMICAS[m[1]]) return null;
    const base = ATOMICAS[m[1]];
    const exp = signo * Number(m[2] ?? 1);
    total.factor *= base.factor ** exp;
    for (const [k, v] of Object.entries(base.dim) as Array<[Base, number]>) {
      total.dim[k] = (total.dim[k] ?? 0) + v * exp;
    }
  }
  return total;
}

export function igualDimension(a: Dimension, b: Dimension): boolean {
  const claves = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<Base>;
  for (const k of claves) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  return true;
}

/** Si dos unidades miden lo mismo (km/h y m/s sí; kg y m no). Una ilegible no mide nada. */
export function mismaDimension(a: string, b: string): boolean {
  const ua = leerUnidad(a);
  const ub = leerUnidad(b);
  return ua !== null && ub !== null && igualDimension(ua.dim, ub.dim);
}


// ─────────────────────────── Sumativa: prefijos sobre la unidad escrita ───────────────────────────

const PREFIJOS: Record<string, number> = { k: 1e3, M: 1e6, c: 1e-2, m: 1e-3, d: 1e-1, μ: 1e-6, u: 1e-6, n: 1e-9 };
const SIN_PREFIJO = new Set(["min", "mol", "cd", "dB", "nmi"]);
const normUnidad = (u: string) => u.replace(/²/g, "2").replace(/³/g, "3").replace(/\^/g, "").replace(/\.$/, "");

/**
 * Cuántas unidades de la clave es una unidad del alumno (cm/s → 0,01 si la clave es m/s); null si no
 * casan. En un área o un volumen de una sola unidad (m², cm³) el prefijo va elevado: cm² = 10⁻⁴ m²
 * (ronda 4); en una compuesta (m/s²) el exponente no es del prefijo.
 */
export function factorDeUnidad(delAlumno: string | null, deLaClave: string | null): number | null {
  if (!delAlumno || !deLaClave) return 1;
  const a = normUnidad(delAlumno);
  const c = normUnidad(deLaClave);
  if (a === c) return 1;
  // Unidades que empiezan como un prefijo y no lo llevan: «min» no es mili-«in» (sonda del 17-10).
  // (Solo cuenta la más larga: «mmol» sí es mili-«mol».)
  if (SIN_PREFIJO.has(a.length > c.length ? a : c)) return null;
  const potencia = (u: string) => Number(/^[a-zμ°ωå]+([23])$/i.exec(u)?.[1] ?? 1);
  if (a.length > c.length && a.endsWith(c) && a.length - c.length === 1 && PREFIJOS[a[0]]) return PREFIJOS[a[0]] ** potencia(c);
  if (c.length > a.length && c.endsWith(a) && c.length - a.length === 1 && PREFIJOS[c[0]]) return 1 / PREFIJOS[c[0]] ** potencia(a);
  return null;
}
