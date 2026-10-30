import { z } from "zod";
import { config as dotenv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const backendRoot = fileURLToPath(new URL("../", import.meta.url));
dotenv({ path: resolve(backendRoot, ".env") });
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
    AI_PROVIDER: z.enum(["disabled", "anthropic", "fake"]).default("disabled"),
    AI_MODEL: z.string().optional(),
    AI_API_KEY: z.string().optional(),
    DATA_DIR: z.string().default(resolve(backendRoot, "data")),
    UPLOAD_DIR: z.string().default(resolve(backendRoot, "uploads")),
  })
  .superRefine((v, c) => {
    if (v.AI_PROVIDER === "anthropic" && (!v.AI_API_KEY || !v.AI_MODEL))
      c.addIssue({
        code: "custom",
        message: "Configura AI_API_KEY y AI_MODEL para Anthropic",
      });
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
