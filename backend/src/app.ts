import { Controller, Get, Inject, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { Database, DatabaseModule } from "./database/database.js";
import {
  IdentidadModule,
  SessionGuard,
} from "./modules/identidad/identidad.js";
import { ContenidoModule } from "./modules/contenido/contenido.js";
import { PracticaModule } from "./modules/practica/practica.js";
import { TutorModule } from "./modules/tutor/tutor.js";
import { SeguimientoModule } from "./modules/seguimiento/seguimiento.js";
import { DocumentosModule } from "./modules/contenido/documentos.js";
import { settings } from "./config.js";
@Controller()
class Health {
  constructor(@Inject(Database) private db: Database) {}
  @Get("salud") async get() {
    await this.db.query("SELECT 1");
    return {
      ok: true,
      ia: settings().AI_PROVIDER,
      pruebas: settings().AI_PROVIDER === "fake",
    };
  }
}
@Module({
  imports: [
    DatabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    IdentidadModule,
    ContenidoModule,
    PracticaModule,
    TutorModule,
    SeguimientoModule,
    DocumentosModule,
  ],
  controllers: [Health],
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
