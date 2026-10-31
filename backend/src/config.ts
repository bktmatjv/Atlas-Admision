import { z } from "zod";
import { config as dotenv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listaDeIds, parsearCadena } from "./modules/tutor/cadena.js";
const backendRoot = fileURLToPath(new URL("../", import.meta.url));
dotenv({ path: resolve(backendRoot, ".env") });
// Las variables vacías de .env (VAR=) cuentan como ausentes y toman su valor por defecto.
const entero = (min: number, max: number, valor: number) =>
  z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().int().min(min).max(max).default(valor),
  );
const schema = z
  .object({
    DATABASE_URL: z
      .string()
      .url()
      .refine((v) => /^postgres(ql)?:/.test(v), "Se necesita PostgreSQL"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().default("0.0.0.0"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    FRONTEND_ORIGIN: z.string().url().default("http://localhost:8090"),
    COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).default("lax"),
    AI_PROVIDER: z
      .enum(["disabled", "groq", "anthropic", "fake", "router"])
      .default("disabled"),
    AI_MODEL: z.string().optional(),
    AI_API_KEY: z.string().optional(),
    // Router de modelos (AI_PROVIDER=router): cadena ordenada de proveedor:modelo con failover.
    AI_CADENA: z.string().optional(),
    AI_SIN_HERRAMIENTAS: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    AI_TIMEOUT_MS: entero(1000, 120000, 20000),
    AI_TIMEOUT_TOTAL_MS: entero(1000, 300000, 45000),
    AI_MAX_CONCURRENCIA: entero(1, 50, 4),
    AI_MAX_ESPERA_COLA_MS: entero(0, 60000, 5000),
    AI_ENFRIAMIENTO_MS: entero(1000, 86400000, 60000),
    AI_FALLOS_DISYUNTOR: entero(1, 20, 3),
    DATA_DIR: z.string().default(resolve(backendRoot, "data")),
    UPLOAD_DIR: z.string().default(resolve(backendRoot, "uploads")),
  })
  .superRefine((v, c) => {
    if (v.AI_PROVIDER === "anthropic" && (!v.AI_API_KEY || !v.AI_MODEL))
      c.addIssue({
        code: "custom",
        message: "Configura AI_API_KEY y AI_MODEL para Anthropic",
      });
    if (v.AI_PROVIDER === "groq" && (!v.AI_API_KEY || !v.AI_MODEL))
      c.addIssue({
        code: "custom",
        message: "Configura AI_API_KEY y AI_MODEL para Groq",
      });
    if (v.AI_PROVIDER === "router") {
      const cadena = parsearCadena(v.AI_CADENA);
      if (!cadena.ok) c.addIssue({ code: "custom", message: cadena.error });
      else {
        // Solo se nombran las variables que faltan, nunca sus valores.
        const usa = (p: string) =>
          cadena.destinos.some((d) => d.proveedor === p);
        if (usa("groq") && !v.GROQ_API_KEY)
          c.addIssue({
            code: "custom",
            message:
              "Falta GROQ_API_KEY para los destinos de Groq de AI_CADENA",
          });
        for (const id of listaDeIds(v.AI_SIN_HERRAMIENTAS))
          if (!cadena.destinos.some((d) => d.id === id))
            c.addIssue({
              code: "custom",
              message: `AI_SIN_HERRAMIENTAS nombra un destino que no está en AI_CADENA: ${id}`,
            });
      }
    }
    if (v.AI_PROVIDER === "fake" && v.NODE_ENV === "production")
      c.addIssue({
        code: "custom",
        message: "El proveedor de pruebas no está permitido en producción",
      });
    if (v.COOKIE_SAME_SITE === "none" && v.NODE_ENV !== "production")
      c.addIssue({
        code: "custom",
        message: "SameSite=None requiere HTTPS y NODE_ENV=production",
      });
  });
export const settings = () => schema.parse(process.env);
export type Settings = z.infer<typeof schema>;
