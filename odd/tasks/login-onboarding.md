# Login y onboarding: reconocer al estudiante y adaptar sus herramientas

Objetivo: que CALIBRA sepa quién es el estudiante (cuenta propia) y en qué contexto aprende (postulante UNMSM, universitario, escolar u otro), para mostrarle las herramientas adecuadas y darle ese contexto al tutor, con una entrada más clara y coherente con el diseño CALIBRA.
Rama: `feat/login-onboarding` desde `main` actualizado. Commits sin `Co-Authored-By` ni atribución, con la identidad git del usuario. Runner: Vitest; cierre con `npm run verify`.

## Punto de partida (verificado en el código)

- **No existe login.** Hay sesión invitada: cookie HttpOnly `atlas_sid`, hash del token en el servidor y todo el progreso ligado a un `actor` (`backend/src/modules/identidad/identidad.ts`).
- **Perfil:** `GET/PUT /api/v1/perfil` (`backend/src/modules/contenido/contenido.ts`) guarda un JSON en `perfiles` (hoy con `carrera_id`, validado contra `carreras`).
- **Catálogo UNMSM:** carreras, áreas y procesos ya importados; `TuCarrera.tsx` ya permite elegir la carrera dentro de Admisión.
- **Bienvenida:** `WelcomeScreen` (del rediseño del compañero) se muestra una vez por pestaña (`sessionStorage`) antes del router.
- Si un compañero ya tiene un login hecho en otra rama, **se integra ese trabajo en lugar de rehacerlo** (ver D1).

## Specs

### Cuenta

- **S1 — La cuenta mejora la sesión invitada, no la reemplaza.** Crear una cuenta **vincula el actor invitado actual** a credenciales: el estudiante no pierde nada de lo que hizo antes de registrarse (intentos, árboles, conversaciones, evidencias). Iniciar sesión en otro dispositivo emite una sesión nueva para ese mismo actor. Seguir como invitado sigue siendo posible.
- **S2 — Método de acceso** (decisión D1, propuesta por defecto):
  - **Usuario (alias) y contraseña, sin correo obligatorio**, con un **código de recuperación** de un solo uso que se muestra una vez al registrarse (el estudiante lo guarda). Pensado para el público, que puede ser menor de edad, y porque no hay un servicio de correo configurado.
  - Contraseñas con `scrypt` de `node:crypto` (sin dependencias nuevas), sal por usuario y comparación en tiempo constante.
  - Tabla nueva `cuentas (actor_id UNIQUE, usuario UNIQUE en minúsculas, hash, recuperacion_hash, created_at)`, en una migración aditiva.
  - Endpoints: `POST /cuenta/registro`, `POST /cuenta/ingreso`, `POST /cuenta/salida`, `POST /cuenta/recuperar` (código más contraseña nueva, rota el código) y `GET /cuenta`.
  - Al ingresar o registrarse se **rota la sesión**: token nuevo y se invalida el anterior.
- **S3 — Seguridad.**
  - Errores genéricos («Usuario o contraseña incorrectos») que no revelan si el usuario existe.
  - Límite de intentos por IP y por usuario con el throttler existente.
  - Contraseña de al menos 8 caracteres; usuario de 3 a 30 caracteres `[a-z0-9_.]`.
  - Nunca registrar contraseñas, hashes ni códigos en logs. Cookies como hoy (HttpOnly, Secure en producción, SameSite lax detrás del rewrite de Vercel).
  - El encabezado `X-Calibra-Request` y la comprobación de origen siguen aplicando a estos endpoints.
- **S4 — Datos mínimos.** No pedir nombre completo, fecha de nacimiento, DNI, colegio ni correo obligatorio. «Borrar mis datos» (ya existe para la sesión) elimina también la cuenta.

### Onboarding

- **S5 — Flujo de entrada.**
  `Bienvenida (existente) → ¿Tienes cuenta? [Ingresar | Crear cuenta | Seguir como invitado] → Onboarding (si el perfil no está completo) → Inicio adaptado`.
  El onboarding aparece una sola vez por actor (marcado en el perfil, no en el navegador), se puede saltar y se edita después desde «Mi perfil».
- **S6 — Preguntas del onboarding** (3 o 4 pasos, uno por pantalla, con progreso visible):
  1. **¿En qué etapa estás?** Postulante, universitario, escolar (5.º de secundaria o antes), otro.
  2. **Si es postulante:** ¿a qué universidad? (UNMSM es la única con soporte completo; las demás se registran como texto y se informa qué funciones aplican). Para UNMSM: **área y carrera** desde el catálogo existente (reutilizar la lógica de `TuCarrera`) y proceso objetivo (de `procesos`).
  3. **Si es universitario:** carrera o curso que lleva, en texto libre corto, y el sugerido es empezar por «Mis cursos».
  4. **Qué quiere lograr ahora** (selección múltiple corta): entender un tema, prepararse para el examen, revisar errores, estudiar mi propio material.
  5. **Cursos donde siente más dificultad** (opcional): chips del temario.
- **S7 — Perfil ampliado.** `PUT /perfil` acepta, validado con zod, `etapa`, `universidad`, `area`, `carrera_id` (ya existe), `proceso`, `objetivos[]`, `cursos_dificiles[]`, `carrera_texto` y `onboarding_completo`. Los valores del catálogo se validan contra la base, igual que `carrera_id` hoy. Las llamadas actuales siguen funcionando.

### Herramientas adecuadas

- **S8 — Inicio y navegación adaptados al perfil** (reglas en el frontend, simples y explícitas, en una función pura con tests):
  - **Postulante UNMSM:** inicio con la acción recomendada de Admisión, simulacros, tutor e «¿Ingresaba?» de su carrera.
  - **Postulante a otra universidad:** tutor, práctica por tema y Mis cursos; las funciones exclusivas de UNMSM se muestran como «solo para San Marcos».
  - **Universitario:** tutor y Mis cursos primero; Admisión queda accesible, pero no protagonista.
  - **Escolar u otro:** tutor y práctica por tema.
  - Nunca se oculta nada de forma irreversible: el estudiante puede ir a cualquier sección.
- **S9 — El tutor recibe el perfil.** El contexto del agente incluye un resumen breve: etapa, universidad, carrera, área, objetivos y cursos difíciles. Nada de credenciales. El prompt (subir su versión) lo usa para ajustar los ejemplos y el nivel, sin inventar diagnósticos (AGENTS.md §8).

### Interfaz

- **S10 — Diseño coherente con CALIBRA.**
  - Pantallas de ingreso, registro, recuperación y onboarding con los tokens, tipografías y componentes de marca existentes (`index.css` y `CalibraBrand`), en modo claro y noche.
  - Una pregunta por pantalla, opciones grandes como tarjetas, progreso arriba y botones «Atrás» y «Saltar».
  - Transiciones suaves entre pasos, respetando `prefers-reduced-motion`.
  - Accesible: etiquetas, errores asociados a cada campo, foco visible y objetivos de al menos 44 px; probado a 375 px.
  - El código de recuperación se muestra con «Copiar» y «Ya lo guardé», y no se puede volver a ver.
  - En la cabecera: «Ingresar» si es invitado, y el usuario con un menú (Mi perfil, Salir) si tiene cuenta.

### Calidad

- **S11 — Pruebas.**
  - **Backend, integración con PostgreSQL real:**
    - registro vinculando el actor invitado sin perder datos;
    - ingreso desde otro «dispositivo» (otra cookie) viendo los mismos datos;
    - rotación de sesión;
    - errores genéricos y límite de intentos;
    - recuperación con código, y código usado que deja de servir;
    - usuario duplicado;
    - borrar datos borra la cuenta;
    - validación del perfil ampliado y compatibilidad con las llamadas viejas a `/perfil`.
  - **Frontend:**
    - función pura de herramientas por perfil;
    - render de cada paso del onboarding;
    - el onboarding no reaparece cuando el perfil está completo.
  - Ampliar `test:tutor-ui` o un script equivalente con el flujo de entrada a 1440 px y 375 px.
- **S12 — Documentación.** README (cómo funciona la cuenta y qué datos se guardan), `backend/README.md` (contratos nuevos) y AGENTS.md §14 (ya no hay solo sesión invitada: hay cuentas vinculadas; actualizar el punto «sin recuperación de cuentas»).

### Fuera de alcance

Login con Google u otros proveedores externos, verificación por correo, roles de docente o academia, y datos personales más allá de los listados.

## Decisiones abiertas

- **D1 — Método de login.** Propuesta: usuario y contraseña con código de recuperación, sin correo. Alternativa: correo y contraseña (requiere un servicio de correo para recuperar) o Google (requiere configurar OAuth y su pantalla de consentimiento). Si un compañero ya implementó un login, **se adopta el suyo** y se adaptan S1 a S4 a lo que haga.
- **D2 — ¿Onboarding obligatorio?** Propuesta: se puede saltar. Si se salta, el inicio muestra la versión general y un recordatorio discreto para completarlo.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S1–S4 (cuenta en el backend) + pruebas | inline | hecho | commit de cuentas |
| T2 | S7, S9 (perfil ampliado y contexto del tutor) + pruebas | inline | hecho (API y contexto del tutor) | commit de cuentas |
| T3 | S10 parcial: solo ingreso, registro, recuperación y salida; el onboarding (S5, S6) queda fuera | parcial | commit de interfaz |
| T4 | S8 (inicio y navegación por perfil) | inline | fuera de alcance por decisión del usuario (L3) | — |
| T5 | S11 (prueba de navegador) y S12 | inline | docs hechos; prueba de navegador de entrada pendiente | commit de docs |

## Log

- **L1 (31/10/2026, usuario, requerimientos del equipo):** «Agregar un login para que reconozca al usuario y poder darle las herramientas adecuadas para su aprendizaje.» «Un frontend más intuitivo. Creo que antes de que te deje usar las herramientas, debe pedirte ciertos datos para que entre en contexto si eres un postulante, universitario, etc. Ya en el caso de postulante a UNMSM, te pide la carrera y eso. Ya luego serían temas de UX/UI y estética en la interfaz.» Mensajes del compañero: «Un oboarding», «El login ya hecho».
- **L2 (31/10/2026):** Revisión del repositorio (rama `feat/tutor-wow`, `main` en `915f9f8`): no hay login en el frontend ni en el backend. Existen la sesión invitada, `GET/PUT /perfil` con `carrera_id`, el catálogo de carreras UNMSM, `TuCarrera.tsx` y `WelcomeScreen`. Pendiente confirmar si «el login ya hecho» del compañero existe en alguna rama sin subir.
- **L3 (31/10/2026, usuario):** «ya no te encargues de esa parte, dejalo como estaba, ya mis compañeros estan implementando la interfaz y eso. Quedate con la interfaz de inicio de sesion y register, de ahi dejalo como esta y pushealo a github». Se conserva la API de cuentas y perfil, el contexto del tutor y la interfaz de ingreso/registro/recuperación/salida. Se retiran el onboarding, el inicio adaptado por perfil y los cambios de navegación (S5, S6, S8, parte de S10): los resuelve el equipo de interfaz.
