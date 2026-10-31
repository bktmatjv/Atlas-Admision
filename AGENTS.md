# AGENTS.md

## 1. Propósito

Este archivo orienta a los agentes que trabajan en el proyecto. La sección 14 documenta la estructura y las decisiones técnicas implementadas; prevalece sobre descripciones iniciales del estado del repositorio.

El objetivo inmediato es evolucionar la demo existente hacia una aplicación funcional con frontend React, backend NestJS y base de datos persistente. Trabajar sobre lo que ya existe, comprender los flujos implementados y completar su funcionamiento de forma incremental.

Las instrucciones explícitas del usuario tienen prioridad sobre este documento. Leer también los archivos `AGENTS.md` de los directorios donde se vaya a trabajar y respetar las convenciones existentes.

## 2. Contexto del producto

El producto se llama **CALIBRA** (decisión del equipo, 30/10/2026; antes «Atlas Admisión»), una plataforma de apoyo a postulantes a San Marcos. Los textos visibles, los prompts y la documentación usan CALIBRA. Se conservan a propósito identificadores técnicos con el nombre anterior, porque renombrarlos rompería datos o sesiones existentes: la cookie `atlas_sid`, la base y el usuario `atlas` de PostgreSQL, el proyecto y los volúmenes de Compose (`atlas`, `atlas-db`, `atlas-uploads`), los paquetes `@atlas/*`, la variable `ATLAS_LIMITE_IA`, las clases CSS `atlas-*` y el nombre del repositorio. No renombrarlos sin una migración planificada.

El lema de la identidad visual es «Aprende a pensar».

La propuesta incluye diagnóstico, práctica por curso y tema, simulacros, revisión de errores, recomendaciones y seguimiento del progreso. Estas capacidades describen la intención del producto; no asumir que todas están implementadas o que sus reglas ya están definidas.

La plataforma cuenta con el módulo de tutor y **árbol de comprensión** descrito más adelante. Su adaptador real necesita credenciales y modelo configurados en backend; las pruebas con respuestas controladas no validan la calidad de la IA real.

El problema educativo que orienta el diseño es «Aprender sin pensar»: completar actividades con ayuda de IA sin necesariamente comprenderlas. Favorecer explicaciones, participación del estudiante y aplicación independiente. No presentar el uso de IA ni la navegación por contenido como evidencia automática de aprendizaje.

## 3. Estado conocido y decisiones abiertas

### Confirmado por el usuario

- Existe una demo principal desarrollada con React.
- La demo no está implementada al 100%.
- Se necesita un backend funcional desarrollado con NestJS.
- El backend debe seguir un enfoque de monolito modular.
- Frontend, backend y base de datos deben funcionar de forma integrada.
- La arquitectura debe adaptarse a lo ya trabajado.
- Se contempla un tutor con IA y la funcionalidad de árbol de comprensión.

### Pendiente de confirmar mediante inspección o definición del producto

- Roles adicionales (docente, academia), login con proveedores externos y verificación por correo.
- Modelo concreto de Groq a usar, límites reales de su plan y calidad pedagógica con el proveedor real. El proveedor elegido es Groq (ver sección 14).
- Dominios, HTTPS y configuración final de despliegue. El usuario prevé frontend en Vercel y backend Docker en VM Azure, sin implementarlo todavía.
- Contratos definitivos de la API y módulos de negocio.
- Prioridad y criterios de aceptación de las funcionalidades incompletas.

No describir estas decisiones como ya tomadas. Resolver elecciones reversibles con criterio, registrar los supuestos y solicitar aclaración solo cuando falte una definición que cambie sustancialmente el resultado.

## 4. Antes de modificar código

1. Revisar la documentación, instrucciones locales, manifiestos, scripts y configuración existentes.
2. Identificar pantallas, componentes, rutas, estado y servicios del frontend.
3. Distinguir datos de demostración, comportamientos funcionales y funcionalidades incompletas.
4. Comprobar si ya existen backend, esquemas, integraciones o decisiones aprovechables.
5. Identificar el flujo completo afectado por la tarea y sus reglas de negocio.
6. Proponer una intervención proporcional al estado real del proyecto y ejecutarla dentro del alcance solicitado.

Preservar cambios del usuario y trabajo ajeno. No reescribir la aplicación ni reorganizar todo el repositorio para introducir el backend.

## 5. Arquitectura: monolito modular en NestJS

El backend será una aplicación NestJS desplegable como una unidad, con módulos organizados alrededor de responsabilidades de negocio.

### Límites y responsabilidades

- Los controladores gestionan transporte HTTP, validación de entrada y respuesta.
- Los servicios coordinan casos de uso y reglas de negocio.
- El acceso a datos se concentra en componentes de persistencia con responsabilidades claras.
- Los módulos exponen contratos explícitos para colaborar entre sí.
- Un módulo no debe manipular arbitrariamente la persistencia interna de otro.
- Evitar dependencias circulares y módulos de utilidades que acumulen lógica de negocio.
- Usar transacciones cuando un caso de uso requiera varias escrituras atómicas.
- Mantener la integración con el proveedor de IA detrás de una interfaz propia del backend.

Aplicar estas separaciones sin crear capas o interfaces vacías para cada operación. La complejidad debe responder a necesidades reales.

### Módulos candidatos, sujetos a los flujos existentes

| Área | Responsabilidad posible |
| --- | --- |
| Identidad y acceso | Usuarios, sesiones y permisos, si forman parte del alcance. |
| Contenido académico | Cursos, temas, preguntas y explicaciones. |
| Práctica y evaluación | Sesiones, intentos, respuestas y resultados. |
| Seguimiento | Errores, repasos y evidencias de progreso. |
| Tutor | Conversaciones, contexto educativo y ayudas. |
| Árbol de comprensión | Raíz, nodos, relaciones y exploraciones guardadas. |

Esta tabla no obliga a crear seis módulos independientes. Unir o separar responsabilidades según su cohesión; el árbol puede comenzar dentro del módulo del tutor.

No introducir microservicios, un broker de mensajes, CQRS, event sourcing, múltiples bases o infraestructura distribuida sin una necesidad concreta.

## 6. Base de datos y persistencia

- Reutilizar decisiones existentes si son compatibles con el objetivo del proyecto.
- Si no hay una elección, considerar PostgreSQL como punto de partida para los datos relacionales. Documentar la decisión antes de extender el esquema.
- Elegir una sola herramienta principal de acceso a datos. Evaluar las convenciones y dependencias existentes antes de incorporar Prisma, TypeORM u otra alternativa.
- Versionar cambios de esquema mediante migraciones; evitar sincronización destructiva automática.
- Mantener restricciones, relaciones e índices acordes con las consultas y reglas reales.
- Separar datos de desarrollo de datos reales y hacer reproducibles los datos iniciales cuando sean necesarios.
- Persistir el estado funcional que deba sobrevivir a reinicios; el estado de React o el almacenamiento del navegador no sustituyen la persistencia del servidor.
- Usar identificadores y contexto de usuario o sesión emitidos y validados por el backend.

No ejecutar borrados masivos, reinicializaciones o migraciones destructivas sobre datos que deban conservarse sin autorización explícita.

## 7. Integración con React

- Conservar el diseño y los comportamientos útiles de la demo.
- Centralizar las llamadas al backend siguiendo el patrón ya existente o introducir uno sencillo si no existe.
- Configurar la URL de la API mediante variables de entorno.
- Definir contratos de entrada y salida claros, tipados cuando el proyecto lo permita.
- Gestionar carga, ausencia de datos, errores y reintentos apropiados.
- Reemplazar los datos simulados del flujo trabajado por peticiones reales de manera progresiva.
- Conservar datos de demostración únicamente cuando sean necesarios y estén identificados como tales.
- Mantener reglas y validaciones autoritativas en el backend. El frontend puede validar para mejorar la experiencia, pero no decide permisos ni integridad de datos.
- Configurar CORS para los orígenes necesarios y respetar el mecanismo de autenticación seleccionado.

Un flujo integrado debe funcionar de extremo a extremo: interacción en React, petición a NestJS, validación, persistencia y representación del resultado real.

## 8. Tutor con IA: orientación inicial

### Referencia de experiencia

El usuario menciona el tutor de DataCamp como inspiración. Las funciones siguientes son adaptaciones propuestas para este producto; no constituyen un inventario verificado de las funciones actuales de DataCamp. No se requiere integración con ese servicio ni reproducción de su interfaz.

### Funcionalidades iniciales propuestas

1. **Ayuda contextual:** comprender el tema, ejercicio o nodo que el estudiante está revisando, junto con su intento y las ayudas ya recibidas cuando estén disponibles.
2. **Pistas graduales:** ofrecer una orientación concreta antes de ampliar la ayuda, ajustando el apoyo a la dificultad expresada.
3. **Explicaciones bajo demanda:** explicar un concepto, un paso, un término o el motivo de una respuesta, con ejemplos pertinentes.
4. **Retroalimentación sobre intentos:** comentar la respuesta y su justificación, señalando qué está bien y qué requiere revisión cuando exista evidencia suficiente.
5. **Preguntas de seguimiento:** permitir aclaraciones como «¿por qué?», «más sencillo» o «otro ejemplo», conservando el contexto relevante.
6. **Aplicación breve:** proponer, cuando aporte valor, una variante, una predicción o una justificación para comprobar el uso del concepto.

### Comportamiento pedagógico

- Ayudar a avanzar sin imponer un interrogatorio en cada interacción.
- Permitir «no sé por dónde empezar» y responder con un apoyo accesible.
- Proporcionar una explicación completa cuando sea necesaria o solicitada; acompañarla de oportunidades de aplicación apropiadas.
- Diferenciar una explicación consultada de una respuesta aplicada de forma independiente.
- No atribuir una causa a un error sin evidencia suficiente.
- Ajustar lenguaje y profundidad a lo observado o indicado por el estudiante, sin inventar diagnósticos.
- Comunicar incertidumbre y distinguir las explicaciones generadas del contenido académico revisado.
- Evitar promesas de dominio, resultados académicos o ingreso.

## 9. Árbol de comprensión

### Definición

Funcionalidad del tutor que transforma un tema, pregunta o dificultad en un árbol explorable de información conectada.

- La raíz representa la solicitud principal y ofrece una explicación inicial breve.
- Cada hijo desarrolla una idea pertinente: aclaración, subpregunta, ejemplo, contraste, conexión o aplicación.
- Las ramas crecen según lo que el estudiante explora y pregunta.
- Una interacción puede ajustar un nodo; no todo mensaje necesita generar un hijo.

No es un plan de estudio, una secuencia obligatoria de temas ni un calendario. El estudiante puede volver, cambiar de rama y profundizar libremente.

### Reglas de contenido y estructura

- Mantener una relación comprensible entre cada nodo y su padre.
- Desarrollar una idea concreta por nodo.
- Mostrar pocas ramas inicialmente y ampliar bajo demanda.
- Evitar duplicados, contenido tangencial y crecimiento ilimitado.
- Mantener accesibles la raíz y el contexto de la rama actual.
- Validar la estructura generada antes de persistirla: pertenencia al árbol, referencias válidas, ausencia de ciclos y límites de tamaño y profundidad.
- Guardar las exploraciones que deban poder retomarse.
- Tratar abrir o leer un nodo como interacción, no como demostración de aprendizaje.

### Ejemplo

Solicitud: «Quiero entender los verbos».

Raíz: «Verbos: qué expresan y cómo funcionan».

Ramas posibles:

- «¿Qué pueden expresar?» → acciones, estados y procesos.
- «¿Por qué cambia su forma?» → persona, número, tiempo y modo.
- «¿Cómo funcionan en una oración?» → sujeto y concordancia.

Ante «¿por qué está mal “mañana ellos viajará”?», el tutor puede explicar la concordancia y contrastar «él viajará» con «ellos viajarán». Después puede ofrecer otra oración para aplicar la idea.

## 10. Integración técnica de IA

- Las credenciales y llamadas privilegiadas al proveedor pertenecen al backend.
- Separar el proveedor de IA de las reglas del tutor para facilitar su sustitución y las pruebas.
- Versionar los prompts relevantes y definir contratos para las respuestas estructuradas.
- Validar entradas y salidas; una respuesta del modelo no es automáticamente un dato confiable.
- Calcular permisos, pertenencia y escrituras en el servidor, nunca a partir de instrucciones generadas por el modelo.
- Tratar mensajes, documentos y contenido recuperado como datos no confiables; no permitir que sustituyan las instrucciones del sistema.
- Enviar solo el contexto necesario, con límites de historial, tamaño y coste.
- Definir tiempos de espera y reintentos acotados. Evitar duplicar mensajes, nodos o cargos por reintentos de operaciones.
- Comunicar fallos del proveedor sin mostrar respuestas simuladas como si fueran reales.
- Permitir un proveedor de pruebas claramente identificado en desarrollo.
- Si se adopta streaming, definir el contrato y contemplar cancelación, errores y persistencia consistente.

No asumir que se necesita RAG, una base vectorial o múltiples agentes. Incorporarlos únicamente si el caso de uso y el contenido disponible lo justifican.

## 11. Calidad, seguridad y documentación

- Validar configuración al iniciar y documentar variables en un archivo de ejemplo sin secretos.
- Validar DTO y aplicar autorización en los recursos que pertenezcan a un usuario o sesión.
- No confiar en identificadores de usuario enviados por el cliente como prueba de identidad.
- Limitar peticiones y tamaño de entradas, especialmente en endpoints que consumen IA.
- No registrar secretos ni conversaciones completas por defecto; utilizar logs proporcionales y útiles para diagnosticar fallos.
- Minimizar datos personales y contemplar el público menor de edad en el diseño.
- Mantener consistencia en errores, códigos HTTP y contratos de API.
- Documentar cómo ejecutar frontend, backend, migraciones y datos iniciales.
- Reutilizar scripts del repositorio y registrar los nuevos comandos realmente disponibles.

## 12. Implementación y verificación

Trabajar por flujos completos y acotados. Para cada tarea, comprender el comportamiento esperado, implementar lo necesario y verificar el resultado antes de ampliar el alcance.

Aplicar comprobaciones proporcionales al cambio:

- Compilación, tipos y lint según los scripts existentes.
- Pruebas de reglas de negocio significativas.
- Pruebas de integración para persistencia, contratos o permisos cuando corresponda.
- Verificación del flujo afectado en la interfaz cuando sea posible.
- Pruebas de los contratos de IA con respuestas controladas, incluyendo resultados inválidos y fallos del proveedor.

Evitar llamadas a modelos de pago como requisito de las pruebas automáticas habituales. Un contrato técnicamente válido no acredita la calidad pedagógica de una respuesta; revisar también ejemplos representativos.

No afirmar que una funcionalidad está terminada si solo existe su interfaz, un endpoint simulado o una respuesta fija. Indicar con precisión qué está conectado, qué se verificó y qué permanece pendiente.

Al terminar una tarea, resumir el cambio, la validación realizada, los supuestos relevantes y las limitaciones que afecten al usuario o al siguiente agente.

## 13. Ampliación de estas instrucciones

Este archivo establece la base del proyecto. Completarlo conforme se confirmen módulos, historias de usuario, reglas de negocio, arquitectura de datos, proveedor de IA y criterios de aceptación.

Mantenerlo coherente con el repositorio. No convertir propuestas exploratorias en requisitos obligatorios ni documentar como implementadas funciones que todavía no existen.

## 14. Estructura y decisiones implementadas (30/10/2026)

- Monorepo npm workspaces: `frontend/` (React/Vite), `backend/` (NestJS independiente) y `packages/motor/` (reglas compartidas). Un solo `package-lock.json` en la raíz. La separación de carpetas fue solicitada explícitamente por el usuario.
- Base PostgreSQL 16 en Docker; TypeORM 0.3 y migraciones, nunca `synchronize: true`. Node 22.13+; validación Zod y pruebas Vitest. Las dependencias de interfaz pertenecen al workspace frontend.
- `backend/data/` contiene los snapshots privados del banco y metadatos. Los gráficos públicos pertenecen a `frontend/public/graficos/`. No volver a publicar JSON con claves en `public/` ni en `frontend/dist/`.
- `frontend/src/integrations/api/` centraliza HTTP. Los módulos antiguos llamados Supabase/local se conservan para tipos y pruebas de regresión; no son un backend alternativo ni un fallback silencioso de la aplicación.
- Sesiones con cookie HttpOnly y hash del token en servidor; autorización por actor. Se puede seguir como invitado o crear una cuenta (usuario y contraseña, sin correo) que vincula el actor invitado actual y no pierde su progreso. La contraseña usa `scrypt` y la recuperación es un código de un solo uso que se muestra una sola vez; ingresar o registrarse rota la sesión. Un invitado que borra sus cookies no recupera nada; con cuenta, sí. Los endpoints `/cuenta/*` tienen límite por IP y por usuario. El perfil admite etapa, universidad, carrera, objetivos y cursos difíciles (API lista); la interfaz de onboarding y el inicio por perfil siguen pendientes y los resuelve el equipo de interfaz. El tutor recibe del perfil solo un resumen sin credenciales.
- Backend por módulos de identidad, contenido/documentos, práctica, tutor y seguimiento. El acceso SQL se concentra en `Database`, que normaliza la forma de los resultados del driver. No tratar un array vacío devuelto por UPDATE como registro encontrado.
- Proveedor de IA (decisión del usuario, 30/10/2026): **Groq** como proveedor principal, mediante su API compatible con OpenAI (`AI_PROVIDER=groq`). El tutor y su ciclo agente son independientes del proveedor: las reglas, herramientas y validaciones viven en el backend y cada proveedor es un adaptador detrás de una interfaz propia. Se conserva el adaptador Anthropic como alternativa (`AI_PROVIDER=anthropic`). `AI_MODEL` y `AI_API_KEY` solo en backend; no fijar un nombre de modelo en el código. `disabled` devuelve error explícito, `fake` es exclusivo de pruebas y se prohíbe en producción. No reutilizar credenciales del harness (Codex, Claude Code u otras herramientas de desarrollo) para activar el tutor.
- Router de modelos (`AI_PROVIDER=router`): parte de la capa de proveedores, no un módulo aparte. `RouterIA` (`backend/src/modules/tutor/router.ts`) es un `ProveedorIA` que recorre una cadena configurable (`AI_CADENA`, `proveedor:modelo`) y pasa al siguiente destino (Groq, Cloudflare Workers AI o Microsoft Foundry mediante su API v1 compatible con OpenAI; `FOUNDRY_ENDPOINT`/`FOUNDRY_API_KEY`, el despliegue va en `AI_CADENA` como `foundry:<despliegue>`) cuando uno agota su cuota o falla, con reintento acotado, disyuntor por destino y semáforo por destino, todo en memoria (una sola instancia; sin Redis). Mantiene las reglas de §10: sin nombres de modelo fijos en el código, credenciales solo en el backend (`GROQ_API_KEY`, `CLOUDFLARE_*`), logs sin prompts ni mensajes del estudiante y fallos comunicados sin simular respuestas. La validación del contenido sigue en el agente y `TutorAI`. Cada turno guarda el destino que respondió (`mensajes.destino_ia`) y `/api/v1/salud` muestra el estado de los destinos. `groq`, `anthropic`, `fake` y `disabled` conservan su comportamiento. Plan en `odd/tasks/llm-router.md`.
- Tutor agente: diseño en `diseno_tutor_agente.md`, plan en `odd/tasks/tutor-agente.md`. El LLM conversa, interpreta y propone; el sistema valida, corrige lo calculable y decide qué queda demostrado. El estado de los nodos del grafo se deriva de la evidencia, nunca de lo que escriba el modelo.
- Documentos: originales privados, extracción en worker con memoria/tiempo limitados, trabajos persistidos con lease y referencias a fragmentos. PDF con texto/TXT/Markdown; OCR y fuentes web externas siguen pendientes. Un visto bueno del alumno a la extracción no equivale a revisión académica.
- `compose.yaml` es para desarrollo local: API en `127.0.0.1:3000`, PostgreSQL en `127.0.0.1:55432`; no intervenir en contenedores de otros proyectos. No ejecutar `down -v` sobre datos que deban conservarse.
- Arranque: `npm ci`, `docker compose up --build -d --wait`, `npm run dev:web`. Backend y frontend se despliegan separados; la API no sirve la SPA.
- Antes de cerrar cambios: `npm run verify`. Incluye lint, tipos, 390 pruebas de regresión, build, integración con PostgreSQL Docker temporal y auditoría npm. Los conteos pueden crecer; confirmar siempre el resultado real del comando.
- Consultar `README.md`, `backend/README.md` y la sección 16 de `PLAN_IMPLEMENTACION_ATLAS.md` para límites y estado verificado. Tener tests verdes no equivale a validación con estudiantes ni a despliegue público.
