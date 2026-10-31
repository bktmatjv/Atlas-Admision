// Lectura pura de AI_CADENA. No importa config.ts: config.ts la usa para validar al arrancar.
export const PROVEEDORES_ROUTER = ["groq", "cloudflare"] as const;
export type ProveedorRouter = (typeof PROVEEDORES_ROUTER)[number];
export type DestinoConfig = {
  proveedor: ProveedorRouter;
  modelo: string;
  id: string;
};
export const MAX_DESTINOS = 8;
export type ResultadoCadena =
  { ok: true; destinos: DestinoConfig[] } | { ok: false; error: string };
// Formato: proveedor:modelo separados por comas. El modelo puede contener «:», «/» y «@»
// (los modelos de Cloudflare empiezan por «@cf/» o «@hf/»), por eso solo se parte en el primer «:».
export function parsearCadena(texto: string | undefined): ResultadoCadena {
  const crudo = (texto ?? "").trim();
  if (!crudo)
    return {
      ok: false,
      error:
        "AI_CADENA es obligatoria con AI_PROVIDER=router (lista proveedor:modelo separada por comas)",
    };
  const partes = crudo.split(",").map((p) => p.trim());
  if (partes.length > MAX_DESTINOS)
    return {
      ok: false,
      error: `AI_CADENA admite como máximo ${MAX_DESTINOS} destinos`,
    };
  const destinos: DestinoConfig[] = [];
  for (const [i, parte] of partes.entries()) {
    const corte = parte.indexOf(":");
    const proveedor = corte > 0 ? parte.slice(0, corte).trim() : "";
    const modelo = corte > 0 ? parte.slice(corte + 1).trim() : "";
    if (!(PROVEEDORES_ROUTER as readonly string[]).includes(proveedor))
      return {
        ok: false,
        error: `AI_CADENA, entrada ${i + 1}: el proveedor debe ser ${PROVEEDORES_ROUTER.join(" o ")} (formato proveedor:modelo)`,
      };
    if (!modelo || modelo.length > 200 || /\s/.test(modelo))
      return {
        ok: false,
        error: `AI_CADENA, entrada ${i + 1}: falta el modelo o contiene espacios (formato proveedor:modelo)`,
      };
    const id = `${proveedor}:${modelo}`;
    if (destinos.some((d) => d.id === id))
      return {
        ok: false,
        error: `AI_CADENA, entrada ${i + 1}: destino repetido`,
      };
    destinos.push({ proveedor: proveedor as ProveedorRouter, modelo, id });
  }
  return { ok: true, destinos };
}
export const listaDeIds = (texto: string | undefined) =>
  (texto ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
