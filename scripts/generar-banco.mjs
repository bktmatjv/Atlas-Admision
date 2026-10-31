import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { examenSubible, filasDeExamen, parsearPrefijo } from "../frontend/src/lib/admision/subida.ts";
import { carreraDeJson, distribucionDeJson, itemDeJson, procesoDeJson, resultadoDeJson } from "../frontend/src/lib/admision/datos-unmsm.ts";

/**
 * Genera el banco privado en backend/data y los recursos en frontend/public/graficos:
 *   - el banco de San Marcos, a partir de la extracción (banco.json y textos.json de cada examen);
 *   - las escuelas, procesos, resultados, distribuciones y el día del examen de scripts/admision/unmsm.
 *
 *   node scripts/generar-banco.mjs [carpeta de la extracción]
 *
 * La carpeta por defecto es la de Atlas (komu-admision/scripts/admision/salida), que no está en git: la
 * extracción costó ~38 USD de IA y es la única copia. Solo se publican las preguntas que Atlas publicaba:
 * `publicada` y sin avisos (los gráficos con marca de agua de otra academia esperan a limpiarse).
 */
const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const SALIDA = resolve(process.argv[2] ?? join(RAIZ, "..", "komu-admision", "scripts", "admision", "salida"));
const DATOS = join(RAIZ, 'backend', 'data');
const GRAFICOS = join(RAIZ, 'frontend', 'public', 'graficos');
const UNMSM = join(RAIZ, 'backend', 'data', 'fuentes', 'unmsm');

if (!existsSync(SALIDA)) {
  console.error(`No encuentro la extracción en ${SALIDA}. Pásala como argumento.`);
  process.exit(2);
}
rmSync(GRAFICOS, { recursive: true, force: true });
mkdirSync(DATOS, { recursive: true });
mkdirSync(GRAFICOS, { recursive: true });

const leer = (d, f) => JSON.parse(readFileSync(join(SALIDA, d, f), "utf8"));
const prefijos = readdirSync(SALIDA).filter((d) => /^UNMSM_/.test(d) && existsSync(join(SALIDA, d, "banco.json"))).sort();

const examenes = [];
const textos = [];
const preguntas = [];
const saltados = [];
let graficos = 0;
for (const prefijo of prefijos) {
  const metricas = leer(prefijo, "metricas.json");
  const f = filasDeExamen(prefijo, leer(prefijo, "banco.json"), leer(prefijo, "textos.json"), () => null);
  const publicadas = f.preguntas.filter((p) => p.estado === "publicada");
  if (!examenSubible({ preguntas: f.preguntas.length, publicadas: publicadas.length })) {
    saltados.push(prefijo);
    continue;
  }
  const { ciclo, area } = parsearPrefijo(prefijo);
  // Ids legibles y estables: el historial del alumno vive en su navegador y tiene que sobrevivir a
  // regenerar el banco.
  const examenId = `unmsm-${ciclo}-${area}`;
  examenes.push({
    id: examenId, universidad: "unmsm", ciclo, area, fecha: null, n_preguntas: f.examen.n_preguntas,
    opciones_por_pregunta: metricas.opciones_por_pregunta ?? 5, created_at: "2026-10-04T00:00:00.000Z",
  });
  const idDeTexto = new Map();
  for (const t of f.textos) {
    const id = `${examenId}-${t.etiqueta.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    idDeTexto.set(t.etiqueta, id);
    textos.push({ id, examen_id: examenId, etiqueta: t.etiqueta, cuerpo: t.cuerpo });
  }
  const usados = new Set();
  for (const p of publicadas) {
    if (p.avisos.length) continue;
    p.graficos.forEach((r) => usados.add(r));
    preguntas.push({
      id: `${examenId}-${p.numero}`, examen_id: examenId, numero: p.numero, texto_id: p.texto ? idDeTexto.get(p.texto) ?? null : null,
      bloque: p.bloque, curso: p.curso, tema: p.tema, enunciado: p.enunciado, opciones: p.opciones, clave: p.clave,
      graficos: p.graficos, solucion: p.solucion, dificultad: p.dificultad, origen: p.origen,
    });
  }
  for (const g of f.graficos) {
    if (!usados.has(g.ruta)) continue;
    copyFileSync(join(SALIDA, prefijo, g.local), join(GRAFICOS, g.ruta));
    graficos++;
  }
}

// Las lecturas que ninguna pregunta publicada usa no se publican.
const textosUsados = new Set(preguntas.map((p) => p.texto_id).filter(Boolean));
const json = (f) => JSON.parse(readFileSync(join(UNMSM, f), "utf8"));
const escribir = (nombre, datos) => writeFileSync(join(DATOS, nombre), JSON.stringify(datos));

examenes.sort((a, b) => b.ciclo.localeCompare(a.ciclo) || a.area.localeCompare(b.area));
escribir("banco.json", { examenes, textos: textos.filter((t) => textosUsados.has(t.id)), preguntas });
escribir("unmsm.json", {
  carreras: json("carreras.json").map(carreraDeJson),
  procesos: json("procesos.json").map(procesoDeJson),
  resultados: json("resultados.json").map(resultadoDeJson),
  dia_examen: json("dia-examen.json").map((x, i) => itemDeJson(x, i + 1)),
  distribuciones: json("distribuciones.json").map(distribucionDeJson),
});

console.log(`${examenes.length} exámenes (${saltados.length} saltados: ${saltados.join(", ") || "ninguno"}), ` +
  `${preguntas.length} preguntas, ${textosUsados.size} lecturas, ${graficos} gráficos.`);
