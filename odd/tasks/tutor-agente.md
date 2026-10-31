# Tutor agente: sistema + consciencia

Objetivo: convertir el tutor en un agente conversacional con harness propio (herramientas, artefactos validados y grafo de comprensión estilo Obsidian), según `diseno_tutor_agente.md`.
Rama: `feat/tutor-agente`, cortada desde `feat/tutor-harness-comprension` (aún sin subir). Entrega: commits por tarea, **sin `Co-Authored-By` ni ninguna atribución**; sin push. Runner: Vitest (`npm test`, `npm run test:docker`), cierre con `npm run verify`.

## Specs

Referencia: `diseno_tutor_agente.md`. Si discrepan, prevalece este documento. Decisión **D1** resuelta (ver `## Log`): las plantillas también sirven como comprobación con evidencia (S13).

- **S1 — Plantillas paramétricas.** Módulo puro en `backend/src/modules/seguimiento/plantillas.ts` con las 6 plantillas del diseño §4.2. Cada una, con una semilla, devuelve `{ plantilla, concepto, parametros, enunciado_base, respuesta, distractores: [{ valor, idea_clave }] }`. Mismo resultado para la misma semilla. Descarta parámetros donde un distractor coincide con la respuesta o con otro distractor. Toda `idea_clave` existe en el catálogo del concepto.
- **S2 — Normalización y evaluador.** Normalizador de respuestas numéricas según §4.4 (coma/punto, `%`, unidades `S/`, `cm`, `ml`, `litros`, fracción `a/b`; valor no interpretable → `{ legible: false }`, no es fallo). Evaluador de igualdades aritméticas simples (`+ - × * / ÷`, paréntesis, porcentajes `20%`), sin `eval` ni `Function`. La comprobación curada existente usa el normalizador (su comportamiento para respuestas ya válidas no cambia).
- **S3 — Validadores de artefactos.** Esquemas zod para `mensaje`, los 10 tipos de bloque (§3.2), las 4 formas de `visual` (§3.3) y las 5 operaciones de grafo (§3.1). Funciones de validación con las 5 capas del diseño §5: forma, referencias, matemática (vía S2), atribución (texto literal del estudiante) y filtración (rechazo si contiene la respuesta de una comprobación activa). Devuelven los bloques y operaciones aceptados y la lista de descartes con su motivo.
- **S4 — Modelo de datos.** Migración aditiva `Agente1770000003000`: tablas `conversaciones`, `mensajes`, `aristas`, `respuestas_bloque`; columnas `nodos.senal` (nullable) y ampliación de los tipos de nodo admitidos (`concepto`, `idea`, `error`, `ejemplo`, `pregunta`, además de los existentes). FKs con `ON DELETE CASCADE` coherentes con el esquema actual. Sin tocar datos existentes.
- **S5 — Grafo de comprensión.** `GET /grafo` devuelve el JSON del diseño §3.1 con todos los nodos del actor (de todos sus árboles), aristas padre-hijo derivadas más las de `aristas`, `estado` **calculado** desde evidencias, rastros e interacciones, `senal`, `foco` y `camino_error`. El estado nunca se lee de algo escrito por el LLM. Otra sesión no ve nada ajeno.
- **S6 — Operaciones de grafo.** Servicio que aplica las operaciones validadas en una transacción: `crear_nodo`, `relacionar`, `editar_nodo` (con revisión), `fusionar` y `enfocar`. Aristas `confusion_con` desde un nodo `error` creadas por el sistema al registrar un rastro con idea clave.
- **S0 — Proveedor Groq e independencia del proveedor.** Interfaz propia de proveedor en `backend/src/modules/tutor/` (por ejemplo `ProveedorIA`) con una operación del estilo «dado este sistema, estos mensajes y estas herramientas, devolvé texto o llamadas a herramientas». Adaptadores:
  - `groq`: API compatible con OpenAI (`https://api.groq.com/openai/v1/chat/completions`), con `fetch` nativo y **sin agregar el SDK de OpenAI** como dependencia. Herramientas en formato `tools`/`tool_calls` de OpenAI.
  - `anthropic`: el actual, adaptado a la misma interfaz.
  - `fake`: guion determinista para pruebas.
  - `AI_PROVIDER` acepta `disabled | groq | anthropic | fake`; `groq` exige `AI_API_KEY` y `AI_MODEL` (validación al arrancar, como hoy con Anthropic). Ningún nombre de modelo fijo en el código.
  - Las operaciones actuales de `TutorAI` (explicar nodos, organizar documentos, proponer actividades) pasan a usar la misma interfaz, así que **toda la app funciona con Groq**, no solo el agente. Su comportamiento con `fake` y `disabled` no cambia.
  - Timeout por llamada, sin reintentos automáticos del SDK; errores del proveedor (incluido HTTP 429 por límite de uso) se traducen a un error explícito y comprensible, nunca a una respuesta inventada.
  - Las pruebas automáticas nunca llaman a Groq real; el adaptador se prueba con un `fetch` simulado (respuesta válida, `tool_calls`, JSON inválido, 429 y timeout).
  - `backend/.env.example` documenta `AI_PROVIDER=groq` y deja `AI_API_KEY` vacío.
- **S7 — Ciclo agente.** `POST /conversaciones` (crea, opcionalmente desde intento, tema o fragmento) y `POST /conversaciones/:id/mensajes` con `Idempotency-Key`. Ciclo propio e independiente del proveedor (S0), con las herramientas del diseño §2; la respuesta final del turno se pide como salida estructurada y se valida con S3. Máximo 4 llamadas a herramientas por turno, timeout total por turno, presupuesto de turnos por sesión. Ninguna llamada a la IA dentro de una transacción. Reparación una sola vez si el turno no pasa la forma; si vuelve a fallar, turno degradado con solo texto. Con comprobación activa: sin herramientas `leer_intento` ni `generar_practica`, y capa de filtración activa. El proveedor `fake` ejecuta un guion determinista que usa al menos una herramienta, para poder probar el ciclo.
- **S8 — Contexto del agente.** El agente recibe en cada turno: resumen del grafo, último rastro (respuesta, idea clave, nivel de ayuda), justificación de la última comprobación, últimas evidencias y los últimos N mensajes. Nunca la clave de una comprobación activa. Prompt versionado `tutor-agente-v1` con el comportamiento del diseño §1 (preguntar antes de resolver, no regalar respuestas, distinguir «me parece» de lo verificado).
- **S9 — Respuestas a bloques.** `POST /bloques/:id/respuesta`. `practica`, `prediccion` y pasos de plantilla: corrección determinista con S1/S2; si es incorrecta y el distractor tiene idea clave, se devuelve esa idea y se crea una `senal` (no un rastro ni evidencia). Texto libre: lectura provisional del diseño §4.3, aceptada solo si la cita aparece literalmente en lo escrito; si no, se guarda sin lectura. Ninguna respuesta a bloques crea evidencia.
- **S10 — Interfaz.** Nueva vista en `frontend/src/pages/Aprender.tsx` (o componentes nuevos en `frontend/src/components/tutor/`):
  - Chat con el agente y renderizado de los 10 bloques, cada uno con su input.
  - Grafo con `react-force-graph-2d`: color por `estado`, tamaño por evidencias, `camino_error` resaltado, borde punteado con `senal`, clic para enfocar y ver el resumen.
  - Las lecturas provisionales se muestran como «Me parece que…».
  - En móvil, el grafo pasa a lista jerárquica con estados en texto.
  - Accesible por teclado; no depender solo del color para el estado.
- **S11 — Pruebas.** Unitarias para S1, S2 y S3 (incluidos visuales con cuentas falsas, contrastes que no cierran, atribuciones inventadas y filtración de la clave). De integración con PostgreSQL real y proveedor `fake`: ciclo con herramienta, idempotencia del turno, turno degradado, bloqueo con comprobación activa, aislamiento entre sesiones del grafo y de las conversaciones, estado que no cambia por practicar en la charla, y señal sin evidencia tras una lectura provisional.
- **S13 — Comprobaciones desde plantillas.** `POST /comprobaciones` sigue eligiendo primero una actividad curada no expuesta al actor. Si no queda ninguna, genera una instancia de plantilla del mismo concepto:
  - El enunciado de comprobación es **texto fijo del sistema** por plantilla (sin IA), para que la evidencia no dependa de una redacción generada.
  - La instancia no puede repetir una combinación `(plantilla, parámetros)` ya expuesta al actor, ni en comprobaciones ni en prácticas de la charla.
  - La corrección usa S2; si la respuesta coincide con un distractor, el rastro de error toma su `idea_clave` (mismo flujo que el mapa de errores curado).
  - La evidencia y el rastro guardan `origen: "plantilla"` o `"curada"`, con `plantilla` y `parametros` cuando aplica.
  - El bloqueo de ayudas, la idempotencia y la regla «una corrección por fallo» siguen igual.
  - La interfaz indica «Problema generado y verificado por Atlas» en las comprobaciones de plantilla.
- **S12 — Documentación.** `backend/README.md` (contratos nuevos), `PLAN_IMPLEMENTACION_ATLAS.md` §16 (estado real) y cabecera de `diseno_tutor_agente.md` (qué se implementó). No describir como implementado lo que no lo esté.

### Fuera de alcance

Streaming, imágenes generadas, plantillas fuera de los 3 conceptos, práctica verificada en «Mis cursos», calificación automática de justificaciones como nota, despliegue, push o PR.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T0 | S0 + pruebas del adaptador | inline | hecha | `0ea929d` |
| T1 | S1, S2 + pruebas unitarias | inline | hecha | `8d07936` |
| T2 | S3 + pruebas unitarias | inline | hecha | `c0402fe` |
| T3 | S4, S5, S6 + integración | inline | hecha | `04a1260` |
| T4 | S7, S8 + integración | inline | hecha | `60f1cb0` |
| T5 | S9, S13 + integración | inline | hecha | `9f74b69` |
| T6 | S10 | inline | hecha | `8564116` |
| T7 | S12 | inline | hecha | este commit (`docs: documentar el tutor agente`) |

Commits previstos (Conventional Commits en español):
0. `feat(tutor): proveedor Groq detrás de una interfaz independiente del proveedor`
1. `feat(seguimiento): plantillas paramétricas y evaluador aritmético`
2. `feat(tutor): validadores de artefactos del agente`
3. `feat(tutor): grafo de comprensión con estados derivados de la evidencia`
4. `feat(tutor): ciclo agente con herramientas del sistema`
5. `feat(tutor): respuestas a bloques y comprobaciones desde plantillas`
6. `feat(frontend): chat del tutor agente y grafo de comprensión`
7. `docs: documentar el tutor agente`

Riesgo previsto: **item 5** (nueva dependencia `react-force-graph-2d` en el frontend) e **item 3** acotado (`AI_PROVIDER` acepta un valor nuevo; los valores existentes conservan su comportamiento). La migración es aditiva.

## Matriz de pruebas por artefacto

Validador: `backend/test/artefactos-matriz.test.ts` (caso válido aceptado y casos inválidos descartados con su motivo; más `artefactos.test.ts`). Integración: bloque `Matriz de artefactos…` de `backend/test/system.test.ts` (PostgreSQL real y proveedor `fake`, que emite cada artefacto con el marcador `[[b:…]]`). Render: `frontend/src/components/tutor/bloques.test.ts` (`renderToStaticMarkup`) y lógica de inputs en `frontend/src/lib/tutor/chat.test.ts`.

| Artefacto | Validador (casos inválidos y motivo) | Integración | Render |
| --- | --- | --- | --- |
| `pregunta_socratica` | más de 4 respuestas rápidas y sin texto: forma | se persiste y se devuelve; respuesta con lectura provisional de cita literal, sin evidencia ni cambio de estados | texto, respuestas rápidas y campo |
| `contraste` | cuenta que no cierra; atribución inventada; clave activa filtrada | se persiste; atribución inventada y clave activa se descartan; sin input (400) | dos columnas «Lo que hiciste» y «Lo correcto» |
| `razonamiento_anotado` | cita que el estudiante no escribió; estado desconocido; sin pasos | se persiste; atribución inventada se descarta; sin input (400) | estado en palabras y cita literal |
| `prediccion` | plantilla de otro concepto, inexistente o semilla negativa | se persiste con enunciado y opciones sin revelar la correcta; corrección determinista (acierta y falla) sin evidencia; retirada con comprobación activa | opciones con coma decimal, sin marcar la correcta |
| `ejemplo_paso_a_paso` | cuenta falsa en un paso; más de 8 pasos | se persiste; intento como lectura provisional sin evidencia | primer paso visible, intento opcional |
| `visual` / `cadena_porcentual` | cuenta falsa; paso sin operación porcentual | se persiste con su forma | valores y operaciones |
| `visual` / `barra_de_partes` | más marcadas que partes; fracción incoherente | se persiste con su forma | partes marcadas y texto accesible |
| `visual` / `tabla_proporcion` | productos o cocientes no constantes | se persiste con su forma | columnas, filas y relación |
| `visual` / `recta_numerica` | punto fuera del rango; mínimo mayor que el máximo | se persiste con su forma | SVG con descripción accesible |
| `practica` | plantilla de otro concepto; historia demasiado larga | se persiste; corrección determinista sin evidencia; retirada con comprobación activa | opciones, historia y rótulo «verificada por Atlas» |
| `en_tus_palabras` | consigna vacía; clave activa filtrada | se persiste; lectura provisional con cita literal sin evidencia | consigna y campo |
| `invitacion_comprobar` | sin texto; campo no admitido | se persiste; `POST /comprobaciones` crea una comprobación real y `/activa` la devuelve | botón o enlace según haya comprobación activa |
| `cita` | fragmento ajeno; id que no es uuid | acepta un fragmento propio y descarta el ajeno | enlace al original |
| `crear_nodo` | padre ajeno; límite de nodos; tipo desconocido; estado escrito por el LLM | se aplica y el nodo nace «sin explorar» | — |
| `relacionar` | nodo ajeno; ciclo; duplicada; tipo desconocido | se aplica con `creada_por: ia` | — |
| `editar_nodo` | nodo ajeno; sin título ni resumen | guarda la revisión anterior (`por: agente`, no cuenta como exploración) | — |
| `fusionar` | nodo ajeno; destino fuera de la lista; un solo nodo | conserva aristas y borra el fusionado; se rechaza con evidencia propia | — |
| `enfocar` | nodo ajeno; campo extra | cambia solo el foco | — |

Regresiones de los ajustes con Groq: respuesta de texto libre que vuelve a la charla (`chat.test.ts`), lectura sin idea sin «Me parece que…» (integración), `idea_clave` obligatoria en nodos y prohibición de trabajar la comprobación activa (`agente-prompt.test.ts` y marcador `[[contexto]]`).

## Log

- **L1 (30/10/2026, usuario):** «Separemos dos cosas, el sistema y la consciencia (el LLM EN SI asi lo llamaré), el sistema te da las herramientas y funcionalidades, te crea el arbol referencial, te da la posibilidad de corregir los errores, te da las funcionalidades que hemos implementado simulando el backward y que el usuario entienda. El usuario final tiene que ver eso de la interfaz de la IA, una muestra visual del arbol de COMPRENSION del usuario, para que vea que temas estan relacionados, en qué pudo haber fallado, qué puede haber quedado claro o no, masomenos como una visualización de Obsidian. […] No es tanto como lecciones, es algo más englobado, no se busca enseñar, se busca que el usuario comprenda el contexto detras de sus errores y asi APRENDA, y no realice el acto de aprender sin pensar»
- **L2 (30/10/2026, usuario):** «literlmente el agente tiene que dar el grafo de comprension, puede ser un arreglo o JSON, tu mismo ve la mejor opción para esto, la cosa es que el frontend lo visualice de buena forma. Asi como creamos objetos/artefactos propon más para la comprensión del alumno»
- **L3 (30/10/2026):** Decisión: el agente emite operaciones sobre el grafo; el sistema las valida, calcula estados desde la evidencia y entrega el grafo completo. Artefactos aprobados por el usuario: «Si, esta correcto, me gusta».
- **L4 (30/10/2026, usuario):** «escribe el plan de implementación, pero aun debemos definir como se van a validar las respuestas en teoria.» Propuesta de validación en `diseno_tutor_agente.md` §4 y §5: tres niveles (determinista, formativo verificado, lectura provisional), plantillas paramétricas y cinco capas sobre las salidas del agente.
- **D1 (resuelta, 30/10/2026, usuario):** «Sí, también evidencia». Las plantillas pueden usarse como comprobación (nivel A) cuando se agotan las actividades curadas. Para que la evidencia no dependa de texto generado, el enunciado de comprobación es fijo por plantilla; la IA solo redacta las prácticas formativas. Ver S13. Límite que se mantiene: los enunciados de plantilla no tienen revisión docente.
- **L5 (30/10/2026, usuario):** «Si normal, cambiamos a Groq mejor, cambia el AGENTS md o las especificaciones para que cumpla con GROQ, dicho eso manda subagentes a que realicen la implementacion, mejor a uno solo subagente». Se descartó Codex como motor del tutor (AGENTS.md prohíbe reutilizar credenciales del harness y su uso desde una aplicación no está cubierto por el plan de ChatGPT). Se agrega S0 y se actualiza AGENTS.md §3 y §14.
- **L6 (30/10/2026, ejecución):** T0–T7 implementadas por una sesión aparte, en la rama `feat/tutor-agente`, un commit por tarea y sin atribución. Desviaciones: (a) T0 y T2 se escribieron implementación primero y pruebas después; T1 sí observó el rojo primero. (b) `.env.example` no se pudo leer ni editar (permiso denegado en la sesión): S0 queda sin esa línea y hay que agregar `AI_PROVIDER=groq` con `AI_API_KEY=` vacío a mano. (c) Se agregó una segunda migración aditiva `Plantillas1770000004000` (`rastros_error.origen`, `plantilla`, `parametros`) para S13 en vez de tocar la migración ya commiteada. (d) `AgenteModule` vive en `agente.ts` para evitar una importación circular con `tutor.ts`. (e) Un valor ilegible en una comprobación curada ahora responde 400 sin cerrar la comprobación (S2). (f) `npm run verify`: todo pasa salvo `npm audit` (14 avisos moderados en eslint/typescript-eslint/minimatch/glob vía typeorm, ajenos a `react-force-graph-2d`).
- **L7 (31/10/2026, ejecución):** el usuario pidió dejar el agente funcional y todos los artefactos con sus pruebas, listo para pushear (el diseño visual lo mejora él después). Tras probar con Groq real se corrigieron cuatro problemas (respuestas a bloques que no seguían en la charla, lectura vacía, `idea_clave` ausente en nodos, ayuda sobre el problema de la comprobación activa; commit `c0867a7`). Al completar la matriz apareció un defecto real: una edición del agente (`editar_nodo`) creaba una revisión que marcaba el nodo como «explorado»; se arregló con la migración aditiva `Revisiones1770000005000` (`revisiones_nodo.por`) en `7229b26`. La matriz está en `a828edf`. Un `npm run test:docker` aislado se colgó una vez en un test (167 s) y no se reprodujo en tres corridas siguientes: queda como flake no explicado, a vigilar.
