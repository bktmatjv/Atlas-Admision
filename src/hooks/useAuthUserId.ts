import { ID_DEL_ALUMNO } from "@/integrations/local/consulta";

/**
 * En Atlas, el id de la sesión de Supabase. Aquí no hay cuentas: el alumno es siempre el de este
 * navegador, y lo suyo se guarda en él.
 */
export function useAuthUserId(): string | null {
  return ID_DEL_ALUMNO;
}
