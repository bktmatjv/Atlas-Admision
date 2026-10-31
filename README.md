# CALIBRA

Tutor y práctica para pasar de consultar una explicación a aplicar una idea. Incluye banco de admisión UNMSM, árbol de comprensión, comprobaciones y cursos personales con material propio.

## Estructura

```text
frontend/          React + Vite; su compilación queda en frontend/dist/
backend/           API NestJS, migraciones, datos privados y Dockerfile
packages/motor/    Reglas compartidas de armado, corrección y repasos
scripts/           Herramientas del monorepo y pruebas aisladas
compose.yaml       Backend + PostgreSQL para desarrollo local
```

Se usa **npm workspaces y un solo `package-lock.json` en la raíz**. Las carpetas de dependencias y compilaciones no se versionan. Los documentos de contexto y el plan permanecen en la raíz.

## Arranque local: backend Docker, frontend separado

Requisitos: Node **22.13+** y Docker Desktop funcionando.

```bash
npm ci
docker build -t atlas-backend -f backend/Dockerfile .
docker compose up -d --wait
npm run dev:web
```

- Frontend: `http://localhost:8090`
- Salud de la API: `http://localhost:3000/api/v1/salud`
- PostgreSQL de este proyecto: `127.0.0.1:55432`; no usa otros contenedores del equipo.

El backend aplica migraciones e importa el banco al arrancar. Repetir la importación no duplica registros ni elimina progreso. Los volúmenes de PostgreSQL y documentos sobreviven a reinicios.

Para detener sin borrar datos: `docker compose down`. **No usar `down -v` salvo que se quiera eliminar expresamente los datos locales.** Las credenciales por defecto de Compose son solo para desarrollo local.

## Configuración de IA

Por defecto `AI_PROVIDER=disabled`: práctica, persistencia y extracción documental funcionan; los endpoints del tutor responden con un error explícito de configuración. No hay respuestas simuladas encubiertas.

1. Copiar `backend/.env.example` a `backend/.env`.
2. Configurar `AI_PROVIDER=anthropic`, `AI_API_KEY` y un `AI_MODEL` disponible en la cuenta.
3. Recrear el backend: `docker compose up -d --force-recreate backend`.

No introducir claves en el frontend. `AI_PROVIDER=fake` existe exclusivamente para pruebas y se identifica en pantalla; no se permite con `NODE_ENV=production`.

Para una API separada, el frontend usa `frontend/.env` con `VITE_API_URL` y el backend admite un origen explícito mediante `FRONTEND_ORIGIN`. La preparación de Vercel/Azure y la configuración final de HTTPS/cookies no forman parte de esta entrega.

## Comandos desde la raíz

| Comando | Función |
| --- | --- |
| `npm run dev:web` | Frontend con proxy local a la API en el puerto 3000 |
| `npm run dev:api` | Backend con recarga, usando `backend/.env` y una DB preparada |
| `npm run build` | Compilar motor, backend y frontend |
| `npm run typecheck` | Comprobar tipos de ambos proyectos |
| `npm run lint` | Revisar código |
| `npm run verify` | Tipos, lint, pruebas, compilación, integración Docker y auditoría npm |
| `npm test` | Pruebas de la demo y motor, sin IA de pago |
| `npm run test:docker` | Integración HTTP con un PostgreSQL Docker temporal, aislado y eliminado al finalizar |
| `npm run test:isolated` | Alternativa con binarios PostgreSQL locales o `TEST_DATABASE_URL` |
| `npm run db:migrate` | Aplicar migraciones a la DB configurada en backend |
| `npm run db:import -- --dry-run` | Comprobar el snapshot sin escribir |

Para desarrollo del backend fuera de Docker: `docker compose up -d db`, configurar `backend/.env`, ejecutar migraciones/importación y después `npm run dev:api`. No ejecutar al mismo tiempo otro backend en el mismo puerto.

## Estado y límites

Implementado: sesiones invitadas del servidor, banco persistido, prácticas/diagnóstico/simulacros, corrección y repasos, árbol con expansión/aclaración, comprobaciones numéricas y evidencias, importación privada PDF con texto/TXT/Markdown y prácticas generadas guardadas.

- Las claves y soluciones del banco están en `backend/data/`, **no** en los archivos públicos del frontend.
- «Sin ayuda» significa sin ayudas de CALIBRA durante la comprobación, no una evaluación vigilada ni una prueba de comprensión profunda. La justificación se conserva sin calificación automática.
- Material generado por IA no equivale a contenido revisado académicamente. Sus prácticas formativas no suman evidencia de transferencia verificada.
- OCR, fuentes web externas, recuperación de cuentas y sincronización entre dispositivos siguen pendientes.
- La sesión invitada dura 30 días. Todavía no hay recuperación de su credencial si se borran las cookies; definir retención operativa y copias de seguridad antes de uso público.
- Falta probar la calidad del proveedor con credenciales reales y validar con postulantes/docentes. No se garantiza ingreso ni eficacia pedagógica.

Detalles de contratos y seguridad: [backend/README.md](backend/README.md). Alcance y estado de ejecución: [PLAN_IMPLEMENTACION_ATLAS.md](PLAN_IMPLEMENTACION_ATLAS.md), sección 16.
