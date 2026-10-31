import { Worker } from "node:worker_threads";
import { z } from "zod";
const result = z.object({
  pages: z.array(z.string()).min(1).max(50).optional(),
  error: z.string().optional(),
});
export async function extractDocument(
  path: string,
  format: string,
): Promise<string[]> {
  const worker = new Worker(
    new URL("../../../workers/extract-document.mjs", import.meta.url),
    {
      workerData: { path, format },
      resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
    },
  );
  try {
    return await new Promise<string[]>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(
            new Error(
              "La extracción del PDF superó 30 segundos. Divide el documento.",
            ),
          ),
        30000,
      );
      const fail = (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      };
      worker.once("error", () =>
        fail(
          new Error(
            "No se pudo extraer el PDF dentro de los límites de memoria.",
          ),
        ),
      );
      worker.once("exit", (code) => {
        if (code !== 0)
          fail(new Error("Se interrumpió la extracción del PDF."));
      });
      worker.once("message", (message: unknown) => {
        clearTimeout(timeout);
        const parsed = result.safeParse(message);
        if (!parsed.success || !parsed.data.pages) {
          reject(
            new Error(
              parsed.success
                ? (parsed.data.error ?? "No se pudo extraer texto.")
                : "Resultado de extracción inválido.",
            ),
          );
          return;
        }
        resolve(parsed.data.pages);
      });
    });
  } finally {
    await worker.terminate();
  }
}
