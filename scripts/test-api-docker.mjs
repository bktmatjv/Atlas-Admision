import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
const root = resolve(import.meta.dirname, "..");
const name = "atlas-test-" + randomUUID().slice(0, 12);
const npmCli =
  process.env.npm_execpath ??
  resolve(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
function run(command, args, options = {}) {
  const r = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
  if (r.error) throw r.error;
  if (r.status !== 0)
    throw new Error(r.stderr || r.stdout || `Falló ${command}`);
  return r.stdout?.trim();
}
let created = false;
try {
  run(process.execPath, [npmCli, "run", "build:api"], { stdio: "inherit" });
  run("docker", ["info", "--format", "{{.ServerVersion}}"]);
  run("docker", [
    "run",
    "-d",
    "--name",
    name,
    "-e",
    "POSTGRES_USER=atlas_test",
    "-e",
    "POSTGRES_DB=atlas_test",
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "-p",
    "127.0.0.1::5432",
    "postgres:16-alpine",
  ]);
  created = true;
  const binding = run("docker", ["port", name, "5432/tcp"]);
  const port = binding.split(":").at(-1);
  let ready = false;
  for (let n = 0; n < 80; n++) {
    const r = spawnSync(
      "docker",
      ["exec", name, "pg_isready", "-U", "atlas_test", "-d", "atlas_test"],
      { stdio: "ignore" },
    );
    if (r.status === 0) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) throw new Error("PostgreSQL de pruebas no inició.");
  run(process.execPath, [npmCli, "run", "test", "-w", "@atlas/backend"], {
    stdio: "inherit",
    env: {
      ...process.env,
      TEST_DATABASE_URL: `postgresql://atlas_test@127.0.0.1:${port}/atlas_test`,
      NODE_ENV: "test",
      AI_PROVIDER: "fake",
    },
  });
} finally {
  if (created) run("docker", ["rm", "-f", name]);
}
