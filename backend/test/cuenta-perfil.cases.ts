import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import type { INestApplication } from "@nestjs/common";
import { ThrottlerStorage, type ThrottlerStorageService } from "@nestjs/throttler";
import { Proveedores, type EntradaIA } from "../src/modules/tutor/proveedor";
import { claveHash, claveValida } from "../src/modules/identidad/credenciales";
type Resultado = { status: number; cookie?: string; data: { actorId: string; usuario: string | null; codigo_recuperacion: string; id: string; arbol_id: string; intento_id: string } };
type Entorno = { http: (path: string, method?: string, body?: unknown, sid?: string, key?: string) => Promise<Resultado>; db: () => Client; app: () => INestApplication; schema: string; url: () => string };
export function casosCuentaPerfil(e: Entorno) {
  const { http, schema } = e;
  const sql = async (q: string, params: unknown[] = []) => (await e.db().query(q.replaceAll("$S", schema), params)).rows;
  const limpiarLimites = () => e.app().get<ThrottlerStorageService>(ThrottlerStorage).onApplicationShutdown();
  const nuevaSesion = async () => (await http("/sesion", "POST", {}, "")).cookie!;
  const datos = () => ({ usuario: `alumno_${randomUUID().slice(0, 8)}`, contrasena: "Una clave segura 123" });
  describe("Cuentas vinculadas al actor · PostgreSQL real", () => {
    let sid: string;
    beforeEach(async () => { limpiarLimites(); sid = await nuevaSesion(); });
    afterEach(limpiarLimites);
    it("scrypt usa sal distinta, valida y rechaza una clave incorrecta", async () => {
      const a = await claveHash("secreto de prueba"), b = await claveHash("secreto de prueba");
      expect(a).not.toBe(b); expect(await claveValida("secreto de prueba", a)).toBe(true); expect(await claveValida("otra clave", a)).toBe(false);
    });
    it("registro conserva intentos, árbol, conversación, mensajes y evidencia; rota la sesión", async () => {
      const actor = (await http("/sesion", "GET", undefined, sid)).data.actorId;
      const intento = await http("/intentos", "POST", { modo: "practica", curso: "aritmetica", n: 3 }, sid);
      const conv = await http("/conversaciones", "POST", { tema: "porcentajes", mensaje_inicial: "Quiero entender mi cálculo" }, sid, randomUUID());
      expect(conv.status).toBe(201);
      const evidencia = randomUUID();
      await sql("INSERT INTO $S.evidencias(id,actor_id,arbol_id,tipo,detalle) VALUES($1,$2,$3,'abierto','{}')", [evidencia, actor, conv.data.arbol_id]);
      const antes = (await http(`/conversaciones/${conv.data.id}`, "GET", undefined, sid)).data;
      const p = datos(), r = await http("/cuenta/registro", "POST", p, sid);
      expect(r.status).toBe(201); expect(r.data.actorId).toBe(actor); expect(r.cookie).not.toBe(sid);
      expect(r.data.codigo_recuperacion).toMatch(/^[a-f0-9]{48}$/);
      expect((await http("/cuenta", "GET", undefined, sid)).status).toBe(401);
      expect((await http(`/intentos/${intento.data.intento_id}`, "GET", undefined, r.cookie)).status).toBe(200);
      expect((await http(`/conversaciones/${conv.data.id}`, "GET", undefined, r.cookie)).data).toEqual(antes);
      expect(await sql("SELECT id FROM $S.evidencias WHERE id=$1 AND actor_id=$2", [evidencia, actor])).toHaveLength(1);
      const almacenado = await sql("SELECT hash,recuperacion_hash FROM $S.cuentas WHERE actor_id=$1", [actor]);
      expect(almacenado[0].hash).not.toContain(p.contrasena); expect(almacenado[0].recuperacion_hash).not.toContain(r.data.codigo_recuperacion);
      expect((await http("/cuenta", "GET", undefined, r.cookie)).data).toEqual({ actorId: actor, usuario: p.usuario });
    });
    it("otro dispositivo accede al mismo actor y perfil sin invalidar las otras sesiones de la cuenta", async () => {
      const p = datos(), registro = await http("/cuenta/registro", "POST", p, sid);
      await http("/perfil", "PUT", { carrera_texto: "Curso propio" }, registro.cookie);
      const visitante = await nuevaSesion();
      const r = await http("/cuenta/ingreso", "POST", { ...p, usuario: p.usuario.toUpperCase() }, visitante);
      expect(r.status).toBe(201); expect(r.data.actorId).toBe(registro.data.actorId); expect(r.cookie).not.toBe(visitante);
      expect((await http("/perfil", "GET", undefined, r.cookie)).data).toMatchObject({ carrera_texto: "Curso propio" });
      expect((await http("/cuenta", "GET", undefined, visitante)).status).toBe(401);
      expect((await http("/cuenta", "GET", undefined, registro.cookie)).status).toBe(200);
    });
    it("ingresa sin cookie; salida invalida solo su sesión", async () => {
      const p = datos(), registro = await http("/cuenta/registro", "POST", p, sid);
      const r = await http("/cuenta/ingreso", "POST", p, "");
      expect(r.status).toBe(201);
      expect((await http("/cuenta/salida", "POST", {}, r.cookie)).status).toBe(201);
      expect((await http("/cuenta", "GET", undefined, r.cookie)).status).toBe(401);
      expect((await http("/cuenta", "GET", undefined, registro.cookie)).status).toBe(200);
    });
    it("devuelve el mismo error para usuario inexistente y contraseña equivocada", async () => {
      const p = datos(); await http("/cuenta/registro", "POST", p, sid);
      const a = await http("/cuenta/ingreso", "POST", { ...p, contrasena: "incorrecta" }, "");
      const b = await http("/cuenta/ingreso", "POST", { ...p, usuario: "no_existe_12345" }, "");
      expect(a.status).toBe(401); expect(b.status).toBe(401); expect(a.data).toEqual(b.data);
      expect(JSON.stringify(a.data)).toContain("Usuario o contraseña incorrectos");
    });
    it("impide duplicados, incluso dos registros concurrentes para el mismo actor", async () => {
      const p = datos();
      const rs = await Promise.all([http("/cuenta/registro", "POST", p, sid), http("/cuenta/registro", "POST", { ...p, usuario: p.usuario + "_2" }, sid)]);
      expect(rs.map(r => r.status).sort()).toEqual([201, 401]);
      const duplicado = await http("/cuenta/registro", "POST", p, await nuevaSesion());
      // Cualquiera de los alias puede haber ganado la carrera.
      if (rs[0].status === 201) expect(duplicado.status).toBe(409);
      else expect(duplicado.status).toBe(201);
    });
    it("rechaza usuario duplicado de otro actor sin reemplazar ninguna cuenta", async () => {
      const p = datos(), r = await http("/cuenta/registro", "POST", p, sid);
      const otro = await nuevaSesion();
      expect((await http("/cuenta/registro", "POST", p, otro)).status).toBe(409);
      expect((await http("/cuenta", "GET", undefined, otro)).data.usuario).toBeNull();
      expect((await http("/cuenta", "GET", undefined, r.cookie)).data.usuario).toBe(p.usuario);
    });
    it("recupera, rota el código y revoca sesiones; el código usado y la contraseña anterior dejan de servir", async () => {
      const p = datos(), r = await http("/cuenta/registro", "POST", p, sid);
      const otro = await http("/cuenta/ingreso", "POST", p, "");
      const recuperado = await http("/cuenta/recuperar", "POST", { ...p, codigo: r.data.codigo_recuperacion, contrasena: "Nueva clave segura" }, "");
      expect(recuperado.status).toBe(201); expect(recuperado.data.actorId).toBe(r.data.actorId);
      expect(recuperado.data.codigo_recuperacion).not.toBe(r.data.codigo_recuperacion);
      expect((await http("/cuenta", "GET", undefined, r.cookie)).status).toBe(401);
      expect((await http("/cuenta", "GET", undefined, otro.cookie)).status).toBe(401);
      expect((await http("/cuenta", "GET", undefined, recuperado.cookie)).status).toBe(200);
      expect((await http("/cuenta/recuperar", "POST", { ...p, codigo: r.data.codigo_recuperacion }, "")).status).toBe(401);
      expect((await http("/cuenta/ingreso", "POST", p, "")).status).toBe(401);
      expect((await http("/cuenta/ingreso", "POST", { ...p, contrasena: "Nueva clave segura" }, "")).status).toBe(201);
    });
    it("un código solo puede consumirse una vez, incluso concurrentemente", async () => {
      const p = datos(), r = await http("/cuenta/registro", "POST", p, sid);
      const body = { ...p, codigo: r.data.codigo_recuperacion };
      const rs = await Promise.all([http("/cuenta/recuperar", "POST", body, ""), http("/cuenta/recuperar", "POST", body, "")]);
      expect(rs.map(r => r.status).sort()).toEqual([201, 401]);
    });
    it("borrar mis datos elimina cuenta, perfil, sesiones y permite reutilizar el alias", async () => {
      const p = datos(), r = await http("/cuenta/registro", "POST", p, sid);
      await http("/perfil", "PUT", { carrera_texto: "No conservar" }, r.cookie);
      expect((await http("/sesion", "DELETE", undefined, r.cookie)).status).toBe(200);
      for (const tabla of ["cuentas", "perfiles", "sesiones"]) expect(await sql(`SELECT actor_id FROM $S.${tabla} WHERE actor_id=$1`, [r.data.actorId])).toEqual([]);
      expect((await http("/cuenta/ingreso", "POST", p, "")).status).toBe(401);
      expect((await http("/cuenta/registro", "POST", p, await nuevaSesion())).status).toBe(201);
    });
    it("valida tamaño y caracteres, no acepta identidad del cliente ni registro sin sesión", async () => {
      for (const body of [{ usuario: "ab", contrasena: "12345678" }, { usuario: "correo@ejemplo", contrasena: "12345678" }, { usuario: "alias", contrasena: "1234567" }, { ...datos(), actorId: randomUUID() }]) expect((await http("/cuenta/registro", "POST", body, sid)).status).toBe(400);
      expect((await http("/cuenta/registro", "POST", datos(), "")).status).toBe(401);
    });
    it("aplica origen y X-Calibra-Request también al ingreso y la recuperación sin cookie", async () => {
      for (const endpoint of ["registro", "ingreso", "recuperar", "salida"]) {
        const r = await fetch(e.url() + "/api/v1/cuenta/" + endpoint, { method: "POST", headers: { "Content-Type": "application/json", Cookie: sid }, body: "{}" });
        expect(r.status).toBe(403);
        const otroOrigen = await fetch(e.url() + "/api/v1/cuenta/" + endpoint, { method: "POST", headers: { "Content-Type": "application/json", "X-Calibra-Request": "1", Origin: "https://ajeno.example", Cookie: sid }, body: "{}" });
        expect(otroOrigen.status).toBe(403);
      }
    });
    it("limita por usuario antes de alcanzar el límite por IP", async () => {
      const p = datos();
      for (let i = 0; i < 8; i++) expect((await http("/cuenta/ingreso", "POST", p, "")).status).toBe(401);
      expect((await http("/cuenta/ingreso", "POST", p, "")).status).toBe(429);
      expect((await http("/cuenta/ingreso", "POST", datos(), "")).status).toBe(401);
    });
    it("limita por IP aunque cambien los usuarios", async () => {
      for (let i = 0; i < 15; i++) expect((await http("/cuenta/ingreso", "POST", datos(), "")).status).toBe(401);
      expect((await http("/cuenta/ingreso", "POST", datos(), "")).status).toBe(429);
    });
  });
  describe("Perfil ampliado y contexto seguro del tutor", () => {
    let sid: string;
    beforeEach(async () => { limpiarLimites(); sid = await nuevaSesion(); });
    afterEach(() => { limpiarLimites(); vi.restoreAllMocks(); });
    it("acepta las llamadas viejas y fusiona actualizaciones sin borrar el onboarding", async () => {
      const [c] = await sql("SELECT id,data FROM $S.carreras LIMIT 1"), [p] = await sql("SELECT ciclo FROM $S.procesos LIMIT 1");
      expect((await http("/perfil", "PUT", { carrera_id: c.id }, sid)).status).toBe(200);
      expect((await http("/perfil", "PUT", { etapa: "postulante", universidad: "unmsm", proceso: p.ciclo, objetivos: ["examen"], cursos_dificiles: ["aritmetica"], onboarding_completo: true }, sid)).status).toBe(200);
      const antiguo = await http("/perfil", "PUT", { carrera_id: c.id, horas_semana: 8 }, sid);
      expect(antiguo.data).toMatchObject({ area: c.data.area, onboarding_completo: true, objetivos: ["examen"], horas_semana: 8 });
      expect((await http("/perfil", "GET", undefined, await nuevaSesion())).data).toBeNull();
    });
    it("valida catálogos, coherencia del área y campos desconocidos de forma atómica", async () => {
      const [c] = await sql("SELECT id,data FROM $S.carreras LIMIT 1");
      for (const body of [{ carrera_id: "inexistente" }, { proceso: "9999-I" }, { area: "Z" }, { cursos_dificiles: ["curso_inexistente"] }, { carrera_id: c.id, area: c.data.area === "A" ? "B" : "A" }, { objetivos: ["dominar"] }, { contrasena: "no guardar" }, { carrera_texto: "x".repeat(121) }]) expect((await http("/perfil", "PUT", body, sid)).status).toBeGreaterThanOrEqual(400);
      expect((await http("/perfil", "GET", undefined, sid)).data).toBeNull();
    });
    it("completar exige contexto; saltar persiste en el actor, no en el navegador", async () => {
      expect((await http("/perfil", "PUT", { onboarding_completo: true }, sid)).status).toBe(400);
      expect((await http("/perfil", "PUT", { etapa: "postulante", objetivos: ["examen"], onboarding_completo: true }, sid)).status).toBe(400);
      const r = await http("/perfil", "PUT", { onboarding_omitido: true, onboarding_completo: false }, sid);
      expect(r.status).toBe(200);
      expect((await http("/perfil", "GET", undefined, sid)).data).toMatchObject({ onboarding_omitido: true, onboarding_completo: false });
      const c = await http("/perfil", "PUT", { etapa: "escolar", objetivos: ["entender", "entender"], onboarding_completo: true }, sid);
      expect(c.data).toMatchObject({ objetivos: ["entender"], onboarding_omitido: false, onboarding_completo: true });
    });
    it("otra universidad no conserva el catálogo UNMSM; deduplica cursos y limita datos", async () => {
      const [c] = await sql("SELECT id FROM $S.carreras LIMIT 1");
      await http("/perfil", "PUT", { carrera_id: c.id }, sid);
      const r = await http("/perfil", "PUT", { etapa: "postulante", universidad: "Universidad de prueba", objetivos: ["entender"], cursos_dificiles: ["aritmetica", "aritmetica"], onboarding_completo: true }, sid);
      expect(r.status).toBe(200); expect(r.data).toMatchObject({ carrera_id: null, area: null, proceso: null, cursos_dificiles: ["aritmetica"] });
      expect((await http("/perfil", "PUT", { universidad: "Otra", carrera_id: c.id }, sid)).status).toBe(400);
    });
    it("el agente recibe solo el resumen permitido, nunca alias, hash, código ni campos arbitrarios", async () => {
      const p = datos(); const cuenta = await http("/cuenta/registro", "POST", p, sid); sid = cuenta.cookie!;
      await http("/perfil", "PUT", { etapa: "universitario", carrera_texto: "Cálculo inicial", objetivos: ["material"], cursos_dificiles: ["aritmetica"], onboarding_completo: true }, sid);
      await sql("UPDATE $S.perfiles SET data=data || '{\"secreto\":\"NO_ENVIAR\"}' WHERE actor_id=$1", [cuenta.data.actorId]);
      const servicio = e.app().get(Proveedores), proveedor = servicio.actual()!;
      vi.spyOn(servicio, "actual").mockReturnValue(proveedor);
      const original = proveedor.completar.bind(proveedor);
      const entradas: EntradaIA[] = [];
      vi.spyOn(proveedor, "completar").mockImplementation(async (entrada) => { entradas.push(entrada); return original(entrada); });
      const conv = await http("/conversaciones", "POST", { tema: "porcentajes", mensaje_inicial: "Ayúdame" }, sid, randomUUID());
      expect(conv.status).toBe(201); expect(entradas.length).toBeGreaterThan(0);
      const enviado = JSON.stringify(entradas);
      expect(enviado).toContain("Cálculo inicial"); expect(enviado).toContain("universitario");
      for (const secreto of [p.usuario, p.contrasena, cuenta.data.codigo_recuperacion, "NO_ENVIAR", "recuperacion_hash"]) expect(enviado).not.toContain(secreto);
    });
  });
}
