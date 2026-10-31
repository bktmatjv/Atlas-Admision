export type ItemHistorial = {
  id: string;
  titulo: string;
  concepto: string | null;
  created_at: string;
};
const NOMBRES: Record<string, string> = {
  porcentajes: "Porcentajes",
  proporciones: "Proporciones",
  fracciones: "Fracciones",
};
export const etiquetaTema = (concepto: string | null) =>
  (concepto && NOMBRES[concepto]) || "General";
const inicioDelDia = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DIA = 24 * 60 * 60 * 1000;
// Hoy, Ayer, Esta semana (últimos 7 días) y Anteriores; respeta el orden recibido y omite grupos vacíos.
export function agruparPorFecha<T extends ItemHistorial>(
  items: T[],
  ahora = new Date(),
) {
  const hoy = inicioDelDia(ahora);
  const grupos = [
    { etiqueta: "Hoy", items: [] as T[] },
    { etiqueta: "Ayer", items: [] as T[] },
    { etiqueta: "Esta semana", items: [] as T[] },
    { etiqueta: "Anteriores", items: [] as T[] },
  ];
  for (const i of items) {
    const dias = Math.round((hoy - inicioDelDia(new Date(i.created_at))) / DIA);
    grupos[dias <= 0 ? 0 : dias === 1 ? 1 : dias <= 7 ? 2 : 3].items.push(i);
  }
  return grupos.filter((g) => g.items.length > 0);
}
