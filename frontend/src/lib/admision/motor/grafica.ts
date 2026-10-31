/**
 * Gráficas y figuras generadas: una especificación declarativa, nunca un dibujo.
 *
 * El modelo no dibuja píxeles ni escribe SVG: describe QUÉ hay (una función, un triángulo con
 * sus vértices, un plano inclinado con sus fuerzas) y el cliente lo pinta
 * (`src/components/stem/Grafica.tsx`). Así lo que se ve se puede comprobar con código antes de
 * enseñarlo:
 * - un punto marcado «sobre» una curva está en la curva;
 * - un ángulo con su medida casa con el dibujo, y los tres de un triángulo suman 180°;
 * - una longitud rotulada es la del dibujo (las coordenadas son las medidas reales);
 * - una fuerza tiene módulo, un plano inclinado está entre 0° y 90°.
 * Lo que no cuadra se descarta (y se cuenta); lo que no se puede dibujar tumba la gráfica.
 *
 * Una sola fuente: el cliente la reexporta (`src/lib/stem/grafica.ts`). Puro, para vitest.
 */
import { evaluar, latexAExpresion } from "@/lib/admision/motor/cuentas";

export type Par = [number, number];

export interface GraficaDeFunciones {
  tipo: "funciones";
  titulo: string | null;
  x: Par;
  y: Par | null;
  funciones: { expresion: string; etiqueta: string | null }[];
  /** `sobre`: el índice de la función en la que está el punto; se comprueba. */
  puntos: { x: number; y: number; etiqueta: string | null; sobre: number | null }[];
  /** `eje: "x"` es la recta vertical x = valor; `eje: "y"`, la horizontal y = valor. */
  asintotas: { eje: "x" | "y"; valor: number }[];
}

export interface GraficaDeGeometria {
  tipo: "geometria";
  titulo: string | null;
  puntos: { id: string; x: number; y: number; etiqueta: string | null }[];
  segmentos: { desde: string; hasta: string; etiqueta: string | null }[];
  poligonos: { vertices: string[] }[];
  circunferencias: { centro: string; radio: number; etiqueta: string | null }[];
  /** El ángulo en `vertice` entre los rayos hacia `desde` y hacia `hasta`. */
  angulos: { vertice: string; desde: string; hasta: string; medida: number | null; etiqueta: string | null }[];
}

export interface GraficaDeFisica {
  tipo: "fisica";
  titulo: string | null;
  /** Un plano inclinado, con su ángulo en grados. */
  plano: { angulo: number } | null;
  /** Las fuerzas sobre el cuerpo (diagrama de cuerpo libre): ángulo en grados desde +x. */
  fuerzas: { etiqueta: string; angulo: number; modulo: number }[];
  vectores: { origen: Par; componentes: Par; etiqueta: string | null }[];
}

export type Grafica = GraficaDeFunciones | GraficaDeGeometria | GraficaDeFisica;

export interface ResultadoDeGrafica {
  grafica: Grafica | null;
  /** Lo que se quitó por no cuadrar, o por qué no hay gráfica. */
  descartes: string[];
}

const TOPE = { funciones: 4, puntos: 20, segmentos: 30, angulos: 12, fuerzas: 8 };
const RANGO_MAXIMO = 1e6;

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const texto = (v: unknown, tope = 60): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, tope) : null;
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function par(v: unknown): Par | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const a = numero(v[0]);
  const b = numero(v[1]);
  return a === null || b === null ? null : [a, b];
}

function rangoValido(r: Par | null): r is Par {
  return r !== null && r[0] < r[1] && r[1] - r[0] <= RANGO_MAXIMO && Math.abs(r[0]) <= RANGO_MAXIMO && Math.abs(r[1]) <= RANGO_MAXIMO;
}

/** Una expresión en x, lista para `evaluar`. `null` si no se puede calcular. */
function compilar(expresion: string): string | null {
  try {
    return latexAExpresion(expresion);
  } catch {
    return null;
  }
}

function valorEn(expresion: string, x: number): number | null {
  try {
    return evaluar(expresion, { x });
  } catch {
    return null;
  }
}

/**
 * La curva en tramos de polilínea: se corta donde la función no existe (raíz de un negativo,
 * división entre cero) y donde salta (una asíntota vertical entre dos muestras).
 */
export function muestrear(expresion: string, [a, b]: Par, n = 200): Par[][] {
  const compilada = compilar(expresion);
  if (!compilada) return [];
  const muestras: Array<Par | null> = [];
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const y = valorEn(compilada, x);
    muestras.push(y === null ? null : [x, y]);
  }
  const finitos = muestras.filter((m): m is Par => m !== null).map(([, y]) => Math.abs(y)).sort((p, q) => p - q);
  const escala = Math.max(1, finitos[Math.floor(finitos.length * 0.9)] ?? 1);
  const tramos: Par[][] = [];
  let actual: Par[] = [];
  for (const m of muestras) {
    const anterior = actual[actual.length - 1];
    if (m === null || (anterior && Math.abs(m[1] - anterior[1]) > 4 * escala)) {
      if (actual.length > 1) tramos.push(actual);
      actual = m === null ? [] : [m];
      continue;
    }
    actual.push(m);
  }
  if (actual.length > 1) tramos.push(actual);
  return tramos;
}

function funciones(c: Record<string, unknown>, descartes: string[]): GraficaDeFunciones | null {
  const x = par(c.x);
  if (!rangoValido(x)) return null;
  const y = par(c.y);
  const fs = lista(c.funciones).slice(0, TOPE.funciones).flatMap((f) => {
    if (!esObjeto(f)) return [];
    const expresion = texto(f.expresion, 200);
    return expresion ? [{ expresion, etiqueta: texto(f.etiqueta) }] : [];
  });
  if (fs.length === 0) return null;
  // Cada función se tiene que poder calcular en buena parte del dominio.
  for (const f of fs) {
    const compilada = compilar(f.expresion);
    if (!compilada) return null;
    let validas = 0;
    for (let i = 0; i <= 50; i++) if (valorEn(compilada, x[0] + ((x[1] - x[0]) * i) / 50) !== null) validas++;
    if (validas < 15) return null;
  }

  const puntos = lista(c.puntos).slice(0, TOPE.puntos).flatMap((p) => {
    if (!esObjeto(p)) return [];
    const px = numero(p.x);
    const py = numero(p.y);
    if (px === null || py === null) return [];
    const sobre = numero(p.sobre);
    if (sobre !== null) {
      const f = fs[sobre];
      const compilada = f ? compilar(f.expresion) : null;
      const real = compilada ? valorEn(compilada, px) : null;
      if (real === null || Math.abs(real - py) > 0.01 * Math.max(1, Math.abs(py))) {
        descartes.push("punto_fuera_de_la_curva");
        return [];
      }
    }
    return [{ x: px, y: py, etiqueta: texto(p.etiqueta), sobre: sobre !== null && fs[sobre] ? sobre : null }];
  });

  const asintotas = lista(c.asintotas).flatMap((a) => {
    if (!esObjeto(a) || (a.eje !== "x" && a.eje !== "y")) return [];
    const valor = numero(a.valor);
    return valor === null ? [] : [{ eje: a.eje as "x" | "y", valor }];
  });

  return { tipo: "funciones", titulo: texto(c.titulo, 120), x, y: rangoValido(y) ? y : null, funciones: fs, puntos, asintotas };
}

/** El ángulo en grados (0–180) en `v` entre los rayos hacia `a` y hacia `b`. */
function anguloEn(v: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const ux = a.x - v.x, uy = a.y - v.y, wx = b.x - v.x, wy = b.y - v.y;
  const coseno = (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy));
  return (Math.acos(Math.max(-1, Math.min(1, coseno))) * 180) / Math.PI;
}

/** El número de una etiqueta que es solo un número («4», «$5$», «3,5 cm»). */
function longitudRotulada(etiqueta: string | null): number | null {
  const m = etiqueta?.replace(/\$/g, "").match(/^\s*(\d+(?:[.,]\d+)?)\s*(?:cm|m|mm|u)?\s*$/);
  return m ? Number(m[1].replace(",", ".")) : null;
}

function geometria(c: Record<string, unknown>, descartes: string[]): GraficaDeGeometria | null {
  const puntos = lista(c.puntos).slice(0, TOPE.puntos).flatMap((p) => {
    if (!esObjeto(p)) return [];
    const id = texto(p.id, 12);
    const x = numero(p.x);
    const y = numero(p.y);
    return id && x !== null && y !== null ? [{ id, x, y, etiqueta: texto(p.etiqueta) }] : [];
  });
  if (puntos.length === 0 || new Set(puntos.map((p) => p.id)).size !== puntos.length) return null;
  const por = new Map(puntos.map((p) => [p.id, p]));
  const existe = (id: unknown): id is string => typeof id === "string" && por.has(id);

  const crudosSeg = lista(c.segmentos).slice(0, TOPE.segmentos).filter(esObjeto);
  const crudosPol = lista(c.poligonos).filter(esObjeto);
  const crudosCir = lista(c.circunferencias).filter(esObjeto);
  const crudosAng = lista(c.angulos).slice(0, TOPE.angulos).filter(esObjeto);
  // Una referencia a un punto que no existe no se puede dibujar: es la figura entera la que no se sabe cuál es.
  if (crudosSeg.some((s) => !existe(s.desde) || !existe(s.hasta))) return null;
  if (crudosPol.some((p) => !Array.isArray(p.vertices) || p.vertices.length < 3 || !p.vertices.every(existe))) return null;
  if (crudosCir.some((s) => !existe(s.centro))) return null;
  if (crudosAng.some((a) => !existe(a.vertice) || !existe(a.desde) || !existe(a.hasta))) return null;

  const segmentos = crudosSeg.flatMap((s) => {
    const etiqueta = texto(s.etiqueta);
    const rotulada = longitudRotulada(etiqueta);
    const a = por.get(s.desde as string)!;
    const b = por.get(s.hasta as string)!;
    if (rotulada !== null && Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - rotulada) > 0.02 * Math.max(1, rotulada)) {
      descartes.push("longitud_no_cuadra");
      return [];
    }
    return [{ desde: a.id, hasta: b.id, etiqueta }];
  });
  const poligonos = crudosPol.map((p) => ({ vertices: (p.vertices as string[]).slice(0, 12) }));
  const circunferencias = crudosCir.flatMap((s) => {
    const radio = numero(s.radio);
    return radio !== null && radio > 0 ? [{ centro: s.centro as string, radio, etiqueta: texto(s.etiqueta) }] : [];
  });

  let angulos = crudosAng.map((a) => ({
    vertice: a.vertice as string,
    desde: a.desde as string,
    hasta: a.hasta as string,
    medida: numero(a.medida),
    etiqueta: texto(a.etiqueta),
  }));
  // Los tres ángulos de un triángulo, si vienen todos con medida, suman 180°.
  for (const pol of poligonos.filter((p) => p.vertices.length === 3)) {
    const suyos = angulos.filter((a) => pol.vertices.includes(a.vertice) && a.medida !== null);
    const vertices = new Set(suyos.map((a) => a.vertice));
    if (vertices.size === 3 && Math.abs(suyos.reduce((s, a) => s + (a.medida ?? 0), 0) - 180) > 1) {
      descartes.push("triangulo_no_suma_180");
      angulos = angulos.filter((a) => !suyos.includes(a));
    }
  }
  // Cada medida casa con el dibujo.
  angulos = angulos.filter((a) => {
    if (a.medida === null) return true;
    const real = anguloEn(por.get(a.vertice)!, por.get(a.desde)!, por.get(a.hasta)!);
    if (Math.abs(real - a.medida) <= 2) return true;
    descartes.push("angulo_no_cuadra");
    return false;
  });

  return { tipo: "geometria", titulo: texto(c.titulo, 120), puntos, segmentos, poligonos, circunferencias, angulos };
}

function fisica(c: Record<string, unknown>, descartes: string[]): GraficaDeFisica | null {
  let plano: GraficaDeFisica["plano"] = null;
  if (esObjeto(c.plano)) {
    const angulo = numero(c.plano.angulo);
    if (angulo === null || angulo <= 0 || angulo >= 90) return null;
    plano = { angulo };
  }
  const fuerzas = lista(c.fuerzas).slice(0, TOPE.fuerzas).flatMap((f) => {
    if (!esObjeto(f)) return [];
    const etiqueta = texto(f.etiqueta, 30);
    const angulo = numero(f.angulo);
    const modulo = numero(f.modulo);
    if (!etiqueta || angulo === null) return [];
    if (modulo === null || modulo <= 0) {
      descartes.push("fuerza_sin_modulo");
      return [];
    }
    return [{ etiqueta, angulo, modulo }];
  });
  const vectores = lista(c.vectores).slice(0, TOPE.fuerzas).flatMap((v) => {
    if (!esObjeto(v)) return [];
    const origen = par(v.origen);
    const componentes = par(v.componentes);
    if (!origen || !componentes) return [];
    if (componentes[0] === 0 && componentes[1] === 0) {
      descartes.push("vector_nulo");
      return [];
    }
    return [{ origen, componentes, etiqueta: texto(v.etiqueta, 30) }];
  });
  if (!plano && fuerzas.length === 0 && vectores.length === 0) return null;
  return { tipo: "fisica", titulo: texto(c.titulo, 120), plano, fuerzas, vectores };
}

/** La gráfica, validada y comprobada, o `null` y por qué. */
export function validarGrafica(bruto: unknown): ResultadoDeGrafica {
  const descartes: string[] = [];
  if (!esObjeto(bruto)) return { grafica: null, descartes: ["no_es_un_objeto"] };
  const grafica =
    bruto.tipo === "funciones" ? funciones(bruto, descartes)
    : bruto.tipo === "geometria" ? geometria(bruto, descartes)
    : bruto.tipo === "fisica" ? fisica(bruto, descartes)
    : null;
  return grafica ? { grafica, descartes } : { grafica: null, descartes: [...descartes, "grafica_invalida"] };
}

const sinDolares = (t: string) => t.replace(/\$/g, "");
const num = (n: number) => String(Number(n.toFixed(2)));

/** Lo que dice la gráfica, para un lector de pantalla y para quien no la ve. */
export function textoAlternativo(g: Grafica): string {
  if (g.tipo === "funciones") {
    const partes = [`Gráfica de ${g.funciones.map((f) => sinDolares(f.expresion)).join(" y ")} entre x = ${num(g.x[0])} y x = ${num(g.x[1])}`];
    if (g.puntos.length > 0) {
      partes.push(`puntos marcados: ${g.puntos.map((p) => `${p.etiqueta ? sinDolares(p.etiqueta) + " " : ""}(${num(p.x)}, ${num(p.y)})`).join(", ")}`);
    }
    if (g.asintotas.length > 0) {
      partes.push(`asíntotas: ${g.asintotas.map((a) => `${a.eje === "x" ? "x" : "y"} = ${num(a.valor)}`).join(", ")}`);
    }
    return `${partes.join("; ")}.`;
  }
  if (g.tipo === "geometria") {
    const partes = [`Figura con ${g.puntos.length} puntos (${g.puntos.map((p) => p.id).join(", ")})`];
    for (const p of g.poligonos) partes.push(`polígono ${p.vertices.join("-")}`);
    for (const s of g.segmentos.filter((s) => s.etiqueta)) partes.push(`segmento ${s.desde}${s.hasta} de ${sinDolares(s.etiqueta!)}`);
    for (const c of g.circunferencias) partes.push(`circunferencia de centro ${c.centro} y radio ${num(c.radio)}`);
    for (const a of g.angulos) partes.push(`ángulo en ${a.vertice}${a.medida !== null ? ` de ${num(a.medida)}°` : ""}`);
    return `${partes.join("; ")}.`;
  }
  const partes = [g.plano ? `Plano inclinado de ${num(g.plano.angulo)}°` : "Diagrama de fuerzas"];
  if (g.fuerzas.length > 0) partes.push(`fuerzas: ${g.fuerzas.map((f) => `${sinDolares(f.etiqueta)} (${num(f.angulo)}°)`).join(", ")}`);
  if (g.vectores.length > 0) partes.push(`vectores: ${g.vectores.map((v) => sinDolares(v.etiqueta ?? "sin nombre")).join(", ")}`);
  return `${partes.join("; ")}.`;
}

export type TrozoConGrafica = { tipo: "texto"; texto: string } | { tipo: "grafica"; grafica: Grafica };

/**
 * Un texto del chat partido en texto y gráficas: el modelo escribe la especificación en un
 * bloque cercado ```grafica … ```. Uno roto o que no pasa la validación se queda como texto.
 */
export function leerBloquesDeGrafica(t: string): TrozoConGrafica[] {
  const trozos: TrozoConGrafica[] = [];
  const empujarTexto = (s: string) => {
    if (!s) return;
    const ultimo = trozos[trozos.length - 1];
    if (ultimo?.tipo === "texto") ultimo.texto += s;
    else trozos.push({ tipo: "texto", texto: s });
  };
  let desde = 0;
  for (const m of t.matchAll(/```grafica[^\n]*\n([\s\S]*?)```/g)) {
    const inicio = m.index ?? 0;
    empujarTexto(t.slice(desde, inicio));
    let grafica: Grafica | null = null;
    try {
      grafica = validarGrafica(JSON.parse(m[1])).grafica;
    } catch {
      grafica = null;
    }
    if (grafica) trozos.push({ tipo: "grafica", grafica });
    else empujarTexto(m[0]);
    desde = inicio + m[0].length;
  }
  empujarTexto(t.slice(desde));
  return trozos;
}

/**
 * Cómo se le explica la especificación al modelo, igual en todos los prompts que la usan (la
 * lección, la práctica, el chat y el resolvedor). Las coordenadas son medidas reales: el código
 * comprueba longitudes y ángulos contra ellas.
 */
export const ESPECIFICACION_DE_GRAFICA = `Una gráfica o figura se describe con un objeto JSON; nunca dibujes ni escribas SVG. Tres tipos:
- {"tipo":"funciones","titulo","x":[min,max],"y":[min,max] o null,"funciones":[{"expresion": en x, como "x^2 - 4","etiqueta"}],"puntos":[{"x","y","etiqueta","sobre": índice de la función en la que está, o null}],"asintotas":[{"eje":"x" (recta vertical x = valor) o "y","valor"}]}
- {"tipo":"geometria","titulo","puntos":[{"id":"A","x","y"}],"segmentos":[{"desde":"A","hasta":"B","etiqueta"}],"poligonos":[{"vertices":["A","B","C"]}],"circunferencias":[{"centro":"O","radio"}],"angulos":[{"vertice":"A","desde":"B","hasta":"C","medida": en grados, o null}]}. Las coordenadas son las medidas reales: una etiqueta de longitud o una medida de ángulo tiene que casar con ellas.
- {"tipo":"fisica","titulo","plano":{"angulo": en grados} o null,"fuerzas":[{"etiqueta","angulo": en grados desde +x,"modulo"}],"vectores":[{"origen":[x,y],"componentes":[dx,dy],"etiqueta"}]}
Se comprueba con código: un punto «sobre» una curva tiene que estar en ella, los ángulos de un triángulo suman 180°.`;
