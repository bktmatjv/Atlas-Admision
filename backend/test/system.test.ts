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
