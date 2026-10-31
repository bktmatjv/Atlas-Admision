// El parser de PDF corre aislado: límite de memoria y terminación desde el proceso principal.
import { parentPort, workerData } from "node:worker_threads";
import { readFile } from "node:fs/promises";
try {
  const buffer = await readFile(workerData.path);
  if (buffer.length > 10 * 1024 * 1024)
    throw new Error("El archivo supera 10 MB.");
  let pages;
  if (workerData.format === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    try {
      if (pdf.numPages > 50)
        throw new Error("El PDF supera 50 páginas. Divide el documento.");
      pages = (await extractText(pdf, { mergePages: false })).text;
    } finally {
      await pdf.cleanup();
    }
  } else pages = [new TextDecoder("utf-8", { fatal: true }).decode(buffer)];
  if (!pages.length || pages.some((p) => p.trim().length < 10))
    throw new Error(
      "Hay páginas sin texto legible. Puede requerir OCR, todavía no disponible.",
    );
  if (pages.join("").length > 100000)
    throw new Error("El texto supera 100.000 caracteres. Divide el documento.");
  parentPort.postMessage({ pages });
} catch (e) {
  const message =
    e instanceof Error && /supera|texto|OCR|páginas/.test(e.message)
      ? e.message
      : "No se pudo extraer el archivo. Comprueba que no esté dañado ni protegido.";
  parentPort.postMessage({ error: message });
}
