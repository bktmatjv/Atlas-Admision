# Backend CALIBRA

API NestJS independiente del frontend. Monolito modular con PostgreSQL/TypeORM y migraciones explícitas (`synchronize: false`). Ver [arranque local](../README.md) antes de ejecutar comandos.

## Responsabilidades

| Módulo | Función |
| --- | --- |
| `identidad` | Sesiones invitadas, validación de identidad y protección de solicitudes |
| `contenido` | Banco, metadatos UNMSM, cursos propios, documentos y prácticas generadas |
| `practica` | Intentos, snapshots, respuestas versionadas, corrección y repasos |
| `tutor` | Árboles, contexto, idempotencia, proveedor IA (`proveedor.ts`), agente conversacional (`agente.ts`), respuestas a bloques (`bloques.ts`) y validadores de artefactos (`artefactos.ts`) |
| `seguimiento` | Comprobaciones, evidencias, grafo de comprensión (`grafo.ts`), plantillas paramétricas (`plantillas.ts`) y normalización numérica (`numeros.ts`) |

Los servicios usan `Database`, que centraliza TypeORM y normaliza el resultado del driver PostgreSQL. Las consultas de dominio son parametrizadas; las escrituras relacionadas usan transacciones. El motor compartido vive en `packages/motor`.

## Contrato HTTP

Prefijo: `/api/v1`. Las escrituras requieren `X-Calibra-Request: 1`; las solicitudes del navegador deben provenir del origen configurado o del mismo origen de la API. CORS tiene un origen explícito, credenciales y preflight; no se acepta `*` con cookies.

La sesión usa cookie HttpOnly `atlas_sid`; la DB guarda solo el hash del token. Cada recurso privado se autoriza por el actor resuelto desde esa cookie. Nunca se acepta `user_id` del cliente como identidad.

| Método y ruta | Entrada / resultado |
| --- | --- |
| `GET /salud` | Público; comprueba DB e informa modo IA sin secretos |
| `POST /sesion` | Crea o recupera sesión invitada; devuelve `actorId` |
| `GET /sesion` | Identidad actual |
| `DELETE /sesion` | Elimina datos de la sesión; exige retirar antes sus documentos originales |
| `GET /catalogo`, `/examenes`, `/unmsm` | Catálogo y metadatos; no publica el banco con claves |
| `GET /perfil`, `PUT /perfil` | Perfil validado con zod: `etapa`, `universidad`, `area`, `carrera_id`, `proceso`, `objetivos[]`, `cursos_dificiles[]`, `carrera_texto`, `horas_semana`, `onboarding_completo` y `onboarding_omitido`. Los valores del catálogo se validan contra la base; otra universidad no conserva el catálogo UNMSM |
| `GET /cuenta` | Usuario de la cuenta vinculada al actor, o `null` si es invitado |
| `POST /cuenta/registro` | `{ usuario, contrasena }`: vincula el actor invitado actual, rota la sesión y devuelve `codigo_recuperacion` (se muestra una sola vez) |
| `POST /cuenta/ingreso` | `{ usuario, contrasena }`: emite una sesión nueva para el actor de la cuenta; error genérico igual para usuario inexistente y contraseña incorrecta |
| `POST /cuenta/recuperar` | `{ usuario, contrasena, codigo }`: cambia la contraseña, consume el código, devuelve uno nuevo y revoca las demás sesiones |
| `POST /cuenta/salida` | Cierra solo la sesión actual |
| `POST /intentos` | `modo`, `area`, curso/tema o examen; devuelve `intento_id` y cantidad real |
| `GET /intentos`, `/intentos/:id` | Historial propio y estado |
| `GET /intentos/:id/preguntas` | Snapshots ordenados; clave/solución solo entregado o reveladas legítimamente |
| `GET /intentos/:id/respuestas` | Respuestas propias |
| `PUT /intentos/:id/respuestas` | Lote con `pregunta_id`, `opcion`, `marcada`, `confianza`, `version` |
| `POST /intentos/:id/entrega` | Corrección transaccional; repetir devuelve el informe sin duplicar efectos |
| `POST /intentos/:id/preguntas/:pid/solucion` | Solo con respuesta guardada y modo permitido; registra consulta |
| `GET /errores`, `/temas-frecuentes?area=A` | Cuaderno y frecuencia del banco |
| `POST /arboles` | Solicitud + pregunta de intento propio, fragmento confirmado o concepto inicial admitido |
| `GET /arboles`, `/arboles/:id` | Exploraciones propias. El detalle incluye `idea_clave` por nodo y `ultimo_rastro` (o `null`) con `camino` calculado en el servidor y `corregido` (si ya hubo una corrección posterior) |
| `POST /arboles/:id/nodos/:nid/expandir` | Crea hijos pertinentes; máximo 30 nodos y profundidad 5. `idea_clave` opcional (del catálogo del concepto del árbol, si no 400) centra el hijo en esa idea y lo etiqueta |
| `POST /arboles/:id/nodos/:nid/aclarar` | Ajusta el nodo y conserva revisión anterior; no agrega ramas |
| `POST /comprobaciones` | `arbol_id`; elige primero una actividad curada no expuesta; si no queda ninguna, una instancia de plantilla del mismo concepto. Devuelve `origen` (`curada` o `plantilla`) |
| `GET /comprobaciones/activa` | Permite retomar la comprobación; incluye `origen` |
| `GET /grafo` | Grafo de comprensión del actor (ver «Tutor agente») |
| `POST /conversaciones` | Crea una conversación con su árbol y raíz. Origen: `tema`, `fragmento_id` o `intento_id` + `pregunta_id`. Con `mensaje_inicial` (y `Idempotency-Key`) crea y manda el primer turno en una llamada y devuelve también `estudiante` y `tutor`; el mismo `mensaje_inicial` puede ir sin contexto (la conversación no tiene concepto ni ideas clave y su título es el mensaje). Repetir la misma clave recupera la misma conversación y el mismo turno. Sin contexto ni mensaje sigue siendo 400 |
| `GET /conversaciones`, `/conversaciones/:id` | Conversaciones propias (`id`, `titulo`, `concepto`, `created_at`) y el historial de una con sus bloques |
| `POST /conversaciones/:id/mensajes` | `texto`; exige `Idempotency-Key`. Ejecuta un turno del agente (ver «Tutor agente») |
| `POST /bloques/:id/respuesta` | `respuesta`; corrige prácticas y predicciones, o guarda texto libre con lectura provisional. Nunca crea evidencia |
| `PUT /comprobaciones/:id/respuesta` | Resultado numérico y justificación; corrección numérica, no de comprensión profunda. Si es incorrecta, devuelve `rastro` (ver «Harness de comprensión») |
| `POST /comprobaciones/:id/cancelar` | Regresa explícitamente al modo de ayuda |
| `GET /evidencias` | Observaciones propias; abrir un nodo no genera aprendizaje demostrado |
| `POST /cursos`, `GET /cursos`, `/cursos/:id` | Cursos personales y materiales |
| `POST /cursos/:id/documentos` | Multipart, campo `archivo`; devuelve ID/estado de importación |
| `GET /documentos/:id` | Estado, texto por fragmentos, temas propuestos y prácticas guardadas; nunca ruta del disco |
| `POST /documentos/:id/confirmar` | Acepta usar la extracción; no constituye revisión académica |
| `POST /documentos/:id/reintentar` | Solo importaciones fallidas |
| `DELETE /documentos/:id` | Retira original, fragmentos y derivados relacionados |
| `POST /fragmentos/:id/actividad` | Práctica generada no revisada; guardada por actor/fragmento |
| `PUT /actividades-generadas/:id/intento` | Guarda intento textual y consulta de respuesta, sin puntaje de transferencia |

Las operaciones de IA de árboles y generación formativa requieren `Idempotency-Key` (8–120 caracteres). Repetir la misma clave con el mismo contenido recupera el resultado; otra operación con esa clave recibe 409. Si está pendiente, devuelve 409; si falló, iniciar un intento nuevo con otra clave. Una interrupción de red no garantiza que el proveedor no haya cobrado.

Errores: `{ "error": { "codigo": "HTTP_400", "mensaje": "..." } }`. Entrada inválida: 400; sesión ausente: 401; origen no permitido: 403; recurso ajeno/inexistente: 404; conflicto de estado: 409; tamaño excedido: 413; límite de peticiones: 429; IA ausente/fallida: 503. No se devuelven SQL, prompts completos, claves ni rutas privadas en errores.

## Cuentas y perfil

- Usuario de 3 a 30 caracteres `[a-z0-9_.]` y contraseña de 8 a 128. No se pide nombre, fecha de nacimiento, DNI, colegio ni correo.
- La contraseña se guarda con `scrypt` (`node:crypto`), sal por usuario y comparación en tiempo constante; un usuario inexistente paga el mismo coste. El código de recuperación solo se guarda como hash SHA-256 y se rota al usarse.
- Registrarse vincula el actor invitado actual en una transacción: intentos, árboles, conversaciones y evidencias siguen siendo del mismo actor. Ingresar desde otro dispositivo crea una sesión nueva para ese actor sin cerrar las demás; registrarse, ingresar y recuperar reemplazan la sesión desde la que se llamó.
- `POST /cuenta/registro|ingreso|recuperar` tienen límite por IP (15/min) y por usuario (8/min), además del límite general. Nunca se registran contraseñas, hashes ni códigos.
- `DELETE /sesion` elimina la cuenta junto con el resto de los datos del actor (`ON DELETE CASCADE`) y permite reutilizar el alias.
- La interfaz actual solo cubre ingreso, registro, recuperación y salida; el onboarding que llena el perfil ampliado está pendiente.
- El agente del tutor recibe un resumen con lista blanca (`etapa`, `universidad`, `area`, `carrera`, `objetivos`, `cursos_dificiles`); nunca alias, hashes, códigos ni campos arbitrarios del perfil. Prompt `tutor-agente-v5`.
- Migración aditiva `Cuentas1770000008000` (tabla `cuentas`; sin reversión automática).

## Persistencia y plazos

- Respuestas: la versión mayor gana; una versión antigua no sobrescribe la nueva. El resultado incluye `guardadas` y las `versiones` del servidor, para que el cliente detecte conflictos entre pestañas.
- El backend decide el vencimiento. No acepta nuevas respuestas después del plazo. Si hubo pérdida de conexión, se puede entregar solo lo recibido, con advertencia en la UI; no se simula que se guardó todo.
- Entrega/corrección y sus efectos son atómicos e idempotentes por intento. Se serializan efectos sobre el cuaderno del actor.
- Fechas de actividad: UTC; fechas de repaso: días de Lima. Puntaje calculado con milésimas exactas en el motor.
- El importador usa snapshot/hash, validación y bloqueo para evitar importaciones simultáneas. No sobrescribe contenido diferente con el mismo identificador.

## Documentos privados

Formatos: PDF con texto, TXT y Markdown. Límites actuales: 10 MB, 50 páginas, 100.000 caracteres y 20 documentos por sesión. No se ejecutan adjuntos ni macros. No hay OCR ni búsqueda externa.

El original tiene nombre interno generado y se guarda fuera de archivos públicos. El parser corre en un worker con límite de memoria y timeout de 30 segundos; la IA de organización recibe una muestra de hasta 12 fragmentos, lo que se declara cuando el documento supera ese alcance.

Los trabajos están en PostgreSQL, con lease recuperable tras reinicio. Un trabajador los procesa de uno en uno, sin broker y sin mantener transacciones durante IA o extracción. Si la IA no está configurada, se conserva la extracción para revisión manual, con advertencia.

Confirmar la extracción no verifica sus afirmaciones. Las propuestas generadas se identifican como no revisadas; se conservan los intentos, pero no suman aciertos de transferencia verificada. Eliminar el documento elimina sus fragmentos, árboles, prácticas y resultados IA asociados mediante referencias; las copias de seguridad requieren política operativa aparte.

## Harness de comprensión (retropropagación del error)

Cierra el ciclo explorar → comprobar → volver al nodo donde se rompió la idea → validar con una actividad nueva. Diseño en `idea_tutor_harness_comprension.md`.

- **Catálogo y mapa curados** (`seguimiento/actividades.ts`): 6 ideas clave para porcentajes, proporciones y fracciones, y un mapa de respuestas incorrectas típicas por actividad (`errores`). `proporciones-2` no tiene mapa.
- **Retropropagación determinista**: al entregar una respuesta incorrecta, en la misma transacción se busca la respuesta numérica en el mapa. La IA no interviene. Si no está, `idea_clave = null` y `motivo = "sin_evidencia"`: el texto dice que no hay evidencia suficiente y pide la justificación o un paso intermedio; no se infiere causa.
- **Nodo de retorno**: el nodo más reciente del árbol con esa `idea_clave`, o `null` si no existe.
- **Nivel de ayuda** por fallos previos en el mismo árbol y la misma idea: 0 → `pista`, 1 → `ejemplo`, 2 o más → `explicacion_completa`.
- **Persistencia**: tabla `rastros_error` (una fila por comprobación, `comprobacion_id` único); reenviar la misma entrega devuelve el resultado guardado y no duplica rastros ni evidencias. Migración `Harness1770000002000` (aditiva): `nodos.idea_clave`, `nodos.created_at` y `rastros_error`.
- **Contrato**: `rastro = { respuesta, idea_clave, descripcion, explicacion, pista, nodo_retorno_id, nivel_ayuda, motivo }` (`null` si la respuesta fue correcta). `GET /arboles/:id` añade `ultimo_rastro` con los mismos campos más `camino` (ids desde la raíz hasta el nodo de retorno; `[]` si no hay nodo).
- **Evidencia `corrigio_tras_error`**: un acierto sin ayuda en un árbol cuyo último rastro de error aún no fue corregido registra, además de `resolvio_sin_ayuda`, esta evidencia con la `idea_clave` de ese rastro. Se registra una sola vez por fallo: los aciertos siguientes no la repiten hasta que haya un fallo nuevo. Abrir o leer nodos no crea evidencias.
- **Etiquetado de nodos**: la IA puede proponer `idea_clave` (prompt `tutor-v2`, que recibe las claves permitidas). El servidor la conserva solo si pertenece al catálogo del concepto del árbol; si no, guarda `NULL` sin fallar.

Alcance: solo el flujo de conceptos de aritmética con comprobación revisada. «Mis cursos» no tiene mapas de error. El resultado no es un porcentaje de comprensión ni certifica dominio.

## Proveedor de IA

`AI_PROVIDER` acepta `disabled | groq | anthropic | fake | router`. `groq` y `anthropic` exigen `AI_API_KEY` y `AI_MODEL` (se valida al arrancar); `router` usa una cadena de modelos con failover (ver más abajo) y sus propias variables. No hay ningún nombre de modelo fijo en el código. `fake` es solo para pruebas y está prohibido en producción. Las credenciales viven solo en el backend.

- `proveedor.ts` define la interfaz propia `ProveedorIA` (`completar({ sistema, mensajes, herramientas, forzar })` → texto o llamadas a herramientas). Los adaptadores son `ProveedorGroq` (API compatible con OpenAI en `https://api.groq.com/openai/v1/chat/completions`, con `fetch` nativo y herramientas `tools`/`tool_calls`; sin SDK de OpenAI), `ProveedorAnthropic` y `ProveedorFake`.
- Timeout de 30 s por llamada y sin reintentos automáticos. HTTP 429 del proveedor, timeout, fallos de red y respuestas inválidas se traducen a un error explícito (503 con mensaje comprensible); nunca se inventa una respuesta.
- Las operaciones del tutor anteriores (explicar nodos, organizar documentos, proponer actividades) usan la misma interfaz, así que funcionan con cualquier proveedor. Con `fake` y `disabled` su comportamiento no cambió.
- `ATLAS_LIMITE_IA` (opcional, por defecto 40) sube el tope de peticiones por minuto de `/conversaciones` y `/bloques`; las pruebas lo usan.
- Las pruebas automáticas no llaman a Groq: el adaptador se prueba con un `fetch` simulado (respuesta válida, `tool_calls`, JSON inválido, 429, timeout y caída de red).
- El plan gratuito de Groq tiene límites por minuto que pueden cortar con varios estudiantes a la vez.

### Router de modelos con failover (`AI_PROVIDER=router`)

El router (`modules/tutor/router.ts`) es un `ProveedorIA` más: el agente y `TutorAI` lo llaman igual que a Groq. Recibe una cadena ordenada de destinos `proveedor:modelo` (`groq`, `cloudflare` o `foundry`) y, cuando uno agota su cuota o falla, pasa al siguiente. Con `groq`, `anthropic`, `fake` y `disabled` nada cambia. Todo su estado vive en memoria (una sola instancia del backend; no hay Redis): al reiniciar, los disyuntores vuelven a `CERRADO`.

**Cómo decide.** En cada llamada recorre la cadena en orden (el primero siempre se prueba antes que los de respaldo) y salta los destinos con el disyuntor abierto. Cada llamada recibe el contexto completo (mensajes, herramientas y esquema), así que un turno del agente puede usar destinos distintos entre vueltas del ciclo de herramientas; el historial `tool_calls`/resultado es del mismo formato OpenAI en Groq y Cloudflare.

| Situación | Qué hace el router |
| --- | --- |
| HTTP 429 o cuota agotada | No reintenta en el mismo destino; abre el destino y pasa al siguiente |
| 5xx (500, 502, 503, 504…), timeout, error de red | Un reintento en el mismo destino con backoff exponencial con jitter (respeta `retry-after` si cabe en el tiempo total); si vuelve a fallar, pasa al siguiente |
| Respuesta vacía o ilegible | Pasa al siguiente, sin reintento |
| 401, 403, 404 | Marca el destino como mal configurado **hasta reiniciar** (clave inválida, sin permiso o modelo inexistente) y pasa al siguiente; sin reintentos |
| 400 por contexto demasiado largo (o 413) | Prueba el siguiente destino; no cuenta como falla del destino |
| Cualquier otro 400/4xx | Es un bug de la solicitud: se registra en nivel `error` y se propaga, sin failover ni reintento |
| Todos abiertos | `ErrorProveedor` de tipo `limite` de inmediato, con el tiempo estimado de recuperación más cercano (el agente lo responde como 503 con mensaje claro y el mensaje del estudiante queda guardado) |

Nunca supera `AI_TIMEOUT_TOTAL_MS` por llamada al router, y cada destino se prueba como máximo una vez más su único reintento. La validación del contenido (zod, reparación, turno degradado) sigue siendo del agente.

**Disyuntor por destino** (`CERRADO` → `ABIERTO` → `SEMIABIERTO`). Un 429 abre el destino hasta el momento que informa la respuesta: `retry-after` y, en Groq, `x-ratelimit-reset-requests` (límite diario de requests) o `x-ratelimit-reset-tokens` (límite por minuto de tokens) cuando su contador `x-ratelimit-remaining-*` quedó en cero; se usa el mayor. Si el proveedor no informa nada útil, se abre `AI_ENFRIAMIENTO_MS`; no se inventan cuotas. En Cloudflare, un 429 con código 3036 (cuota diaria gratuita) abre hasta las 00:00 UTC. Tras `AI_FALLOS_DISYUNTOR` fallos transitorios seguidos también se abre. Al vencer pasa a `SEMIABIERTO`: deja pasar **una** llamada de prueba (las demás siguen al respaldo); si sale bien se cierra y el destino principal vuelve a usarse, si falla se vuelve a abrir. En Groq los límites son por modelo, por lo que otro modelo de Groq es un respaldo válido.

**Concurrencia.** Cada destino tiene un semáforo de `AI_MAX_CONCURRENCIA` llamadas simultáneas con cola FIFO. Si la espera supera `AI_MAX_ESPERA_COLA_MS`, se prueba el siguiente destino; si ninguno tiene lugar, `limite` («ocupados»). La saturación no abre el disyuntor. El throttler por actor del agente se mantiene.

**Variables** (`backend/.env.example`; se validan al arrancar y los errores nombran la variable que falta, nunca su valor):

| Variable | Significado |
| --- | --- |
| `AI_PROVIDER=router` | Activa el router |
| `AI_CADENA` | Lista ordenada `proveedor:modelo` separada por comas (máx. 8, sin repetidos). El modelo se parte en el primer `:` |
| `GROQ_API_KEY` | Clave de los destinos `groq:`. (`AI_API_KEY`/`AI_MODEL` son solo para `AI_PROVIDER=groq`) |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Credenciales de los destinos `cloudflare:` (endpoint compatible con OpenAI de Workers AI) |
| `FOUNDRY_ENDPOINT`, `FOUNDRY_API_KEY` | Recurso (URL https, p. ej. `https://<recurso>.openai.azure.com`) y clave de los destinos `foundry:<despliegue>`; se exigen solo si la cadena incluye Foundry |
| `AI_SIN_HERRAMIENTAS` | Destinos de la cadena sin function calling: solo reciben llamadas sin herramientas. Todo el tutor actual envía herramientas, así que es una salida de emergencia |
| `AI_TIMEOUT_MS` (20000) / `AI_TIMEOUT_TOTAL_MS` (45000) | Tiempo por llamada a un destino / por llamada al router, sumando failovers |
| `AI_MAX_CONCURRENCIA` (4) / `AI_MAX_ESPERA_COLA_MS` (5000) | Llamadas simultáneas por destino / espera máxima en su cola |
| `AI_ENFRIAMIENTO_MS` (60000) / `AI_FALLOS_DISYUNTOR` (3) | Apertura sin dato del proveedor / fallos seguidos que abren un destino |

**Observabilidad.** Una línea de log JSON por llamada (`[RouterIA]`): destino usado, intentos, motivo de cada failover, latencia, tokens si el proveedor los informa, espera en cola y estado de cada disyuntor. Nunca incluye prompts, mensajes del estudiante, documentos ni claves. Cada turno del tutor guarda en `mensajes.destino_ia` qué destino respondió (`NULL` con otros proveedores), para comparar la calidad por modelo.

**Microsoft Foundry como respaldo.** (1) En el portal de Azure/Foundry crea un recurso de Azure OpenAI (Foundry) y, dentro, un despliegue de un modelo con function calling (recomendado: `gpt-5-mini`; revisa región y cuota de tu suscripción). (2) Copia el endpoint del recurso, el **nombre del despliegue** y una clave (en el portal: el recurso → «Keys and Endpoint» / «Claves y punto de conexión»). `FOUNDRY_ENDPOINT` acepta `https://<recurso>.openai.azure.com` o `https://<recurso>.services.ai.azure.com`, con o sin `/openai/v1` al final (se normaliza). Si el recurso tiene la autenticación por clave desactivada («Disable local authentication»), hay que reactivarla; la VM no usa Entra ID. (3) En `backend/.env`: `FOUNDRY_ENDPOINT=...`, `FOUNDRY_API_KEY=...` y pon `foundry:<nombre del despliegue>` en `AI_CADENA`, por ejemplo `groq:<modelo>,foundry:<despliegue>,cloudflare:<modelo>`. (4) Recrea el backend. El adaptador llama a `{FOUNDRY_ENDPOINT}/openai/v1/chat/completions` con el encabezado `api-key`, usa el despliegue como `model` y, por ser un modelo de razonamiento, envía `max_completion_tokens` sin `temperature`. Un 401/403 deja el destino `mal_configurado` en `/salud`; `mensajes.destino_ia` guarda `foundry:<despliegue>` cuando responde.

**Cómo leer `GET /api/v1/salud`.** Con el router activo agrega `router`, un arreglo con un objeto por destino:

```json
{ "ok": true, "ia": "router", "pruebas": false,
  "router": [
    { "id": "groq:<modelo>", "proveedor": "groq", "modelo": "<modelo>", "herramientas": true,
      "estado": "ABIERTO", "hasta": "2026-11-01T12:07:12.000Z", "motivo": "limite",
      "ocupados": 0, "en_cola": 0 } ] }
```

`estado` es el del disyuntor; `hasta` es la hora (ISO) hasta la que está abierto (`null` si está cerrado o si no se recuperará solo); `motivo` es `limite`, `fallos` o `mal_configurado` (este último dura hasta reiniciar el backend y suele indicar una clave inválida o un modelo inexistente); `ocupados` y `en_cola` son las llamadas en curso y esperando. No se muestran claves ni datos de cuentas. Con otro proveedor, `router` es `null`.

**Pruebas.** `test/router.test.ts` (failover, reintentos, disyuntor, concurrencia y configuración, con relojes simulados), `test/cloudflare.test.ts` (adaptador de Cloudflare y cadena mixta) y el describe «Router de modelos con el agente» de `test/system.test.ts` (ciclo de herramientas con failover, reparación sin bucle, idempotencia y `/salud`). Todas usan `fetch` simulado: ninguna llama a Groq ni a Cloudflare. La calidad pedagógica de cada modelo real y la disponibilidad de los modelos en cada plan solo se verifican con claves reales (ver «Prueba manual con APIs reales» en `odd/tasks/llm-router.md`).

## Tutor agente (sistema + consciencia)

Diseño en `diseno_tutor_agente.md`; plan en `odd/tasks/tutor-agente.md`. El LLM conversa y propone; el sistema valida, corrige lo calculable y decide qué queda demostrado.

- **Migraciones aditivas** `Agente1770000003000` (tablas `conversaciones`, `mensajes`, `aristas`, `respuestas_bloque`; `nodos.senal`; tipos de nodo `concepto`, `idea`, `error`, `ejemplo`, `pregunta`; `actores.foco_nodo_id` y `grafo_version`) `Plantillas1770000004000` (`rastros_error.origen`, `plantilla`, `parametros`) y `Revisiones1770000005000` (`revisiones_nodo.por`: solo las revisiones del estudiante cuentan como exploración; `editar_nodo` del agente guarda `agente`).
- **`GET /grafo`**: `{ version, foco, camino_error, nodos[], aristas[] }` con todos los nodos de todos los árboles del actor. Cada nodo trae `estado`, `senal`, `evidencias`, `idea_clave`, `concepto`, `origen` y `arbol_id`. Las aristas son las padre-hijo (`subtema`, id `p-…`, creadas por el sistema) más las de la tabla `aristas`.
- **`estado` calculado, nunca guardado ni escrito por el LLM**: `fallo` si un rastro de error apunta al nodo y no hubo una corrección posterior; `aplicado` si hay una evidencia `corrigio_tras_error` con su `idea_clave` (o `resolvio_sin_ayuda` en una raíz); `explorado` si el estudiante expandió o aclaró el nodo; `sin_explorar` en los demás. Los hijos creados por el agente no cuentan como exploración.
- **`senal`** (`posible_confusion`): pista visual provisional que nunca cambia el estado ni crea evidencia.
- **Operaciones de grafo** (`crear_nodo`, `relacionar`, `editar_nodo` con revisión, `fusionar`, `enfocar`): viajan en la respuesta final del turno, se validan y se aplican en una transacción. Un nodo nuevo sin padre válido cuelga de la raíz de la conversación. `fusionar` rechaza nodos con rastros propios, hijos o raíces. Al registrar un rastro con idea clave, el sistema crea una arista `confusion_con` desde un nodo `error` existente con esa idea hacia el nodo de retorno.
- **Turno** (`POST /conversaciones/:id/mensajes`): reserva idempotente del mensaje → contexto (grafo, último rastro, justificación de la última comprobación, evidencias recientes y últimos 12 mensajes; nunca la clave de una comprobación activa) → ciclo con herramientas `leer_grafo`, `leer_rastro`, `leer_evidencias`, `leer_intento`, `generar_practica`, `proponer_comprobacion` → validación → persistencia. Máximo 4 llamadas a herramientas, 60 s por turno, 40 turnos por conversación y 200 por actor (429). La llamada a la IA nunca ocurre dentro de una transacción. Si el proveedor falla, el mensaje del estudiante queda guardado y reintentar con la misma `Idempotency-Key` retoma el turno.
- **Fallos del proveedor**: si el proveedor falla durante un turno (límite de uso, timeout, caída) la API responde 503 con el mensaje del proveedor y «Tu mensaje quedó guardado; puedes reintentar»; el mensaje del estudiante ya está guardado y reintentar con la misma `Idempotency-Key` retoma el turno.
- **Pasos visibles**: el turno y cada mensaje del tutor incluyen `pasos: string[]`, con los nombres de herramientas ejecutadas en orden, sin argumentos ni resultados. Se persisten en `mensajes.pasos` mediante la migración aditiva `PasosAgente1770000007000`; los mensajes anteriores devuelven `[]`. La respuesta idempotente y la recarga conservan esos mismos pasos. No es una transcripción del razonamiento del modelo ni un informe de failover.
- **Cierre estructurado**: el modelo responde con la herramienta `responder` `{ mensaje, bloques, grafo_ops }`. Si no pasa la forma se repara una sola vez devolviéndole el error; si vuelve a fallar, el turno se guarda como `degradado` con solo texto.
- **Cinco capas de validación** (`artefactos.ts`): forma (zod; máximo 6 bloques y 8 operaciones), referencias (nodos propios, ideas clave del catálogo, sin ciclos en `subtema`/`requiere`, límites), matemática (visuales y cuentas de `contraste`/`ejemplo_paso_a_paso` con un evaluador propio, sin `eval`), atribución (lo atribuido al estudiante debe aparecer en lo que escribió) y filtración (con una comprobación activa se rechaza el valor correcto). Cada descarte queda registrado con su motivo.
- **Con una comprobación activa** no se ofrecen `leer_intento` ni `generar_practica`, se descartan los bloques `practica` y `prediccion`, y `POST /bloques/:id/respuesta` devuelve 409.
- **Bloques** (10 tipos): `pregunta_socratica`, `contraste`, `razonamiento_anotado`, `prediccion`, `ejemplo_paso_a_paso`, `visual` (`cadena_porcentual`, `barra_de_partes`, `tabla_proporcion`, `recta_numerica`), `practica`, `en_tus_palabras`, `invitacion_comprobar` y `cita`. Cada bloque guardado recibe un `id`; `practica` y `prediccion` se guardan con `enunciado` y `opciones` sin indicar cuál es correcta.
- **Respuestas a bloques**: práctica y predicción se corrigen de forma determinista; si el distractor elegido tiene idea clave, se devuelve y se deja una `senal`. El texto libre (`pregunta_socratica`, `en_tus_palabras`, `ejemplo_paso_a_paso`) pide una lectura provisional al proveedor y la acepta solo si las ideas son del catálogo y `cita_del_estudiante` aparece literalmente en lo escrito; el mensaje «Me parece que…» lo redacta el sistema. Si no hay proveedor, falla o la cita no es literal, la respuesta se guarda sin lectura. Ninguna respuesta a un bloque crea evidencia ni cambia un estado.
- **Plantillas paramétricas** (`plantillas.ts`): `porcentaje_encadenado`, `porcentaje_para_volver`, `complemento_de_fraccion`, `fraccion_de_cantidad`, `proporcion_inversa` y `proporcion_directa`. Con una semilla dan siempre el mismo resultado; los distractores nunca coinciden con la respuesta ni entre sí y cada uno trae su `idea_clave` del catálogo.
- **Comprobaciones de plantilla**: solo cuando se agotan las actividades curadas. El enunciado es texto fijo del sistema (sin IA) y no se repite una combinación `(plantilla, parámetros)` ya expuesta en comprobaciones ni en prácticas de la charla. La corrección usa el normalizador numérico (`coma/punto`, `%`, `S/`, `cm`, `ml`, `litros`, fracciones `a/b`); un valor que no se puede leer responde 400 sin contarse como fallo. El rastro y la evidencia guardan `origen`, y `plantilla` y `parametros` cuando aplica. El bloqueo de ayudas, la idempotencia y la regla «una corrección por fallo» no cambian.

El proveedor `fake` emite cada artefacto con un marcador en el mensaje del estudiante (`[[b:contraste]]`, `[[b:visual_cadena]]`, `[[b:ops_completas]]`, `[[b:cita:<uuid>]]`, etc.), para probar el ciclo sin IA real. La matriz de pruebas por artefacto está en `odd/tasks/tutor-agente.md`.

El prompt del agente es `tutor-agente-v3`: además de lo anterior, pide acompañar la respuesta con al menos un bloque pertinente cuando aporte (por ejemplo una `pregunta_socratica` con `respuestas_rapidas` o un `contraste` y un `visual` si el estudiante ya mostró su cálculo), sin forzar bloques en cada turno. Los bloques `cita` guardan además el `documento` y la `pagina` del fragmento.

Límites: la calidad pedagógica del agente con un proveedor real no está validada; los modelos abiertos pueden usar herramientas con menos consistencia (las capas de validación descartan o degradan lo que falle). Las plantillas cubren solo los tres conceptos actuales y sus enunciados no tienen revisión docente. «Mis cursos» solo tiene lectura provisional y citas, sin práctica verificada. No hay streaming.

## Pruebas y límites pendientes

`npm run test:docker` inicia un contenedor PostgreSQL de pruebas con puerto aleatorio y un esquema propio; no reutiliza el volumen de Compose ni bases de otros proyectos. Lo elimina al finalizar. Las llamadas habituales usan `AI_PROVIDER=fake`, rotulado y prohibido en producción.

Las pruebas cubren importación repetible, actor ajeno, guardado versionado y rollback, entrega concurrente, plazos, soluciones, idempotencia IA, aclaraciones, comprobaciones, rastros de error y etiquetado de nodos, prácticas documentales, PDF válido/corrupto, borrado de derivados, CORS, JSON inválido y reinicio de la API. Para el tutor agente: unitarias del adaptador Groq (con `fetch` simulado), normalizador y evaluador, plantillas y validadores de artefactos; de integración con el proveedor `fake` (ciclo con herramienta, idempotencia, reparación y turno degradado, bloqueo con comprobación activa, aislamiento entre sesiones, estados derivados, señales sin evidencia y comprobaciones de plantilla).

No está validada todavía la calidad de respuestas con credenciales reales ni con usuarios. Faltan OCR, fuentes externas, recuperación de cuentas, edición avanzada de cursos y revisión pedagógica de las actividades. Antes de un servicio público: definir retención/respaldos, ajustar cuotas a costes reales y completar revisión de seguridad/operación. No se ha desplegado en Azure ni se configuró Vercel.
