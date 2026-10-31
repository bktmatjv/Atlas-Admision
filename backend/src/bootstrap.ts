import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import express from "express";
import { AppModule } from "./app.js";
import { Errors } from "./http.js";
import { settings } from "./config.js";

/** API independiente. No sirve el frontend, documentos originales ni el banco JSON. */
export async function createApp() {
  const cfg = settings();
  const app = await NestFactory.create(AppModule, {
    logger: cfg.NODE_ENV === "test" ? ["error"] : ["error", "warn", "log"],
    bodyParser: false,
  });
  app.enableShutdownHooks();
  app.setGlobalPrefix("api/v1");
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: "64kb" }));
  app.useGlobalFilters(new Errors());
  app.enableCors({
    origin: cfg.FRONTEND_ORIGIN,
    credentials: true,
    allowedHeaders: ["Content-Type", "X-Calibra-Request", "Idempotency-Key"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });
  await app.init();
  return app;
}
