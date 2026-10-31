import "reflect-metadata";
import { Injectable, Global, Module } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { settings } from "../config.js";
import { Initial1770000000000 } from "./initial.js";
import { Learning1770000001000 } from "./learning.js";
import { Harness1770000002000 } from "./harness.js";
import { Agente1770000003000 } from "./agente.js";
import { Plantillas1770000004000 } from "./plantillas.js";
import { Revisiones1770000005000 } from "./revisiones.js";
import { DestinoIa1770000006000 } from "./destino-ia.js";
export const createDataSource = (url: string) => {
  const schema = process.env.DB_SCHEMA ?? "public";
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema))
    throw new Error("DB_SCHEMA inválido");
  return new DataSource({
    type: "postgres",
    url,
    schema,
    synchronize: false,
    migrationsRun: false,
    migrations: [
      Initial1770000000000,
      Learning1770000001000,
      Harness1770000002000,
      Agente1770000003000,
      Plantillas1770000004000,
      Revisiones1770000005000,
      DestinoIa1770000006000,
    ],
    logging: false,
    extra: { max: 10, options: `-c search_path=${schema}` },
  });
};
@Injectable()
export class Database {
  readonly source = createDataSource(settings().DATABASE_URL);
  async onModuleInit() {
    await this.source.initialize();
  }
  async onApplicationShutdown() {
    if (this.source.isInitialized) await this.source.destroy();
  }
  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
    manager?: EntityManager,
  ): Promise<T[]> {
    const result = await (manager ?? this.source.manager).query(sql, params);
    // Postgres/TypeORM devuelve [filas, cantidad] en UPDATE/DELETE y filas en SELECT/INSERT.
    // Normalizar evita que un [] de filas sea confundido con un registro existente.
    if (
      Array.isArray(result) &&
      result.length === 2 &&
      Array.isArray(result[0]) &&
      typeof result[1] === "number"
    )
      return result[0] as T[];
    return result as T[];
  }
  transaction<T>(fn: (manager: EntityManager) => Promise<T>) {
    return this.source.transaction(fn);
  }
}
@Global()
@Module({ providers: [Database], exports: [Database] })
export class DatabaseModule {}
