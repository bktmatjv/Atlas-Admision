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
  aristas: ids.slice(1).map((id, i) => ({
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
const lista=[{id:'fixture',titulo:'Variaciones sucesivas',concepto:'porcentajes',created_at:new Date().toISOString()},{id:'otra',titulo:'Regla de tres',concepto:'proporciones',created_at:new Date(Date.now()-86400000).toISOString()}];
const originalFetch=window.fetch.bind(window);window.fetch=async(input,init={})=>{const path=new URL(typeof input==='string'?input:input.url,location.href).pathname;if(!path.includes('/api/v1'))return originalFetch(input,init);const method=init.method||'GET';const body=init.body?JSON.parse(init.body):null;window.__requests.push({path,method,body,key:init.headers?.['Idempotency-Key']});let data,status=200;
const responder=(t)=>({id:'t'+conv.mensajes.length,rol:'tutor',orden:conv.mensajes.length+2,texto:t,bloques:[],degradado:false});
if(path.endsWith('/sesion'))data={actorId:'fixture'};else if(path.endsWith('/salud'))data={ok:true,ia:'fake',pruebas:true};else if(path.endsWith('/grafo'))data=graph;else if(path.endsWith('/comprobaciones/activa'))data=null;else if(path.endsWith('/intentos')||path.endsWith('/cursos'))data=[];else if(path.endsWith('/conversaciones/fixture'))data=conv;else if(path.endsWith('/conversaciones')&&method==='GET')data=lista;else if(path.endsWith('/conversaciones')&&method==='POST'){conv.mensajes.push({id:'u'+conv.mensajes.length,rol:'estudiante',orden:conv.mensajes.length+1,texto:body.mensaje_inicial,bloques:[],degradado:false},responder('Respuesta de prueba al primer mensaje.'));data={id:'fixture',arbol_id:'arbol-a',raiz_id:'base'};}else if(path.endsWith('/conversaciones/fixture/mensajes')&&method==='POST'){if(window.__failNext){window.__failNext=false;status=503;data={error:{mensaje:'Proveedor de prueba ocupado; reintenta.'}};}else{conv.mensajes.push({id:'u'+conv.mensajes.length,rol:'estudiante',orden:conv.mensajes.length+1,texto:body.texto,bloques:[],degradado:false},responder('Respuesta de prueba para verificar el envío y la persistencia visual.'));data={ok:true};}}else if(path.endsWith('/comprobaciones'))data={id:'check'};else throw Error('Solicitud de fixture no prevista: '+method+' '+path);return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});};
const client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false},mutations:{retry:false}}});client.setQueryData(['grafo'],graph);client.setQueryData(['salud'],{ok:true,ia:'fake',pruebas:true});client.setQueryData(['comprobacion-activa'],null);function Destination(){return React.createElement('p',{'data-destination':true},useLocation().pathname);}
createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider,{client},React.createElement(ThemeProvider,{attribute:'class',defaultTheme:'light'},React.createElement(MemoryRouter,{initialEntries:['/tutor']},React.createElement(Routes,null,React.createElement(Route,{path:'/tutor',element:React.createElement(Tutor)}),React.createElement(Route,{path:'/tutor/:id',element:React.createElement(Tutor)}),React.createElement(Route,{path:'/aprender/:id',element:React.createElement(Destination)}))))));
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
  await until(`Boolean(document.querySelector('.tc-home'))`);
  await evalJS("document.fonts.ready");
  const ANCHOS = [1672, 1440, 1200, 1199, 900, 899, 600, 599, 390, 360];
  const metricas = (ancho) =>
    send("Emulation.setDeviceMetricsOverride", {
      width: ancho,
      height: ancho < 600 ? 844 : 1000,
      deviceScaleFactor: 1,
      mobile: ancho < 600,
    });
  const capturar = async (nombre, ancho) => {
    await evalJS("window.scrollTo(0,0)");
    const m = await send("Page.getLayoutMetrics");
    const shot = await send("Page.captureScreenshot", {
      format: "png",
      clip: {
        x: 0,
        y: 0,
        width: ancho,
        height: Math.ceil(m.cssContentSize.height),
        scale: 1,
      },
      captureBeyondViewport: true,
    });
    await writeFile(
      resolve(root, `.atl/${nombre}-${ancho}.png`),
      Buffer.from(shot.data, "base64"),
    );
  };
  const revisarAncho = async (pantalla, selector) => {
    const resultados = [];
    for (const ancho of ANCHOS) {
      await metricas(ancho);
      await new Promise((r) => setTimeout(r, 100));
      const d = await evalJS(
        `({width:innerWidth,scroll:document.documentElement.scrollWidth,pantalla:!!document.querySelector(${JSON.stringify(selector)}),chicos:[...document.querySelectorAll('.tc-page button:not(:disabled), .tc-page a, .tc-page select')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<43.5&&!e.closest('[hidden]')}).map(e=>(e.innerText||e.getAttribute('aria-label')||e.tagName).trim().slice(0,30))})`,
      );
      assert(d.pantalla, `${pantalla}: no se dibujó a ${ancho}px`);
      assert(
        d.scroll <= d.width,
        `Desborde horizontal en ${pantalla} a ${ancho}px: ${JSON.stringify(d)}`,
      );
      assert.deepEqual(
        d.chicos,
        [],
        `Objetivos táctiles menores de 44px en ${pantalla} a ${ancho}px`,
      );
      resultados.push({ ancho, scroll: d.scroll });
      if ([1672, 390].includes(ancho)) await capturar(pantalla, ancho);
    }
    return resultados;
  };
  const tecla = (key, modifiers = 0) =>
    send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code: key,
      modifiers,
      ...(key === "Enter" ? { windowsVirtualKeyCode: 13, text: "\r" } : {}),
    });
  const hacerClicEnTexto = async (texto, raiz = "document") => {
    const sel = await evalJS(
      `(()=>{const b=[...${raiz}.querySelectorAll('button,a')].find(x=>x.innerText.trim().toLowerCase().includes(${JSON.stringify(texto.toLowerCase())}));if(!b)throw Error('No hay botón con el texto: '+${JSON.stringify(texto)});b.setAttribute('data-uitest','1');return '[data-uitest]'})()`,
    );
    await click(sel);
    await evalJS(
      `document.querySelector('[data-uitest]')?.removeAttribute('data-uitest')`,
    );
  };

  // ---------- Pantalla inicial (S1, S7) ----------
  const inicio = await revisarAncho("inicio", ".tc-home");
  await metricas(1440);
  const textoInicio = await evalJS(
    "document.querySelector('.tc-home').innerText",
  );
  for (const t of [
    "aprender",
    "Resolver una duda",
    "Analizar un ejercicio",
    "Practicar por tema",
    "Explorar mi grafo",
    "Temas recomendados para ti",
  ])
    assert(textoInicio.includes(t), "Falta en la pantalla inicial: " + t);
  for (const falso of ["Ecuaciones", "Progresiones"])
    assert(
      !textoInicio.includes(falso),
      "Tema sin soporte en la pantalla inicial: " + falso,
    );
  assert.equal(await evalJS(`document.querySelectorAll('.tc-card').length`), 4);
  assert.equal(
    await evalJS(`document.querySelectorAll('.tc-temas .tc-chip').length`),
    3,
  );
  await hacerClicEnTexto("Resolver una duda");
  assert(
    (
      await evalJS(`document.querySelector('#tc-inicio-mensaje').value`)
    ).startsWith("Tengo una duda sobre"),
  );
  await hacerClicEnTexto("Porcentajes", "document.querySelector('.tc-temas')");
  assert.equal(
    await evalJS(
      `document.querySelector('.tc-temas .tc-chip[aria-pressed=true]').innerText.includes('Porcentajes')`,
    ),
    true,
  );
  await click("#tc-inicio-mensaje");
  await send("Input.insertText", { text: "porcentajes sucesivos" });
  // Shift+Enter hace salto de línea y no envía; Enter envía y crea la conversación en una llamada.
  await tecla("Enter", 8);
  assert.equal(
    await evalJS(
      `window.__requests.some(r=>r.method==='POST'&&r.path.endsWith('/conversaciones'))`,
    ),
    false,
    "Shift+Enter no debe enviar",
  );
  await tecla("Enter");
  await until(
    `window.__requests.some(r=>r.method==='POST'&&r.path.endsWith('/conversaciones'))`,
  );
  const creacion = await evalJS(
    `window.__requests.find(r=>r.method==='POST'&&r.path.endsWith('/conversaciones'))`,
  );
  assert(creacion.key?.length >= 8, "La creación debe llevar Idempotency-Key");
  assert.equal(creacion.body.tema, "porcentajes");
  assert(creacion.body.mensaje_inicial.startsWith("Tengo una duda sobre"));
  await until(`Boolean(document.querySelector('.tc-chat'))`);

  // ---------- Conversación (S3, S4, S5) ----------
  await until(`document.querySelectorAll('.tb').length>=2`);
  const conversacion = await revisarAncho("conversacion", ".tc-chat");
  await metricas(1440);
  const log = await evalJS("document.querySelector('.tc-log').innerText");
  assert(
    log.includes("Respuesta de prueba al primer mensaje"),
    "El primer turno debe verse",
  );
  for (const t of ["Lo que hiciste", "Lo correcto", "Aquí se separan"])
    assert(
      log.toLowerCase().includes(t.toLowerCase()),
      "Falta en el contraste: " + t,
    );
  const acciones = await evalJS(
    `[...document.querySelectorAll('.tc-actions .tc-chip')].map(b=>b.innerText.trim())`,
  );
  assert.deepEqual(acciones, [
    "Analizar error",
    "Explicar concepto",
    "Dame una comprobación",
  ]);
  // Enter envía y vacía el campo; la clave de idempotencia viaja.
  await click("#tc-mensaje");
  await send("Input.insertText", { text: "¿Por qué cambia la base?" });
  await tecla("Enter");
  await until(
    `window.__requests.some(r=>r.body?.texto==='¿Por qué cambia la base?')`,
  );
  await until(`document.querySelector('#tc-mensaje').value===''`);
  assert(
    (await evalJS(
      `window.__requests.find(r=>r.body?.texto==='¿Por qué cambia la base?').key.length`,
    )) >= 8,
  );
  await until(
    `document.querySelector('.tc-log').innerText.includes('verificar el envío')`,
  );
  // Un error del proveedor se explica, conserva el borrador y permite reintentar.
  await evalJS("window.__failNext=true");
  await click("#tc-mensaje");
  await send("Input.insertText", { text: "Necesito otro ejemplo" });
  await tecla("Enter");
  await until(
    `document.querySelector('.tc-banner--error')?.textContent.includes('Proveedor de prueba ocupado')`,
  );
  assert.equal(
    await evalJS(`document.querySelector('#tc-mensaje').value`),
    "Necesito otro ejemplo",
  );
  const claveFallida = await evalJS(
    `window.__requests.filter(r=>r.body?.texto==='Necesito otro ejemplo').at(-1).key`,
  );
  await hacerClicEnTexto(
    "Reintentar",
    "document.querySelector('.tc-banner--error')",
  );
  await until(`document.querySelector('#tc-mensaje').value===''`);
  assert.equal(
    await evalJS(
      `window.__requests.filter(r=>r.body?.texto==='Necesito otro ejemplo').at(-1).key`,
    ),
    claveFallida,
    "El reintento debe usar la misma clave",
  );
  // Mapa plegable y foco del tutor.
  assert.equal(
    await evalJS(`Boolean(document.querySelector('.tc-map'))`),
    true,
  );
  await hacerClicEnTexto("Ocultar mapa");
  assert.equal(
    await evalJS(`Boolean(document.querySelector('.tc-map'))`),
    false,
  );
  await hacerClicEnTexto("Ver mapa");
  await until(`Boolean(document.querySelector('.tc-map .tutor-node-detail'))`);
  assert(
    (await evalJS(`document.querySelector('.tc-map').innerText`)).includes(
      "En foco del tutor",
    ),
  );
  // Historial como hoja (S2).
  await hacerClicEnTexto("Historial");
  await until(`Boolean(document.querySelector('[role=dialog] .tc-hist'))`);
  const hist = await evalJS(
    `document.querySelector('[role=dialog] .tc-hist').innerText`,
  );
  for (const t of ["Hoy", "Ayer", "Variaciones sucesivas", "Regla de tres"])
    assert(
      hist.toLowerCase().includes(t.toLowerCase()),
      "Falta en el historial: " + t,
    );
  await tecla("Escape");
  await until(`!document.querySelector('[role=dialog]')`);
  // Apariencia propia del tutor: noche por defecto, variante clara a pedido.
  const fondoNoche = await evalJS(
    `getComputedStyle(document.querySelector('.tutor-layout')).getPropertyValue('--background')`,
  );
  await hacerClicEnTexto("Claro");
  await until(`Boolean(document.querySelector('.tc-claro'))`);
  const fondoClaro = await evalJS(
    `getComputedStyle(document.querySelector('.tutor-layout')).getPropertyValue('--background')`,
  );
  assert.notEqual(
    fondoNoche.trim(),
    fondoClaro.trim(),
    "La variante clara debe cambiar la paleta",
  );
  await hacerClicEnTexto("Noche");
  await until(`!document.querySelector('.tc-claro')`);
  assert.equal(exceptions.length, 0, exceptions.join("\n"));
  console.log(
    JSON.stringify(
      {
        viewports: { inicio, conversacion },
        interacciones: [
          "tarjetas y temas soportados",
          "Shift+Enter no envía; Enter crea la conversación con idempotencia",
          "bloques: contraste y visual",
          "Enter envía en la charla",
          "error del proveedor: conserva borrador y reintenta con la misma clave",
          "mapa plegable y foco del tutor",
          "historial en hoja",
          "modo noche/claro del tutor",
        ],
        screenshots: [
          ".atl/inicio-1672.png",
          ".atl/inicio-390.png",
          ".atl/conversacion-1672.png",
          ".atl/conversacion-390.png",
        ],
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
