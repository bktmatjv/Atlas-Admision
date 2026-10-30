/**
 * Los consejos del informe. El spec los pedía a la IA; salen de reglas (SUPUESTO de la integración de
 * Audix, 15-10-2026): no hay saldo y el informe tiene que servir ya. Cada cifra sale del informe, nada se
 * inventa, y cada consejo dice el siguiente paso, no el diagnóstico.
 */
import type { Calibracion } from "./estrategia";
import type { Informe } from "./informe";
import { cursoPorId } from "./temario";

export interface Consejo { texto: string; practicar?: { curso: string; tema?: string } }

const fmt = (x: number) => x.toLocaleString("es", { maximumFractionDigits: 3 });
const nombre = (curso: string) => cursoPorId(curso)?.nombre ?? curso;

export function consejos(informe: Informe, cal: Calibracion): Consejo[] {
  const out: Consejo[] = [];
  const usados = new Set<string>();

  // 1. El curso que más pesa en lo perdido, con su tema más flojo si lo hay.
  const primero = informe.porCurso.find((c) => c.perdidos > 0 && c.curso !== "actitudinal");
  if (primero) {
    const tema = informe.porTema.find((t) => t.curso === primero.curso && t.acierto < 0.7);
    out.push({
      texto: `Empieza por ${nombre(primero.curso)}: ahí se fueron ${fmt(primero.perdidos)} puntos.${tema ? ` Practica ${tema.nombre}, donde acertaste ${tema.aciertos} de ${tema.preguntas}.` : " Practica sus temas antes del siguiente simulacro."}`,
      practicar: { curso: primero.curso, ...(tema ? { tema: tema.tema } : {}) },
    });
    usados.add(primero.curso);
  }

  // 2. La actitudinal en blanco: ahí marcar nunca resta.
  if (cal.blancosActitudinal > 0) {
    out.push({ texto: `En la sección actitudinal marca siempre: una incorrecta no resta. Dejaste ${cal.blancosActitudinal} en blanco.` });
  }

  // 3. Lo que dice su propia calibración, si hay datos; si no, el valor de marcar descartando.
  const dudosas = cal.niveles.find((n) => n.confianza === 1);
  if (dudosas && dudosas.recomendacion === "blanco") {
    out.push({ texto: `Cuando dudas mucho aciertas ${dudosas.aciertos} de ${dudosas.preguntas}: en esas, déjala en blanco salvo que puedas descartar dos opciones.` });
  } else if (dudosas && dudosas.recomendacion === "marcar" && dudosas.tasa !== null) {
    out.push({ texto: `Aun dudando aciertas ${dudosas.aciertos} de ${dudosas.preguntas}: con eso marcar te suma. Marca si puedes descartar una opción.` });
  } else if (cal.blancos - cal.blancosActitudinal > 0) {
    out.push({ texto: `Dejaste ${cal.blancos - cal.blancosActitudinal} en blanco. Si puedes descartar una opción, marca: incluso al azar entre cinco, en promedio sumas.` });
  }

  // 4. El segundo curso con más puntos perdidos.
  const segundo = informe.porCurso.find((c) => c.perdidos > 0 && c.curso !== "actitudinal" && !usados.has(c.curso));
  if (segundo) out.push({ texto: `Después, ${nombre(segundo.curso)}: ${fmt(segundo.perdidos)} puntos por recuperar.`, practicar: { curso: segundo.curso } });

  return out.slice(0, 4);
}
