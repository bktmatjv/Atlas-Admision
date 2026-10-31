const base = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");
let session: Promise<{ actorId: string }> | null = null;
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(base + path, {
      ...options,
      credentials: "include",
      headers: {
        "X-Atlas-Request": "1",
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      "No se pudo conectar con Calibra. Comprueba que el backend esté iniciado y reintenta.",
      0,
    );
  }
  const data = await r.json().catch(() => null);
  if (!r.ok)
    throw new ApiError(
      data?.error?.mensaje || "No se pudo completar la solicitud.",
      r.status,
    );
  return data as T;
}
export function ensureSession() {
  session ??= request<{ actorId: string }>("/sesion", { method: "POST" }).catch(
    (e) => {
      session = null;
      throw e;
    },
  );
  return session;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  await ensureSession();
  return request<T>(path, options);
}
export const post = <T>(path: string, body: unknown, key?: string) =>
  api<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: key ? { "Idempotency-Key": key } : {},
  });
export async function capture<T>(
  fn: () => Promise<T>,
): Promise<{ data: T | null; error: Error | null }> {
  try {
    return { data: await fn(), error: null };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error("Error inesperado"),
    };
  }
}
