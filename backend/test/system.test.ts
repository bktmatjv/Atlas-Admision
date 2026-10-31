import "reflect-metadata";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
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
  const headers: Record<string, string> = { "X-Atlas-Request": "1" };
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
describe("Atlas integrado con PostgreSQL real", () => {
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
      "X-Atlas-Request": "1",
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
        "Access-Control-Request-Headers": "X-Atlas-Request",
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
    expect(fila.prompt_version).toBe("tutor-v2");
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
    const ms = await mensajes();
    expect(ms.map((m) => m.rol)).toEqual(["estudiante", "tutor"]);
  });
  it("el turno es idempotente por Idempotency-Key", async () => {
    const key = randomUUID();
    const antes = (await mensajes()).length;
    const x = await decir("Mensaje con clave", key);
    const y = await decir("Mensaje con clave", key);
    expect(y.data.tutor.id).toBe(x.data.tutor.id);
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
