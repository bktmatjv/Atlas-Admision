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
import { AgenteModule } from "./modules/tutor/agente.js";
import { SeguimientoModule } from "./modules/seguimiento/seguimiento.js";
import { DocumentosModule } from "./modules/contenido/documentos.js";
import { settings } from "./config.js";
import { Proveedores } from "./modules/tutor/proveedor.js";
import { hashToken } from "./modules/identidad/credenciales.js";
const noEsAcceso = (ctx: import("@nestjs/common").ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.method !== "POST" || !/\/cuenta\/(registro|ingreso|recuperar)$/.test(req.path);
};
@Controller()
class Health {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(Proveedores) private proveedores: Proveedores,
  ) {}
  @Get("salud") async get() {
    await this.db.query("SELECT 1");
    return {
      ok: true,
      ia: settings().AI_PROVIDER,
      pruebas: settings().AI_PROVIDER === "fake",
      // Estado del router de modelos (disyuntor por destino); null si no se usa.
      router: this.proveedores.estadoRouter(),
    };
  }
}
@Module({
  imports: [
    DatabaseModule,
    ThrottlerModule.forRoot([
      { name: "default", ttl: 60000, limit: 120 },
      { name: "cuenta-ip", ttl: 60000, limit: 15, skipIf: noEsAcceso },
      { name: "cuenta-usuario", ttl: 60000, limit: 8, skipIf: noEsAcceso,
        getTracker: (req) => hashToken(typeof req.body?.usuario === "string" ? req.body.usuario.trim().toLowerCase().slice(0, 128) : "") },
    ]),
    IdentidadModule,
    ContenidoModule,
    PracticaModule,
    TutorModule,
    AgenteModule,
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
