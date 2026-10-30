import { createDataSource } from "./database.js";
export async function migrate(url: string) {
  const ds = createDataSource(url);
  await ds.initialize();
  const lock = ds.createQueryRunner();
  try {
    await lock.connect();
    await lock.query("SELECT pg_advisory_lock(1770000000)");
    return (await ds.runMigrations({ transaction: "all" })).map((m) => m.name);
  } finally {
    try {
      await lock.query("SELECT pg_advisory_unlock(1770000000)");
    } finally {
      await lock.release();
      await ds.destroy();
    }
  }
}
