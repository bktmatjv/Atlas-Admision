# Despliegue: API en Azure VM con CI/CD y frontend en Vercel

Objetivo: tener CALIBRA accesible públicamente para el jurado. La API y PostgreSQL corren en una VM de Azure con despliegue automático en cada push a `main`; el frontend corre en Vercel.
Rama: `chore/despliegue` desde `main` actualizado. Commits sin `Co-Authored-By` ni atribución, **y con autor y committer = la identidad git configurada del usuario (Matias), nunca «Claude»**. El push y el merge los aprueba el usuario.

## Datos y autorización del usuario

- **Destino autorizado:** VM de Azure, IP pública `68.211.137.127`, puerto SSH 22, usuario de administración.
- **Credencial autorizada:** la clave privada en `C:\Users\USUARIO\Downloads\calibra-vm_key.pem` (solo la ruta; nunca copiar su contenido a archivos, logs, commits ni secretos de GitHub).
- **Operaciones autorizadas:** preparar la VM, desplegar el backend, configurar CI/CD desde GitHub Actions y conectar Vercel.
- **Requieren aprobación explícita del usuario en el momento:** cada conexión SSH o SCP, cambios en Azure (NSG, DNS), cargar secretos y cada push.

## Arquitectura de despliegue

```text
Navegador ──HTTPS──▶ Vercel (frontend estático)
                       └─ rewrite /api/* ──HTTPS──▶ Caddy (VM :443) ──▶ API NestJS (127.0.0.1:3000) ──▶ PostgreSQL (solo red interna Docker)
GitHub (push a main) ──▶ Actions: lint + tipos + tests + build ──▶ SSH a la VM con clave de despliegue ──▶ git pull + docker compose up --build --wait + chequeo de /salud
```

**Decisión clave: Vercel reenvía `/api/*` a la VM (rewrite).** Para el navegador todo vive en el dominio de Vercel:
- La cookie de sesión es de primera parte. Si el frontend llamara directo a otro dominio, Safari y los navegadores que bloquean cookies de terceros perderían la sesión.
- No hace falta CORS entre dominios. `FRONTEND_ORIGIN` = URL de Vercel; `COOKIE_SAME_SITE=lax`.
- El frontend no necesita `VITE_API_URL` (usa `/api/v1` por defecto).

## Specs

- **S1 — Producción en Compose.** `compose.prod.yaml` (override de `compose.yaml`, sin tocar el flujo local):
  - `NODE_ENV=production`, `restart: unless-stopped` en API y base.
  - PostgreSQL **sin puerto publicado**. API solo en `127.0.0.1:3000`.
  - Servicio `caddy` (imagen oficial) en 80/443 con HTTPS automático (Let's Encrypt) hacia `backend:3000`, con volúmenes para certificados.
  - `POSTGRES_PASSWORD` fuerte, que sale del entorno de la VM y no del repo.
  - Configurar Express para confiar en el proxy (`trust proxy`) si hace falta para el protocolo y la IP real; verificarlo.
  - `Caddyfile` con el dominio tomado de una variable de entorno.
- **S2 — Dominio con HTTPS sin comprar dominio.** Usar la etiqueta DNS de la IP pública de Azure (`<etiqueta>.<región>.cloudapp.azure.com`). La configura el usuario en el portal, o la sesión le da el comando `az` para que lo apruebe. Caddy obtiene el certificado para ese nombre.
- **S3 — Red de la VM (NSG).** Abrir 80 y 443 a internet. **22 restringido a la IP del usuario** cuando sea posible; si GitHub Actions necesita SSH, documentar el compromiso (ver S5). 3000 y 5432 cerrados. Lo aplica el usuario en el portal, o la sesión con su aprobación.
- **S4 — Preparación de la VM** (script versionado `deploy/preparar-vm.sh`, idempotente, revisado antes de correrlo):
  - Docker Engine y el plugin de Compose desde el repositorio oficial de Docker.
  - Clonar el repo en `/opt/calibra` (es público; si no lo es, usar una deploy key de solo lectura).
  - Crear `backend/.env` en la VM con permisos `600`. **Las claves (Groq, Cloudflare, `POSTGRES_PASSWORD`) las escribe el usuario**, o se copian de su `backend/.env` local por SCP solo con su aprobación explícita. Nunca pasan por el repo ni por los logs.
  - Firewall del sistema operativo coherente con el NSG.
- **S5 — CI/CD en GitHub Actions** (`.github/workflows/deploy.yml`):
  - `on: push: branches: [main]`, más `workflow_dispatch` para relanzar a mano.
  - Job `verificar`: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Sin `npm audit` como bloqueante (hay 14 avisos moderados preexistentes); dejarlo como paso informativo.
  - Job `desplegar` (depende de `verificar`): SSH a la VM con una **clave de despliegue dedicada**, generada para esto y autorizada solo en `~/.ssh/authorized_keys` de un usuario de despliegue. **Nunca la `.pem` de administración del usuario.** Ejecuta un script versionado `deploy/desplegar.sh`: `git fetch` + `git reset --hard origin/main`, `docker compose -f compose.yaml -f compose.prod.yaml up -d --build --wait` y verificación de `https://<dominio>/api/v1/salud`. Si falla, el job queda en rojo.
  - `concurrency` para que dos pushes seguidos no desplieguen a la vez.
  - Secretos de GitHub: `VM_HOST`, `VM_USER`, `VM_SSH_KEY` (la clave de despliegue) y `VM_KNOWN_HOSTS` (huella del host, para no desactivar la verificación). **Los carga el usuario**, en Settings → Secrets o con `gh secret set` que él mismo ejecuta. La sesión le da los valores públicos (huella) y le indica de dónde sale la clave privada de despliegue.
  - Compromiso de SSH: los runners de GitHub usan IPs variables. Para la hackatón, dejar 22 abierto solo con clave (sin contraseña, sin root) es aceptable; documentarlo. Alternativa más cerrada para después: runner autoalojado en la VM.
- **S6 — Datos.** Las migraciones corren al arrancar, como hoy. El volumen `atlas-db` persiste entre despliegues: **nunca** `down -v` en el script ni en el workflow. Documentar un respaldo manual con `pg_dump` (comando en el README) antes de cambios riesgosos.
- **S7 — Vercel.**
  - `frontend/vercel.json` con el rewrite `/api/:path*` → `https://<dominio>/api/:path*` y fallback de la SPA (todas las rutas → `index.html`).
  - Proyecto de Vercel conectado al repo de GitHub, *root directory* `frontend`, instalación desde la raíz del monorepo si hace falta para `packages/motor`. Verificarlo con un build de prueba.
  - Rama de producción: `main`. Así Vercel despliega solo en cada push, y los PR tienen preview.
  - La integración de Vercel con este asistente **requiere autorización del usuario** (`/mcp`). Si no está, el usuario importa el repo desde el panel de Vercel con los valores que le da la sesión.
  - Después del primer deploy, `FRONTEND_ORIGIN` en la VM = URL de producción de Vercel, y redeploy de la API.
- **S8 — Verificación de punta a punta.**
  - Desde fuera: `https://<dominio>/api/v1/salud` responde (`"ia":"groq"` o `"router"`).
  - En la URL de Vercel: crear sesión, practicar, abrir el tutor, mandar un mensaje y ver respuesta real, recargar y ver que la sesión persiste.
  - Un push de prueba a `main` dispara Actions y queda en verde.
  - Capturas o salida en el Log.
- **S9 — Documentación.** Sección «Despliegue» en `README.md`: URL de la demo, cómo funciona el CI/CD, cómo relanzar, cómo ver logs (`docker compose logs`), cómo respaldar la base. Actualizar «Demo desplegada», que hoy dice «Pendiente», con la URL real. AGENTS.md §3 y §14 pasan a reflejar el despliegue real.

### Fuera de alcance

Kubernetes, balanceadores, varias réplicas, Redis, dominio propio pagado y monitoreo externo.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S1, S4, S6 (archivos en el repo) | inline | pendiente | — |
| T2 | S5 (workflow + scripts) | inline | pendiente | — |
| T3 | S7 (`vercel.json`) | inline | pendiente | — |
| T4 | S2, S3, S4 en la VM (con aprobación) | inline | pendiente | — |
| T5 | S7 conexión de Vercel + S8 | inline | pendiente | — |
| T6 | S9 | inline | pendiente | — |

## Log

- **L1 (31/10/2026, usuario):** «quiero que me ayudes a deployar estos dos, quiero que dejes encargado para deployarllo en azure en una VM y en vercel el frontend. En el caso de la VM quiero que tenga CD CI automatico cuando se haga push al main en el github, y asi ya no tener que estar haciendo tanto trabajo manual. En el frontend si no me eqiuvoco tienes conexión con Vercel, asi que si lo conectas». Datos de la VM tomados de su captura del portal de Azure: IP pública `68.211.137.127`, puerto 22, usuario de administración y clave `.pem` locales.
- **L2 (31/10/2026) — Seguridad:** el contenido de la clave privada de administración quedó expuesto en una conversación con el asistente. Recomendación: usarla solo para preparar la VM, crear la clave de despliegue dedicada para CI/CD y **rotar la clave de administración** desde Azure («Restablecer contraseña o claves») después de la hackatón.
