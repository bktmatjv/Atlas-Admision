# Backend Atlas

API NestJS independiente del frontend. Monolito modular con PostgreSQL/TypeORM y migraciones explícitas (`synchronize: false`). Ver [arranque local](../README.md) antes de ejecutar comandos.

## Responsabilidades

| Módulo | Función |
| --- | --- |
| `identidad` | Sesiones invitadas, validación de identidad y protección de solicitudes |
| `contenido` | Banco, metadatos UNMSM, cursos propios, documentos y prácticas generadas |
| `practica` | Intentos, snapshots, respuestas versionadas, corrección y repasos |
| `tutor` | Árboles, contexto, idempotencia y proveedor IA |
| `seguimiento` | Comprobaciones y evidencias creadas por el servidor |

Los servicios usan `Database`, que centraliza TypeORM y normaliza el resultado del driver PostgreSQL. Las consultas de dominio son parametrizadas; las escrituras relacionadas usan transacciones. El motor compartido vive en `packages/motor`.

## Contrato HTTP

Prefijo: `/api/v1`. Las escrituras requieren `X-Atlas-Request: 1`; las solicitudes del navegador deben provenir del origen configurado o del mismo origen de la API. CORS tiene un origen explícito, credenciales y preflight; no se acepta `*` con cookies.

La sesión usa cookie HttpOnly `atlas_sid`; la DB guarda solo el hash del token. Cada recurso privado se autoriza por el actor resuelto desde esa cookie. Nunca se acepta `user_id` del cliente como identidad.

| Método y ruta | Entrada / resultado |
| --- | --- |
| `GET /salud` | Público; comprueba DB e informa modo IA sin secretos |
| `POST /sesion` | Crea o recupera sesión invitada; devuelve `actorId` |
| `GET /sesion` | Identidad actual |
| `DELETE /sesion` | Elimina datos de la sesión; exige retirar antes sus documentos originales |
| `GET /catalogo`, `/examenes`, `/unmsm` | Catálogo y metadatos; no publica el banco con claves |
| `GET /perfil`, `PUT /perfil` | Universidad, carrera y horas semanales |
| `POST /intentos` | `modo`, `area`, curso/tema o examen; devuelve `intento_id` y cantidad real |
| `GET /intentos`, `/intentos/:id` | Historial propio y estado |
| `GET /intentos/:id/preguntas` | Snapshots ordenados; clave/solución solo entregado o reveladas legítimamente |
| `GET /intentos/:id/respuestas` | Respuestas propias |
| `PUT /intentos/:id/respuestas` | Lote con `pregunta_id`, `opcion`, `marcada`, `confianza`, `version` |
| `POST /intentos/:id/entrega` | Corrección transaccional; repetir devuelve el informe sin duplicar efectos |
| `POST /intentos/:id/preguntas/:pid/solucion` | Solo con respuesta guardada y modo permitido; registra consulta |
| `GET /errores`, `/temas-frecuentes?area=A` | Cuaderno y frecuencia del banco |
| `POST /arboles` | Solicitud + pregunta de intento propio, fragmento confirmado o concepto inicial admitido |
| `GET /arboles`, `/arboles/:id` | Exploraciones propias. El detalle incluye `idea_clave` por nodo y `ultimo_rastro` (o `null`) con `camino` calculado en el servidor |
| `POST /arboles/:id/nodos/:nid/expandir` | Crea hijos pertinentes; máximo 30 nodos y profundidad 5. `idea_clave` opcional (del catálogo del concepto del árbol, si no 400) centra el hijo en esa idea y lo etiqueta |
| `POST /arboles/:id/nodos/:nid/aclarar` | Ajusta el nodo y conserva revisión anterior; no agrega ramas |
| `POST /comprobaciones` | `arbol_id`; selecciona actividad disponible aún no expuesta |
| `GET /comprobaciones/activa` | Permite retomar la comprobación |
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
- **Evidencia `corrigio_tras_error`**: un acierto sin ayuda en un árbol con algún rastro previo registra, además de `resolvio_sin_ayuda`, esta evidencia con la `idea_clave` del último rastro. Abrir o leer nodos no crea evidencias.
- **Etiquetado de nodos**: la IA puede proponer `idea_clave` (prompt `tutor-v2`, que recibe las claves permitidas). El servidor la conserva solo si pertenece al catálogo del concepto del árbol; si no, guarda `NULL` sin fallar.

Alcance: solo el flujo de conceptos de aritmética con comprobación revisada. «Mis cursos» no tiene mapas de error. El resultado no es un porcentaje de comprensión ni certifica dominio.

## Pruebas y límites pendientes

`npm run test:docker` inicia un contenedor PostgreSQL de pruebas con puerto aleatorio y un esquema propio; no reutiliza el volumen de Compose ni bases de otros proyectos. Lo elimina al finalizar. Las llamadas habituales usan `AI_PROVIDER=fake`, rotulado y prohibido en producción.

Las pruebas cubren importación repetible, actor ajeno, guardado versionado y rollback, entrega concurrente, plazos, soluciones, idempotencia IA, aclaraciones, comprobaciones, rastros de error y etiquetado de nodos, prácticas documentales, PDF válido/corrupto, borrado de derivados, CORS, JSON inválido y reinicio de la API.

No está validada todavía la calidad de respuestas con credenciales reales ni con usuarios. Faltan OCR, fuentes externas, recuperación de cuentas, edición avanzada de cursos y revisión pedagógica de las actividades. Antes de un servicio público: definir retención/respaldos, ajustar cuotas a costes reales y completar revisión de seguridad/operación. No se ha desplegado en Azure ni se configuró Vercel.
