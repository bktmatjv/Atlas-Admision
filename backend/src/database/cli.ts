import { settings } from "../config.js";
import { migrate } from "./migrate.js";
import { importBank } from "./import-bank.js";
try {
  const cfg = settings(),
    command = process.argv[2];
  if (command === "migrate")
    console.log("Migraciones aplicadas:", await migrate(cfg.DATABASE_URL));
  else if (command === "import")
    console.log(
      process.argv.includes("--dry-run")
        ? "Validación sin escrituras:"
        : "Banco importado:",
      await importBank(cfg, process.argv.includes("--dry-run")),
    );
  else throw new Error("Usa migrate o import [--dry-run].");
} catch (e) {
  console.error(
    e instanceof Error ? e.message : "No se pudo preparar la base de datos.",
  );
  process.exitCode = 1;
}
