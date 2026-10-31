# CALIBRA

**Un tutor con IA que no te da la respuesta: te ayuda a encontrar dónde se rompió tu razonamiento.**

Plataforma para postulantes a la Universidad Nacional Mayor de San Marcos (UNMSM). Combina práctica con preguntas de admisiones anteriores, un tutor conversacional y un **grafo de comprensión** que muestra qué ideas exploraste, dónde fallaste y qué ya aplicaste por tu cuenta.

> **Estado actual:** MVP funcional en entorno local, con frontend React, API NestJS y PostgreSQL integrados. La demo pública y la validación con postulantes siguen **pendientes** (ver [Limitaciones](#limitaciones-actuales)).

---

## 🎯 Problema y solución

### El problema: «aprender sin pensar»

Los estudiantes ya usan IA para estudiar, pero leer una explicación convincente no es lo mismo que poder resolver un problema nuevo.

- El reporte 2025 de uDocz sobre educación superior peruana, reseñado por la UPC, reporta que **el 95% de los estudiantes universitarios encuestados usa IA** para estudiar ([uDocz](https://www.udocz.com/academic_report), [UPC](https://innovacioneducativa.upc.edu.pe/2025/10/13/el-impacto-de-la-ia-en-la-educacion-superior-peruana-hallazgos-y-aprendizajes-del-primer-estudio-2025-2/)). Es una muestra de universitarios, no un censo nacional ni un dato de postulantes.
- Un estudio en PNAS con cerca de mil escolares encontró que un asistente general basado en GPT-4 mejoró el desempeño **durante** la práctica, pero el rendimiento posterior **sin IA** fue un 17% inferior al del grupo de control; un tutor con salvaguardas pedagógicas mitigó ese perjuicio ([PNAS](https://doi.org/10.1073/pnas.2422633122)). Es un estudio de matemáticas, en una escuela y a corto plazo.

El estudiante se queda con la sensación de haber entendido. En el examen, sin ayuda, aparece la diferencia.

### La solución: separar lo que leíste de lo que puedes resolver solo

CALIBRA usa la IA para **conversar y hacer pensar**, no para entregar respuestas, y deja la verdad sobre el progreso en manos del sistema:

1. **Practicas** con preguntas reales de admisiones anteriores.
2. Cuando fallas, el sistema **rastrea tu error hasta la idea que lo explica**. Por ejemplo, responder 100 en «S/100 sube 20% y baja 20%» indica que tomaste la misma base para los dos porcentajes.
3. El **tutor conversa** contigo sobre tu razonamiento: te pregunta por qué, contrasta tu cálculo con el correcto y te muestra diagramas verificados.
4. Lo **compruebas** con un problema nuevo, sin ayudas del tutor.
5. Tu **grafo de comprensión** se actualiza **solo con evidencia**: practicar en la charla no pinta nada de verde; resolver una variante nueva sin ayuda, sí.

> **La IA aporta la conversación; el sistema aporta la verdad.**

---

## ✅ Funcionalidades implementadas

| Funcionalidad | Qué hace | Estado |
| --- | --- | --- |
| Práctica de admisión | 2.027 preguntas de 26 exámenes UNMSM anteriores; práctica por curso y tema, diagnóstico y simulacros cronometrados; corrección en el servidor | ✅ Funciona |
| Cuaderno de errores | Repasos espaciados (sistema Leitner) de las preguntas falladas | ✅ Funciona |
| Rastro de error | Cada respuesta incorrecta conocida apunta a una «idea clave»; el sistema resalta el nodo donde se rompió la comprensión y escala la ayuda (pista → ejemplo → explicación completa) | ✅ Funciona |
| Tutor agente | Conversación con un LLM que usa herramientas del sistema (leer tu grafo, tu rastro, tus evidencias y tu intento; generar prácticas; proponer comprobaciones) | ✅ Funciona con Groq |
| Artefactos del tutor | 10 tipos de bloque: pregunta socrática, contraste «lo que hiciste / lo correcto», razonamiento anotado, predicción, ejemplo paso a paso, visual matemático, práctica, «explícalo con tus palabras», invitación a comprobar y cita | ✅ Funciona |
| Visuales verificados | Cadena porcentual, barra de partes, tabla de proporción y recta numérica; el sistema recalcula cada cuenta antes de mostrarla | ✅ Funciona |
| Grafo de comprensión | Vista tipo Obsidian de tus ideas y sus relaciones; estado de cada nodo (sin explorar, explorado, falló, aplicado) calculado desde la evidencia | ✅ Funciona |
| Comprobaciones | 7 actividades curadas y, cuando se agotan, problemas generados por plantillas paramétricas con respuesta calculada por el sistema | ✅ Funciona (Aritmética: porcentajes, proporciones y fracciones) |
| Mis cursos | Importas un PDF con texto, TXT o Markdown; se extrae por páginas y el tutor lo cita | ✅ Funciona (sin OCR) |
| Sesión invitada | Sin registro: cookie segura de 30 días | ✅ Funciona |

---

## 🧭 Cómo usarlo

Con el proyecto levantado (ver [Instrucciones de ejecución](#-instrucciones-de-ejecución)):

1. Abre `http://localhost:8090/admision` y resuelve una práctica.
2. En una pregunta fallada, usa **«Entender esta pregunta con CALIBRA»** para abrir el tutor sobre tu propio intento.
3. En `http://localhost:8090/tutor`, conversa con el tutor: prueba «No sé por dónde empezar» o explícale cómo lo pensaste.
4. Pide **comprobar** cuando quieras: te toca un problema nuevo, sin ayudas.
5. Mira cómo cambia tu **grafo de comprensión** según lo que realmente resolviste.

| Ruta | Pantalla |
| --- | --- |
| `/admision` | Inicio y práctica de admisión |
| `/admision/temas` | Temario oficial |
| `/tutor` | Tutor conversacional y grafo de comprensión |
| `/aprender` | Exploraciones y árbol de comprensión |
| `/cursos` | Mis cursos (material propio) |

---

## ⚙️ Arquitectura y tecnologías

```text
React + Vite ──HTTP──▶ API NestJS (monolito modular) ──▶ PostgreSQL 16
                               │
                               └──▶ Proveedor de IA (Groq, o un router con failover Groq/Cloudflare) detrás de una interfaz propia
```

| Capa | Tecnología |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind, TanStack Query, `react-force-graph-2d` para el grafo |
| Backend | NestJS, TypeORM 0.3 (migraciones), validación con Zod, Node 22 |
| Base de datos | PostgreSQL 16 |
| IA | Groq (API compatible con OpenAI) por defecto; router opcional que pasa al siguiente modelo (Groq o Cloudflare Workers AI) cuando uno agota su cuota o falla; adaptador Anthropic como alternativa; proveedor de pruebas para tests |
| Infraestructura local | Docker Compose para API y base de datos |
| Pruebas | Vitest, integración con PostgreSQL real en Docker |

**Módulos del backend:** identidad (sesión invitada), contenido (banco y documentos), práctica (intentos y corrección), tutor (agente, artefactos, proveedor de IA) y seguimiento (rastros, evidencias, grafo y plantillas).

**Decisiones técnicas clave:**

- **El LLM propone, el sistema decide.** El agente emite mensajes, bloques y operaciones sobre el grafo; el servidor valida cada uno en cinco capas (forma, referencias, matemática, atribución al estudiante y filtración de respuestas) y descarta lo que no pasa.
- **El estado de comprensión sale de la evidencia**, nunca de lo que escriba el modelo.
- **Ejercicios verificables:** las plantillas paramétricas generan los números, la respuesta y los distractores (cada uno ligado a una idea clave); la IA solo redacta la historia.
- **Lecturas provisionales honestas:** cuando la IA interpreta un texto libre del estudiante, debe citarlo literalmente; si la cita no existe en lo que escribió, la lectura se descarta.
- **Independiente del proveedor:** cambiar de Groq a otro modelo es cambiar una variable de entorno.
- **Seguridad:** sesiones con cookie HttpOnly y token con hash en el servidor, autorización por estudiante, las claves del banco nunca llegan al navegador, límites de uso para la IA.

Más detalle: [backend/README.md](backend/README.md) · [diseño del tutor agente](diseno_tutor_agente.md) · [harness de comprensión](idea_tutor_harness_comprension.md).

---

## Tutor: diseño para la demo

En `/tutor?demo=1` se amplían los textos principales y se ralentizan las animaciones; no cambia la corrección ni los datos. El panel lateral permite abrir artefactos, redimensionarlo con teclado y explorar el grafo; en móvil es una hoja con tres alturas. La bienvenida y la identidad visual de `feat/ui-calibra-completa` están integradas; la mascota se conserva fuera del tutor para no tapar sus controles.

La retropropagación solo usa aristas y rastros existentes: sin idea o camino verificable no se anima. «Lo explicaste» y «Practicaste» quedan deshabilitadas porque la API no publica el historial necesario. El antes/después exige ambas evidencias guardadas. No se inventa un indicador de failover: el contrato del turno no lo informa explícitamente.

Las capturas de `npm run test:tutor-ui` se guardan en `.atl/` (ignoradas por Git). Las pruebas de interfaz usan transporte simulado identificado; no prueban la calidad del modelo real ni el despliegue público.

## Cuenta y perfil

Puedes seguir como invitado o crear una cuenta con usuario y contraseña, sin correo. Al registrarte conservas todo lo que hiciste como invitado, y recibes un **código de recuperación de un solo uso** que se muestra una vez: guárdalo. En la cabecera aparecen «Ingresar» y «Crear cuenta»; con cuenta, un menú con tu usuario y «Salir». El perfil ampliado (etapa, universidad, carrera, objetivos y cursos difíciles) ya existe en la API y el tutor lo usa para ajustar ejemplos y nivel, pero **la pantalla de onboarding y el inicio adaptado por perfil están pendientes** (los hace el equipo de interfaz).

Solo se guardan esos datos: no se piden nombre completo, fecha de nacimiento, DNI, colegio ni correo. «Borrar mis datos» elimina también la cuenta.

## 🔗 Demo desplegada

**Pendiente.** Todavía no hay una URL pública. El despliegue previsto es el frontend en Vercel y el backend en Docker sobre una VM de Azure.

---

## 📖 Instrucciones de ejecución

Requisitos: Node **22.13+** y Docker Desktop funcionando.

```bash
npm ci
docker compose up --build -d --wait
npm run dev:web
```

- Frontend: `http://localhost:8090`
- Salud de la API: `http://localhost:3000/api/v1/salud`

El backend aplica las migraciones e importa el banco al arrancar. Repetir la importación no duplica registros ni borra progreso.

Para detener sin borrar datos: `docker compose down`. **No usar `down -v`**, que elimina los datos locales.

### Configurar la IA (Groq)

Sin configuración, `AI_PROVIDER=disabled`: la práctica funciona y el tutor responde con un error explícito, nunca con respuestas simuladas.

1. Copia `backend/.env.example` a `backend/.env`.
2. Configura `AI_PROVIDER=groq`, tu `AI_API_KEY` de Groq y un `AI_MODEL` disponible en tu cuenta.
3. Recrea el backend: `docker compose up -d --force-recreate backend`.

Las claves van **solo** en el backend.

#### Varios modelos con respaldo (router)

Si un modelo agota su límite o falla, el tutor puede pasar solo al siguiente de una cadena (modelos de Groq y, como respaldo, Cloudflare Workers AI). En `backend/.env`:

1. `AI_PROVIDER=router`
2. `AI_CADENA=groq:<modelo 1>,groq:<modelo 2>,cloudflare:<modelo>` (se prueba en ese orden)
3. `GROQ_API_KEY`, y `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN` si la cadena incluye Cloudflare.
4. Recrea el backend: `docker compose up --build -d --force-recreate --wait backend`.

El estado de cada modelo (cerrado, abierto hasta cuándo, ocupado) se ve en `curl http://127.0.0.1:3000/api/v1/salud`. Detalles, variables y cómo funciona el failover en `backend/README.md`. Con `AI_PROVIDER=groq` todo sigue funcionando como antes.

### Comandos útiles

| Comando | Función |
| --- | --- |
| `npm run dev:web` | Frontend con proxy a la API local |
| `npm run dev:api` | Backend con recarga (requiere `backend/.env` y una base preparada) |
| `npm run build` | Compilar motor, backend y frontend |
| `npm test` | Pruebas unitarias, sin llamadas a IA de pago |
| `npm run test:docker` | Integración con un PostgreSQL temporal en Docker |
| `npm run test:tutor-ui` | Navegador Chromium aislado: tutor, panel, móvil, movimiento reducido y bienvenida; sin llamadas a IA |
| `npm run verify` | Lint, tipos, pruebas, build, integración y auditoría de dependencias |

### Estructura

```text
frontend/          React + Vite
backend/           API NestJS, migraciones, datos privados y Dockerfile
packages/motor/    Reglas compartidas de armado, corrección y repasos
scripts/           Herramientas del monorepo y pruebas aisladas
compose.yaml       API + PostgreSQL para desarrollo local
```

---

## 🧪 Calidad

- **477 pruebas** en el frontend y el motor compartido, y **310 pruebas** del backend, incluidas pruebas de integración con PostgreSQL real.
- Cada artefacto del tutor tiene tres niveles de prueba: validador (acepta lo válido, descarta lo inválido con su motivo), integración con la API y render en la interfaz.
- Las pruebas automáticas nunca llaman a la IA real: los adaptadores de Groq y Cloudflare y el router de modelos se prueban con respuestas simuladas, incluidos errores, límites de uso (HTTP 429), timeouts y failover entre modelos.

---

## Limitaciones actuales

- **Sin demo pública:** el despliegue en Vercel y Azure está pendiente.
- **Sin validación con usuarios reales todavía:** no hay evidencia de eficacia pedagógica; no se promete ingreso ni mejora de puntaje.
- **«Sin ayuda» significa sin ayudas de CALIBRA** durante la comprobación. No es una evaluación vigilada: no se detecta ayuda externa.
- **Cobertura del tutor:** las ideas clave, el mapa de errores y las plantillas cubren solo Aritmética (porcentajes, proporciones y fracciones). Los enunciados de las plantillas no tienen revisión docente; sus cuentas sí están verificadas.
- **Calidad de la IA:** se probó con casos reales en Groq, pero los modelos abiertos pueden usar herramientas con menos consistencia; las validaciones descartan o degradan lo que falle. El plan gratuito de Groq tiene límites por minuto y por día; el router de modelos reparte la carga entre varios modelos, pero no está probado con las APIs reales ni se verificó qué modelos de Cloudflare con herramientas están disponibles en su plan gratuito.
- **Material generado por IA** no equivale a contenido revisado académicamente y no cuenta como evidencia.
- **Mis cursos:** sin OCR para PDF escaneados ni búsqueda en fuentes externas.
- **Cuentas:** sin cuenta, la sesión invitada dura 30 días y no se recupera si se borran las cookies. Con cuenta (usuario y contraseña) sí se retoma desde otro dispositivo; no hay correo, así que perder la contraseña y el código de recuperación significa perder la cuenta. No hay login con Google ni verificación de identidad.
- **Dependencias:** `npm audit` reporta 14 avisos moderados en herramientas de desarrollo (ESLint) y en TypeORM, pendientes de actualizar.
