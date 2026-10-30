import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { admision } from '@/integrations/api/admision';
import type { AreaDeAdmision } from "@/integrations/supabase/admision";
import { functionErrorReason } from "@/lib/function-error";

/**
 * «Practicar» un curso o un tema: arma una práctica de 10 preguntas reales (primero las no vistas) con la
 * solución tras cada una, y lleva a ella. Lo usan el informe, los temas que más vienen y el cuaderno.
 */
export function usePracticarAdmision(area: AreaDeAdmision) {
  const navigate = useNavigate();
  const [armando, setArmando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function practicar(clave: string, cuerpo: Record<string, unknown>) {
    setArmando(clave);
    setError(null);
    const { data, error: e } = await admision.crear({ modo: 'practica', area, n: 10, ver_soluciones: true, ...cuerpo });
    setArmando(null);
    if (e) { setError(await functionErrorReason(e)); return; }
    navigate(`/admision/intento/${(data as { intento_id: string }).intento_id}`);
  }
  return { armando, error, practicar };
}
