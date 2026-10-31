import { createServer } from "vite";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
// Verificación de interfaz con transporte simulado: nunca llama a Groq ni usa sus credenciales.
const root = resolve(import.meta.dirname, "..");
await mkdir(resolve(root, ".atl"), { recursive: true });
const chromePath = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => p && existsSync(p));
if (!chromePath)
  throw new Error("Configura CHROME_PATH con un navegador Chromium instalado.");
const ids = [
  "base",
  "ejemplo",
  "reducir",
  "inversa",
  "pendiente",
  "cociente",
  "tiempo",
];
const names = [
  "Proporciones: por dónde empezar",
  "Ejemplo distinto: proporción",
  "Reducir a por unidades antes",
  "¿Y si la relación no es directa?",
  "¿La relación es directa o inversa?",
  "Cociente constante vs. producto cruzado",
  "Otra magnitud: tiempo y distancia",
];
const states = [
  "explorado",
  "explorado",
  "aplicado",
  "fallo",
  "sin_explorar",
  "explorado",
  "sin_explorar",
];
const graph = {
  version: 1,
  foco: "base",
  camino_error: ["base", "inversa"],
  nodos: ids.map((id, i) => ({
    id,
    arbol_id: "arbol-a",
    tipo: "concepto",
    titulo: names[i],
    resumen:
      "Las proporciones comparan dos cantidades mediante una razón. Aparecen en problemas de escalas, porcentajes y situaciones de la vida real. Comprueba qué cantidades cambian y cómo se relacionan.",
    idea_clave: null,
    concepto: "proporciones",
    estado: states[i],
    senal: null,
    origen: "fixture de interfaz",
    evidencias: i === 2 ? 2 : i === 3 ? 1 : 0,
  })),
  aristas: ids
    .slice(1)
    .map((id, i) => ({
      id: "edge" + i,
      origen: "base",
      destino: id,
      tipo: "subtema",
      creada_por: "fixture",
    })),
};
const conversation = {
  id: "fixture",
  arbol_id: "arbol-a",
  mensajes: [
    {
      id: "m1",
      orden: 1,
      rol: "tutor",
      texto:
        "¡Hola! Soy tu tutor de CALIBRA. Veamos juntos tu ejercicio. Cuéntame qué pensaste al resolverlo y en qué parte te resultó difícil.",
      bloques: [],
      degradado: false,
      descartes: 0,
    },
    {
      id: "m2",
      orden: 2,
      rol: "estudiante",
      texto:
        "Creo que 6/8 es igual a 3/4 porque dividí ambos términos por 2, pero no estoy seguro de cómo comprobarlo.",
      bloques: [],
      degradado: false,
      descartes: 0,
    },
    {
      id: "m3",
      orden: 3,
      rol: "tutor",
      texto:
        "Tu simplificación es correcta. Ambas fracciones representan la misma cantidad; podemos mirar el procedimiento y verlo en partes.",
      bloques: [
        {
          id: "b1",
          tipo: "contraste",
          tuyo: [
            "$\\frac{6}{8}=\\frac{3}{4}$",
            "Dividí el numerador y el denominador por 2.",
          ],
          correcto: [
            "$\\frac{6}{8}=\\frac{3}{4}$",
            "El procedimiento conserva el valor de la fracción.",
          ],
        },
        {
          id: "b2",
          tipo: "visual",
          forma: "barra_de_partes",
          total: 1,
          partes: 8,
          marcadas: 6,
          fraccion: "6/8",
        },
      ],
      degradado: false,
      descartes: 0,
    },
  ],
};
const html = `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{MemoryRouter,Routes,Route,useLocation}from'react-router-dom';import{ThemeProvider}from'next-themes';import Tutor from'/src/pages/Tutor.tsx';import '/src/fuentes.css';import '/src/index.css';import '/src/arcade.css';
const graph=${JSON.stringify(graph)},conv=${JSON.stringify(conversation)};window.__requests=[];window.__failNext=false;
const originalFetch=window.fetch.bind(window);window.fetch=async(input,init={})=>{const path=new URL(typeof input==='string'?input:input.url,location.href).pathname;if(!path.includes('/api/v1'))return originalFetch(input,init);const method=init.method||'GET';const body=init.body?JSON.parse(init.body):null;window.__requests.push({path,method,body,key:init.headers?.['Idempotency-Key']});let data,status=200;
if(path.endsWith('/sesion'))data={actorId:'fixture'};else if(path.endsWith('/salud'))data={ok:true,ia:'fake',pruebas:true};else if(path.endsWith('/grafo'))data=graph;else if(path.endsWith('/comprobaciones/activa'))data=null;else if(path.endsWith('/conversaciones/fixture'))data=conv;else if(path.endsWith('/conversaciones')&&method==='POST')data={id:'fixture'};else if(path.endsWith('/conversaciones/fixture/mensajes')&&method==='POST'){if(window.__failNext){window.__failNext=false;status=503;data={error:{mensaje:'Proveedor de prueba ocupado; reintenta.'}};}else{conv.mensajes.push({id:'u'+conv.mensajes.length,rol:'estudiante',orden:conv.mensajes.length+1,texto:body.texto,bloques:[],degradado:false},{id:'t'+conv.mensajes.length,rol:'tutor',orden:conv.mensajes.length+2,texto:'Respuesta de prueba para verificar el envío y la persistencia visual.',bloques:[],degradado:false});data={ok:true};}}else if(path.endsWith('/comprobaciones'))data={id:'check'};else throw Error('Solicitud de fixture no prevista: '+method+' '+path);return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});};
const client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false},mutations:{retry:false}}});client.setQueryData(['grafo'],graph);client.setQueryData(['conversacion','fixture'],conv);client.setQueryData(['salud'],{ok:true,ia:'fake',pruebas:true});client.setQueryData(['comprobacion-activa'],null);function Destination(){return React.createElement('p',{'data-destination':true},useLocation().pathname);}
createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider,{client},React.createElement(ThemeProvider,{attribute:'class',defaultTheme:'light'},React.createElement(MemoryRouter,{initialEntries:['/tutor/fixture']},React.createElement(Routes,null,React.createElement(Route,{path:'/tutor/:id',element:React.createElement(Tutor)}),React.createElement(Route,{path:'/aprender/:id',element:React.createElement(Destination)}))))));
</script></body></html>`;
process.chdir(resolve(root, "frontend"));
const server = await createServer({
  root: resolve(root, "frontend"),
  cacheDir: resolve(root, ".atl/tutor-vite-cache"),
  define: { "import.meta.env.VITE_API_URL": JSON.stringify("/api/v1") },
  server: { host: "127.0.0.1", port: 0, open: false },
  plugins: [
    {
      name: "tutor-design-fixture",
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (req.url?.split("?")[0] !== "/__design.html") return next();
          try {
            res.setHeader("Content-Type", "text/html");
            res.end(await s.transformIndexHtml("/__design.html", html));
          } catch (e) {
            next(e);
          }
        });
      },
    },
  ],
});
await server.listen();
const port = server.httpServer.address().port;
const profile = await mkdtemp(join(tmpdir(), "calibra-design-"));
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
let ws;
try {
  let cdp;
  for (let i = 0; i < 80; i++) {
    try {
      cdp = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split(
        "\n",
      )[0];
      break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert(cdp, "Chrome no inició");
  const tabs = await (await fetch(`http://127.0.0.1:${cdp}/json/list`)).json();
  ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let sequence = 0;
  const pending = new Map(),
    exceptions = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      clearTimeout(p.timer);
      m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result);
    } else if (m.method === "Runtime.exceptionThrown")
      exceptions.push(
        m.params.exceptionDetails.exception?.description ??
          m.params.exceptionDetails.text,
      );
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++sequence,
        timer = setTimeout(() => {
          pending.delete(id);
          reject(Error("CDP timeout: " + method));
        }, 20000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evalJS = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails)
      throw Error(
        r.exceptionDetails.exception?.description ?? r.exceptionDetails.text,
      );
    return r.result.value;
  };
  async function until(expression) {
    for (let i = 0; i < 150; i++) {
      if (await evalJS(expression)) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error(
      "No se cumplió condición: " +
        expression +
        "\n" +
        (await evalJS("document.body.innerText.slice(0,800)")) +
        "\n" +
        exceptions.join("\n"),
    );
  }
  async function click(selector) {
    const box = await evalJS(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('No existe '+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`,
    );
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      button: "left",
      clickCount: 1,
      ...box,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      button: "left",
      clickCount: 1,
      ...box,
    });
  }
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1672,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", {
    url: `http://127.0.0.1:${port}/__design.html`,
  });
  await until(`Boolean(document.querySelector('.tutor-node-detail'))`);
  await evalJS("document.fonts.ready");
  await until(`[...document.images].every(i=>i.complete&&i.naturalWidth>0)`);
  const results = [];
  for (const width of [1672, 1440, 1200, 1199, 900, 899, 600, 599, 390, 360]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: width < 600 ? 844 : 1000,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    await new Promise((r) => setTimeout(r, 100));
    const dims = await evalJS(
      `({width:innerWidth,scroll:document.documentElement.scrollWidth,chat:!!document.querySelector('#chat-title'),map:!!document.querySelector('#mapa-title'),search:!!document.querySelector('[type=search]')})`,
    );
    assert(
      dims.scroll <= dims.width,
      "Desborde a " + width + ": " + JSON.stringify(dims),
    );
    results.push(dims);
    if ([1672, 390].includes(width)) {
      await evalJS("window.scrollTo(0,0)");
      const metrics = await send("Page.getLayoutMetrics");
      const shot = await send("Page.captureScreenshot", {
        format: "png",
        clip: {
          x: 0,
          y: 0,
          width,
          height: Math.ceil(metrics.cssContentSize.height),
          scale: 1,
        },
        captureBeyondViewport: true,
      });
      await writeFile(
        resolve(root, `.atl/tutor-${width}.png`),
        Buffer.from(shot.data, "base64"),
      );
    }
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1672,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await click(".tutor-detail-tabs button:nth-child(2)");
  assert.equal(
    await evalJS(
      `document.querySelector('[role=tab][aria-selected=true]').textContent`,
    ),
    "Evidencia",
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowRight",
    code: "ArrowRight",
  });
  assert.equal(
    await evalJS(
      `document.querySelector('[role=tab][aria-selected=true]').textContent`,
    ),
    "Ejercicios",
  );
  await click(".tutor-map-tools button");
  await until(`Boolean(document.querySelector('.tutor-map-list'))`);
  await click(".tutor-header-search input");
  await send("Input.insertText", { text: "cociente" });
  await until(`document.querySelectorAll('.tutor-map-list-node').length===1`);
  await click(".tutor-map-list-node");
  assert(
    (
      await evalJS(
        `document.querySelector('.tutor-node-detail h3').textContent`,
      )
    ).includes("Cociente"),
  );
  await click("#tutor-message");
  await send("Input.insertText", { text: "¿Por qué cambia la base?" });
  await click(".tutor-composer button[type=submit]");
  await until(
    `window.__requests.some(r=>r.body?.texto==='¿Por qué cambia la base?')`,
  );
  await until(`document.querySelector('#tutor-message').value===''`);
  assert(
    (await evalJS(
      `window.__requests.find(r=>r.body?.texto==='¿Por qué cambia la base?').key.length`,
    )) >= 8,
  );
  await evalJS("window.__failNext=true");
  await click("#tutor-message");
  await send("Input.insertText", { text: "Necesito otro ejemplo" });
  await click(".tutor-composer button[type=submit]");
  await until(
    `document.querySelector('[role=alert]')?.textContent.includes('Proveedor de prueba ocupado')`,
  );
  assert.equal(
    await evalJS(`document.querySelector('#tutor-message').value`),
    "Necesito otro ejemplo",
  );
  await click('[aria-label="Tema"] button:nth-child(2)');
  await until(`document.documentElement.classList.contains('dark')`);
  assert(
    (
      await evalJS(
        `getComputedStyle(document.querySelector('.tutor-layout')).getPropertyValue('--background')`,
      )
    ).includes("300"),
  );
  await click('[aria-label="Tema"] button:first-child');
  assert.equal(exceptions.length, 0, exceptions.join("\n"));
  console.log(
    JSON.stringify(
      {
        viewports: results,
        interacciones: [
          "pestañas",
          "teclado",
          "mapa/lista",
          "búsqueda",
          "selección",
          "envío con idempotencia",
          "error conserva borrador",
          "tema oscuro",
        ],
        screenshots: [".atl/tutor-1672.png", ".atl/tutor-390.png"],
        excepciones: exceptions,
        transporte: "fixture aislado, sin IA de pago",
      },
      null,
      2,
    ),
  );
} finally {
  ws?.close();
  chrome.kill();
  await server.close();
  await new Promise((r) => setTimeout(r, 300));
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
