# Tutor de comprensión: harness con retropropagación del error

Objetivo: cerrar el ciclo explorar → comprobar → **retropropagar el error al árbol** → corregir → validar con una actividad nueva, según `idea_tutor_harness_comprension.md`.
Rama: `feat/tutor-harness-comprension` (desde `main`). Entrega: commits por unidad, **sin línea `Co-Authored-By` ni ninguna atribución**; sin push. Runner: Vitest (`npm test`, `npm run test:docker`), cierre con `npm run verify`.

## Specs

Diseño de referencia: `idea_tutor_harness_comprension.md` (§4–§8 y §11). Si este documento y la idea discrepan, prevalece este documento.

- **S1 — Catálogo de ideas clave.** Catálogo fijo en código para los 3 conceptos actuales (`porcentajes`, `proporciones`, `fracciones`) con las 6 claves de la idea §5.1: `base-del-porcentaje`, `cambio-de-base`, `directa-vs-inversa`, `valor-unitario`, `parte-vs-complemento`, `fraccion-de-cantidad`, cada una con `concepto`, `clave` y `descripcion`. Vive junto a `ACTIVIDADES` en `backend/src/modules/seguimiento/actividades.ts` (o un archivo hermano del mismo módulo).
- **S2 — Mapa de errores.** Cada actividad de `ACTIVIDADES` incorpora `errores: { respuesta: number, idea_clave, explicacion, pista }[]`. Como mínimo, los 6 casos de la idea §5.2: `porcentajes-1` 100 → `cambio-de-base`; `porcentajes-2` 190 → `cambio-de-base`; `porcentajes-3` 20 → `base-del-porcentaje`; `proporciones-1` 24 → `directa-vs-inversa`; `fracciones-1` 9 → `parte-vs-complemento`; `fracciones-2` 600 → `parte-vs-complemento`. `proporciones-2` puede quedar sin mapa. Una prueba unitaria comprueba que cada `idea_clave` del mapa existe en el catálogo y pertenece al mismo concepto que la actividad, y que ninguna respuesta del mapa coincide con la respuesta correcta.
- **S3 — Nodos etiquetados.** Migración nueva `Harness1770000002000` (registrada en `backend/src/database/database.ts`), solo aditiva: columna nullable `idea_clave text` en `nodos`. El esquema de salida de la IA (`outputSchema` en `ai.ts`) acepta `idea_clave` opcional en raíz e hijos. El servidor la conserva **solo** si pertenece al catálogo del concepto del árbol; si no, la guarda como `NULL` (nunca falla la creación por eso). `PROMPT_VERSION` pasa a `tutor-v2`; el prompt recibe la lista de claves permitidas del concepto. El proveedor `fake` devuelve una clave válida cuando el árbol tiene concepto.
- **S4 — Retropropagación determinista.** En `PUT /comprobaciones/:id/respuesta`, si la respuesta es incorrecta, en la **misma transacción** que guarda el resultado:
  - Buscar la respuesta numérica en el mapa de la actividad. Si está → `idea_clave`; si no → `idea_clave = null` y `motivo = "sin_evidencia"`. **La IA no interviene en este paso.**
  - Nodo de retorno: el nodo más reciente del árbol con esa `idea_clave`, o `null` si no existe.
  - Nivel de ayuda por fallos previos en el mismo árbol y la misma idea clave: 0 → `pista`, 1 → `ejemplo`, 2 o más → `explicacion_completa`.
  - Insertar en la tabla nueva `rastros_error (id, actor_id, arbol_id, comprobacion_id UNIQUE, respuesta, idea_clave NULL, nodo_retorno_id NULL, nivel_ayuda, created_at)` con FKs y `ON DELETE CASCADE` coherentes con el esquema existente.
  - La respuesta del endpoint incluye `rastro: { idea_clave, descripcion, explicacion, pista, nodo_retorno_id, nivel_ayuda, motivo }`. Con `sin_evidencia`, el texto debe decir que no hay evidencia suficiente para ubicar el error y pedir la justificación o un paso intermedio; no inventar causa.
  - La entrega sigue siendo idempotente: reenviar no crea un segundo rastro.
- **S5 — Corrección tras error.** Si una comprobación correcta y **sin ayuda** ocurre en un árbol con al menos un rastro de error previo, además de la evidencia `resolvio_sin_ayuda` se inserta una evidencia `corrigio_tras_error` con la `idea_clave` del último rastro. Abrir o leer nodos sigue sin crear evidencias.
- **S6 — Rastro en el árbol.** `GET /arboles/:id` añade `ultimo_rastro` (o `null`) con los campos de S4 más `camino`: los ids desde la raíz hasta `nodo_retorno_id`, calculados en el servidor. Solo el actor dueño lo ve; otra sesión recibe 404 como hoy.
- **S7 — Crear el nodo que falta.** `POST /arboles/:id/nodos/:nid/expandir` acepta un `idea_clave` opcional del catálogo del concepto. Si viene, el prompt pide un hijo centrado en esa idea y el servidor etiqueta el nodo creado con ella. Respeta la idempotencia (`solicitudes_ia`), los límites de profundidad y el bloqueo durante una comprobación activa.
- **S8 — Interfaz.** En `frontend/src/pages/Aprender.tsx`:
  - Tras un fallo, resaltar en el árbol el camino de `ultimo_rastro.camino` y marcar el nodo de retorno con una etiqueta visible «Volver aquí» (no depender solo del color).
  - Mostrar la devolución citando la respuesta del estudiante («Tu respuesta 100 …»), la `explicacion` y la `pista`.
  - Tres acciones de ayuda siempre visibles: pista (ya mostrada), «Ver ejemplo resuelto» y «Explicación completa», reutilizando los endpoints existentes de expandir/aclarar sobre el nodo de retorno.
  - Si `nodo_retorno_id` es `null` pero hay `idea_clave`, un botón «Explicar esta idea» que llama a S7 sobre la raíz.
  - Con `motivo = "sin_evidencia"`, mostrar el mensaje honesto y no resaltar ningún nodo.
  - Etiqueta legible para la evidencia `corrigio_tras_error` («Corregiste tras un error: resolviste una variante nueva sin ayuda»).
  - Sin porcentajes de comprensión. Accesible por teclado y legible a 360 px.
- **S9 — Pruebas.** Unitarias para S1–S2. En `backend/test/system.test.ts`, con PostgreSQL real y proveedor `fake`:
  1. Fallar `porcentajes-1` con `100` → rastro `cambio-de-base`, `nivel_ayuda = pista`, y `GET /arboles/:id` devuelve `ultimo_rastro` con `camino`.
  2. Respuesta fuera del mapa → `motivo = sin_evidencia`, `idea_clave = null`.
  3. Segundo fallo en la misma idea del mismo árbol → `nivel_ayuda = ejemplo`.
  4. Acierto posterior sin ayuda en una actividad distinta → evidencias `resolvio_sin_ayuda` **y** `corrigio_tras_error`.
  5. Reenviar la misma respuesta no duplica rastros ni evidencias.
  6. Otra sesión no puede leer el árbol ni su rastro.
  7. Una `idea_clave` fuera del catálogo propuesta por la IA se guarda como `NULL`.
  Las pruebas existentes siguen pasando sin cambiar su comportamiento esperado.
- **S10 — Documentación.** Actualizar `PLAN_IMPLEMENTACION_ATLAS.md` (nueva subsección en §16 con lo implementado, lo verificado y los límites), `backend/README.md` (contratos nuevos) y la cabecera de estado de `idea_tutor_harness_comprension.md` (de «propuesta» a «implementado parcialmente», enumerando qué partes). No describir como implementado lo que no lo esté.

### Fuera de alcance

Mapas de error para «Mis cursos», catálogo de ideas para otros cursos, cambiar cómo se elige la actividad de validación, calificar la justificación con IA, despliegue, push o PR.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S1, S2, S4, S5, S6 + pruebas S9.1–S9.6 | inline (Sonnet) | hecho | 255c35c |
| T2 | S3, S7 + prueba S9.7 | inline (Sonnet) | hecho | 3f4d655 |
| T3 | S8 | inline (Sonnet) | hecho | 8eff4f4 |
| T4 | S10 | inline (Sonnet) | hecho | commit de documentación (el que contiene este archivo) |

Commits previstos (Conventional Commits en español, como el historial):
1. `feat(seguimiento): retropropagar errores de comprobación a ideas clave`
2. `feat(tutor): etiquetar nodos con ideas clave y generar el nodo faltante`
3. `feat(frontend): resaltar en el árbol dónde se rompió la comprensión`
4. `docs: documentar el harness de comprensión`

## Log

- **L1 (30/10/2026, usuario, sobre la idea original):** «El descenso de gradiente es la forma en la que una red neuronal aprende y corrige sus errores, lo que digo es que con el arbol de comprension que tenemos de cada usuario, tema, etc. Podemos abstraer este concepto de descenso de gradiente con el fin de obtener mejoras y comprensión en el estudiante, no lo sé, de acuerdo a cada nodo podemos ir de abajo hacia arriba (nodos hijo hacia la raiz) y con eso enseñarle de mejor manera al alumno. Cosa que tambien podemos diseñar de mejor forma el interfaz del Tutor y su consigna de aprendizaje. Esto lo realizaría al Tutor como un mini Harness con sus propios artefactos y formas de presentar información.»
- **L2 (30/10/2026, usuario):** «Ok, crea un plan de implementación y pasaselo a Sonnet Alto, recuerdale que no tiene que realizar commits con coautiria claude, que los realice sin coautoria, me gusta la idea. Vamos a seguir»
- **L3:** Mapa del código hecho antes de planificar: actividades en `backend/src/modules/seguimiento/actividades.ts`; entrega de comprobación en `seguimiento.ts` (`PUT comprobaciones/:id/respuesta`, transacción con evidencia); salida de IA en `ai.ts` (`outputSchema`, `PROMPT_VERSION = "tutor-v1"`); inserción de nodos en `tutor.ts` (`create`, `expand`); migraciones `Initial1770000000000` y `Learning1770000001000` registradas en `database.ts`; UI en `frontend/src/pages/Aprender.tsx`; pruebas de sistema en `backend/test/system.test.ts`.
- **L4:** Riesgo evaluado: migración solo aditiva, campos nuevos opcionales en la API y la salida de IA, sin cambios en contratos existentes. `Risk: none` previsto; si durante la implementación algo cambia un contrato existente, registrarlo aquí.
- **L5 (implementación):** La migración `Harness1770000002000` (columna `idea_clave`, tabla `rastros_error`) entró en el commit de T1 porque la retropropagación y su prueba la necesitan; T2 solo agrega el etiquetado por IA y `expandir`. Se añadió además `nodos.created_at` (default `clock_timestamp()`, aditivo) para poder resolver «el nodo más reciente con esa idea clave», que S4 exige y la tabla no podía ordenar. `rastro` y `ultimo_rastro` se reconstruyen del mapa curado, sin guardar texto de la IA.
- **L6 (decisiones de interfaz):** el resaltado del camino y «Volver aquí» se muestran tras el fallo en la sesión de la pantalla (no se reconstruyen al recargar; `ultimo_rastro` sí queda disponible). Con `nodo_retorno_id = null` se ofrece solo «Explicar esta idea» (S7 sobre la raíz); con `sin_evidencia` no hay botones de ayuda ni resaltado.
- **L7 (verificación):** `npm run lint`, `typecheck`, `npm test` (384), `npm run test:docker` (38), `npm run build` y `npm run verify` pasaron en verde. La IA real no se probó. `Risk: none`: migración aditiva, campos opcionales nuevos en la API; `rastro` se agrega al resultado de la comprobación sin cambiar campos existentes.
