# Rediseño de la experiencia del tutor (chat primero)

Objetivo: que `/tutor` arranque como un chat (referencia visual del usuario), con el contexto elegible en el propio input, historial de conversaciones, y que la conversación y sus artefactos tengan un diseño cuidado, sin perder el grafo de comprensión ni las reglas del sistema.
Rama: `feat/tutor-diseno`, cortada desde `feat/tutor-agente`. Commits sin `Co-Authored-By` ni ninguna atribución; sin push. Runner: Vitest; cierre con `npm run verify`.

## Specs

- **S1 — Pantalla inicial chat primero.** Al entrar a `/tutor` sin conversación se ve, en este orden (referencia: captura del usuario en el Log):
  - Icono del tutor, título «¿Qué quieres **aprender** hoy?» (palabra destacada con el color de marca) y subtítulo breve.
  - Cuatro tarjetas de intención: «Resolver una duda», «Analizar un ejercicio», «Practicar por tema» y «Explorar mi grafo». Cada una precarga el input o la acción correspondiente (la última abre la vista del grafo).
  - «Temas recomendados para ti»: solo los temas que el backend soporta hoy (Porcentajes, Proporciones, Fracciones). **No** mostrar temas sin soporte (Ecuaciones, Progresiones). Si hay evidencias o rastros, ordenar primero el tema con un fallo pendiente.
  - Input grande con: campo de texto, selector de **contexto** (tema del catálogo; «Mi última práctica» si hay un intento con preguntas falladas; un material de «Mis cursos» si existe) y botón enviar. Adjuntar archivo lleva al flujo de «Mis cursos»; no agregar adjuntar imagen (no hay soporte).
  - Enviar crea la conversación y manda el primer mensaje en un solo paso.
- **S2 — Historial de conversaciones.** Panel lateral derecho «Historial» con las conversaciones del estudiante (`GET /conversaciones`), agrupadas por Hoy, Ayer y Esta semana, título y tema; botón de nueva conversación. En móvil se abre como hoja (sheet). Sin acciones que el backend no soporte (no renombrar ni borrar si no existe el endpoint).
- **S3 — Conversación.**
  - Layout: chat a la izquierda; grafo de comprensión a la derecha, plegable. El historial se accede desde un botón, para no tener tres columnas apretadas.
  - Burbujas diferenciadas para el estudiante y el tutor; avatar del tutor consistente; la última respuesta queda visible al enviar (auto-scroll) y hay un indicador «El tutor está pensando…» mientras dura el turno.
  - **Enter envía, Shift+Enter hace salto de línea** (hoy Enter no envía: es un bug).
  - Los botones de acción rápida no deben romper palabras: hoy se ve «Analizarerror», «Explicarconcepto» y «Dame unacomprobación» en anchos angostos (bug).
  - Pluralización correcta («1 idea», no «1 ideas»).
  - Estados visibles: error del proveedor (incluido el límite de uso de Groq), turno degradado («respondí solo con texto») y comprobación activa (aviso fijo «Comprobación en curso: sin ayudas del tutor»).
- **S4 — Diseño de los 10 bloques y 4 visuales.** Cada bloque es una tarjeta con su propio encabezado e icono, con el mismo lenguaje visual (tokens y tipografías del rediseño CALIBRA de `frontend/src/index.css`):
  - `pregunta_socratica`: pregunta destacada y respuestas rápidas como chips que se envían con un clic.
  - `contraste`: dos columnas «Lo que hiciste» / «Lo correcto», con la línea donde se separan resaltada.
  - `razonamiento_anotado`: los pasos del estudiante como lista con ✓ / «revisar», citando sus palabras.
  - `prediccion`: opciones grandes; tras elegir, se revela con animación discreta.
  - `ejemplo_paso_a_paso`: pasos revelables uno a uno con «¿Cuál sería el siguiente?».
  - `visual`: cada forma con un diagrama SVG propio (cadena con flechas y porcentajes; barra segmentada; tabla con flecha de directa/inversa; recta con marcas). Accesibles: texto alternativo con los valores.
  - `practica`: tarjeta de ejercicio con rótulo «Verificada por CALIBRA» y opciones.
  - `en_tus_palabras`: área de texto amplia.
  - `invitacion_comprobar`: llamada a la acción principal del turno.
  - `cita`: referencia compacta al documento y página.
  - Las lecturas provisionales se ven como «Me parece que…», con estilo distinto de lo verificado.
- **S5 — Grafo con contexto en el chat.** El nodo en foco del grafo se resalta cuando el tutor lo menciona o lo enfoca (`grafo_ops` con `enfocar`). Los nodos `error` con `senal` muestran «posible confusión» (hoy un error nuevo aparece como «Sin explorar», lo que confunde). El estado sigue saliendo solo de la evidencia.
- **S6 — Backend mínimo para S1.** `POST /conversaciones` acepta también un `mensaje_inicial` opcional para crear y enviar el primer turno en una sola llamada, con la misma idempotencia que `POST /conversaciones/:id/mensajes`. Si no se elige contexto, la conversación se crea sin concepto (sin ideas clave): el schema actual exige tema, intento o fragmento, así que este caso debe agregarse con su prueba. No cambiar el comportamiento de las llamadas existentes.
- **S7 — Sin funciones fingidas.** No mostrar búsqueda global, notificaciones ni avatar de usuario con iniciales (no hay cuentas: la sesión es invitada; mostrar «Invitado» como hoy). No mostrar temas, adjuntos ni acciones sin soporte real.
- **S9 — Que el agente use los artefactos.** En la prueba real, el tutor respondió solo con texto. Ajustar el prompt del agente (subir `PROMPT_AGENTE` de versión) para que, cuando aporte, acompañe su respuesta con al menos un bloque pertinente: por ejemplo, una `pregunta_socratica` con respuestas rápidas al preguntar por el razonamiento, o un `contraste` y un `visual` cuando el estudiante ya mostró su cálculo. Sin forzar bloques en cada turno. Prueba del prompt y comprobación con Groq real.
- **S8 — Calidad.**
  - Pruebas de render (`renderToStaticMarkup`) de la pantalla inicial, el historial y cada bloque rediseñado; pruebas unitarias de la lógica nueva (agrupación por fecha, Enter/Shift+Enter, pluralización).
  - Prueba de integración para S6.
  - Recorrido en el navegador a 1440 px y 375 px con Groq real: pantalla inicial → conversación → al menos 3 tipos de bloque → comprobación. Capturas en el Log.
  - Accesibilidad: foco visible, navegación por teclado, contraste suficiente y objetivos táctiles de al menos 44 px.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S6, S9 | inline | hecha | `627d10d` |
| T2 | S1, S2, S7 | inline | hecha | `a5c0244` |
| T3 | S3, S5 | inline | hecha | `a5c0244`, `8d4971d`, `4d263e8` |
| T4 | S4 | inline | hecha | `a5c0244` |
| T5 | S8 + docs | inline | hecha | este commit |

## Log

- **L1 (31/10/2026, usuario):** «yo estaba pensando en que incialmente sea como un chat asi como en la imagen, donde le ingreses de igual forma el contexto, y el mismo agente tenga el contexto del grafo de comprension, como ya tenemos ahora pero mejorado, de igual forma ya le pusimos algunas tools, artefactos, etc, solo queda ponerle buenos diseños a los artefactos, en esto si nos dedicaremos a mejorar el diseño, asi que mejora el diseño iinicial del tutor, mejora tambien el diseño que ya tenemos en el chat del tutor y lo que te comente».
- **L2 (31/10/2026) — Referencia visual del usuario:** pantalla «¿Qué quieres aprender hoy?» con logo CALIBRA, navegación (Tutor, Aprender, Mis cursos, Admisión, Temas), cuatro tarjetas (Resolver una duda, Analizar un ejercicio, Practicar por tema, Explorar mi grafo), chips de temas recomendados, input con selectores «Curso: Aritmética» y «Contexto: Admisión UNMSM», y panel derecho «Historial de chats» agrupado por Hoy / Ayer / Esta semana. Elementos de la captura sin soporte real que no se implementan (S7): búsqueda global, campana de notificaciones, avatar «JD», adjuntar imagen, temas Ecuaciones y Progresiones.
- **L3 (31/10/2026) — Revisión de la experiencia actual** en `localhost:8090/tutor` con Groq real:
  - Funciona de punta a punta. Ante «Yo puse 100 porque +20 y −20 se cancelan», el tutor citó literalmente al estudiante y preguntó por la base de cada porcentaje, sin dar la respuesta. Buena conducta pedagógica.
  - Ese turno no usó ningún bloque (ni respuestas rápidas): los artefactos casi no se ven en uso real.
  - Enter no envía el mensaje.
  - En anchos angostos, las acciones rápidas pierden el espacio entre palabras («Analizarerror»).
  - La pantalla inicial es un tablero denso (hero, chat, mapa y estadísticas a la vez) en lugar de un chat.
  - El nodo de error recién creado aparece como «Sin explorar», lo que confunde.
  - «1 ideas más disponibles en la lista»: pluralización incorrecta.
- **L4 (31/10/2026, ejecución):** el usuario pidió partir del trabajo sin commitear de otra sesión en `feat/tutor-diseno-panel` (no se creó `feat/tutor-diseno`). Antes de commitearlo se comprobó que nadie lo editaba (estado y diff idénticos tras 60 s). Se registró tal cual en `5b78ec4` (hero, mapa SVG con pestañas, resumen y `npm run test:tutor-ui`). **Qué cubría el trabajo previo:** cabecera CALIBRA, mapa SVG estable con estados y búsqueda sin tildes (`presentacion.ts`), pestañas Resumen/Evidencia/Ejercicios, avatar y estados de conexión. **Qué no cubría:** pantalla inicial chat primero, historial, contexto elegible, Enter para enviar (solo Ctrl/Cmd+Enter), acciones rápidas con `<br/>` (el bug de «Analizarerror»), pluralización, diseño de los bloques, `mensaje_inicial` y el prompt. Se reutilizaron `GrafoComprension`, `presentacion.ts`, `TutorAvatar`, `TutorProgress`, `tutor.css` y la ilustración.
- **L5 (31/10/2026, usuario):** con una captura de la pantalla de carga (grafito con vino y crema, brillo radial, rótulos en mayúsculas espaciadas, botones de cristal): «Con este tono será la pantalla de carga, quiero que le pongas esas tonalidades y elegancia al diseño también». Decisión: el tutor usa por defecto la **noche CALIBRA** (grafito, vino, crema, brillo radial, cristal) y conserva una variante clara propia del tutor (botón «Claro/Noche», guardado en `localStorage`, sin tocar el tema global de la app). Se reemplazó el `ThemeToggle` del tutor por ese botón.
- **L6 (31/10/2026) — Cobertura de specs:** S1 sí (pantalla inicial, tarjetas, temas soportados con el tema con fallo primero, input con selector de contexto —temas, «Mi última práctica» si hay pregunta fallada, material de «Mis cursos»—, adjuntar lleva a Mis cursos, enviar crea y manda el primer mensaje en una llamada). S2 sí (historial agrupado Hoy/Ayer/Esta semana/Anteriores, hoja en pantallas chicas, acoplado a la derecha en anchas; sin renombrar ni borrar). S3 sí (Enter envía, Shift+Enter salto de línea, acciones rápidas sin cortes, «1 idea», burbujas diferenciadas, auto-scroll, «pensando», errores del proveedor, degradado y aviso de comprobación en curso). S4 sí (diez bloques como tarjetas con encabezado e icono, cuatro visuales SVG, lectura provisional distinta de lo verificado, contraste con «Aquí se separan», cita con documento y página). S5 sí (foco del tutor resaltado, nodo de error «Error por comprobar» y señal «posible confusión»; el estado real sigue saliendo de la evidencia). S6 sí. S7 sí (sin búsqueda global ni notificaciones ni avatar de iniciales; «Invitado»; solo temas soportados). S8 parcial: pruebas de render, de lógica y de integración sí; el recorrido con Groq real cubrió pantalla inicial, conversación y tres tipos de bloque (`pregunta_socratica`, `contraste`, texto), **no una comprobación completa** en el navegador. S9 sí (`tutor-agente-v3`; con Groq real el tutor emitió `pregunta_socratica` con respuestas rápidas y un `contraste`; el primer turno fue solo texto, como pide «sin forzar»).
- **L7 (31/10/2026) — Hallazgos del recorrido con Groq real (`qwen/qwen3.8-27b`), capturas en la carpeta de notas compartidas `capturas-tutor-diseno/`:** (1) **Bug real corregido** (`4d263e8`): un fallo del proveedor durante un turno terminaba en un 500 genérico («No se pudo completar la operación»); ahora es 503 con mensaje claro y el turno se retoma con la misma clave. Lo descubrió el recorrido, no las pruebas previas. (2) Contraste de la paleta: botones, tarjetas y el markdown de las respuestas heredaban colores del navegador (texto oscuro sobre oscuro); se corrigió con tokens y se verificó. (3) La ilustración de la montaña no sirve sobre fondo oscuro: se oculta en noche y se conserva en la variante clara. (4) En 375 px las tres acciones rápidas se apilaban y la barra ocupaba tres filas: ahora son una fila desplazable y la barra es compacta; sin desbordamiento horizontal y con objetivos táctiles de 44 px. (5) Con Groq, el primer turno fue solo texto y el segundo emitió bloques: la presencia de bloques depende del modelo. (6) `npm run test:tutor-ui` (trabajo previo, fixtures de la página anterior) **quedó desactualizado** con el rediseño: no forma parte de `verify`; queda por reescribir.
