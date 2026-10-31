import "reflect-metadata";
import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import { textPdf } from "./pdf-fixture";
import {
  generar,
  instanciaDesdeClave,
} from "../src/modules/seguimiento/plantillas";
import { clavesExpuestas } from "../src/modules/seguimiento/expuestas";
import { olvidarRouters } from "../src/modules/tutor/proveedor";
import { casosCuentaPerfil } from "./cuenta-perfil.cases";
let app: INestApplication,
  db: Client,
  url: string,
  cookie: string,
  other: string,
  attempt: string,
  pid: string,
  tree: string,
  root: string,
  course: string,
  document: string,
  folder: string;
const schema = "atlas_test_" + randomUUID().replaceAll("-", "");
const database = process.env.TEST_DATABASE_URL;
if (!database)
  throw new Error(
    "Usa npm run test:isolated o proporciona TEST_DATABASE_URL; nunca usamos DATABASE_URL por defecto.",
  );
async function http(
  path: string,
  method = "GET",
  body?: unknown,
  sid = cookie,
  key?: string,
) {
  const headers: Record<string, string> = { "X-Calibra-Request": "1" };
  if (sid) headers.Cookie = sid;
  if (key) headers["Idempotency-Key"] = key;
  if (!(body instanceof FormData)) headers["Content-Type"] = "application/json";
  const r = await fetch(url + "/api/v1" + path, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  return {
    status: r.status,
    data,
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
beforeAll(async () => {
  db = new Client({ connectionString: database });
  await db.connect();
  await db.query(`CREATE SCHEMA ${schema}`);
  folder = await mkdtemp(resolve(tmpdir(), "atlas-upload-"));
  process.env.DATABASE_URL = database;
  process.env.DB_SCHEMA = schema;
  process.env.NODE_ENV = "test";
  process.env.AI_PROVIDER = "fake";
  process.env.ATLAS_LIMITE_IA = "1000";
  process.env.UPLOAD_DIR = folder;
  process.env.DATA_DIR = resolve(import.meta.dirname, "../data");
  const { createDataSource } = await import("../src/database/database.js");
  const source = createDataSource(database!);
  await source.initialize();
  await source.runMigrations();
  await source.destroy();
  const importBank = () =>
    execFileSync(
      process.execPath,
      ["--import", "tsx", "src/database/cli.ts", "import"],
      {
        cwd: resolve(import.meta.dirname, ".."),
        env: process.env,
        stdio: "pipe",
      },
    );
  importBank();
  importBank();
  const { createApp } = await import("../src/bootstrap.js");
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  url = await app.getUrl();
  cookie = (await http("/sesion", "POST", {}, "")).cookie!;
  other = (await http("/sesion", "POST", {}, "")).cookie!;
}, 60000);
afterAll(async () => {
  if (app) await app.close();
  if (db) {
    await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await db.end();
  }
  if (folder) await rm(folder, { recursive: true, force: true });
}, 60000);
casosCuentaPerfil({ http, db: () => db, app: () => app, schema, url: () => url });
describe("CALIBRA integrado con PostgreSQL real", () => {
  it("importa sin duplicar y no sirve el banco con claves", async () => {
    const c = await db.query(
      `SELECT count(*)::int AS n FROM ${schema}.preguntas`,
    );
    expect(c.rows[0].n).toBe(2027);
    const r = await fetch(url + "/datos/banco.json");
    expect(r.status).toBe(404);
  });
  it("exige sesión y protege escrituras de otros orígenes", async () => {
    expect((await http("/intentos", "GET", undefined, "")).status).toBe(401);
    const r = await fetch(url + "/api/v1/intentos", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
        Origin: "https://evil.example",
      },
      body: "{}",
    });
    expect(r.status).toBe(403);
  });
  it("crea práctica con preguntas sin claves y sin confiar en user_id", async () => {
    expect(
      (
        await http("/intentos", "POST", {
          modo: "practica",
          curso: "aritmetica",
          user_id: "otro",
        })
      ).status,
    ).toBe(400);
    const r = await http("/intentos", "POST", {
      modo: "practica",
      curso: "aritmetica",
      n: 3,
      ver_soluciones: true,
    });
    expect(r.status).toBe(201);
    attempt = r.data.intento_id;
    const p = await http(`/intentos/${attempt}/preguntas`);
    expect(p.data).toHaveLength(3);
    expect(p.data.every((x: { clave: null }) => x.clave === null)).toBe(true);
    pid = p.data[0].pregunta_id;
  });
  it("no revela una solución antes de guardar una respuesta", async () => {
    expect(
      (await http(`/intentos/${attempt}/preguntas/${pid}/solucion`, "POST", {}))
        .status,
    ).toBe(409);
  });
  it("no permite que otra sesión acceda ni escriba el intento", async () => {
    expect(
      (await http(`/intentos/${attempt}`, "GET", undefined, other)).status,
    ).toBe(404);
    expect(
      (await http(`/intentos/${attempt}/respuestas`, "PUT", [], other)).status,
    ).toBe(404);
  });
  it("guarda por versión y rechaza preguntas ajenas de manera atómica", async () => {
    expect(
      (
        await http(`/intentos/${attempt}/respuestas`, "PUT", [
          {
            pregunta_id: pid,
            opcion: "A",
            marcada: false,
            confianza: 2,
            version: 2,
          },
        ])
      ).status,
    ).toBe(200);
    await http(`/intentos/${attempt}/respuestas`, "PUT", [
      { pregunta_id: pid, opcion: "B", marcada: false, version: 1 },
    ]);
    const r = await http(`/intentos/${attempt}/respuestas`);
    expect(r.data[0].opcion).toBe("A");
    const invalid = await http(`/intentos/${attempt}/respuestas`, "PUT", [
      { pregunta_id: pid, opcion: "B", marcada: false, version: 3 },
      { pregunta_id: "otra", opcion: "A", marcada: false, version: 4 },
    ]);
    expect(invalid.status).toBe(400);
    expect((await http(`/intentos/${attempt}/respuestas`)).data[0].opcion).toBe(
      "A",
    );
  });
  it("revela solo en práctica y entrega idempotentemente", async () => {
    const r = await http(
      `/intentos/${attempt}/preguntas/${pid}/solucion`,
      "POST",
      {},
    );
    expect(r.status).toBe(201);
    expect(r.data.clave).toMatch(/[A-E]/);
    const [a, b] = await Promise.all([
      http(`/intentos/${attempt}/entrega`, "POST", {}),
      http(`/intentos/${attempt}/entrega`, "POST", {}),
    ]);
    expect(a.data).toEqual(b.data);
    expect(a.data.maximo).toBe(60);
    expect(
      (await http(`/intentos/${attempt}/respuestas`, "PUT", [])).status,
    ).toBe(409);
  });
  it("el servidor aplica el vencimiento del intento", async () => {
    const r = await http("/intentos", "POST", {
      modo: "diagnostico",
      area: "A",
    });
    const id = r.data.intento_id;
    await db.query(
      `UPDATE ${schema}.intentos SET vence_en=now()-interval '1 minute' WHERE id=$1`,
      [id],
    );
    expect((await http(`/intentos/${id}/respuestas`, "PUT", [])).status).toBe(
      409,
    );
    expect((await http(`/intentos/${id}/entrega`, "POST", {})).status).toBe(
      201,
    );
  });
  it("crea un árbol con proveedor de pruebas explícito e idempotencia", async () => {
    const key = randomUUID(),
      input = {
        tema: "porcentajes",
        solicitud: "Ayúdame con la base de un porcentaje",
      };
    const r = await http("/arboles", "POST", input, cookie, key);
    expect(r.status).toBe(201);
    tree = r.data.id;
    expect((await http("/arboles", "POST", input, cookie, key)).data.id).toBe(
      tree,
    );
    expect(
      (
        await http(
          "/arboles",
          "POST",
          { ...input, tema: "fracciones" },
          cookie,
          key,
        )
      ).status,
    ).toBe(409);
    const t = await http(`/arboles/${tree}`);
    expect(t.data.nodos).toHaveLength(2);
    root = t.data.nodos[0].id;
    expect(t.data.nodos[0].contenido).toContain("PROVEEDOR DE PRUEBAS");
  });
  it("aisla árboles y expande solo dentro del árbol autorizado", async () => {
    expect(
      (await http(`/arboles/${tree}`, "GET", undefined, other)).status,
    ).toBe(404);
    expect(
      (
        await http(
          `/arboles/${tree}/nodos/${randomUUID()}/expandir`,
          "POST",
          { solicitud: "Ejemplo" },
          cookie,
          randomUUID(),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await http(
          `/arboles/${tree}/nodos/${root}/expandir`,
          "POST",
          { solicitud: "Otro ejemplo" },
          cookie,
          randomUUID(),
        )
      ).status,
    ).toBe(201);
  });
  it("abrir un árbol no produce evidencia de aprendizaje", async () => {
    const before = await http("/evidencias");
    await http(`/arboles/${tree}`);
    const after = await http("/evidencias");
    expect(before.data.length).toBe(after.data.length);
  });
  it("comprueba actividad nueva sin filtrar clave y bloquea ayudas hasta entregar", async () => {
    const c = await http("/comprobaciones", "POST", { arbol_id: tree });
    expect(c.status).toBe(201);
    expect(c.data.respuesta).toBeUndefined();
    expect(c.data.solucion).toBeUndefined();
    expect(
      (
        await http(
          `/arboles/${tree}/nodos/${root}/expandir`,
          "POST",
          { solicitud: "Dame la clave" },
          cookie,
          randomUUID(),
        )
      ).status,
    ).toBe(409);
    const result = await http(`/comprobaciones/${c.data.id}/respuesta`, "PUT", {
      respuesta: "96",
      justificacion: "El segundo porcentaje usa la base 120.",
    });
    expect(result.data.correcta).toBe(true);
    expect((await http("/evidencias")).data[0].tipo).toBe("resolvio_sin_ayuda");
    const next = await http("/comprobaciones", "POST", { arbol_id: tree });
    expect(next.data.enunciado).not.toBe(c.data.enunciado);
    await http(`/comprobaciones/${next.data.id}/cancelar`, "POST", {});
  });
  it("no disfraza un proveedor sin configurar como una respuesta real", async () => {
    process.env.AI_PROVIDER = "disabled";
    try {
      expect(
        (
          await http(
            "/arboles",
            "POST",
            { tema: "fracciones", solicitud: "Explica" },
            cookie,
            randomUUID(),
          )
        ).status,
      ).toBe(503);
    } finally {
      process.env.AI_PROVIDER = "fake";
    }
  });
  it("importa un curso propio, conserva citas y requiere revisión", async () => {
    const c = await http("/cursos", "POST", {
      titulo: "Mi curso independiente",
      objetivo: "Comprender mi apunte",
    });
    course = c.data.id;
    const data = new FormData();
    data.append(
      "archivo",
      new Blob([
        "Los porcentajes se calculan respecto de una base. Un 20% significa veinte de cada cien. Si cambia la base, cambia la cantidad correspondiente.",
      ]),
      "apuntes.md",
    );
    const d = await http(`/cursos/${course}/documentos`, "POST", data);
    expect(d.status).toBe(201);
    document = d.data.id;
    for (let n = 0; n < 60; n++) {
      const r = await http(`/documentos/${document}`);
      if (r.data.estado === "requiere_revision") break;
      if (r.data.estado === "fallido") throw new Error(r.data.error);
      await new Promise((r) => setTimeout(r, 200));
    }
    const r = await http(`/documentos/${document}`);
    expect(r.data.estado).toBe("requiere_revision");
    expect(r.data.ruta).toBeUndefined();
    expect(r.data.fragmentos[0].pagina).toBe(1);
    expect(
      (await http(`/documentos/${document}`, "GET", undefined, other)).status,
    ).toBe(404);
    await http(`/documentos/${document}/confirmar`, "POST", {});
    const t = await http(
      "/arboles",
      "POST",
      {
        fragmento_id: r.data.fragmentos[0].id,
        solicitud: "Explícame este material",
      },
      cookie,
      randomUUID(),
    );
    expect(t.status).toBe(201);
    const full = await http(`/arboles/${t.data.id}`);
    expect(full.data.nodos[0].citas[0].documento_id).toBe(document);
  });
  it("aclara un nodo sin multiplicar ramas y conserva su versión anterior", async () => {
    const before = await http(`/arboles/${tree}`);
    const r = await http(
      `/arboles/${tree}/nodos/${root}/aclarar`,
      "POST",
      { solicitud: "Explica más sencillo" },
      cookie,
      randomUUID(),
    );
    expect(r.status).toBe(201);
    expect((await http(`/arboles/${tree}`)).data.nodos.length).toBe(
      before.data.nodos.length,
    );
    expect(
      (
        await db.query(
          `SELECT count(*)::int AS n FROM ${schema}.revisiones_nodo WHERE nodo_id=$1`,
          [root],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("guarda prácticas generadas sin presentarlas como evidencia verificada", async () => {
    const doc = await http(`/documentos/${document}`),
      fid = doc.data.fragmentos[0].id,
      key = randomUUID();
    const p = await http(
      `/fragmentos/${fid}/actividad`,
      "POST",
      {},
      cookie,
      key,
    );
    expect(p.status).toBe(201);
    expect(p.data.estado).toBe("generada_no_revisada");
    expect(
      (await http(`/fragmentos/${fid}/actividad`, "POST", {}, cookie, key)).data
        .id,
    ).toBe(p.data.id);
    const saved = await http(
      `/actividades-generadas/${p.data.id}/intento`,
      "PUT",
      { intento: "Mi razonamiento sobre la base", revelada: true },
    );
    expect(saved.status).toBe(200);
    expect(saved.data.intento).toBe("Mi razonamiento sobre la base");
    expect(
      (await http(`/documentos/${document}`)).data.propuestas[0].intento,
    ).toBe("Mi razonamiento sobre la base");
    expect(
      (
        await http(
          `/actividades-generadas/${p.data.id}/intento`,
          "PUT",
          { intento: "ajeno" },
          other,
        )
      ).status,
    ).toBe(404);
  });
  it("extrae un PDF real en worker y conserva página y texto", async () => {
    const form = new FormData();
    form.append("archivo", new Blob([textPdf()]), "conceptos.pdf");
    const uploaded = await http(`/cursos/${course}/documentos`, "POST", form);
    expect(uploaded.status).toBe(201);
    let result;
    for (let n = 0; n < 100; n++) {
      result = await http(`/documentos/${uploaded.data.id}`);
      if (["requiere_revision", "fallido"].includes(result.data.estado)) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(result!.data.estado, result!.data.error).toBe("requiere_revision");
    expect(result!.data.fragmentos[0].texto).toContain("Percentages");
    await http(`/documentos/${uploaded.data.id}`, "DELETE");
  });
  it("no oculta un PDF corrupto como importación completada", async () => {
    const form = new FormData();
    form.append(
      "archivo",
      new Blob(["%PDF-1.4 archivo roto sin objetos"]),
      "roto.pdf",
    );
    const uploaded = await http(`/cursos/${course}/documentos`, "POST", form);
    let result;
    for (let n = 0; n < 100; n++) {
      result = await http(`/documentos/${uploaded.data.id}`);
      if (result.data.estado === "fallido") break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(result!.data.estado).toBe("fallido");
    expect(result!.data.error).toBeTruthy();
    await http(`/documentos/${uploaded.data.id}`, "DELETE");
  });
  it("rechaza JSON malformado o demasiado grande con errores seguros", async () => {
    const headers = {
      "X-Calibra-Request": "1",
      Cookie: cookie,
      "Content-Type": "application/json",
    };
    const bad = await fetch(url + "/api/v1/cursos", {
      method: "POST",
      headers,
      body: "{roto",
    });
    expect(bad.status).toBe(400);
    const huge = await fetch(url + "/api/v1/cursos", {
      method: "POST",
      headers,
      body: JSON.stringify({ titulo: "x".repeat(70000) }),
    });
    expect(huge.status).toBe(413);
  });
  it("solo permite CORS del frontend configurado", async () => {
    const r = await fetch(url + "/api/v1/sesion", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:8090",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "X-Calibra-Request",
      },
    });
    expect(r.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:8090",
    );
    expect(r.headers.get("access-control-allow-credentials")).toBe("true");
  });
  it("rechaza formatos engañosos y la eliminación retira los derivados", async () => {
    const form = new FormData();
    form.append("archivo", new Blob(["no es pdf"]), "falso.pdf");
    expect(
      (await http(`/cursos/${course}/documentos`, "POST", form)).status,
    ).toBe(400);
    expect(
      (await http(`/documentos/${document}`, "DELETE", undefined, other))
        .status,
    ).toBe(404);
    expect((await http(`/documentos/${document}`, "DELETE")).status).toBe(200);
    expect((await http(`/documentos/${document}`)).status).toBe(404);
    const files = await import("node:fs/promises");
    expect(await files.readdir(folder)).toHaveLength(0);
  });
  it("retoma sesión, práctica y árbol tras reiniciar la API", async () => {
    await app.close();
    const { createApp } = await import("../src/bootstrap.js");
    app = await createApp();
    await app.listen(0, "127.0.0.1");
    url = await app.getUrl();
    expect((await http(`/intentos/${attempt}`)).data.estado).toBe("entregado");
    expect((await http(`/arboles/${tree}`)).data.id).toBe(tree);
    expect(
      (await http("/cursos")).data.some((c: { id: string }) => c.id === course),
    ).toBe(true);
  });
});

describe("Harness de comprensión: retropropagación del error", () => {
  let actor: string,
    foreign: string,
    arbol: string,
    raiz: string,
    hijo: string,
    fallo: { id: string },
    segundoFallo: { id: string };
  const crearArbol = async (tema: string, sid: string) =>
    (
      await http(
        "/arboles",
        "POST",
        { tema, solicitud: "Quiero entender " + tema },
        sid,
        randomUUID(),
      )
    ).data.id as string;
  const responder = async (id: string, respuesta: string, sid = actor) =>
    http(
      `/comprobaciones/${id}/respuesta`,
      "PUT",
      { respuesta, justificacion: "Mi razonamiento" },
      sid,
    );
  const evidencias = async (comprobacion: string) =>
    (
      await db.query(
        `SELECT tipo,detalle FROM ${schema}.evidencias WHERE comprobacion_id=$1 ORDER BY tipo`,
        [comprobacion],
      )
    ).rows;
  const rastros = async (arbolId: string) =>
    (
      await db.query(
        `SELECT * FROM ${schema}.rastros_error WHERE arbol_id=$1 ORDER BY created_at`,
        [arbolId],
      )
    ).rows;
  const totalEvidencias = async () =>
    (await db.query(`SELECT count(*)::int AS n FROM ${schema}.evidencias`))
      .rows[0].n as number;
  beforeAll(async () => {
    actor = (await http("/sesion", "POST", {}, "")).cookie!;
    foreign = (await http("/sesion", "POST", {}, "")).cookie!;
    arbol = await crearArbol("porcentajes", actor);
    const nodos = (await http(`/arboles/${arbol}`, "GET", undefined, actor))
      .data.nodos;
    raiz = nodos[0].id;
    hijo = nodos[1].id;
    // El etiquetado automático de nodos llega con la generación; aquí se fija a mano.
    await db.query(
      `UPDATE ${schema}.nodos SET idea_clave='cambio-de-base' WHERE id=$1`,
      [hijo],
    );
  });
  it("fallar porcentajes-1 con 100 señala cambio-de-base, pista y el camino en el árbol", async () => {
    const c = await http("/comprobaciones", "POST", { arbol_id: arbol }, actor);
    expect(c.status).toBe(201);
    fallo = c.data;
    const r = await responder(c.data.id, "100");
    expect(r.status).toBe(200);
    expect(r.data.correcta).toBe(false);
    expect(r.data.rastro).toMatchObject({
      idea_clave: "cambio-de-base",
      nodo_retorno_id: hijo,
      nivel_ayuda: "pista",
      motivo: null,
      respuesta: "100",
    });
    expect(r.data.rastro.descripcion).toContain("base");
    expect(r.data.rastro.explicacion).toBeTruthy();
    expect(r.data.rastro.pista).toBeTruthy();
    expect(r.data.solucion).toBeTruthy();
    const filas = await rastros(arbol);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      idea_clave: "cambio-de-base",
      nodo_retorno_id: hijo,
      nivel_ayuda: "pista",
      comprobacion_id: c.data.id,
    });
    const t = await http(`/arboles/${arbol}`, "GET", undefined, actor);
    expect(t.data.ultimo_rastro).toMatchObject({
      idea_clave: "cambio-de-base",
      nodo_retorno_id: hijo,
      camino: [raiz, hijo],
      nivel_ayuda: "pista",
    });
    expect((await evidencias(c.data.id)).map((e) => e.tipo)).toEqual([
      "aplicacion_por_reforzar",
    ]);
  });
  it("una respuesta fuera del mapa se declara sin evidencia y no inventa causa", async () => {
    const otro = await crearArbol("fracciones", actor);
    const c = await http("/comprobaciones", "POST", { arbol_id: otro }, actor);
    const r = await responder(c.data.id, "7");
    expect(r.data.correcta).toBe(false);
    expect(r.data.rastro).toMatchObject({
      idea_clave: null,
      nodo_retorno_id: null,
      motivo: "sin_evidencia",
      nivel_ayuda: "pista",
      descripcion: null,
    });
    expect(r.data.rastro.explicacion).toContain("evidencia suficiente");
    expect(r.data.rastro.pista).toMatch(/justificaci|paso intermedio/);
    const t = await http(`/arboles/${otro}`, "GET", undefined, actor);
    expect(t.data.ultimo_rastro).toMatchObject({
      idea_clave: null,
      motivo: "sin_evidencia",
      camino: [],
    });
    expect((await rastros(otro))[0].idea_clave).toBeNull();
    await http(`/comprobaciones/${c.data.id}/cancelar`, "POST", {}, actor);
  });
  it("un segundo fallo en la misma idea del mismo árbol sube a ejemplo", async () => {
    const c = await http("/comprobaciones", "POST", { arbol_id: arbol }, actor);
    segundoFallo = c.data;
    const r = await responder(c.data.id, "190");
    expect(r.data.rastro).toMatchObject({
      idea_clave: "cambio-de-base",
      nivel_ayuda: "ejemplo",
    });
    expect((await rastros(arbol)).map((x) => x.nivel_ayuda)).toEqual([
      "pista",
      "ejemplo",
    ]);
  });
  it("un acierto posterior sin ayuda en otra actividad registra corrigio_tras_error", async () => {
    const c = await http("/comprobaciones", "POST", { arbol_id: arbol }, actor);
    expect(c.data.id).not.toBe(fallo.id);
    const r = await responder(c.data.id, "25");
    expect(r.data.correcta).toBe(true);
    expect(r.data.rastro).toBeNull();
    const ev = await evidencias(c.data.id);
    expect(ev.map((e) => e.tipo)).toEqual([
      "corrigio_tras_error",
      "resolvio_sin_ayuda",
    ]);
    expect(ev[0].detalle).toMatchObject({ idea_clave: "cambio-de-base" });
    expect(await rastros(arbol)).toHaveLength(2);
  });
  it("reenviar la misma respuesta no duplica rastros ni evidencias", async () => {
    const antes = await totalEvidencias();
    const again = await responder(segundoFallo.id, "190");
    expect(again.status).toBe(200);
    expect(again.data.rastro.nivel_ayuda).toBe("ejemplo");
    const also = await responder(fallo.id, "100");
    expect(also.data.rastro.nivel_ayuda).toBe("pista");
    expect(await rastros(arbol)).toHaveLength(2);
    expect(await totalEvidencias()).toBe(antes);
  });
  it("otra sesión no puede leer el árbol ni su rastro", async () => {
    expect(
      (await http(`/arboles/${arbol}`, "GET", undefined, foreign)).status,
    ).toBe(404);
    expect(
      (
        await http(
          `/comprobaciones/${fallo.id}/respuesta`,
          "PUT",
          { respuesta: "1" },
          foreign,
        )
      ).status,
    ).toBe(404);
  });
  it("abrir o leer nodos no crea evidencias aunque exista un rastro", async () => {
    const antes = await http("/evidencias", "GET", undefined, actor);
    await http(`/arboles/${arbol}`, "GET", undefined, actor);
    const despues = await http("/evidencias", "GET", undefined, actor);
    expect(despues.data).toHaveLength(antes.data.length);
  });
  it("corrigio_tras_error se registra una sola vez por fallo y el rastro queda marcado como corregido", async () => {
    const alumno = (await http("/sesion", "POST", {}, "")).cookie!;
    const propio = await crearArbol("porcentajes", alumno);
    const tipos = async (id: string) =>
      (
        await db.query(
          `SELECT tipo FROM ${schema}.evidencias WHERE comprobacion_id=$1 ORDER BY tipo`,
          [id],
        )
      ).rows.map((e) => e.tipo);
    const intentar = async (respuesta: string) => {
      const c = await http(
        "/comprobaciones",
        "POST",
        { arbol_id: propio },
        alumno,
      );
      await responder(c.data.id, respuesta, alumno);
      return c.data.id as string;
    };
    await intentar("100");
    const antes = await http(`/arboles/${propio}`, "GET", undefined, alumno);
    expect(antes.data.ultimo_rastro.corregido).toBe(false);
    const corrige = await intentar("180");
    expect(await tipos(corrige)).toEqual([
      "corrigio_tras_error",
      "resolvio_sin_ayuda",
    ]);
    const despues = await http(`/arboles/${propio}`, "GET", undefined, alumno);
    expect(despues.data.ultimo_rastro.corregido).toBe(true);
    const otroAcierto = await intentar("25");
    expect(await tipos(otroAcierto)).toEqual(["resolvio_sin_ayuda"]);
  });
});

describe("Harness de comprensión: nodos etiquetados y nodo faltante", () => {
  let sid: string, arbol: string, raiz: string;
  const crear = async (solicitud: string, key = randomUUID()) =>
    http("/arboles", "POST", { tema: "proporciones", solicitud }, sid, key);
  const nodos = async (id = arbol) =>
    (await http(`/arboles/${id}`, "GET", undefined, sid)).data.nodos as {
      id: string;
      idea_clave: string | null;
      titulo: string;
      padre_id: string | null;
    }[];
  beforeAll(async () => {
    sid = (await http("/sesion", "POST", {}, "")).cookie!;
    const c = await crear("Quiero entender proporciones");
    arbol = c.data.id;
    raiz = (await nodos())[0].id;
  });
  it("el proveedor de pruebas etiqueta raíz e hijos con claves del concepto", async () => {
    const ns = await nodos();
    const claves = ["directa-vs-inversa", "valor-unitario"];
    expect(ns.length).toBeGreaterThan(1);
    for (const n of ns) expect(claves).toContain(n.idea_clave);
    const [fila] = (
      await db.query(`SELECT prompt_version FROM ${schema}.nodos WHERE id=$1`, [
        raiz,
      ])
    ).rows;
    expect(fila.prompt_version).toBe("tutor-v3");
  });
  it("una idea_clave fuera del catálogo propuesta por la IA se guarda como NULL", async () => {
    const c = await crear("Explica proporciones [[clave-invalida]]");
    expect(c.status).toBe(201);
    const ns = await nodos(c.data.id);
    expect(ns).toHaveLength(2);
    expect(ns[0].idea_clave).not.toBeNull();
    expect(ns[1].idea_clave).toBeNull();
  });
  it("expandir con idea_clave etiqueta el nodo creado y es idempotente", async () => {
    const key = randomUUID();
    const body = {
      solicitud: "Explica esta idea",
      idea_clave: "valor-unitario",
    };
    const url = `/arboles/${arbol}/nodos/${raiz}/expandir`;
    const previos = await nodos();
    const antes = previos.length;
    const a = await http(url, "POST", body, sid, key);
    expect(a.status).toBe(201);
    const ns = await nodos();
    expect(ns.length).toBeGreaterThan(antes);
    const etiquetados = (l: { idea_clave: string | null }[]) =>
      l.filter((n) => n.idea_clave === "valor-unitario").length;
    expect(etiquetados(ns)).toBe(etiquetados(previos) + 1);
    const b = await http(url, "POST", body, sid, key);
    expect(b.data).toEqual(a.data);
    expect((await nodos()).length).toBe(ns.length);
  });
  it("expandir rechaza una idea_clave que no es del concepto del árbol", async () => {
    const r = await http(
      `/arboles/${arbol}/nodos/${raiz}/expandir`,
      "POST",
      { solicitud: "Explica", idea_clave: "cambio-de-base" },
      sid,
      randomUUID(),
    );
    expect(r.status).toBe(400);
  });
});

describe("Grafo de comprensión: estados derivados de la evidencia", () => {
  let a: string, b: string, arbol: string, otro: string, arbolB: string;
  let raiz: string, hijo: string;
  type N = { id: string; titulo: string; arbol_id: string; estado: string };
  type E = {
    origen: string;
    destino: string;
    tipo: string;
    creada_por: string;
  };
  const crear = async (tema: string, sid: string) =>
    (
      await http(
        "/arboles",
        "POST",
        { tema, solicitud: "Quiero entender " + tema },
        sid,
        randomUUID(),
      )
    ).data.id as string;
  const grafo = async (sid = a) =>
    (await http("/grafo", "GET", undefined, sid)).data;
  const nodo = async (id: string, sid = a) =>
    (await grafo(sid)).nodos.find((n: N) => n.id === id);
  const porTitulo = async (t: string) =>
    (await grafo()).nodos.find((n: N) => n.titulo === t);
  const aplicarOps = async (ops: unknown[], arbolId = arbol) => {
    const { GrafoService } =
      await import("../src/modules/seguimiento/grafo.js");
    const { Database } = await import("../src/database/database.js");
    const actor = (
      await db.query(`SELECT actor_id FROM ${schema}.arboles WHERE id=$1`, [
        arbolId,
      ])
    ).rows[0].actor_id as string;
    return app
      .get(Database)
      .transaction((m) =>
        app.get(GrafoService).aplicar(m, actor, arbolId, ops as never),
      );
  };
  const comprobar = async (respuesta: string) => {
    const c = await http("/comprobaciones", "POST", { arbol_id: arbol }, a);
    return http(
      `/comprobaciones/${c.data.id}/respuesta`,
      "PUT",
      { respuesta },
      a,
    );
  };
  beforeAll(async () => {
    a = (await http("/sesion", "POST", {}, "")).cookie!;
    b = (await http("/sesion", "POST", {}, "")).cookie!;
    arbol = await crear("porcentajes", a);
    otro = await crear("fracciones", a);
    arbolB = await crear("proporciones", b);
    const ns = (await http(`/arboles/${arbol}`, "GET", undefined, a)).data
      .nodos;
    raiz = ns[0].id;
    hijo = ns[1].id;
    await db.query(
      `UPDATE ${schema}.nodos SET idea_clave='cambio-de-base' WHERE id=$1`,
      [hijo],
    );
  });
  it("reúne los nodos de todos los árboles del actor, con aristas padre-hijo", async () => {
    const g = await grafo();
    const cuantos = (
      await db.query(
        `SELECT count(*)::int AS n FROM ${schema}.nodos WHERE arbol_id = ANY($1::uuid[])`,
        [[arbol, otro]],
      )
    ).rows[0].n;
    expect(g.nodos).toHaveLength(cuantos);
    expect(new Set(g.nodos.map((n: N) => n.arbol_id))).toEqual(
      new Set([arbol, otro]),
    );
    expect(g.nodos.find((n: N) => n.id === raiz)).toMatchObject({
      tipo: "concepto",
      concepto: "porcentajes",
      senal: null,
    });
    expect(
      g.aristas.some(
        (e: E) =>
          e.origen === raiz && e.destino === hijo && e.tipo === "subtema",
      ),
    ).toBe(true);
    expect(g.foco).toBeNull();
    expect(g.camino_error).toEqual([]);
  });
  it("otra sesión no ve nada ajeno", async () => {
    const gb = await grafo(b);
    expect(gb.nodos.every((n: N) => n.arbol_id === arbolB)).toBe(true);
    expect(gb.nodos.some((n: N) => n.id === raiz)).toBe(false);
    expect((await http("/grafo", "GET", undefined, "")).status).toBe(401);
  });
  it("la señal se dibuja aparte y no cambia el estado", async () => {
    await db.query(
      `UPDATE ${schema}.nodos SET senal='posible_confusion' WHERE id=$1`,
      [hijo],
    );
    expect(await nodo(hijo)).toMatchObject({
      senal: "posible_confusion",
      estado: "sin_explorar",
    });
    await db.query(`UPDATE ${schema}.nodos SET senal=NULL WHERE id=$1`, [hijo]);
  });
  it("un fallo en la comprobación marca el nodo de retorno y el camino del error", async () => {
    await comprobar("100");
    expect(await nodo(hijo)).toMatchObject({ estado: "fallo", evidencias: 1 });
    expect((await grafo()).camino_error).toEqual([raiz, hijo]);
  });
  it("corregir después del error lleva el nodo a aplicado", async () => {
    await comprobar("180");
    expect(await nodo(hijo)).toMatchObject({ estado: "aplicado" });
    expect(await nodo(raiz)).toMatchObject({ estado: "aplicado" });
  });
  it("un nodo sin interacción ni evidencia sigue sin explorar", async () => {
    const ns = (await grafo()).nodos.filter((n: N) => n.arbol_id === otro);
    expect(ns.some((n: N) => n.estado === "sin_explorar")).toBe(true);
  });
  it("crear_nodo y relacionar aplican la operación y el nodo nace sin explorar", async () => {
    const r = await aplicarOps([
      {
        op: "crear_nodo",
        ref_temporal: "e1",
        tipo: "error",
        titulo: "Compensar porcentajes",
        resumen: "Creer que +20% y -20% se anulan",
        idea_clave: "base-del-porcentaje",
        padre: hijo,
      },
      {
        op: "crear_nodo",
        ref_temporal: "i1",
        tipo: "idea",
        titulo: "La base cambia",
        resumen: "Cada porcentaje se calcula sobre su base",
        idea_clave: "base-del-porcentaje",
        padre: "e1",
      },
      { op: "relacionar", origen: "i1", destino: raiz, tipo: "requiere" },
    ]);
    expect(r.aplicadas).toHaveLength(3);
    const g = await grafo();
    const e1 = g.nodos.find((n: N) => n.titulo === "Compensar porcentajes");
    const i1 = g.nodos.find((n: N) => n.titulo === "La base cambia");
    expect(e1).toMatchObject({
      tipo: "error",
      origen: "ia",
      estado: "sin_explorar",
    });
    expect(
      g.aristas.some(
        (x: E) =>
          x.origen === i1.id &&
          x.destino === raiz &&
          x.tipo === "requiere" &&
          x.creada_por === "ia",
      ),
    ).toBe(true);
    expect(
      g.aristas.some((x: E) => x.origen === e1.id && x.destino === i1.id),
    ).toBe(true);
  });
  it("el sistema une el nodo error con el de retorno al registrar un rastro con idea clave", async () => {
    await comprobar("20");
    const g = await grafo();
    const e1 = g.nodos.find((n: N) => n.titulo === "Compensar porcentajes");
    const i1 = g.nodos.find((n: N) => n.titulo === "La base cambia");
    expect(i1.estado).toBe("fallo");
    expect(
      g.aristas.filter(
        (x: E) =>
          x.tipo === "confusion_con" &&
          x.origen === e1.id &&
          x.destino === i1.id &&
          x.creada_por === "sistema",
      ),
    ).toHaveLength(1);
  });
  it("editar_nodo guarda la revisión anterior", async () => {
    const i1 = await porTitulo("La base cambia");
    await aplicarOps([
      { op: "editar_nodo", nodo: i1.id, resumen: "Resumen nuevo" },
    ]);
    expect((await nodo(i1.id)).resumen).toBe("Resumen nuevo");
    const rev = await db.query(
      `SELECT contenido FROM ${schema}.revisiones_nodo WHERE nodo_id=$1`,
      [i1.id],
    );
    expect(rev.rows.map((x) => x.contenido)).toContain(
      "Cada porcentaje se calcula sobre su base",
    );
  });
  it("fusionar conserva las aristas y rechaza nodos con evidencia propia", async () => {
    const r = await aplicarOps([
      {
        op: "crear_nodo",
        ref_temporal: "f1",
        tipo: "ejemplo",
        titulo: "Ejemplo A",
        resumen: "A",
        padre: raiz,
      },
      {
        op: "crear_nodo",
        ref_temporal: "f2",
        tipo: "ejemplo",
        titulo: "Ejemplo B",
        resumen: "B",
        padre: raiz,
      },
      { op: "relacionar", origen: "f2", destino: hijo, tipo: "ejemplo_de" },
      { op: "fusionar", nodos: ["f1", "f2"], en: "f1" },
    ]);
    expect(r.aplicadas).toHaveLength(4);
    expect(await porTitulo("Ejemplo B")).toBeUndefined();
    const f1 = await porTitulo("Ejemplo A");
    expect(
      (await grafo()).aristas.some(
        (x: E) =>
          x.origen === f1.id && x.destino === hijo && x.tipo === "ejemplo_de",
      ),
    ).toBe(true);
    const bloqueada = await aplicarOps([
      { op: "fusionar", nodos: [hijo, f1.id], en: f1.id },
    ]);
    expect(bloqueada.aplicadas).toHaveLength(0);
    expect(bloqueada.rechazadas).toHaveLength(1);
    expect(await nodo(hijo)).toBeTruthy();
  });
  it("enfocar solo cambia el foco de la vista", async () => {
    const antes = await nodo(hijo);
    await aplicarOps([{ op: "enfocar", nodo: hijo }]);
    expect((await grafo()).foco).toBe(hijo);
    expect((await nodo(hijo)).estado).toBe(antes.estado);
  });
  it("las operaciones no alcanzan nodos de otra sesión", async () => {
    const ajeno = (await grafo(b)).nodos[0].id;
    const r = await aplicarOps([{ op: "enfocar", nodo: ajeno }]);
    expect(r.aplicadas).toHaveLength(0);
    expect(r.rechazadas).toHaveLength(1);
  });
});

describe("Tutor agente: ciclo con herramientas del sistema", () => {
  let a: string, b: string, conv: string, arbol: string;
  type Bloque = { tipo: string; id?: string; opciones?: number[] };
  const nuevaConv = async (sid: string, tema = "porcentajes") =>
    (await http("/conversaciones", "POST", { tema }, sid)).data as {
      id: string;
      arbol_id: string;
    };
  const decir = (texto: string, key = randomUUID(), c = conv, sid = a) =>
    http(`/conversaciones/${c}/mensajes`, "POST", { texto }, sid, key);
  const mensajes = async (c = conv) =>
    (
      await db.query(
        `SELECT rol,texto,bloques,grafo_ops,descartes,degradado FROM ${schema}.mensajes WHERE conversacion_id=$1 ORDER BY orden`,
        [c],
      )
    ).rows;
  const grafo = async (sid = a) =>
    (await http("/grafo", "GET", undefined, sid)).data;
  beforeAll(async () => {
    a = (await http("/sesion", "POST", {}, "")).cookie!;
    b = (await http("/sesion", "POST", {}, "")).cookie!;
    const c = await nuevaConv(a);
    conv = c.id;
    arbol = c.arbol_id;
  });
  it("crea la conversación con su árbol y raíz, sin llamar a la IA", async () => {
    const r = await http("/conversaciones", "POST", {}, a);
    expect(r.status).toBe(400);
    const g = await grafo();
    expect(
      g.nodos.some(
        (n: { arbol_id: string; tipo: string }) =>
          n.arbol_id === arbol && n.tipo === "concepto",
      ),
    ).toBe(true);
    expect(
      (await http(`/conversaciones/${conv}`, "GET", undefined, a)).data
        .mensajes,
    ).toEqual([]);
  });
  it("un turno usa al menos una herramienta y persiste el mensaje del tutor", async () => {
    const r = await decir("Hola, quiero entender los porcentajes");
    expect(r.status).toBe(201);
    expect(r.data.tutor.texto).toContain("PROVEEDOR DE PRUEBAS");
    expect(r.data.tutor.degradado).toBe(false);
    expect(r.data.tutor.pasos).toEqual(["leer_grafo"]);
    const guardado = (
      await http(`/conversaciones/${conv}`, "GET", undefined, a)
    ).data;
    expect(guardado.mensajes.at(-1).pasos).toEqual(["leer_grafo"]);
    expect(guardado.mensajes[0].pasos).toEqual([]);
    const fila = await db.query(
      `SELECT pasos FROM ${schema}.mensajes WHERE id=$1`,
      [r.data.tutor.id],
    );
    expect(fila.rows[0].pasos).toEqual(["leer_grafo"]);
    const ms = await mensajes();
    expect(ms.map((m) => m.rol)).toEqual(["estudiante", "tutor"]);
  });
  it("el turno es idempotente por Idempotency-Key", async () => {
    const key = randomUUID();
    const antes = (await mensajes()).length;
    const x = await decir("Mensaje con clave", key);
    const y = await decir("Mensaje con clave", key);
    expect(y.data.tutor.id).toBe(x.data.tutor.id);
    expect(y.data.tutor.pasos).toEqual(x.data.tutor.pasos);
    expect((await mensajes()).length).toBe(antes + 2);
    expect((await decir("Otro texto", key)).status).toBe(409);
    expect((await decir("sin clave", "corta")).status).toBe(400);
  });
  it("ofrece las seis herramientas cuando no hay comprobación activa", async () => {
    const r = await decir("[[herramientas]]");
    expect(r.data.tutor.texto.split(": ")[1].split(",")).toEqual([
      "leer_grafo",
      "leer_rastro",
      "leer_evidencias",
      "leer_intento",
      "generar_practica",
      "proponer_comprobacion",
    ]);
  });
  it("ejecuta como máximo 4 llamadas a herramientas por turno", async () => {
    const r = await decir("[[cuatro]]");
    expect(r.data.tutor.texto).toBe("Ejecutadas: 4");
    expect(r.data.tutor.pasos).toHaveLength(4);
    expect(
      r.data.tutor.pasos.every((p: unknown) => typeof p === "string"),
    ).toBe(true);
  });
  it("repara una sola vez un turno que no pasa la forma", async () => {
    const r = await decir("[[reparable]]");
    expect(r.data.tutor).toMatchObject({
      texto: "Respuesta reparada.",
      degradado: false,
    });
  });
  it("si la reparación falla, el turno queda degradado con solo texto", async () => {
    const r = await decir("[[sin-forma]]");
    expect(r.data.tutor).toMatchObject({
      texto: "esto no es json",
      degradado: true,
      bloques: [],
    });
    const ult = (await mensajes()).at(-1)!;
    expect(ult.degradado).toBe(true);
  });
  it("descarta bloques inválidos y conserva los válidos", async () => {
    const r = await decir("[[bloques]]");
    const bloques = r.data.tutor.bloques as Bloque[];
    expect(bloques.map((x) => x.tipo)).toEqual(["en_tus_palabras"]);
    expect(bloques[0].id).toBeTruthy();
    expect(r.data.tutor.descartes).toBe(2);
  });
  it("aplica las operaciones de grafo válidas y descarta las ajenas", async () => {
    const r = await decir("[[ops]]");
    expect(r.status).toBe(201);
    const g = await grafo();
    const e = g.nodos.find(
      (n: { titulo: string }) =>
        n.titulo === "Pensar que +20% y -20% se anulan",
    );
    const i = g.nodos.find(
      (n: { titulo: string }) => n.titulo === "Cada porcentaje tiene su base",
    );
    expect(e).toMatchObject({ tipo: "error", estado: "sin_explorar" });
    expect(i).toMatchObject({
      idea_clave: "cambio-de-base",
      estado: "sin_explorar",
    });
    expect(g.foco).toBe(i.id);
    expect(
      g.aristas.some(
        (x: { origen: string; destino: string; tipo: string }) =>
          x.origen === e.id && x.destino === i.id && x.tipo === "confusion_con",
      ),
    ).toBe(true);
    expect(r.data.tutor.descartes).toBe(1);
  });
  it("el agente genera práctica desde una plantilla, sin revelar cuál opción es la correcta", async () => {
    const r = await decir("[[practica]]");
    const p = (r.data.tutor.bloques as Bloque[])[0] as Bloque &
      Record<string, unknown>;
    expect(p.tipo).toBe("practica");
    expect(p.id).toBeTruthy();
    expect(typeof p.enunciado).toBe("string");
    expect(p.opciones!.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(p)).not.toMatch(/respuesta|distractor|correct/);
  });
  it("propone la comprobación sin iniciarla", async () => {
    const r = await decir("[[comprobar]]");
    expect((r.data.tutor.bloques as Bloque[]).map((x) => x.tipo)).toContain(
      "invitacion_comprobar",
    );
    expect(
      (await http("/comprobaciones/activa", "GET", undefined, a)).data,
    ).toBeNull();
  });
  it("sin comprobación activa el mensaje puede contener cualquier número", async () => {
    const r = await decir("[[filtrar]]");
    expect(r.data.tutor.texto).toContain("96");
  });
  describe("con una comprobación activa", () => {
    let comprobacion: string;
    beforeAll(async () => {
      comprobacion = (
        await http("/comprobaciones", "POST", { arbol_id: arbol }, a)
      ).data.id;
    });
    afterAll(async () => {
      await http(`/comprobaciones/${comprobacion}/cancelar`, "POST", {}, a);
    });
    it("no ofrece leer_intento ni generar_practica", async () => {
      const r = await decir("[[herramientas]]");
      const lista = r.data.tutor.texto.split(": ")[1].split(",");
      expect(lista).not.toContain("leer_intento");
      expect(lista).not.toContain("generar_practica");
      expect(lista).toContain("leer_grafo");
    });
    it("rechaza una respuesta que contiene el valor correcto de la actividad", async () => {
      const r = await decir("[[filtrar]]");
      expect(r.data.tutor.texto).toMatch(/comprobación está activa/);
      expect(r.data.tutor.texto).not.toContain("96");
      expect(r.data.tutor.descartes).toBe(1);
    });
    it("no entrega bloques de práctica mientras dura la comprobación", async () => {
      const r = await decir("[[practica]]");
      expect(r.data.tutor.bloques).toEqual([]);
    });
    it("conversar no cierra ni modifica la comprobación", async () => {
      const activa = await http("/comprobaciones/activa", "GET", undefined, a);
      expect(activa.data.id).toBe(comprobacion);
    });
  });
  it("otra sesión no ve ni escribe en la conversación", async () => {
    expect(
      (await http(`/conversaciones/${conv}`, "GET", undefined, b)).status,
    ).toBe(404);
    expect((await decir("hola", randomUUID(), conv, b)).status).toBe(404);
    expect((await http("/conversaciones", "GET", undefined, b)).data).toEqual(
      [],
    );
    expect(
      (await http("/conversaciones", "GET", undefined, a)).data.length,
    ).toBeGreaterThan(0);
  });
  it("sin proveedor configurado falla con claridad y el reintento con la misma clave funciona", async () => {
    const key = randomUUID();
    process.env.AI_PROVIDER = "disabled";
    try {
      const r = await decir("Hola otra vez", key);
      expect(r.status).toBe(503);
      expect(r.data.error.mensaje).toMatch(/no está configurado/);
    } finally {
      process.env.AI_PROVIDER = "fake";
    }
    const ok = await decir("Hola otra vez", key);
    expect(ok.status).toBe(201);
    const ms = (await mensajes()).filter((m) => m.texto === "Hola otra vez");
    expect(ms).toHaveLength(1);
  });
  it("hay un presupuesto de turnos por conversación", async () => {
    const c = await nuevaConv(b);
    for (let n = 1; n <= 40; n++)
      await db.query(
        `INSERT INTO ${schema}.mensajes(id,conversacion_id,orden,rol,texto) VALUES($1,$2,$3,'estudiante','x')`,
        [randomUUID(), c.id, n],
      );
    const r = await decir("uno más", randomUUID(), c.id, b);
    expect(r.status).toBe(429);
  });
});

describe("Respuestas a bloques de la charla: sin evidencia", () => {
  let a: string, b: string, conv: string, arbol: string, raiz: string;
  type Bloque = {
    id: string;
    tipo: string;
    plantilla?: string;
    semilla?: number;
  };
  type Nodo = { titulo: string; senal: string | null; estado: string };
  const decir = async (texto: string, sid = a) =>
    (
      await http(
        `/conversaciones/${conv}/mensajes`,
        "POST",
        { texto },
        sid,
        randomUUID(),
      )
    ).data.tutor.bloques as Bloque[];
  const responder = (id: string, respuesta: string, sid = a) =>
    http(`/bloques/${id}/respuesta`, "POST", { respuesta }, sid);
  const grafo = async () => (await http("/grafo", "GET", undefined, a)).data;
  const nodoIdea = async (idea: string) =>
    (
      await db.query(
        `SELECT id FROM ${schema}.nodos WHERE arbol_id=$1 AND idea_clave=$2`,
        [arbol, idea],
      )
    ).rows[0].id as string;
  const evidencias = async () =>
    (await http("/evidencias", "GET", undefined, a)).data.length as number;
  beforeAll(async () => {
    a = (await http("/sesion", "POST", {}, "")).cookie!;
    b = (await http("/sesion", "POST", {}, "")).cookie!;
    const c = (
      await http("/conversaciones", "POST", { tema: "porcentajes" }, a)
    ).data;
    conv = c.id;
    arbol = c.arbol_id;
    raiz = c.raiz_id;
    let orden = 0;
    for (const idea of ["cambio-de-base", "base-del-porcentaje"])
      await db.query(
        `INSERT INTO ${schema}.nodos(id,arbol_id,padre_id,profundidad,orden,tipo,titulo,contenido,procedencia,prompt_version,idea_clave)
         VALUES($1,$2,$3,1,$4,'idea',$5,'x','Generado por IA; no revisado','t',$6)`,
        [randomUUID(), arbol, raiz, orden++, "Nodo " + idea, idea],
      );
  });
  it("una práctica incorrecta devuelve la idea clave del distractor y deja una señal, no evidencia", async () => {
    const [p] = await decir("[[practica]]");
    const i = generar(p.plantilla!, p.semilla!);
    const malo = i.distractores[0];
    const antes = await evidencias();
    const r = await responder(p.id, String(malo.valor));
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({
      correcta: false,
      idea_clave: malo.idea_clave,
      senal: true,
      solucion: null,
    });
    const g = await grafo();
    const marcado = g.nodos.filter(
      (x: Nodo) => x.senal === "posible_confusion",
    );
    expect(marcado).toHaveLength(1);
    expect(marcado[0].estado).toBe("sin_explorar");
    expect(await evidencias()).toBe(antes);
    const filas = await db.query(
      `SELECT resultado FROM ${schema}.respuestas_bloque WHERE actor_id=(SELECT actor_id FROM ${schema}.conversaciones WHERE id=$1)`,
      [conv],
    );
    expect(filas.rows.at(-1).resultado).toMatchObject({ correcta: false });
  });
  it("una práctica correcta se corrige de forma determinista y tampoco crea evidencia", async () => {
    const [p] = await decir("[[practica]]");
    const i = generar(p.plantilla!, p.semilla!);
    const antes = await evidencias();
    const r = await responder(p.id, String(i.respuesta).replace(".", ","));
    expect(r.data).toMatchObject({ correcta: true, idea_clave: null });
    expect(r.data.solucion).toContain(String(i.respuesta));
    expect(await evidencias()).toBe(antes);
    const estados = (await grafo()).nodos.map((n: Nodo) => n.estado);
    expect(
      estados.every((e: string) => e !== "aplicado" && e !== "fallo"),
    ).toBe(true);
  });
  it("una respuesta que no es número no se cuenta como fallo", async () => {
    const [p] = await decir("[[practica]]");
    expect((await responder(p.id, "no sé")).status).toBe(400);
  });
  it("el texto libre se acepta solo si la cita está literalmente en lo escrito", async () => {
    const [e] = await decir("[[bloques]]");
    expect(e.tipo).toBe("en_tus_palabras");
    const antes = await evidencias();
    const r = await responder(e.id, "Yo pensé que +20 y -20 se cancelan");
    expect(r.data.guardada).toBe(true);
    expect(r.data.lectura).toMatchObject({
      posible_confusion: "cambio-de-base",
      cita_del_estudiante: "se cancelan",
    });
    expect(r.data.mensaje).toMatch(/^Me parece que/);
    const g = await grafo();
    const id = await nodoIdea("cambio-de-base");
    const n = g.nodos.find((x: { id: string }) => x.id === id);
    expect(n).toMatchObject({
      senal: "posible_confusion",
      estado: "sin_explorar",
    });
    expect(await evidencias()).toBe(antes);
  });
  it("una cita inventada se descarta: la respuesta queda guardada sin lectura", async () => {
    const [e] = await decir("[[bloques]]");
    const r = await responder(
      e.id,
      "No sé por dónde empezar [[cita-inventada]]",
    );
    expect(r.data).toMatchObject({
      guardada: true,
      lectura: null,
      mensaje: null,
    });
    const fila = await db.query(
      `SELECT respuesta,lectura FROM ${schema}.respuestas_bloque ORDER BY created_at DESC LIMIT 1`,
    );
    expect(fila.rows[0].lectura).toBeNull();
    expect(fila.rows[0].respuesta).toContain("No sé por dónde");
  });
  it("sin proveedor la respuesta igual se guarda", async () => {
    const [e] = await decir("[[bloques]]");
    process.env.AI_PROVIDER = "disabled";
    try {
      const r = await responder(e.id, "Mi respuesta sin lectura");
      expect(r.status).toBe(201);
      expect(r.data.lectura).toBeNull();
    } finally {
      process.env.AI_PROVIDER = "fake";
    }
  });
  it("los bloques sin input y los de otra sesión se rechazan", async () => {
    const [inv] = await decir("[[comprobar]]");
    expect(inv.tipo).toBe("invitacion_comprobar");
    expect((await responder(inv.id, "hola")).status).toBe(400);
    const [e] = await decir("[[bloques]]");
    expect((await responder(e.id, "hola", b)).status).toBe(404);
    expect((await responder(randomUUID(), "hola")).status).toBe(404);
  });
  it("durante una comprobación activa no se corrige ni se lee nada", async () => {
    const [e] = await decir("[[bloques]]");
    const c = await http("/comprobaciones", "POST", { arbol_id: arbol }, a);
    expect((await responder(e.id, "algo")).status).toBe(409);
    await http(`/comprobaciones/${c.data.id}/cancelar`, "POST", {}, a);
  });
});

describe("Comprobaciones desde plantillas (S13)", () => {
  let t: string, arbol: string;
  const iniciar = () => http("/comprobaciones", "POST", { arbol_id: arbol }, t);
  const fila = async (id: string) =>
    (
      await db.query(
        `SELECT actividad_id,version,concepto,enunciado FROM ${schema}.comprobaciones WHERE id=$1`,
        [id],
      )
    ).rows[0];
  beforeAll(async () => {
    t = (await http("/sesion", "POST", {}, "")).cookie!;
    arbol = (
      await http(
        "/arboles",
        "POST",
        { tema: "porcentajes", solicitud: "Quiero entender porcentajes" },
        t,
        randomUUID(),
      )
    ).data.id;
  });
  it("primero usa las actividades curadas y solo después una instancia de plantilla", async () => {
    for (let n = 0; n < 3; n++) {
      const c = await iniciar();
      expect(c.status).toBe(201);
      expect(c.data.origen).toBe("curada");
      expect((await fila(c.data.id)).actividad_id).toMatch(/^porcentajes-\d$/);
      await http(`/comprobaciones/${c.data.id}/cancelar`, "POST", {}, t);
    }
    const c = await iniciar();
    expect(c.status).toBe(201);
    expect(c.data.origen).toBe("plantilla");
    const f = await fila(c.data.id);
    const i = instanciaDesdeClave(f.actividad_id)!;
    expect(i.concepto).toBe("porcentajes");
    // El enunciado es texto fijo del sistema, no generado por IA.
    expect(c.data.enunciado).toBe(i.enunciado_base);
    expect(f.enunciado).toBe(i.enunciado_base);
    expect(f.version).toBe("plantilla-v1");
    const activa = await http("/comprobaciones/activa", "GET", undefined, t);
    expect(activa.data.origen).toBe("plantilla");
    await http(`/comprobaciones/${c.data.id}/cancelar`, "POST", {}, t);
  });
  it("nunca repite una combinación (plantilla, parámetros) ya expuesta", async () => {
    const vistas = new Set<string>();
    for (let n = 0; n < 8; n++) {
      const c = await iniciar();
      const f = await fila(c.data.id);
      expect(vistas.has(f.actividad_id)).toBe(false);
      vistas.add(f.actividad_id);
      await http(`/comprobaciones/${c.data.id}/cancelar`, "POST", {}, t);
    }
    const expuestas = await clavesExpuestas(
      app.get((await import("../src/database/database.js")).Database),
      (
        await db.query(`SELECT actor_id FROM ${schema}.arboles WHERE id=$1`, [
          arbol,
        ])
      ).rows[0].actor_id,
    );
    for (const k of vistas) expect(expuestas.has(k)).toBe(true);
  });
  it("un distractor de la plantilla deja un rastro con su idea clave y origen plantilla", async () => {
    const c = await iniciar();
    const f = await fila(c.data.id);
    const i = instanciaDesdeClave(f.actividad_id)!;
    const d = i.distractores[0];
    const r = await http(
      `/comprobaciones/${c.data.id}/respuesta`,
      "PUT",
      { respuesta: String(d.valor), justificacion: "Mi razonamiento" },
      t,
    );
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ correcta: false, origen: "plantilla" });
    expect(r.data.rastro).toMatchObject({
      idea_clave: d.idea_clave,
      motivo: null,
    });
    const rastro = (
      await db.query(
        `SELECT origen,plantilla,parametros,idea_clave FROM ${schema}.rastros_error WHERE comprobacion_id=$1`,
        [c.data.id],
      )
    ).rows[0];
    expect(rastro).toMatchObject({
      origen: "plantilla",
      plantilla: i.plantilla,
      parametros: i.parametros,
      idea_clave: d.idea_clave,
    });
    const ev = (
      await db.query(
        `SELECT detalle FROM ${schema}.evidencias WHERE comprobacion_id=$1`,
        [c.data.id],
      )
    ).rows;
    expect(ev).toHaveLength(1);
    expect(ev[0].detalle).toMatchObject({
      origen: "plantilla",
      plantilla: i.plantilla,
      parametros: i.parametros,
    });
  });
  it("una respuesta correcta registra resolvio_sin_ayuda y la corrección sigue siendo una por fallo", async () => {
    const c = await iniciar();
    const i = instanciaDesdeClave((await fila(c.data.id)).actividad_id)!;
    expect(
      (
        await http(
          `/comprobaciones/${c.data.id}/respuesta`,
          "PUT",
          { respuesta: "nada" },
          t,
        )
      ).status,
    ).toBe(400);
    const r = await http(
      `/comprobaciones/${c.data.id}/respuesta`,
      "PUT",
      { respuesta: String(i.respuesta).replace(".", ",") },
      t,
    );
    expect(r.data).toMatchObject({ correcta: true, origen: "plantilla" });
    const tipos = (
      await db.query(
        `SELECT tipo FROM ${schema}.evidencias WHERE comprobacion_id=$1 ORDER BY tipo`,
        [c.data.id],
      )
    ).rows.map((x) => x.tipo);
    expect(tipos).toEqual(["corrigio_tras_error", "resolvio_sin_ayuda"]);
    const c2 = await iniciar();
    const i2 = instanciaDesdeClave((await fila(c2.data.id)).actividad_id)!;
    await http(
      `/comprobaciones/${c2.data.id}/respuesta`,
      "PUT",
      { respuesta: String(i2.respuesta) },
      t,
    );
    const otra = await db.query(
      `SELECT tipo FROM ${schema}.evidencias WHERE comprobacion_id=$1`,
      [c2.data.id],
    );
    expect(otra.rows.map((x) => x.tipo)).toEqual(["resolvio_sin_ayuda"]);
  });
  it("el bloqueo de ayudas sigue igual con una comprobación de plantilla", async () => {
    const c = await iniciar();
    const raiz = (
      await db.query(
        `SELECT id FROM ${schema}.nodos WHERE arbol_id=$1 AND padre_id IS NULL`,
        [arbol],
      )
    ).rows[0].id;
    const r = await http(
      `/arboles/${arbol}/nodos/${raiz}/expandir`,
      "POST",
      { solicitud: "Explícame" },
      t,
      randomUUID(),
    );
    expect(r.status).toBe(409);
    expect((await iniciar()).data.id).toBe(c.data.id);
    await http(`/comprobaciones/${c.data.id}/cancelar`, "POST", {}, t);
  });
});

describe("Ajustes del agente tras las pruebas con Groq", () => {
  let a: string, conv: string, arbol: string;
  const decir = (texto: string) =>
    http(
      `/conversaciones/${conv}/mensajes`,
      "POST",
      { texto },
      a,
      randomUUID(),
    );
  beforeAll(async () => {
    a = (await http("/sesion", "POST", {}, "")).cookie!;
    const c = (
      await http("/conversaciones", "POST", { tema: "porcentajes" }, a)
    ).data;
    conv = c.id;
    arbol = c.arbol_id;
  });
  it("una lectura sin idea detectada no muestra el «Me parece que…»", async () => {
    const r = await decir("[[bloques]]");
    const bloque = r.data.tutor.bloques[0];
    const res = await http(
      `/bloques/${bloque.id}/respuesta`,
      "POST",
      { respuesta: "Tengo que pensarlo un poco más" },
      a,
    );
    expect(res.status).toBe(201);
    expect(res.data.guardada).toBe(true);
    expect(res.data.mensaje).toBeNull();
  });
  it("el agente recibe el enunciado de la comprobación activa, nunca su clave", async () => {
    const sin = await decir("[[contexto]]");
    expect(sin.data.tutor.texto).toBe("sin-enunciado;clave:oculta");
    const c = await http("/comprobaciones", "POST", { arbol_id: arbol }, a);
    const con = await decir("[[contexto]]");
    expect(con.data.tutor.texto).toBe("con-enunciado;clave:oculta");
    await http(`/comprobaciones/${c.data.id}/cancelar`, "POST", {}, a);
  });
});

describe("Matriz de artefactos: integración con PostgreSQL real y proveedor fake", () => {
  let a: string, b: string, conv: string, arbol: string, actor: string;
  let propio: string, ajeno: string;
  type Bl = {
    id: string;
    tipo: string;
    opciones?: number[];
    plantilla?: string;
    semilla?: number;
    forma?: string;
  };
  const TEXTO = "Respondí 100 porque +20 y -20 se cancelan";
  const emitir = async (marca: string, texto = TEXTO, c = conv, sid = a) =>
    (
      await http(
        `/conversaciones/${c}/mensajes`,
        "POST",
        { texto: `[[b:${marca}]] ${texto}` },
        sid,
        randomUUID(),
      )
    ).data.tutor as {
      id: string;
      bloques: Bl[];
      descartes: number;
      degradado: boolean;
    };
  const nuevoActor = async () => {
    const sid = (await http("/sesion", "POST", {}, "")).cookie!;
    const c = (
      await http("/conversaciones", "POST", { tema: "porcentajes" }, sid)
    ).data;
    return { sid, conv: c.id as string, arbol: c.arbol_id as string };
  };
  const responder = (id: string, respuesta: string) =>
    http(`/bloques/${id}/respuesta`, "POST", { respuesta }, a);
  const evidencias = async () =>
    (await http("/evidencias", "GET", undefined, a)).data.length as number;
  const grafo = async () => (await http("/grafo", "GET", undefined, a)).data;
  const fragmento = async (actorId: string) => {
    const curso = randomUUID(),
      doc = randomUUID(),
      frag = randomUUID();
    await db.query(
      `INSERT INTO ${schema}.cursos_personales(id,actor_id,titulo) VALUES($1,$2,'Curso de prueba')`,
      [curso, actorId],
    );
    await db.query(
      `INSERT INTO ${schema}.documentos(id,curso_id,nombre,hash,ruta,formato,estado) VALUES($1,$2,'doc.txt',$3,'x','txt','listo')`,
      [doc, curso, randomUUID()],
    );
    await db.query(
      `INSERT INTO ${schema}.fragmentos(id,documento_id,pagina,posicion,texto) VALUES($1,$2,1,1,'Texto de prueba')`,
      [frag, doc],
    );
    return frag;
  };
  beforeAll(async () => {
    a = (await http("/sesion", "POST", {}, "")).cookie!;
    b = (await http("/sesion", "POST", {}, "")).cookie!;
    const c = (
      await http("/conversaciones", "POST", { tema: "porcentajes" }, a)
    ).data;
    conv = c.id;
    arbol = c.arbol_id;
    actor = (
      await db.query(
        `SELECT actor_id FROM ${schema}.conversaciones WHERE id=$1`,
        [conv],
      )
    ).rows[0].actor_id;
    const cb = (
      await http("/conversaciones", "POST", { tema: "porcentajes" }, b)
    ).data;
    const actorB = (
      await db.query(
        `SELECT actor_id FROM ${schema}.conversaciones WHERE id=$1`,
        [cb.id],
      )
    ).rows[0].actor_id;
    propio = await fragmento(actor);
    ajeno = await fragmento(actorB);
  });
  const TIPOS: [string, string][] = [
    ["pregunta_socratica", "pregunta_socratica"],
    ["contraste", "contraste"],
    ["razonamiento_anotado", "razonamiento_anotado"],
    ["prediccion", "prediccion"],
    ["ejemplo_paso_a_paso", "ejemplo_paso_a_paso"],
    ["visual_cadena", "visual"],
    ["visual_barra", "visual"],
    ["visual_tabla", "visual"],
    ["visual_recta", "visual"],
    ["practica", "practica"],
    ["en_tus_palabras", "en_tus_palabras"],
    ["invitacion_comprobar", "invitacion_comprobar"],
  ];
  for (const [marca, tipo] of TIPOS)
    it(`persiste y devuelve el bloque ${marca}`, async () => {
      const t = await emitir(marca);
      expect(t.degradado).toBe(false);
      expect(t.descartes).toBe(0);
      expect(t.bloques).toHaveLength(1);
      expect(t.bloques[0]).toMatchObject({ tipo });
      expect(t.bloques[0].id).toBeTruthy();
      const guardado = (
        await db.query(`SELECT bloques FROM ${schema}.mensajes WHERE id=$1`, [
          t.id,
        ])
      ).rows[0].bloques;
      expect(guardado).toHaveLength(1);
      expect(guardado[0].id).toBe(t.bloques[0].id);
      const leido = (
        await http(`/conversaciones/${conv}`, "GET", undefined, a)
      ).data.mensajes.find((m: { id: string }) => m.id === t.id);
      expect(leido.bloques[0].id).toBe(t.bloques[0].id);
    });
  it("las cuatro formas de visual se persisten con su forma", async () => {
    const formas = [];
    for (const m of [
      "visual_cadena",
      "visual_barra",
      "visual_tabla",
      "visual_recta",
    ])
      formas.push((await emitir(m)).bloques[0].forma);
    expect(formas).toEqual([
      "cadena_porcentual",
      "barra_de_partes",
      "tabla_proporcion",
      "recta_numerica",
    ]);
  });
  it("prediccion y practica llegan con enunciado y opciones, sin revelar la correcta", async () => {
    for (const m of ["prediccion", "practica"]) {
      const [x] = (await emitir(m)).bloques as (Bl & Record<string, unknown>)[];
      expect(typeof x.enunciado).toBe("string");
      expect(x.opciones!.length).toBeGreaterThanOrEqual(3);
      expect(JSON.stringify(x)).not.toMatch(/respuesta|distractor|correct/);
    }
  });
  it("pregunta_socratica se responde con lectura provisional de cita literal y sin evidencia", async () => {
    const [p] = (await emitir("pregunta_socratica")).bloques;
    const antes = await evidencias();
    const estados = (await grafo()).nodos.map(
      (n: { estado: string }) => n.estado,
    );
    const r = await responder(p.id, "Sobre 100, porque se cancelan");
    expect(r.status).toBe(201);
    expect(r.data.lectura).toMatchObject({
      cita_del_estudiante: "se cancelan",
      posible_confusion: "cambio-de-base",
    });
    expect("Sobre 100, porque se cancelan").toContain(
      r.data.lectura.cita_del_estudiante,
    );
    expect(r.data.mensaje).toMatch(/^Me parece que/);
    expect(await evidencias()).toBe(antes);
    expect(
      (await grafo()).nodos.map((n: { estado: string }) => n.estado),
    ).toEqual(estados);
    const guardada = await db.query(
      `SELECT respuesta,lectura FROM ${schema}.respuestas_bloque ORDER BY created_at DESC LIMIT 1`,
    );
    expect(guardada.rows[0].lectura).toMatchObject({ confianza: "media" });
  });
  it("prediccion se corrige de forma determinista, acierte o falle, sin evidencia", async () => {
    const [p] = (await emitir("prediccion")).bloques;
    const i = generar(p.plantilla!, p.semilla!);
    const antes = await evidencias();
    const mal = await responder(p.id, String(i.distractores[0].valor));
    expect(mal.data).toMatchObject({
      correcta: false,
      idea_clave: i.distractores[0].idea_clave,
      solucion: null,
    });
    const bien = await responder(p.id, String(i.respuesta));
    expect(bien.data).toMatchObject({ correcta: true });
    expect(bien.data.solucion).toContain(String(i.respuesta));
    expect(await evidencias()).toBe(antes);
  });
  it("ejemplo_paso_a_paso recibe el intento del estudiante como lectura provisional, sin evidencia", async () => {
    const [p] = (await emitir("ejemplo_paso_a_paso")).bloques;
    const antes = await evidencias();
    const r = await responder(p.id, "En mi ejemplo los descuentos se cancelan");
    expect(r.status).toBe(201);
    expect(r.data.lectura.cita_del_estudiante).toBe("se cancelan");
    const benigna = await responder(p.id, "Lo intento con 200 y 10%");
    expect(benigna.data.guardada).toBe(true);
    expect(benigna.data.mensaje).toBeNull();
    expect(await evidencias()).toBe(antes);
  });
  it("practica y en_tus_palabras se responden sin crear evidencia", async () => {
    const [pr] = (await emitir("practica")).bloques;
    const [et] = (await emitir("en_tus_palabras")).bloques;
    const antes = await evidencias();
    const i = generar(pr.plantilla!, pr.semilla!);
    expect((await responder(pr.id, String(i.respuesta))).data.correcta).toBe(
      true,
    );
    expect(
      (await responder(et.id, "Porque se cancelan olvidé la base")).data
        .lectura,
    ).toMatchObject({
      cita_del_estudiante: "se cancelan",
    });
    expect(await evidencias()).toBe(antes);
  });
  it("los bloques sin input rechazan respuestas", async () => {
    for (const m of [
      "contraste",
      "razonamiento_anotado",
      "visual_cadena",
      "invitacion_comprobar",
    ]) {
      const [x] = (await emitir(m)).bloques;
      expect((await responder(x.id, "hola")).status, m).toBe(400);
    }
  });
  it("invitacion_comprobar lleva a una comprobación real", async () => {
    const [inv] = (await emitir("invitacion_comprobar")).bloques;
    expect(inv.tipo).toBe("invitacion_comprobar");
    expect(
      (await http("/comprobaciones/activa", "GET", undefined, a)).data,
    ).toBeNull();
    const c = await http("/comprobaciones", "POST", { arbol_id: arbol }, a);
    expect(c.status).toBe(201);
    expect(c.data.enunciado).toBeTruthy();
    const activa = (await http("/comprobaciones/activa", "GET", undefined, a))
      .data;
    expect(activa.id).toBe(c.data.id);
    await http(`/comprobaciones/${c.data.id}/cancelar`, "POST", {}, a);
  });
  it("cita acepta solo fragmentos del propio estudiante", async () => {
    const ok = await emitir(`cita:${propio}`);
    expect(ok.bloques[0]).toMatchObject({
      tipo: "cita",
      fragmento_id: propio,
      documento: "doc.txt",
      pagina: 1,
    });
    const no = await emitir(`cita:${ajeno}`);
    expect(no.bloques).toEqual([]);
    expect(no.descartes).toBe(1);
  });
  it("contraste y razonamiento_anotado descartan atribuciones inventadas", async () => {
    const c = await nuevoActor();
    for (const m of ["contraste", "razonamiento_anotado"]) {
      const t = await emitir(m, "Hola, no escribí nada de eso", c.conv, c.sid);
      expect(t.bloques, m).toEqual([]);
      expect(t.descartes, m).toBe(1);
    }
  });
  it("las cinco operaciones de grafo se aplican en una sola transacción", async () => {
    const antes = (await grafo()).nodos.length;
    const t = await emitir("ops_completas");
    expect(t.descartes).toBe(0);
    const g = await grafo();
    expect(g.nodos.length).toBe(antes + 1);
    expect(
      g.nodos.some((n: { titulo: string }) => n.titulo === "Ejemplo B"),
    ).toBe(false);
    const f = g.nodos.find((n: { titulo: string }) => n.titulo === "Ejemplo A");
    expect(f).toMatchObject({ resumen: "A editado", estado: "sin_explorar" });
    expect(g.foco).toBe(f.id);
    const rev = await db.query(
      `SELECT contenido FROM ${schema}.revisiones_nodo WHERE nodo_id=$1`,
      [f.id],
    );
    expect(rev.rows.map((x) => x.contenido)).toContain("A");
  });
  describe("con una comprobación activa", () => {
    let d: { sid: string; conv: string; arbol: string };
    beforeAll(async () => {
      d = await nuevoActor();
      // El primer actor nuevo recibe porcentajes-1, cuya respuesta es 96.
      await http("/comprobaciones", "POST", { arbol_id: d.arbol }, d.sid);
    });
    it("un contraste que contiene la clave se descarta", async () => {
      const t = await emitir("contraste", TEXTO, d.conv, d.sid);
      expect(t.bloques).toEqual([]);
      expect(t.descartes).toBe(1);
    });
    it("prediccion y practica no se entregan", async () => {
      for (const m of ["prediccion", "practica"])
        expect((await emitir(m, TEXTO, d.conv, d.sid)).bloques, m).toEqual([]);
    });
    it("los bloques sin la clave sí se entregan", async () => {
      for (const m of ["pregunta_socratica", "en_tus_palabras", "visual_barra"])
        expect((await emitir(m, TEXTO, d.conv, d.sid)).bloques, m).toHaveLength(
          1,
        );
    });
  });
});

describe("Revisiones de nodo: quién las hizo", () => {
  it("aclarar un nodo (el estudiante) lo marca explorado; que el agente lo edite, no", async () => {
    const sid = (await http("/sesion", "POST", {}, "")).cookie!;
    const arbol = (
      await http(
        "/arboles",
        "POST",
        { tema: "fracciones", solicitud: "Quiero entender fracciones" },
        sid,
        randomUUID(),
      )
    ).data.id as string;
    const nodos = (
      await db.query(
        `SELECT id FROM ${schema}.nodos WHERE arbol_id=$1 ORDER BY profundidad,orden`,
        [arbol],
      )
    ).rows;
    const [raiz, hijo] = [nodos[0].id, nodos[1].id];
    const estado = async (id: string) =>
      (await http("/grafo", "GET", undefined, sid)).data.nodos.find(
        (n: { id: string }) => n.id === id,
      ).estado;
    const actor = (
      await db.query(`SELECT actor_id FROM ${schema}.arboles WHERE id=$1`, [
        arbol,
      ])
    ).rows[0].actor_id as string;
    const { GrafoService } =
      await import("../src/modules/seguimiento/grafo.js");
    const { Database } = await import("../src/database/database.js");
    await app
      .get(Database)
      .transaction((m) =>
        app
          .get(GrafoService)
          .aplicar(m, actor, arbol, [
            { op: "editar_nodo", nodo: hijo, resumen: "Editado por el agente" },
          ]),
      );
    expect(await estado(hijo)).toBe("sin_explorar");
    const r = await http(
      `/arboles/${arbol}/nodos/${raiz}/aclarar`,
      "POST",
      { solicitud: "Explícalo más sencillo" },
      sid,
      randomUUID(),
    );
    expect(r.status).toBe(201);
    expect(await estado(raiz)).toBe("explorado");
    const por = await db.query(
      `SELECT nodo_id,por FROM ${schema}.revisiones_nodo WHERE nodo_id = ANY($1::uuid[]) ORDER BY por`,
      [[raiz, hijo]],
    );
    expect(por.rows.map((x) => x.por)).toEqual(["agente", "estudiante"]);
  });
});

describe("Conversación con mensaje inicial y sin contexto (S6)", () => {
  let a: string, b: string;
  const crear = (body: unknown, key?: string, sid = a) =>
    http("/conversaciones", "POST", body, sid, key);
  const filas = async (sql: string, params: unknown[] = []) =>
    (await db.query(sql.replaceAll("$S", schema), params)).rows;
  beforeAll(async () => {
    a = (await http("/sesion", "POST", {}, "")).cookie!;
    b = (await http("/sesion", "POST", {}, "")).cookie!;
  });
  it("crea la conversación y manda el primer turno en una sola llamada", async () => {
    const r = await crear(
      { mensaje_inicial: "No sé por dónde empezar" },
      randomUUID(),
    );
    expect(r.status).toBe(201);
    expect(r.data.id).toBeTruthy();
    expect(r.data.arbol_id).toBeTruthy();
    expect(r.data.estudiante).toMatchObject({
      rol: "estudiante",
      texto: "No sé por dónde empezar",
    });
    expect(r.data.tutor).toMatchObject({ rol: "tutor", degradado: false });
    const c = (await http(`/conversaciones/${r.data.id}`, "GET", undefined, a))
      .data;
    expect(c.mensajes.map((m: { rol: string }) => m.rol)).toEqual([
      "estudiante",
      "tutor",
    ]);
  });
  it("sin contexto la conversación no tiene concepto ni ideas clave", async () => {
    const r = await crear(
      { mensaje_inicial: "Quiero repasar algo" },
      randomUUID(),
    );
    const arbol = (
      await filas(`SELECT titulo,concepto FROM $S.arboles WHERE id=$1`, [
        r.data.arbol_id,
      ])
    )[0];
    expect(arbol.concepto).toBeNull();
    expect(arbol.titulo).toBe("Quiero repasar algo");
    const nodo = (await http("/grafo", "GET", undefined, a)).data.nodos.find(
      (n: { arbol_id: string }) => n.arbol_id === r.data.arbol_id,
    );
    expect(nodo).toMatchObject({ concepto: null, tipo: "concepto" });
    const seguido = await http(
      `/conversaciones/${r.data.id}/mensajes`,
      "POST",
      { texto: "[[ops]] sigo" },
      a,
      randomUUID(),
    );
    expect(seguido.status).toBe(201);
    const creado = (await http("/grafo", "GET", undefined, a)).data.nodos.find(
      (n: { titulo: string }) => n.titulo === "Cada porcentaje tiene su base",
    );
    // Sin concepto no hay catálogo: la idea clave se ignora en vez de inventarse.
    expect(creado.idea_clave).toBeNull();
  });
  it("con tema y mensaje inicial usa el concepto elegido", async () => {
    const r = await crear(
      { tema: "fracciones", mensaje_inicial: "Fracciones, por favor" },
      randomUUID(),
    );
    expect(r.status).toBe(201);
    const arbol = (
      await filas(`SELECT concepto,titulo FROM $S.arboles WHERE id=$1`, [
        r.data.arbol_id,
      ])
    )[0];
    expect(arbol.concepto).toBe("fracciones");
    // El historial muestra el mensaje, no solo el nombre del concepto.
    expect(arbol.titulo).toBe("Fracciones, por favor");
  });
  it("repetir la misma clave recupera la misma conversación y el mismo turno", async () => {
    const key = randomUUID();
    const x = await crear({ mensaje_inicial: "Hola, soy nuevo" }, key);
    const y = await crear({ mensaje_inicial: "Hola, soy nuevo" }, key);
    expect(y.status).toBe(201);
    expect(y.data.id).toBe(x.data.id);
    expect(y.data.arbol_id).toBe(x.data.arbol_id);
    expect(y.data.tutor.id).toBe(x.data.tutor.id);
    expect(
      (
        await filas(
          `SELECT count(*)::int AS n FROM $S.mensajes WHERE conversacion_id=$1`,
          [x.data.id],
        )
      )[0].n,
    ).toBe(2);
    expect(
      (
        await filas(`SELECT count(*)::int AS n FROM $S.arboles WHERE id=$1`, [
          x.data.arbol_id,
        ])
      )[0].n,
    ).toBe(1);
  });
  it("la misma clave con otro mensaje es un conflicto; otra sesión no la comparte", async () => {
    const key = randomUUID();
    await crear({ mensaje_inicial: "Primero" }, key);
    expect((await crear({ mensaje_inicial: "Segundo" }, key)).status).toBe(409);
    const ajena = await crear({ mensaje_inicial: "Primero" }, key, b);
    expect(ajena.status).toBe(201);
  });
  it("el mensaje inicial exige Idempotency-Key", async () => {
    expect((await crear({ mensaje_inicial: "Hola" })).status).toBe(400);
    expect((await crear({ mensaje_inicial: "Hola" }, "corta")).status).toBe(
      400,
    );
  });
  it("no cambian las llamadas existentes: sin contexto ni mensaje sigue siendo 400", async () => {
    expect((await crear({})).status).toBe(400);
    expect((await crear({ mensaje_inicial: "" }, randomUUID())).status).toBe(
      400,
    );
    const sola = await crear({ tema: "porcentajes" });
    expect(sola.status).toBe(201);
    expect(sola.data.tutor).toBeUndefined();
    expect(Object.keys(sola.data).sort()).toEqual([
      "arbol_id",
      "id",
      "raiz_id",
    ]);
  });
  it("el historial trae título, concepto y fecha de cada conversación", async () => {
    const lista = (await http("/conversaciones", "GET", undefined, a)).data;
    expect(lista.length).toBeGreaterThan(2);
    for (const c of lista) {
      expect(c.titulo).toBeTruthy();
      expect(c.created_at).toBeTruthy();
      expect("concepto" in c).toBe(true);
    }
    expect(
      lista.some((c: { concepto: string | null }) => c.concepto === null),
    ).toBe(true);
    expect(
      lista.some(
        (c: { concepto: string | null }) => c.concepto === "fracciones",
      ),
    ).toBe(true);
  });
});

describe("Fallos del proveedor durante un turno", () => {
  let a: string, conv: string;
  const decir = (texto: string, key = randomUUID()) =>
    http(`/conversaciones/${conv}/mensajes`, "POST", { texto }, a, key);
  beforeAll(async () => {
    a = (await http("/sesion", "POST", {}, "")).cookie!;
    conv = (await http("/conversaciones", "POST", { tema: "porcentajes" }, a))
      .data.id;
  });
  it("el límite de uso del proveedor es un 503 comprensible, no un error interno", async () => {
    const r = await decir("[[error-limite]] hola");
    expect(r.status).toBe(503);
    expect(r.data.error.mensaje).toMatch(/límite de uso/);
    expect(r.data.error.mensaje).toMatch(/puedes reintentar/);
  });
  it("una caída del proveedor también es un 503 con mensaje claro", async () => {
    const r = await decir("[[error-red]] hola");
    expect(r.status).toBe(503);
    expect(r.data.error.mensaje).toMatch(/proveedor de IA/);
  });
  it("el mensaje del estudiante queda guardado y reintentar con la misma clave retoma el turno", async () => {
    const key = randomUUID();
    const texto = "[[error-una-vez]] repasemos";
    const falla = await decir(texto, key);
    expect(falla.status).toBe(503);
    const guardado = await db.query(
      `SELECT count(*)::int AS n FROM ${schema}.mensajes WHERE conversacion_id=$1 AND texto=$2 AND rol='estudiante'`,
      [conv, texto],
    );
    expect(guardado.rows[0].n).toBe(1);
    const ok = await decir(texto, key);
    expect(ok.status).toBe(201);
    expect(ok.data.tutor.degradado).toBe(false);
    const total = await db.query(
      `SELECT count(*)::int AS n FROM ${schema}.mensajes WHERE conversacion_id=$1 AND texto=$2 AND rol='estudiante'`,
      [conv, texto],
    );
    expect(total.rows[0].n).toBe(1);
  });
});

describe("Router de modelos con el agente (Groq simulado, sin llamadas reales)", () => {
  type Llamada = {
    modelo: string;
    mensajes: Record<string, unknown>[];
    herramientas: string[];
  };
  const fetchReal = globalThis.fetch;
  let a: string;
  let llamadas: Llamada[];
  const respuestaGroq = (mensaje: Record<string, unknown>) =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: null, ...mensaje } }],
        usage: { prompt_tokens: 12, completion_tokens: 4 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  const responder = (args: unknown) =>
    respuestaGroq({
      tool_calls: [
        {
          id: "call_resp",
          type: "function",
          function: { name: "responder", arguments: JSON.stringify(args) },
        },
      ],
    });
  const turno = (mensaje: string) =>
    responder({ mensaje, bloques: [], grafo_ops: [] });
  const limite = (segundos = 30) =>
    new Response("{}", {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "retry-after": String(segundos),
      },
    });
  // Solo intercepta la API de Groq: las llamadas a la propia app siguen siendo reales.
  const simular = (guion: (l: Llamada, n: number) => Response) =>
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      if (!String(url).startsWith("https://api.groq.com/"))
        return fetchReal(url, init);
      const cuerpo = JSON.parse(init.body as string);
      llamadas.push({
        modelo: cuerpo.model,
        mensajes: cuerpo.messages,
        herramientas: (cuerpo.tools ?? []).map(
          (t: { function: { name: string } }) => t.function.name,
        ),
      });
      return guion(llamadas[llamadas.length - 1], llamadas.length);
    });
  const usarRouter = (extra: Record<string, string> = {}) => {
    Object.assign(process.env, {
      AI_PROVIDER: "router",
      AI_CADENA: "groq:modelo-a,groq:modelo-b",
      GROQ_API_KEY: "clave-de-prueba",
      AI_ENFRIAMIENTO_MS: "1000",
      ...extra,
    });
    olvidarRouters();
  };
  const nuevaConversacion = async () =>
    (await http("/conversaciones", "POST", { tema: "porcentajes" }, a)).data
      .id as string;
  const decir = (conv: string, texto: string, key = randomUUID()) =>
    http(`/conversaciones/${conv}/mensajes`, "POST", { texto }, a, key);
  const filas = async (conv: string, rol: string) =>
    (
      await db.query(
        `SELECT id,texto,degradado,destino_ia FROM ${schema}.mensajes WHERE conversacion_id=$1 AND rol=$2 ORDER BY orden`,
        [conv, rol],
      )
    ).rows;
  beforeAll(async () => {
    a = (await http("/sesion", "POST", {}, "")).cookie!;
  });
  beforeEach(() => {
    llamadas = [];
    olvidarRouters();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.AI_PROVIDER = "fake";
    for (const k of ["AI_CADENA", "GROQ_API_KEY", "AI_ENFRIAMIENTO_MS"])
      delete process.env[k];
    olvidarRouters();
  });

  it("la migración agrega mensajes.destino_ia como columna nullable", async () => {
    const r = await db.query(
      `SELECT is_nullable FROM information_schema.columns WHERE table_schema=$1 AND table_name='mensajes' AND column_name='destino_ia'`,
      [schema],
    );
    expect(r.rows).toEqual([{ is_nullable: "YES" }]);
  });

  it("el turno guarda qué destino respondió; con el proveedor de pruebas queda en null", async () => {
    usarRouter();
    simular(() => turno("Respuesta del modelo A"));
    const conv = await nuevaConversacion();
    const r = await decir(conv, "Hola, quiero repasar porcentajes");
    expect(r.status).toBe(201);
    expect(r.data.tutor.texto).toBe("Respuesta del modelo A");
    expect(llamadas.map((l) => l.modelo)).toEqual(["modelo-a"]);
    expect((await filas(conv, "tutor"))[0].destino_ia).toBe("groq:modelo-a");
    expect((await filas(conv, "estudiante"))[0].destino_ia).toBeNull();
    process.env.AI_PROVIDER = "fake";
    const conv2 = await nuevaConversacion();
    expect((await decir(conv2, "Hola")).status).toBe(201);
    expect((await filas(conv2, "tutor"))[0].destino_ia).toBeNull();
  });

  it("11. un failover a mitad del ciclo de herramientas termina el turno y el historial es aceptado", async () => {
    usarRouter();
    simular((l, n) => {
      if (n === 1)
        return respuestaGroq({
          tool_calls: [
            {
              id: "call_a1",
              type: "function",
              function: { name: "leer_grafo", arguments: "{}" },
            },
          ],
        });
      if (n === 2) return limite(); // el modelo A agota su cuota justo después de la herramienta
      return turno(`Respuesta del modelo ${l.modelo}`);
    });
    const conv = await nuevaConversacion();
    const r = await decir(conv, "Explícame los porcentajes");
    expect(r.status).toBe(201);
    expect(r.data.tutor.degradado).toBe(false);
    expect(r.data.tutor.texto).toBe("Respuesta del modelo modelo-b");
    expect(llamadas.map((l) => l.modelo)).toEqual([
      "modelo-a",
      "modelo-a",
      "modelo-b",
    ]);
    // B recibe el contexto completo, igual que lo recibió A, con la llamada y el resultado de A.
    expect(llamadas[2].mensajes).toEqual(llamadas[1].mensajes);
    const historial = llamadas[2].mensajes;
    expect(historial).toContainEqual(
      expect.objectContaining({
        role: "assistant",
        tool_calls: [
          expect.objectContaining({
            id: "call_a1",
            function: expect.objectContaining({ name: "leer_grafo" }),
          }),
        ],
      }),
    );
    expect(historial).toContainEqual(
      expect.objectContaining({ role: "tool", tool_call_id: "call_a1" }),
    );
    expect(llamadas[2].herramientas).toContain("responder");
    expect((await filas(conv, "tutor")).map((m) => m.destino_ia)).toEqual([
      "groq:modelo-b",
    ]);
    expect(await filas(conv, "estudiante")).toHaveLength(1);
  });

  it("8. una salida inválida se repara una vez y no hay bucle de llamadas", async () => {
    usarRouter();
    simular((_l, n) =>
      n === 1
        ? respuestaGroq({ content: "esto no es el JSON del turno" })
        : turno("Respuesta reparada"),
    );
    const conv = await nuevaConversacion();
    const r = await decir(conv, "Hola, ayúdame con fracciones");
    expect(r.status).toBe(201);
    expect(r.data.tutor.texto).toBe("Respuesta reparada");
    expect(r.data.tutor.degradado).toBe(false);
    expect(llamadas).toHaveLength(2);
    const ultimo = llamadas[1].mensajes.at(-1) as {
      role: string;
      content: string;
    };
    expect(ultimo.role).toBe("user");
    expect(ultimo.content).toMatch(/^ERROR_DE_FORMA/);
    // Si la reparación también falla, el turno se degrada a solo texto: sin más llamadas.
    llamadas = [];
    olvidarRouters();
    simular(() => respuestaGroq({ content: "sigo sin devolver JSON" }));
    const conv2 = await nuevaConversacion();
    const r2 = await decir(conv2, "Otro mensaje");
    expect(r2.status).toBe(201);
    expect(r2.data.tutor.degradado).toBe(true);
    expect(llamadas).toHaveLength(2);
  });

  it("10. reintentar el mismo turno con la misma clave deja un solo mensaje por rol", async () => {
    usarRouter();
    let agotados = true;
    simular(() => (agotados ? limite(1) : turno("Ahora sí respondo")));
    const conv = await nuevaConversacion();
    const texto = "Necesito ayuda con proporciones";
    const key = randomUUID();
    const falla = await decir(conv, texto, key);
    expect(falla.status).toBe(503);
    expect(falla.data.error.mensaje).toMatch(/puedes reintentar/);
    // Cada destino se probó una vez (un 429 no se reintenta en el mismo destino).
    expect(llamadas.map((l) => l.modelo)).toEqual(["modelo-a", "modelo-b"]);
    expect(await filas(conv, "estudiante")).toHaveLength(1);
    expect(await filas(conv, "tutor")).toHaveLength(0);
    // Con todos los destinos abiertos responde de inmediato, sin llamar al proveedor.
    const inmediato = await decir(conv, "Otro mensaje mientras tanto");
    expect(inmediato.status).toBe(503);
    expect(inmediato.data.error.mensaje).toMatch(/recuperar/i);
    expect(llamadas).toHaveLength(2);
    // Pasado el enfriamiento, el reintento con la misma clave retoma el turno.
    agotados = false;
    await new Promise((r) => setTimeout(r, 1150));
    const ok = await decir(conv, texto, key);
    expect(ok.status).toBe(201);
    expect(ok.data.tutor.texto).toBe("Ahora sí respondo");
    const repetido = await decir(conv, texto, key);
    expect(repetido.status).toBe(201);
    expect(repetido.data.tutor.id).toBe(ok.data.tutor.id);
    const antes = llamadas.length;
    expect(
      (await filas(conv, "estudiante")).filter((m) => m.texto === texto),
    ).toHaveLength(1);
    expect(await filas(conv, "tutor")).toHaveLength(1);
    expect(llamadas).toHaveLength(antes); // la repetición no llama al modelo
  });

  it("/salud muestra el estado del router sin claves ni datos de cuentas", async () => {
    usarRouter();
    simular(() => limite(30));
    const conv = await nuevaConversacion();
    await decir(conv, "Hola");
    const r = await fetchReal(url + "/api/v1/salud");
    const salud = await r.json();
    expect(r.status).toBe(200);
    expect(salud.ia).toBe("router");
    expect(salud.router.map((d: { id: string }) => d.id)).toEqual([
      "groq:modelo-a",
      "groq:modelo-b",
    ]);
    expect(salud.router[0]).toMatchObject({
      proveedor: "groq",
      modelo: "modelo-a",
      estado: "ABIERTO",
      motivo: "limite",
    });
    expect(Number.isNaN(Date.parse(salud.router[0].hasta))).toBe(false);
    expect(JSON.stringify(salud)).not.toContain("clave-de-prueba");
    process.env.AI_PROVIDER = "fake";
    const fake = await (await fetchReal(url + "/api/v1/salud")).json();
    expect(fake.router).toBeNull();
    expect(fake.pruebas).toBe(true);
  });
});

describe("Demo: comprobación sin tema y retorno creado por el sistema", () => {
  let a: string;
  const nueva = async (sid: string) =>
    (await http("/conversaciones", "POST", { tema: "porcentajes" }, sid))
      .data as {
      id: string;
      arbol_id: string;
    };
  const sinConcepto = async (arbol: string) =>
    db.query(`UPDATE ${schema}.arboles SET concepto=NULL WHERE id=$1`, [arbol]);
  const concepto = async (arbol: string) =>
    (
      await db.query(`SELECT concepto FROM ${schema}.arboles WHERE id=$1`, [
        arbol,
      ])
    ).rows[0].concepto;
  beforeAll(async () => {
    a = (await http("/sesion", "POST", {}, "")).cookie!;
  });
  it("sin concepto ni tema responde elige_tema, no el mensaje de actividad agotada", async () => {
    const c = await nueva(a);
    await sinConcepto(c.arbol_id);
    const r = await http(
      "/comprobaciones",
      "POST",
      { arbol_id: c.arbol_id },
      a,
    );
    expect(r.status).toBe(409);
    expect(r.data.error.codigo).toBe("elige_tema");
    expect(r.data.error.mensaje).not.toContain("No hay otra actividad");
    expect(await concepto(c.arbol_id)).toBeNull();
  });
  it("con tema fija el concepto del árbol y crea la comprobación", async () => {
    const c = await nueva(a);
    await sinConcepto(c.arbol_id);
    const r = await http(
      "/comprobaciones",
      "POST",
      { arbol_id: c.arbol_id, tema: "proporciones" },
      a,
    );
    expect(r.status).toBe(201);
    expect(r.data.enunciado).toBeTruthy();
    expect(await concepto(c.arbol_id)).toBe("proporciones");
    await http(`/comprobaciones/${r.data.id}/cancelar`, "POST", {}, a);
  });
  it("un tema fuera del catálogo se rechaza y un concepto existente no se pisa", async () => {
    const c = await nueva(a);
    const malo = await http(
      "/comprobaciones",
      "POST",
      { arbol_id: c.arbol_id, tema: "geometria" },
      a,
    );
    expect(malo.status).toBe(400);
    const r = await http(
      "/comprobaciones",
      "POST",
      { arbol_id: c.arbol_id, tema: "fracciones" },
      a,
    );
    expect(r.status).toBe(201);
    expect(await concepto(c.arbol_id)).toBe("porcentajes");
    await http(`/comprobaciones/${r.data.id}/cancelar`, "POST", {}, a);
  });
  it("fallar sin nodo de la idea clave lo crea con su error y su arista, una sola vez", async () => {
    a = (await http("/sesion", "POST", {}, "")).cookie!;
    const c = await nueva(a);
    const ini = await http(
      "/comprobaciones",
      "POST",
      { arbol_id: c.arbol_id },
      a,
    );
    expect(ini.status).toBe(201);
    const r = await http(
      `/comprobaciones/${ini.data.id}/respuesta`,
      "PUT",
      { respuesta: "100", justificacion: "" },
      a,
    );
    expect(r.status).toBe(200);
    expect(r.data.rastro.idea_clave).toBe("cambio-de-base");
    const retorno = r.data.rastro.nodo_retorno_id as string;
    expect(retorno).toBeTruthy();
    const nodos = (
      await db.query(
        `SELECT id,tipo,titulo,idea_clave,procedencia,padre_id FROM ${schema}.nodos WHERE arbol_id=$1 ORDER BY orden`,
        [c.arbol_id],
      )
    ).rows;
    const idea = nodos.filter((n) => n.tipo === "idea");
    const error = nodos.filter((n) => n.tipo === "error");
    expect(idea).toHaveLength(1);
    expect(idea[0]).toMatchObject({
      id: retorno,
      idea_clave: "cambio-de-base",
      titulo: "Cambio de base",
    });
    expect(error).toHaveLength(1);
    expect(error[0].titulo).toBe("Respondiste 100");
    const aristas = (
      await db.query(
        `SELECT origen,destino,tipo,creada_por FROM ${schema}.aristas WHERE origen=$1 OR destino=$1`,
        [error[0].id],
      )
    ).rows;
    expect(aristas).toEqual([
      {
        origen: error[0].id,
        destino: retorno,
        tipo: "confusion_con",
        creada_por: "sistema",
      },
    ]);
    const g = (await http("/grafo", "GET", undefined, a)).data;
    expect(g.camino_error).toHaveLength(2);
    expect(g.camino_error.at(-1)).toBe(retorno);
    const nodo = g.nodos.find((n: { id: string }) => n.id === retorno);
    expect(nodo).toMatchObject({ estado: "fallo", origen: "sistema" });
    // La raíz no pasa a «explorado» por los nodos que creó el sistema.
    const raiz = g.nodos.find(
      (n: { tipo: string; arbol_id: string }) =>
        n.arbol_id === c.arbol_id && n.tipo === "concepto",
    );
    expect(raiz.estado).toBe("sin_explorar");
    // Reenviar la misma respuesta devuelve el resultado guardado y no duplica nada.
    const otra = await http(
      `/comprobaciones/${ini.data.id}/respuesta`,
      "PUT",
      { respuesta: "100", justificacion: "" },
      a,
    );
    expect(otra.data.rastro.nodo_retorno_id).toBe(retorno);
    const [{ n }] = (
      await db.query(
        `SELECT count(*)::int AS n FROM ${schema}.nodos WHERE arbol_id=$1`,
        [c.arbol_id],
      )
    ).rows;
    expect(n).toBe(nodos.length);
  });
});

describe("Árbol vivo: evento de comprobación entregada", () => {
  let a: string, b: string, conv: string, arbol: string;
  const entregar = async (respuesta: string, sid = a, c = arbol) => {
    const ini = await http("/comprobaciones", "POST", { arbol_id: c }, sid);
    expect(ini.status).toBe(201);
    const r = await http(
      `/comprobaciones/${ini.data.id}/respuesta`,
      "PUT",
      { respuesta, justificacion: "Sumé y resté el mismo 20" },
      sid,
    );
    expect(r.status).toBe(200);
    return { id: ini.data.id as string, resultado: r.data };
  };
  beforeAll(async () => {
    a = (await http("/sesion", "POST", {}, "")).cookie!;
    b = (await http("/sesion", "POST", {}, "")).cookie!;
    const c = (await http("/conversaciones", "POST", { tema: "porcentajes" }, a))
      .data as { id: string; arbol_id: string };
    conv = c.id;
    arbol = c.arbol_id;
  });
  it("al entregar, el agente responde solo y el mensaje del sistema no se muestra como del estudiante", async () => {
    const c = await entregar("100");
    const key = `evento-${c.id}`;
    const r = await http(
      `/conversaciones/${conv}/eventos`,
      "POST",
      { tipo: "comprobacion_entregada", comprobacion_id: c.id },
      a,
      key,
    );
    expect(r.status).toBe(201);
    expect(r.data.estudiante.evento).toBe("comprobacion_entregada");
    expect(r.data.estudiante.texto).toBe("Entregaste una comprobación.");
    expect(r.data.tutor.rol).toBe("tutor");
    const fila = (
      await db.query(
        `SELECT texto,evento,rol FROM ${schema}.mensajes WHERE conversacion_id=$1 AND clave=$2`,
        [conv, key],
      )
    ).rows[0];
    expect(fila.rol).toBe("estudiante");
    expect(fila.evento).toBe("comprobacion_entregada");
    expect(fila.texto).toContain("EVENTO_DEL_SISTEMA");
    expect(fila.texto).toContain("cambio-de-base");
    const guardado = (await http(`/conversaciones/${conv}`, "GET", undefined, a)).data;
    const evento = guardado.mensajes.find((m: { evento: string | null }) => m.evento);
    expect(evento.texto).toBe("Entregaste una comprobación.");
    expect(JSON.stringify(guardado)).not.toContain("EVENTO_DEL_SISTEMA");
  });
  it("reintentar con la misma clave no duplica mensajes", async () => {
    const c = await entregar("96");
    const key = `evento-${c.id}`;
    const body = { tipo: "comprobacion_entregada", comprobacion_id: c.id };
    const uno = await http(`/conversaciones/${conv}/eventos`, "POST", body, a, key);
    const dos = await http(`/conversaciones/${conv}/eventos`, "POST", body, a, key);
    expect(dos.data.tutor.id).toBe(uno.data.tutor.id);
    const [{ n }] = (
      await db.query(
        `SELECT count(*)::int AS n FROM ${schema}.mensajes WHERE conversacion_id=$1 AND clave IN ($2,$3)`,
        [conv, key, "r:" + key],
      )
    ).rows;
    expect(n).toBe(2);
  });
  it("rechaza comprobaciones ajenas, no entregadas o de otra charla", async () => {
    const body = (id: string) => ({ tipo: "comprobacion_entregada", comprobacion_id: id });
    const ini = await http("/comprobaciones", "POST", { arbol_id: arbol }, a);
    const pendiente = await http(`/conversaciones/${conv}/eventos`, "POST", body(ini.data.id), a, "evento-pendiente-1");
    expect(pendiente.status).toBe(409);
    await http(`/comprobaciones/${ini.data.id}/cancelar`, "POST", {}, a);
    const cancelada = await http(`/conversaciones/${conv}/eventos`, "POST", body(ini.data.id), a, "evento-cancelada-1");
    expect(cancelada.status).toBe(409);
    const ajena = await http(`/conversaciones/${conv}/eventos`, "POST", body(ini.data.id), b, "evento-ajena-001");
    expect(ajena.status).toBe(404);
    const invalido = await http(`/conversaciones/${conv}/eventos`, "POST", { tipo: "otro", comprobacion_id: ini.data.id }, a, "evento-invalido-1");
    expect(invalido.status).toBe(400);
  });
});
