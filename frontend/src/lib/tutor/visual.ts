const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
// Índice de la primera línea donde «lo que hiciste» y «lo correcto» se separan; null si coinciden.
export function primeraDivergencia(tuyo: string[], correcto: string[]) {
  const n = Math.max(tuyo.length, correcto.length);
  for (let i = 0; i < n; i++) {
    const a = tuyo[i],
      b = correcto[i];
    if (a === undefined || b === undefined) return i;
    if (normalizar(a) !== normalizar(b)) return i;
  }
  return null;
}
const redondear = (x: number) => Math.round(x * 1e6) / 1e6;
// Marcas «cómodas» (1, 2, 2,5 o 5 por potencia de 10) dentro del rango, a lo sumo unas 6.
export function marcasDeRecta(min: number, max: number) {
  const bruto = (max - min) / 5;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const paso =
    [1, 2, 2.5, 5, 10].map((k) => k * potencia).find((p) => p >= bruto) ??
    bruto;
  const marcas: number[] = [];
  for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso)
    marcas.push(redondear(v));
  return marcas;
}
export const posicionEnRecta = (valor: number, min: number, max: number) =>
  max <= min ? 0 : Math.min(1, Math.max(0, (valor - min) / (max - min)));
type PasoCadena = { op?: string; valor: number };
// Cada tramo de la cadena: de un valor al siguiente, con su porcentaje y el sentido.
export function tramosDeCadena(pasos: PasoCadena[]) {
  return pasos.slice(1).map((p, i) => ({
    desde: pasos[i].valor,
    hasta: p.valor,
    op: p.op ?? "",
    sube: p.op ? !p.op.trim().startsWith("-") : p.valor >= pasos[i].valor,
  }));
}
