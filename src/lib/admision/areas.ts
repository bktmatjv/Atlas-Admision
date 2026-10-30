import type { AreaDeAdmision } from "@/integrations/supabase/admision";

/** Las áreas del examen de San Marcos, y Medicina Humana, que rinde el suyo. */
export const AREAS_DEL_EXAMEN: { id: AreaDeAdmision; nombre: string }[] = [
  { id: "A", nombre: "A · Ciencias de la Salud" }, { id: "B", nombre: "B · Ciencias Básicas" }, { id: "C", nombre: "C · Ingenierías" },
  { id: "D", nombre: "D · Ciencias Económicas y de la Gestión" }, { id: "E", nombre: "E · Humanidades y Ciencias Jurídicas" },
  { id: "medicina", nombre: "Medicina Humana" },
];
