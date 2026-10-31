import { useQuery } from '@tanstack/react-query';
import { ensureSession } from '@/integrations/api/client';

/** Identidad opaca emitida por NestJS; no prueba permisos por sí sola en el cliente. */
export function useAuthUserId(): string | null {
  const { data } = useQuery({ queryKey: ['sesion'], queryFn: ensureSession, staleTime: Infinity, retry: false });
  // BYPASS TEMPORAL: Mock básico si el backend está apagado
  return data?.actorId ?? 'demo-local';
}
