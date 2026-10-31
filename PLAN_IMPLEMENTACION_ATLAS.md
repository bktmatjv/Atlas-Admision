# CALIBRA: de recibir respuestas a poder resolver por tu cuenta

> Plan inicial · Actualizado el 30 de octubre de 2026 con «Mis cursos» e importación de material propio · Estado: propuesta de implementación, no funcionalidades terminadas.
> Revisión técnica inicial: sección 15. Estado de la implementación y cambios posteriores solicitados por el usuario: sección 16. Para estructura, comandos y estado real prevalece la sección 16; el resto conserva el diseño y su evolución.
> Leer este documento antes de trabajar en cada fase. `AGENTS.md` gobierna la arquitectura; las instrucciones actuales del usuario prevalecen. Actualizar decisiones y verificaciones al ejecutar, sin marcar una fase como completa solo por tener interfaz.

## 1. Decisión de producto

**El concepto es pertinente para «Aprender sin pensar», pero un árbol de explicaciones no demuestra aprendizaje.** El diferencial propuesto es unir la exploración libre del árbol con oportunidades de aplicación y un registro que distinga lo consultado, lo resuelto con apoyo y lo resuelto después sin ayuda dentro de CALIBRA.

**Propuesta en una frase:** CALIBRA convierte una duda o un error en una exploración conectada y ayuda al estudiante a comprobar qué puede explicar y aplicar por su cuenta.

- Público inicial: postulantes a San Marcos; validar con personas de este público, no extrapolar directamente cifras de universitarios.
- Comportamiento a investigar: leer una solución convincente y creer que ya se sabe resolver otra pregunta del mismo principio.
- Intervención: intento → ayuda contextual y árbol → problema diferente → devolución → repaso posterior.
- Resultado principal: desempeño y justificación en una actividad nueva sin asistencia dentro de la aplicación.
- Hipótesis: esta experiencia ayuda más que consultar una solución y continuar. Falta validación; no prometer eficacia ni ingreso.

El árbol sigue siendo una funcionalidad del tutor, no un calendario, una secuencia obligatoria ni toda la plataforma. La práctica, los simulacros y el cuaderno de errores se conservan.

**Ampliación solicitada por el usuario: autonomía con material propio.** CALIBRA tendrá un apartado «Mis cursos» para importar documentos y adaptar la experiencia a lo que estudia cada persona, sin depender exclusivamente del banco de admisión. La IA transformará ese material en una propuesta de temas, conceptos, explicaciones y actividades que alimente el mismo tutor, árbol, práctica y seguimiento. Podrá complementar con fuentes externas identificadas y autorizadas, sin mezclar silenciosamente sus afirmaciones con las del documento. El banco actual es una base inicial y una referencia de organización, no el límite del conocimiento ni una taxonomía obligatoria para todo material.

### Qué lo diferencia de un chatbot con otro nombre

| Respuesta genérica | Propuesta CALIBRA |
| --- | --- |
| Conversación desconectada de lo que se estudia | Tutor ligado a una pregunta, su concepto, el intento y las ayudas previas |
| Explicaciones que se pierden en un historial lineal | Ramas navegables, persistidas y con contexto de origen |
| «Entendí» porque leí una explicación | Evidencia separada de lectura, resolución asistida y aplicación posterior |
| Más mensajes como indicador de éxito | Actividad nueva, justificación y seguimiento diferido |
| Recomendación genérica | Volver al punto concreto que una respuesta mostró que necesita refuerzo |
| Subir un PDF solo para resumirlo o conversar | Convertir material propio en un curso trazable y reutilizarlo en exploración, práctica y comprobación |

No afirmar que nadie ha hecho algo similar. La diferenciación debe demostrarse con el recorrido y con usuarios; la forma de árbol por sí sola no constituye una innovación suficiente.

## 2. Fuentes y requisitos de la hackatón

Documentos leídos: [AGENTS.md](AGENTS.md), [idea del tutor](idea_tutor_arbol_de_comprension.md), [contexto del problema](contexto_aprender_sin_pensar_atlas.md) y el PDF oficial de temática incluido en la raíz. La imagen compartida se interpreta como advertencia de producto, no como diseño de interfaz que debamos copiar.

El PDF exige problema actual con dato y fuente, tendencia hacia 2036, software desplegado y prueba con al menos una persona que viva el problema. Es un documento de apoyo: revisar también las bases completas del grupo oficial para entregables o reglas adicionales.

| Rúbrica del PDF | Qué presentar |
| --- | --- |
| Problemática, 30% | Observación real de cómo estudia un postulante; evidencia publicada con sus límites |
| Innovación, 30% | Distinción entre desempeño asistido y aplicación independiente, visible en la demo |
| Técnico y factibilidad, 20% | React → NestJS → PostgreSQL funcionando y desplegado; costes y fallos contemplados |
| Pitch y negocio, 20% | Usuario, beneficio, canal de adopción y una hipótesis de sostenibilidad |

Las fuentes del MD de contexto son investigación previa, no han sido verificadas nuevamente en esta tarea. Antes del pitch, comprobar los enlaces y el alcance de las afirmaciones utilizadas. El 95% citado no debe presentarse como censo nacional ni como dato de postulantes. Hacia 2036 argumentar una tendencia, no inventar una predicción numérica de deterioro.

## 3. Estado real de partida

### Lo aprovechable

- React 18, TypeScript, Vite, Tailwind, React Router y TanStack Query.
- Diagnóstico, prácticas, resolución de intentos, soluciones, informes, temas frecuentes y repasos Leitner.
- Motor de armado, corrección, cálculo numérico y renderizado Markdown/KaTeX con pruebas.
- `src/integrations/supabase/client.ts` es un adaptador **local**; no hay conexión real a Supabase.
- Persistencia actual: `localStorage`; identidad fija `local`. No existe backend NestJS ni esquema de base de datos en esta copia.
- Rutas actuales: `/admision`, `/admision/intento/:id`, `/admision/temas`.

### Auditoría estructural de los JSON

| Conjunto | Registros |
| --- | ---: |
| Exámenes / preguntas / lecturas | 26 / 2.027 / 61 |
| Carreras y sedes / procesos | 120 / 3 |
| Resultados / distribuciones históricas | 206 / 206 |
| Checklist del día del examen | 9 |

Comprobaciones realizadas sobre los archivos actuales:

- Sin IDs de pregunta duplicados, preguntas con examen/lectura inexistente ni gráficos referenciados ausentes.
- Todas las preguntas tienen tema, clave válida dentro de sus opciones y solución no vacía; curso y tema coinciden con el catálogo actual.
- Resultados históricos sin referencias huérfanas a carreras o procesos.
- **107 grupos de enunciado normalizado + opciones idénticos, que reúnen 214 registros.** Pueden ser apariciones legítimas en distintas áreas; no borrarlos automáticamente. Evitar que esos equivalentes se utilicen como supuesta transferencia inédita.
- Los 26 exámenes contienen entre **70 y 85 preguntas publicadas**, menos de lo declarado en sus metadatos. Presentarlos como selecciones disponibles de exámenes anteriores; no como cuadernillos completos ni equivalentes automáticos a un puntaje oficial.
- Aritmética tiene 66 registros, entre ellos 15 de razones/proporciones, 8 de fracciones y 4 bajo regla de tres. Estas etiquetas son amplias, no garantizan cobertura de cada concepto propuesto.

La revisión es de integridad estructural, no una certificación académica, de derechos de publicación o de calidad de las soluciones. Conservar las marcas `fuente`, `verificado` y las advertencias existentes.

### Deuda que afecta al recorrido

- `PreguntaDeAdmision.tsx` enlaza a `/resolver?admision=...`, pero esa ruta no está registrada. Sustituir esa entrada por el tutor contextual cuando exista; no añadir otro enlace vacío.
- El hook de entrega actual llama a corrección aunque `vaciarCola()` no confirme que se guardaron todas las respuestas. Resolver esa condición al conectar la API, con una política explícita para vencimiento del examen.
- La selección puede producir menos preguntas que el cupo si faltan candidatas. Mostrar el número real y no fingir completitud.
- La evidencia de aprendizaje y los casos de transferencia todavía no existen; no se obtienen automáticamente convirtiendo JSON a SQL.

Línea base verificada en esta revisión: **384 pruebas aprobadas en 38 archivos**, `npm run typecheck` y `npm run lint` correctos. No se hizo validación visual de la aplicación en este turno.

## 4. Experiencia propuesta

### Recorrido principal de demostración

1. El estudiante responde una pregunta y puede expresar brevemente cómo la pensó; también puede elegir «No sé por dónde empezar».
2. Pulsa «Entender este paso». CALIBRA abre el tutor con el ejercicio y el intento, no un chat vacío.
3. Una raíz breve sitúa la duda; aparecen hasta tres ramas iniciales pertinentes.
4. El estudiante elige «más sencillo», «un ejemplo», «por qué» o una nueva duda. El tutor ajusta un nodo o añade un hijo cuando realmente aporta otra idea.
5. Puede pedir la explicación completa sin superar barreras artificiales.
6. Cuando quiera comprobarlo, intenta una actividad distinta. Las ayudas se apartan durante ese intento dentro de CALIBRA, sin presentarlo como examen vigilado.
7. La devolución indica lo observado: acierto, justificación, ayuda recibida y qué merece revisar. Si necesita apoyo, puede regresar a una rama y volver a practicar.
8. El cuaderno conserva la dificultad, la exploración y la evidencia; un repaso posterior usa otra actividad disponible.

### Ejemplo de pitch, a preparar y revisar

- Pregunta inicial: «Dos descuentos de 20%, ¿equivalen a 40%?».
- Respuesta del estudiante: «Sí, porque se suman».
- Árbol: «¿Sobre qué cantidad se calcula?» → ejemplo con S/100 → contraste entre sumar porcentajes y cambiar la base.
- Aplicación: «Sube 20% y luego baja 20%, ¿vuelve al precio original? Explica».
- Resultado esperado del ejemplo: S/100 → S/120 → S/96. La devolución debe atender al principio, no solo al número.

Este caso es contenido educativo propuesto; no afirmar que pertenece a un examen real del banco. Un error de opción múltiple aislado no permite concluir por qué se equivocó el estudiante.

### Lenguaje de evidencias

Usar observaciones con actividad y fecha: «Consultaste una explicación», «Resolviste con una pista», «Respondiste una variante sin ayuda en CALIBRA», «Aplicaste el principio en un repaso posterior».

No son una escalera obligatoria ni estados universales de dominio. Un estudiante puede resolver sin ayuda antes de explorar, volver a necesitar apoyo después o fallar un caso distinto. Mantener el historial, no sobreescribirlo con una etiqueta favorable.

No usar porcentajes de comprensión, puntuaciones de dependencia, diagnósticos psicológicos ni nodos “dominados” solo por abrirlos. El estado técnico `dominada` del Leitner existente no debe convertirse en certificación conceptual.

## 5. Diseño: un espacio para pensar, no otra ventana de chat

- Identidad CALIBRA: cartografía del conocimiento, conexiones y foco; no copiar el slide oscuro de advertencias ni añadir un grafo decorativo.
- Inicio: una acción principal «Continuar aprendiendo», último punto de dificultad y accesos secundarios a práctica/simulacros. Reducir la competencia de tarjetas actual.
- Escritorio: mapa compacto de la rama activa + panel de explicación/ejercicio. La pregunta original permanece accesible sin duplicar bloques largos.
- Móvil: árbol como lista jerárquica y migas de navegación; detalle en una vista enfocada. No depender de arrastrar o hacer zoom en un lienzo para usar el tutor.
- Nodos con título concreto, una idea y procedencia del contenido. Badges distinguen interacción de evidencia sin depender solo del color.
- Seguimiento breve dentro del nodo; el chat puede existir como medio de aclaración, pero no es toda la experiencia.
- Apartado «Mis cursos»: catálogo base y cursos personales separados; crear curso o vincular material a uno existente, importar documentos, revisar la organización propuesta y elegir qué estudiar. Cada tema muestra sus materiales, fuentes y acciones «Explorar», «Practicar» y «Repasar».
- Importación con progreso real y previsualización: páginas recuperadas, advertencias, temas sugeridos y opciones para corregir, excluir contenido o reintentar. No mostrar una carga exitosa como si el curso ya estuviera listo.
- Modo «Comprender» permite ayudas; modo «Simulacro» no abre el tutor durante un intento evaluativo.
- Carga, árbol vacío, fallo de IA, respuesta incierta, gráfico roto, pérdida de conexión y recuperación visibles.
- Conservar las fuentes locales y el renderizado matemático. Animaciones discretas y respeto de movimiento reducido.

Criterios de interfaz: operación por teclado, foco visible, nombres accesibles, contraste suficiente, paneles con orden de lectura claro, objetivos táctiles de al menos 44 px y prueba a 360 px de ancho sin desbordes de página. El árbol debe poder recorrerse también sin su representación gráfica.

## 6. Alcance y prioridades

### P0: demostración completa y desplegada

- Importar el banco disponible sin depender de la extracción externa.
- Persistencia e identidad de sesión real del backend.
- Un flujo de práctica conectado, tutor con árbol guardado y seguimiento real con un proveedor IA.
- Un curso inicial del banco: **Aritmética**. Curar dos o tres conceptos: base de porcentajes, proporcionalidad y equivalencia de fracciones; ajustar la selección al revisar contenido.
- Una importación vertical de material propio: crear un curso personal, subir PDF con texto o TXT/Markdown, revisar los temas propuestos, conservar referencias al original y abrir el tutor/árbol sobre un fragmento. Generar al menos una propuesta de práctica con solución y sustento, identificada como borrador hasta validarla. La demo debe mostrar material no incorporado previamente al banco, no una respuesta fija para un único PDF.
- ~~Complementación externa en P0~~ → **movida a P1** (sección 15.1). Exige proveedor de búsqueda, protección SSRF y verificación de citas; su riesgo no compensa en la demo. Declararla pendiente; no fingir búsqueda con enlaces inventados.
- Preparar al menos un conjunto por concepto: pregunta inicial, explicación revisada, actividad de transferencia y actividad diferida. Revisar equivalencia conceptual, dificultad y posibles duplicados; añadir contenido propio identificado si falta.
- Evidencias observables y enlace al cuaderno. Un repaso diferido real no puede demostrarse como ya ocurrido el mismo día.
- Rediseño del recorrido que se demuestra, no de todas las pantallas antes de integrar.
- Validación con al menos una persona del público objetivo y despliegue accesible.

### P1: completar la evolución de CALIBRA

- Conectar diagnóstico, simulacros, informes, perfil, estadísticas y datos UNMSM a la API.
- Extender árboles y contenido revisado a otros cursos.
- Historial más completo de ayudas, aplicaciones y repasos.
- Importación voluntaria del progreso local, sin atribuirle identidad o verificación que no tenía.
- Entrada libre al tutor por tema/pregunta además del ejercicio; para temas sin actividades revisadas permitir exploración, indicando que no hay comprobación preparada.
- Ampliar importación a DOCX, PDF escaneado mediante OCR y otros formatos admitidos explícitamente. Mejorar tablas, fórmulas, figuras y documentos extensos tras evaluar extracción y coste.
- Extender los cursos personales a diagnóstico, conjuntos cronometrados, práctica por tema y repasos cuando tengan suficientes actividades válidas. No inventar cobertura ni presentar estos conjuntos como exámenes oficiales.
- Mejorar actualización/versionado de material y recuperación de fuentes, sin crear una base vectorial separada salvo necesidad medida.

### Fuera del primer alcance

Microservicios, agentes múltiples, base vectorial separada sin necesidad medida, entrenamiento de un modelo propio, grafo global de prerrequisitos, editor docente completo, detección de textos con IA, vigilancia, app nativa y garantías de ingreso. La recuperación de fragmentos de documentos sí tiene ahora un caso de uso: empezar con búsqueda acotada y filtros de acceso, sin asumir que requiere infraestructura adicional. Un panel docente puede evaluarse después; no es requisito para demostrar el recorrido del alumno.

Si falta tiempo: recortar cantidad de conceptos, sofisticación del mapa, streaming y reportes secundarios. **No recortar** persistencia, actividad nueva, veracidad de las evidencias, validación con usuario ni despliegue para sustituirlos por pantallas simuladas.

### Mis cursos: importar material y adaptarlo a CALIBRA

**Capacidad de producto confirmada; alcance técnico inicial propuesto.** El estudiante podrá usar un curso del catálogo como referencia o crear uno personal si su material no encaja. La IA sugiere la relación, pero el estudiante puede corregirla; nunca modifica por su cuenta el temario global de admisión.

#### Flujo de importación

1. **Crear o elegir curso.** Indicar objetivo, nivel y, opcionalmente, temas de interés. Seleccionar si se permite complementar con fuentes externas; no es obligatorio para estudiar el documento.
2. **Adjuntar material.** Inicio propuesto: PDF con texto, TXT y Markdown; límites configurables iniciales de 10 MB por archivo y 50 páginas por PDF, más límites de texto/tokens y cuota por sesión. Explicar tipos admitidos y costes/límites antes de procesar.
3. **Extraer y diagnosticar calidad.** Conservar original privado, versión/hash, páginas o secciones, párrafos y recursos extraídos. Señalar páginas vacías, OCR necesario, fórmulas o tablas dudosas; no aceptar una extracción parcial como documento completo.
4. **Traducir al modelo educativo de CALIBRA.** Proponer temas, conceptos, objetivos y explicaciones breves, con referencias a fragmentos. «Traducir» significa estructurar pedagógicamente, no traducir de idioma ni copiar el PDF entero dentro de un prompt.
5. **Revisar la propuesta.** El estudiante puede renombrar, corregir, excluir partes y confirmar su pertinencia. Esa confirmación no equivale a revisión académica de la veracidad del material o de lo generado.
6. **Aprender y practicar.** Desde el curso, explorar el árbol, solicitar ayudas y generar propuestas de actividades con respuesta esperada, criterio y sustento. Reutilizar las reglas de práctica y evidencias, no otro tutor aislado para archivos.
7. **Complementar cuando se solicite.** Recuperar fuentes externas pertinentes, mostrar procedencia y límites, y preguntar o avisar ante contradicciones. No reemplazar silenciosamente el enfoque del estudiante ni dar por correcto todo lo que suba.
8. **Retomar o actualizar.** Persistir curso, importación, árbol y actividad/versiones; al cambiar material, identificar qué contenido derivado necesita regenerarse o revisarse sin alterar resultados históricos silenciosamente.

#### Mismas capacidades, sin equivalencias engañosas

| Capacidad | Adaptación al material propio |
| --- | --- |
| Tutor y árbol | Explicar y conectar temas del curso usando fragmentos autorizados y citas al original |
| Práctica y diagnóstico | Actividades alineadas con objetivos del documento, mostrando cobertura disponible y estado de revisión |
| Simulacro | Conjunto personal cronometrado solo con suficiente contenido apto; sin atribuir distribución oficial UNMSM |
| Cuaderno y repaso | Errores de actividades personales, conceptos relacionados y aplicaciones posteriores |
| Progreso | Evidencias por curso, actividad y ayuda; las tareas no verificadas producen devoluciones provisionales, no certificación |
| Referencias de ingreso | Exclusivas del banco/áreas compatibles de admisión; un curso personal no hereda «¿Ingresaba?» ni percentiles oficiales |

**Generar no significa validar.** La IA puede producir actividades para estudio autónomo, pero deben identificarse como generadas y no revisadas. Para una comprobación puntuable, validar respuesta, sustento, ambigüedad y alineación mediante reglas apropiadas y/o revisión académica. Una segunda opinión de IA o el visto bueno del estudiante no prueban por sí solos corrección. Si no hay validación suficiente, permitir uso formativo con devolución provisional y no sumar un acierto objetivo al indicador de transferencia. Mantener los casos revisados de P0 como referencia demostrable.

#### Fuentes y adaptación responsable

- Distinguir tres procedencias: **material del estudiante**, **fuente externa recuperada** y **elaboración de IA**. Citar documento + versión + página/sección/fragmento; para la web, URL, título, fecha de consulta y pasaje realmente recuperado. La etiqueta de procedencia no implica verdad verificada.
- Adaptar vocabulario, orden y ejemplos al curso y a la dificultad observada, no inventar un perfil o diagnóstico del estudiante. La falta de respaldo se comunica; se puede preguntar antes de completar huecos.
- Ante desacuerdo entre documento y una fuente externa, mostrar ambas referencias y explicar la incertidumbre; proponer una corrección revisable, sin ocultar la diferencia ni marcar automáticamente mal al estudiante.
- No inventar citas, páginas ni acceso a fuentes que no se pudieron recuperar. Sin búsqueda disponible, continuar con el material suficiente o indicar el límite.
- Las actividades nuevas no pueden ser copias de lo recién explicado o del mismo caso del documento con cambios cosméticos. Registrar exposición conocida y distinguir práctica de reproducción de transferencia.

#### Seguridad, privacidad y procesamiento

- Material privado por defecto, accesible solo por su actor/sesión. Informar qué contenido se envía al proveedor IA/OCR, retención y cómo eliminarlo; no usar documentos para entrenar modelos ni compartirlos sin autorización. Minimizar datos personales y respetar permisos de uso del material.
- Archivos fuera de `public/` y de rutas ejecutables: nombres internos generados, tipo real validado, límites de tamaño/páginas/descompresión/tiempo, parsers actualizados y aislamiento apropiado. Rechazar ejecutables, macros y archivos malformados; no ejecutar scripts, adjuntos ni instrucciones embebidas.
- Documentos y páginas externas son datos no confiables. Probar instrucciones maliciosas ocultas, extracción de claves y cruces de cursos; nunca darles autoridad sobre permisos, herramientas o prompts.
- Recuperar solo fragmentos de cursos/versiones autorizados, filtrando **antes** de buscar o enviarlos al modelo. Usar inicialmente texto completo/fragmentos en PostgreSQL; evaluar embeddings en la misma base solo si mejora recuperación con evidencia.
- Búsqueda externa desde backend, con consultas mínimas y sin enviar el documento completo a un buscador. Recuperación web con HTTP(S), validación de destinos/redirecciones, bloqueo de redes privadas/loopback/metadatos, límites y timeouts; no construir un descargador arbitrario de URLs internas.
- Trabajo persistido en estados `recibido`, `extrayendo`, `requiere_revision`, `listo`, `fallido` y `cancelado`; progreso por etapa, reintento idempotente y errores concretos. Ejecutar con concurrencia acotada dentro de NestJS y tareas guardadas en la DB; no introducir un broker para este alcance. Prever recuperación tras reinicio y no mantener transacciones durante IA/OCR.
- Eliminar material propio debe cancelar tareas y retirar originales, fragmentos, índices, cachés y derivados que dependan de él, con política explícita para historiales y copias de seguridad. Marcar actividades/evidencias afectadas sin seguir sirviendo el contenido eliminado; no prometer borrado completo si quedan copias no contempladas.

## 7. Arquitectura alineada con AGENTS.md

### Confirmado y propuesto

| Decisión | Estado y razón |
| --- | --- |
| Mantener React y migrar incrementalmente | Requisito; no rehacer el frontend |
| NestJS como monolito modular | Requisito; controladores HTTP, casos de uso y persistencia delimitados |
| PostgreSQL | Propuesta inicial prevista por AGENTS, no una elección previa del usuario |
| TypeORM como única herramienta principal | Propuesta para integración NestJS, entidades y migraciones; no añadir Prisma a la vez |
| Sesión invitada opaca emitida por servidor | Propuesta MVP para evitar un login completo sin confiar en `user_id` del cliente |
| Proveedor IA por interfaz backend | Requisito; proveedor/modelo concretos pendientes de credenciales, coste y capacidad |
| HTTP JSON inicialmente | Propuesta; streaming solo si aporta valor y está probado |
| Cursos personales e importación documental | Funcionalidad solicitada; formatos, límites, OCR y proveedor de extracción propuestos por fases |
| Recuperación fundamentada y complementación externa | Funcionalidad solicitada; fragmentos con procedencia y permisos, búsqueda externa opcional por curso, sin imponer base vectorial |

Registrar una decisión distinta antes de ampliar su esquema. No presentar PostgreSQL/TypeORM, proveedor, login o infraestructura como decisiones ya aprobadas por el usuario.

### Organización propuesta

```text
src/                       # Frontend existente; permanece en la raíz
  features/tutor/          # Pantallas y componentes nuevos, sin reorganizar todo
  integrations/api/        # Cliente HTTP y servicios por recurso
backend/
  src/modules/
    identidad/             # Sesión/actor y autorización
    contenido/             # Banco, cursos personales, documentos, conceptos y tareas; datos UNMSM
    practica/              # Intentos, respuestas y corrección
    seguimiento/           # Evidencias y repasos
    tutor/                 # Contexto, ayudas, árboles y adaptador IA
  src/database/            # DataSource y migraciones
  scripts/                 # Importación y comprobación reproducibles
```

Son rutas propuestas, todavía no creadas. El árbol empieza dentro de `tutor`, no como servicio distribuido. Compartir únicamente contratos o funciones puras que de verdad se reutilicen; no importar componentes React desde NestJS ni duplicar reglas autoritativas.

### Límites de negocio

- Contenido publica preguntas y consultas específicas; sus claves/rúbricas solo se exponen a servicios autorizados. Administra también cursos personales, importaciones, versiones, fragmentos y propuestas derivadas, sin contaminar el banco público ni el catálogo canónico.
- Práctica decide orden, pertenencia, plazo, aceptación de respuestas y puntaje. El reloj del navegador solo representa el estado.
- Tutor accede al contexto permitido a través de contratos; no lee libremente tablas de todos los módulos ni persiste lo que mande el modelo.
- Seguimiento recibe resultados de casos de uso y conserva las evidencias. Lecturas y clics no crean resultados de aprendizaje.
- Corrección y registro de su efecto deben ser atómicos; un fallo de IA no revierte un resultado ya guardado. No mantener transacciones abiertas durante llamadas al proveedor.

### Identidad y configuración

- Token de sesión aleatorio, opaco, almacenado de forma segura en servidor y cookie HttpOnly, Secure en producción, SameSite acorde al despliegue; no usar `local` como identidad real.
- Autorizar cada intento, árbol, mensaje, curso personal, documento, descarga y evidencia por el actor de la sesión. Otro visitante no accede cambiando un UUID; el mismo aislamiento se aplica a recuperación de fragmentos y trabajos de importación.
- Preferir frontend/API bajo el mismo origen con proxy. Si se separan, CORS con lista explícita, cookies configuradas y protección CSRF en escrituras; no comodín con credenciales.
- La sesión invitada permite retomar en el mismo navegador mientras exista su credencial, no sincronización automática entre dispositivos. Cuentas recuperables quedan para una fase definida.
- Configuración propuesta: `DATABASE_URL`, `PORT`, `FRONTEND_ORIGIN`, `VITE_API_URL`, `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, almacenamiento privado, límites de importación y configuración del proveedor de búsqueda/OCR cuando se adopten. Validación al arrancar y `.env.example` sin valores secretos. Nunca versionar archivos privados subidos.
- Separar bases de desarrollo/pruebas/producción. No reiniciar bases con datos del usuario sin permiso.

## 8. Datos: transformación a tablas y enriquecimiento separado

### Mapeo propuesto

| Origen / responsabilidad | Tablas o estructura relacional |
| --- | --- |
| Catálogo `temario.ts` | `cursos`, `temas`; unicidad de tema dentro de su curso |
| Organización personal | `cursos_personales`, `temas_personales`; propietario obligatorio, vínculo opcional al catálogo base, objetivo y política de complementación externa |
| Importación | `documentos`, `documento_versiones`, `trabajos_importacion`; actor/curso, hash, ubicación privada, tipo, tamaño, calidad de extracción, estado y error |
| Contenido recuperable | `fragmentos_documento`, `fuentes_externas`; versión, página/sección/posición, pasaje y metadatos; acceso heredado del curso privado |
| Derivaciones documentales | Relación de nodos, conceptos y actividades con curso, versiones/fragmentos fuente, tipo de procedencia y estado de revisión; campos explícitos y referencias válidas, no solo una cita de texto libre |
| `banco.json.examenes` | `examenes`; conservar ID, área/ciclo, cantidad declarada y cantidad disponible |
| `banco.json.textos` | `lecturas` con FK al examen |
| `banco.json.preguntas` | `preguntas` con FK a examen, lectura opcional y tema; opciones/recursos estructurados; clave/solución separadas en DTO públicos |
| Carreras / procesos | `carreras`, `procesos`; jornadas en JSONB o tabla hija según consultas |
| Resultados / distribuciones | `resultados`, `distribuciones`; clave única `(ciclo, carrera_id)` y fuentes conservadas |
| Checklist | `items_dia_examen` con orden y verificación |
| Sesión y preferencias | `actores`, `sesiones`, `perfiles` |
| Intento y orden de preguntas | `intentos`, `intento_preguntas`; orden único por intento, versión/snapshot del contenido evaluado |
| Respuestas | `respuestas`; unicidad `(intento_id, pregunta_id)`, versión para conflictos y corrección del servidor |
| Cuaderno | `errores_repaso`; unicidad `(actor_id, pregunta_id)` y fechas DATE de Lima |
| Curación adicional | `conceptos`, `pregunta_conceptos`, `actividades_comprobacion`; objetivos, rúbrica, origen, versión y estado de revisión |
| Tutor | `arboles`, `nodos`, `mensajes_tutor`; actor, origen, padre, orden, contenido y versión |
| Evidencias | `evidencias`; actividad/versión, respuesta, ayuda, resultado, justificación, criterio y fecha |

No hace falta normalizar cada alternativa, frase o conteo a una tabla independiente. Campos relacionales para identidad e integridad; JSONB para opciones, rúbricas y estructuras acotadas cuando resulte adecuado. Puntajes con decimal exacto o enteros escalados; timestamps UTC y fechas de repaso como DATE según Lima.

El árbol de una exploración no es el catálogo de conceptos: son modelos distintos. Definir una raíz por árbol, FK de padre dentro del mismo árbol, validación de ciclos/profundidad y autorización. Una respuesta del modelo no puede elegir propietario, IDs de otro árbol ni relaciones arbitrarias.

Para cursos personales, delimitar también conceptos, preguntas y actividades por su curso/propietario; una relación con el catálogo base no vuelve público el material. Unicidad de hash/versiones acotada al propietario para evitar filtrar la existencia de archivos ajenos. Mantener referencias de versión usadas en actividades e intentos para que reemplazar un PDF no cambie retroactivamente su evaluación. Guardar el binario en almacenamiento privado persistente y sus metadatos en PostgreSQL; no tratar el disco efímero de un despliegue como almacenamiento duradero.

### Procedimiento de importación

1. Tomar `public/datos/banco.json` y `public/datos/unmsm.json` como snapshot inicial utilizable; no requiere ejecutar `npm run banco` ni tener la extracción privada.
2. Crear migración y un importador validado con modo de comprobación previa. Registrar versión/hash del snapshot y reporte de conteos.
3. Importar en orden de dependencias con IDs estables, FKs e índices por curso/tema, actor/fecha y repasos pendientes. Usar transacción o lotes con estrategia explícita de recuperación.
4. Hacer la importación repetible por claves estables: segunda ejecución sin duplicados. Rechazar colisiones incompatibles, no sobrescribir ediciones revisadas silenciosamente y no borrar registros por ausencia en el snapshot.
5. Comparar conteos, campos, relaciones, gráficos y metadatos después de importar. No convertir `null` de vacantes o datos desconocidos en cero.
6. Preservar apariciones repetidas en sus exámenes; identificar familias equivalentes para no confundir repetición con actividad inédita. La coincidencia exacta auditada es un mínimo, no detecta todas las variantes semánticas.
7. Mover los JSON fuente fuera de `public/` cuando el flujo servidor sustituya el local. Servir gráficos como recursos estáticos y preguntas mediante DTO permitidos; comprobar que `dist/` no publique el banco con claves ni rúbricas.
8. Conservar material fuente y atribución; revisar permisos antes de ampliar su publicación. No reescribir el historial Git ni borrar originales del usuario como parte de esta migración.

Los JSON ya publicados no pueden volverse secretos retroactivamente. Ocultarlos en el despliegue evita filtraciones triviales del flujo, pero CALIBRA no es un examen antifraude.

Para progreso local: exportación previa y migración voluntaria por sesión; tratar contenido e identificadores como no confiables. No considerar ese historial como evidencia validada por el nuevo servidor.

## 9. API e integración progresiva

Contratos propuestos bajo `/api/v1`; no son endpoints existentes.

| Recurso | Operaciones mínimas |
| --- | --- |
| Sesión/perfil | Crear sesión, consultar identidad, leer/actualizar preferencias y borrar datos propios con confirmación |
| Contenido | Catálogo, lista de exámenes, temas y metadatos permitidos |
| Mis cursos | Crear/listar/actualizar cursos propios y sus temas, vincular al catálogo y configurar fuentes externas |
| Documentos/importaciones | Subir a curso, consultar estado/calidad, obtener previsualización, confirmar organización, cancelar/reintentar y eliminar con sus dependencias |
| Adaptación y fuentes | Proponer actividades desde fragmentos, consultar sustento, solicitar complemento externo autorizado y revisar cambios de versión |
| Intentos | Crear, listar propios, obtener, guardar lote versionado de respuestas y entregar |
| Soluciones | Revelar solo cuando el modo y el estado lo permitan; registrar la ayuda |
| Árboles | Crear desde pregunta/tema, listar propios, recuperar y ampliar un nodo |
| Tutor | Solicitar aclaración/pista con contexto de nodo y clave de idempotencia |
| Comprobaciones | Iniciar actividad permitida, responder y solicitar devolución posterior |
| Seguimiento | Evidencias propias, cuaderno, repasos pendientes y resultados históricos permitidos |

- DTO con validación estricta; nunca aceptar puntaje, corrección, propietario o evidencia favorable calculados por el cliente.
- Lotes de respuestas con versión/orden para que reintentos antiguos no reemplacen una respuesta nueva. Mostrar cuándo se guardó y qué sigue pendiente.
- Entrega idempotente y transaccional: reenvío no duplica puntaje, errores ni evidencias. Rechazar respuestas de otra pregunta/intento y escrituras tras cierre.
- Vencimiento autoritativo por servidor: definir si se usa entrega con último lote dentro del plazo o corrección de lo recibido. Si faltan respuestas por conexión, mostrarlo; no fingir que todo quedó guardado.
- DTO de actividad sin clave/rúbrica hasta entregar; distinguir práctica asistida, aplicación y simulacro.
- TanStack Query y cliente centralizado HTTP; reemplazar operaciones locales por recurso, no construir otra emulación completa de Supabase.
- Cola del navegador solo como respaldo de escrituras pendientes, no como fuente autoritativa. No confirmar éxito antes de recibir persistencia real.
- Mantener el modo local únicamente si se identifica como demo. No caer silenciosamente a datos simulados cuando falle la API.
- Nueva ruta propuesta `/aprender/:arbolId`, conectada desde la pregunta y el cuaderno; la entrada libre puede comenzar en `/aprender` cuando se amplíe el alcance.
- Rutas propuestas `/cursos`, `/cursos/:cursoId` y `/cursos/:cursoId/materiales/:documentoId`: listado personal, espacio del curso y revisión del material. El tutor recibe referencias autorizadas al curso y fragmento; no se basa en IDs arbitrarios del cliente.
- La subida crea una importación, no un curso listo instantáneamente. Responder con identificador/estado persistido (por ejemplo, HTTP 202 para el procesamiento), consultar avance con frecuencia acotada y devolver límites/errores accionables.

## 10. IA: función acotada y comprobable

**IA:** adaptar lenguaje, proponer ramas, responder dudas y comentar justificaciones con cautela. **Código y contenido revisado:** permisos, estructura, selección de actividades, puntaje y hechos verificables del caso.

- Puerto `TutorAI` en NestJS y un adaptador de proveedor. Claves solo en backend.
- Contexto acotado: objetivo, pregunta/explicación autorizada, intento, rama activa, ancestros necesarios, resumen de ayudas y fragmentos pertinentes del curso personal si existe; no enviar el banco, PDF o historial completos indiscriminadamente.
- Separar extracción, organización pedagógica, generación de actividades, recuperación de fuentes y respuesta del tutor en operaciones con contratos propios dentro del monolito. El modelo propone; el backend valida esquema, referencias, límites y procedencia antes de guardar. No es entrenamiento del modelo ni conocimiento nuevo permanente fuera del curso autorizado.
- Prompts versionados y salida estructurada validada: explicación, acciones y propuestas de hijos. El servidor asigna IDs, padre y propietario.
- Límites iniciales propuestos y configurables: tres propuestas de rama por expansión, profundidad 5, 30 nodos por árbol y tamaño máximo de mensaje. Probarlos con usuarios y ajustarlos sin perder claridad.
- Idempotencia, límite de peticiones por sesión, presupuesto de tokens, timeout y reintentos acotados. Registrar latencia/coste estimado sin guardar conversaciones completas en logs.
- Estados de solicitud pendientes/completadas/fallidas para evitar que reintentar cree nodos o cargos duplicados. Un proveedor puede haber cobrado aun si la respuesta se perdió; no prometer exactamente una llamada sin soporte real del proveedor.
- Datos y mensajes no pueden sustituir instrucciones del sistema. Probar prompt injection y solicitudes de claves de actividades activas.
- En una comprobación sin ayuda, todos los accesos al tutor deben respetar ese modo desde el backend. Si el estudiante necesita ayuda, permitir pasar a práctica asistida y registrar el cambio; no seguir etiquetándolo como independiente.
- No se puede detectar ayuda externa. «Sin ayuda» significa sin ayudas de CALIBRA durante ese intento y sin exposición previa conocida al mismo caso, no una certificación de independencia absoluta.
- Para P0, las actividades puntuables de transferencia y sus respuestas se preparan/revisan antes; no calificar con claves improvisadas por el modelo. Las actividades creadas al importar material se identifican como propuestas generadas hasta validar su sustento, respuesta y criterio. Pueden servir para práctica formativa con devolución provisional, pero no acreditan transferencia verificada automáticamente.
- Evaluar exactitud objetiva con reglas apropiadas; justificaciones abiertas con rúbrica versionada y devolución revisable. «No hay evidencia suficiente» es un resultado válido.
- Distinguir explicación generada de contenido revisado. Citar el material usado sin inventar fuentes ni atribuir inferencias al examen oficial.
- Un proveedor de pruebas controlado sirve para tests, identificado como tal. Un fallo real se muestra como fallo, no como éxito con una respuesta fija encubierta.

## 11. Fases por entregables verificables

Cada fase incluye código, pruebas y documentación del flujo afectado. Mantener cambios revisables; no hacer commits ni push salvo petición del usuario. No es un cronograma garantizado: faltan disponibilidad del equipo y presupuesto.

| Fase | Entrega | Criterio de aceptación |
| --- | --- | --- |
| 0. Validar y curar | Observar un postulante, revisar casos con un docente si es posible, preparar conjuntos iniciales | Problema observado y actividades/rúbricas registradas sin fingir resultados; confirmar reglas del evento |
| 1. Persistencia y contenido | NestJS, sesión invitada, PostgreSQL/ORM acordados, migraciones/importador y catálogo | Reimportación sin duplicados, FKs/conteos comprobados; otra sesión no accede a datos ajenos |
| 2. Primera práctica real | Crear intento, responder, entregar y revisar mediante API | React → NestJS → DB; refrescar y reiniciar servidor conserva datos; corrección sin depender del cliente |
| 3. Tutor y árbol vertical | Abrir desde pregunta del banco, obtener raíz IA, ampliar/aclarar, guardar y retomar | Relación con la duda original; sin ciclos/cruces de propietario; fallos de IA visibles y reintentos sin duplicados |
| 4. Aplicación y evidencia | Actividad distinta, rúbrica/devolución, historial de ayuda y enlace a repaso | Abrir nodos no crea aprendizaje; no filtrar respuestas antes de entregar; caso repetido no cuenta como transferencia nueva |
| 4A. Mis cursos y material propio | Crear curso, subir PDF con texto/TXT/Markdown, procesar, revisar estructura, abrir el árbol sobre un fragmento y proponer práctica | Material fuera del banco procesado realmente; trazabilidad hasta página/fragmento; permisos, recuperación tras reinicio y extracción incompleta visibles; actividades generadas no fingidas como revisadas. Reutiliza el tutor de la fase 3, no lo duplica |
| 5. Diseño y cierre P0 | Rediseño del recorrido, accesibilidad, despliegue y prueba con usuario | URL pública funcional, móvil/escritorio, errores recuperables; registrar observaciones reales del usuario |
| 6. Completar P1 | Diagnóstico, simulacros y restantes flujos integrados; más contenido revisado; DOCX/OCR y más capacidades en cursos personales | Sin pantallas que aparenten integración inexistente; formatos/cobertura declarados; regresión de reglas y datos; retirar dependencias locales obsoletas |

Comenzar despliegue de un esqueleto en fase 1 para no descubrir problemas de hosting al final. Prototipar el layout mientras se integra; no posponer toda la usabilidad a fase 5.

Antes de cada fase: releer `AGENTS.md` y esta sección; revisar cambios ajenos; definir una actividad de aceptación. Al terminar: anotar qué funciona, qué se probó y qué sigue propuesto. Una decisión técnica nueva debe quedar documentada antes de utilizarla como requisito.

## 12. Verificación y demostración honesta

### Técnica

- Conservar las pruebas existentes; ejecutar `npm test`, `npm run typecheck`, `npm run lint` y `npm run build` al cerrar cambios de frontend. Documentar scripts de backend solo cuando existan.
- Tests de integración con PostgreSQL aislado: migraciones, importación repetible, autorización por sesión, FK/unicidad, entrega concurrente y reversión atómica ante fallos.
- Contratos IA con respuestas controladas: JSON inválido, timeout, padre inexistente, ciclo, tamaño excesivo, inyección y reintento. Pruebas rutinarias sin llamadas de pago.
- Importación con fixtures: PDF con texto, PDF escaneado, archivo corrupto/protegido, tamaño excedido, MIME falso, fórmula/tabla ambigua y extracción parcial. Duplicado/reintento sin cursos ni actividades duplicadas; cancelar y reiniciar sin perder estado ni dejar trabajos eternos.
- Seguridad documental: otra sesión no puede listar, descargar, recuperar fragmentos ni consultar trabajos ajenos; contenido malicioso no cambia instrucciones. Probar SSRF/redirecciones en fuentes externas, borrado de derivados/cachés y ausencia de documentos privados en `dist/` o logs.
- Calidad de adaptación: cada cita apunta a un pasaje real de la versión correcta; revisar pertinencia de temas/actividades, contradicción con fuente externa y abstención cuando no existe sustento. Confirmar que reemplazar un documento no altera silenciosamente un intento anterior.
- UI real: responder → abrir tutor → explorar → aplicar → ver evidencia → refrescar y retomar. Incluir caída de API/IA y pérdida de conexión.
- Verificar que la compilación pública y las respuestas de red no contienen claves/rúbricas de actividades activas. Comprobar el antiguo enlace `/resolver` y navegación directa a rutas nuevas.

### Pedagógica y de producto

- Mínimo del evento: al menos una persona que vive el problema. Para menores, adulto responsable presente y sin recoger datos personales, conforme al PDF.
- Preguntar «muéstrame cómo estudiaste la última vez» y observar; no inducir «¿la IA te hace pensar menos?».
- Evaluar respuesta nueva y justificación, ayuda requerida, utilidad, tiempo extra y abandono. No usar clics o mensajes como prueba de aprendizaje.
- Revisar contenido con un docente cuando sea posible. Un piloto de una persona valida problemas/usabilidad, no prueba eficacia causal.
- Para un piloto posterior: pretest, tiempos comparables, preguntas distintas de dificultad comparable, rúbrica común y comparación con estudio habitual; medir retención días después. Asignación aleatoria si es viable.
- Registrar ejemplos anonimizados y limitaciones. No inventar testimonios ni porcentajes de mejora para el pitch.

### Guion corto de demo

1. Mostrar el problema con una respuesta y razonamiento reales o con un caso de demostración explícitamente identificado.
2. Explorar dos ramas útiles y volver a la duda original.
3. Resolver la aplicación nueva sin ayudas de CALIBRA.
4. Mostrar evidencia concreta y posibilidad de refuerzo, también si el estudiante falla.
5. Mostrar «Mis cursos»: importar un material propio distinto del banco, revisar un tema propuesto y abrir su explicación/árbol con referencia al original. Enseñar una actividad generada como propuesta y, si está conectado, un complemento externo con cita verificable. No presentarlo como revisión académica automática.
6. Refrescar para comprobar persistencia; cerrar con lo observado en la prueba real y lo que falta validar.

Si se utiliza un reloj de prueba para enseñar el repaso diferido, rotularlo como simulación. No mostrar retención ya demostrada cuando no transcurrió el intervalo.

## 13. Adopción, coste y sostenibilidad

Hipótesis a validar, no modelo de negocio confirmado: entrada por postulantes que ya practican exámenes y posible adopción por academias interesadas en reforzar errores entre clases. Preguntar quién lo usaría, quién decidiría/pagaría y qué tarea sustituye antes de construir un panel institucional.

- Indicador de utilidad: el estudiante identifica un punto concreto que antes no podía aplicar y entiende qué practicar después.
- Medir coste de IA por sesión útil, llamadas por árbol, latencia y carga de revisión de contenido; no solo coste por mensaje. Para material propio, incluir extracción/OCR, páginas/tokens, búsquedas, almacenamiento, reintentos y regeneraciones; establecer cuotas para evitar costes inesperados.
- Reusar contenido revisado y limitar expansiones; no compartir respuestas personalizadas entre usuarios sin considerar privacidad/contexto.
- Desplegar frontend estático, una instancia NestJS, una PostgreSQL persistente y almacenamiento privado persistente para originales (volumen seguro u objetos, según hosting). Sin brokers ni servicios distribuidos adicionales para P0; proveedor externo de IA/búsqueda/OCR solo cuando se integre explícitamente.
- Documentar migración de despliegue, healthcheck, variables, HTTPS, copia de seguridad y restauración. Reiniciar no debe borrar exploraciones.
- No afirmar escalabilidad masiva por contar con un prototipo. Estimar capacidad y precio tras observar consumo real.

## 14. Decisiones pendientes antes de ejecutar

| Pendiente | Base propuesta para avanzar |
| --- | --- |
| Motor y ORM definitivos | PostgreSQL + TypeORM, documentar elección al iniciar fase 1 |
| Proveedor/modelo IA y presupuesto | Uno con salida estructurada suficiente; confirmar credenciales sin exponerlas |
| Hosting y dominios | Una API, una DB y frontend; preferir proxy de mismo origen |
| Tiempo/equipo y alcance de entrega | Priorizar P0, no prometer todo P1 para la hackatón |
| Conceptos y calidad del material | Selección tras revisión; no asumir que los 2.027 registros son pares de transferencia |
| Identidad recuperable entre dispositivos | Sesión invitada P0; cuentas solo si se confirma necesidad |
| Validación real | Conseguir al menos un postulante y, si es viable, revisión docente |
| Formatos y extracción documental | PDF con texto + TXT/Markdown primero; límites configurables; DOCX/OCR y extracción multimodal tras probar calidad/coste |
| Fuentes externas | Elegir proveedor, criterios de selección y política por curso; citas reales, permiso de complementación y privacidad de consultas |
| Almacenamiento y retención | Ubicación privada persistente, cuotas, consentimiento informado de procesamiento y borrado de fuentes/derivados |
| Validación de actividades importadas | Distinguir propuestas formativas de comprobaciones verificadas; definir validadores/rúbricas y revisión por tipo de actividad |

**Siguiente unidad de trabajo recomendada:** seleccionar/revisar el primer conjunto conceptual y construir el recorrido mínimo de sesión + contenido + práctica persistida, dejando explícito el contexto de curso y la procedencia del contenido. Después añadir la importación vertical de «Mis cursos», conectar el tutor tanto al banco como al material propio y completar la comprobación; no empezar por un chat genérico, un resumidor de PDFs aislado ni por una reescritura visual de toda la app.

## 15. Revisión técnica y decisiones para aprobar

Revisión hecha sobre el código real (30/10/2026). Las afirmaciones de la sección 3 se comprobaron: rutas en `src/App.tsx:31-35`, enlace roto a `/resolver` en `src/components/admision/PreguntaDeAdmision.tsx:219`, adaptador local con forma de Supabase en `src/integrations/supabase/client.ts`, e identidad fija `ID_DEL_ALUMNO = "local"` en `src/integrations/local/consulta.ts:14`. El defecto de entrega también se confirma: `src/hooks/useIntentoDeAdmision.ts:167` ignora el booleano de `vaciarCola()` y corrige igual.

### 15.1 Problemas del plan anterior y corrección

| Problema | Corrección |
| --- | --- |
| P0 acumula backend, sesión, práctica, tutor, árbol, evidencias, importación documental, fuentes externas, rediseño, despliegue y validación. Es alcance de varias semanas. | P0 = recorrido banco → tutor/árbol → aplicación → evidencia, desplegado. «Mis cursos» entra como **P0-b** (fase 4A) solo si P0 está verde. Fuentes externas pasan a P1. |
| La fase 2A (importación) iba antes del tutor, pero el diferencial que se juzga es tutor + transferencia. | Orden nuevo: 1 → 2 → 3 → 4 → 4A → 5. La importación reutiliza el tutor ya probado. |
| No hay estimación temporal ni fecha de entrega. | Ver 15.7: bloques con presupuesto en días-persona; confirmar la fecha del evento antes de iniciar. |
| «Compartir funciones puras» sin decidir cómo. | Ver 15.2: el motor se comparte por workspace; no se reescribe. |
| Ninguna librería concreta para validación, subida, PDF, IA ni tests de integración. | Ver 15.3. |
| La API se describe en abstracto, sin mapearla al adaptador actual. | Ver 15.4: correspondencia 1:1 con las funciones locales existentes. |

### 15.2 Estructura del repositorio

npm workspaces, sin reorganizar el frontend:

```text
package.json               # "workspaces": ["backend", "packages/*"]
src/                       # Frontend actual, intacto
packages/motor/            # Se mueve src/lib/admision/motor (+ temario) aquí
backend/                   # NestJS
```

- `src/lib/admision/motor` es puro: no usa `window`, `document` ni `localStorage`; solo importa el alias `@/lib/admision/...` y `@/lib/onboarding/catalog`. Al moverlo, reemplazar el alias por imports relativos y reexportar desde la ruta antigua para no tocar las pantallas.
- Las pruebas del motor (Vitest) se mueven con él. El backend usa **Vitest** también (con `unplugin-swc` para decoradores) para no mantener Jest y Vitest a la vez.
- NestJS compila en CommonJS por defecto y el motor es ESM. Compilar `packages/motor` con salida doble (ESM + CJS vía `exports`) o configurar el backend con `"module": "nodenext"`. Validar con una prueba que importe el motor desde Nest antes de seguir.

### 15.3 Stack concreto propuesto

| Área | Elección | Razón |
| --- | --- | --- |
| Backend | NestJS 11, Node 22 LTS | Requisito; versión LTS |
| DB | PostgreSQL 16 | Ya propuesto en AGENTS |
| ORM | TypeORM 0.3 con migraciones, `synchronize: false` | Integración nativa con Nest; un solo ORM |
| Validación | `zod` + pipe propio (`ZodValidationPipe`) | Un mismo esquema valida DTO HTTP **y** la salida estructurada de la IA; `class-validator` no cubre lo segundo |
| Config | `@nestjs/config` + esquema zod; falla al arrancar | AGENTS §11 |
| Sesión | Cookie `atlas_sid` HttpOnly; en DB se guarda `sha256(token)`; guard global que inyecta `actorId` | Nunca confiar en IDs del cliente |
| Rate limit | `@nestjs/throttler`, más estricto en `/tutor/*` e importaciones | Coste de IA |
| Subida | `@nestjs/platform-express` (multer en memoria, `limits.fileSize`) + `file-type` para validar la firma real | MIME falso |
| PDF | `unpdf` (pdf.js sin DOM) para texto por página | Sin binarios nativos; OCR fuera de P0 |
| Búsqueda en fragmentos | Full-text de PostgreSQL: columna `tsvector` generada con configuración `spanish` + índice GIN | Sin base vectorial (AGENTS §10) |
| Trabajos de importación | Tabla `trabajos_importacion` + worker en proceso con `SELECT … FOR UPDATE SKIP LOCKED`, concurrencia 2 | Sobrevive reinicios sin broker |
| IA | Puerto `TutorAI`; adaptador Anthropic (`@anthropic-ai/sdk`) con salida forzada por *tool use* y validación zod; `AI_PROVIDER=fake` para tests | Proveedor pendiente de aprobación (15.5) |
| Tests de integración | `@testcontainers/postgresql` | DB real aislada, sin tocar datos de desarrollo |
| Despliegue | Una imagen Docker: Nest sirve el `dist/` del frontend (`@nestjs/serve-static`) en el mismo origen + PostgreSQL gestionado + volumen persistente para originales | Mismo origen = sin CORS ni CSRF cruzado; un solo servicio |

### 15.4 API: correspondencia con el adaptador actual

El frontend llama hoy a cinco funciones locales de `src/integrations/local/servidor.ts`. Se reemplazan una a una por un cliente HTTP en `src/integrations/api/`, conservando las firmas que consumen los hooks; después se elimina el adaptador `supabase` (no se emula Supabase en el servidor).

| Local actual | Endpoint `/api/v1` |
| --- | --- |
| `armar` (`admision-armar`) | `POST /intentos` → 201 `{ intento_id, preguntas }` (número real, aunque sea menor que el cupo) |
| `preguntasDelIntento` | `GET /intentos/:id/preguntas` (DTO sin clave ni solución) |
| Cola de respuestas (`admision_respuestas`) | `PUT /intentos/:id/respuestas`, lote `{ pregunta_id, opcion, marcada, confianza, version }[]`; ignora una `version` menor que la guardada |
| `entregar` (`admision-entregar`) | `POST /intentos/:id/entrega` con `Idempotency-Key`; 409 si quedan respuestas sin confirmar y el plazo no venció |
| `revelar` | `POST /intentos/:id/preguntas/:pid/solucion` (registra la ayuda) |
| `temasFrecuentes` | `GET /temas-frecuentes?area=` |
| Nuevo | `POST /arboles`, `GET /arboles/:id`, `POST /arboles/:id/nodos/:nid/expandir`, `POST /arboles/:id/nodos/:nid/aclarar` |
| Nuevo | `POST /comprobaciones`, `PUT /comprobaciones/:id/respuesta`, `GET /evidencias` |

Errores con un formato único `{ error: { codigo, mensaje } }`; `src/lib/function-error.ts` se adapta a él.

Corrección del defecto de entrega: el hook solo llama a `/entrega` si el último `PUT /respuestas` respondió 200; si no, muestra «N respuestas sin guardar» y ofrece reintentar. El servidor es autoritativo sobre el plazo (`intentos.vence_en`).

### 15.5 Modelo del árbol y contrato de IA

```sql
CREATE TABLE nodos (
  id uuid PRIMARY KEY,
  arbol_id uuid NOT NULL REFERENCES arboles(id) ON DELETE CASCADE,
  padre_id uuid NULL,
  profundidad smallint NOT NULL CHECK (profundidad BETWEEN 0 AND 5),
  orden smallint NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('raiz','aclaracion','subpregunta','ejemplo','contraste','conexion','aplicacion')),
  titulo text NOT NULL,
  contenido text NOT NULL,
  procedencia text NOT NULL,
  prompt_version text NOT NULL,
  UNIQUE (arbol_id, id),
  FOREIGN KEY (arbol_id, padre_id) REFERENCES nodos (arbol_id, id),  -- el padre pertenece al mismo árbol
  UNIQUE (arbol_id, padre_id, orden)
);
CREATE UNIQUE INDEX una_raiz_por_arbol ON nodos (arbol_id) WHERE padre_id IS NULL;
```

- Los ciclos son imposibles por construcción: el servidor solo crea hijos bajo un nodo existente y `padre_id` es inmutable. No se necesita detección de ciclos en ejecución.
- Límite de 30 nodos por árbol: se verifica en la misma transacción bloqueando la fila de `arboles` (`SELECT … FOR UPDATE`).
- La IA devuelve solo `{ explicacion, hijos_propuestos: [{ tipo, titulo, contenido }] (máx. 3) }`. El servidor asigna `id`, `padre_id`, `profundidad`, `orden` y actor.
- Idempotencia: tabla `solicitudes_ia (actor_id, clave, estado, respuesta_json, UNIQUE (actor_id, clave))`. Un reintento con la misma clave devuelve el resultado guardado; si sigue `pendiente`, 409.
- Sin transacción abierta durante la llamada: (1) registrar solicitud `pendiente`; (2) llamar al proveedor con timeout de 30 s y un reintento; (3) validar con zod; (4) transacción corta que inserta nodos y marca `completada`.
- Prompts en `backend/src/modules/tutor/prompts/` con versión en el nombre; la versión se guarda en cada nodo.
- Modelos sugeridos si se aprueba Anthropic: `claude-sonnet-5-5` para tutor y devoluciones; `claude-haiku-5-5` para organizar material importado. Confirmar presupuesto antes.

### 15.6 Evidencias

Enum `tipo_evidencia`: `consulto_explicacion`, `consulto_solucion`, `resolvio_con_ayuda`, `resolvio_sin_ayuda`, `aplico_en_repaso`. Solo los casos de uso del servidor insertan evidencias (entrega, comprobación, revelar). Abrir o leer un nodo se registra como **interacción** en otra tabla, nunca como evidencia. `resolvio_sin_ayuda` exige que no haya solicitudes al tutor entre el inicio y la entrega de la comprobación (verificado por consulta, no por una bandera del cliente) y que la actividad no pertenezca a una familia de equivalentes ya expuesta al actor.

### 15.7 Bloques de trabajo con presupuesto

Estimación para una persona; ajustar al equipo y a la fecha real del evento.

| Bloque | Contenido | Días |
| --- | --- | ---: |
| A | Workspaces, mover motor, Nest + config + Postgres + migración inicial + sesión invitada + despliegue del esqueleto | 2 |
| B | Importador del banco (idempotente, `--dry-run`, reporte de conteos) | 1 |
| C | Intentos y respuestas por API; hooks migrados; defecto de entrega corregido | 2 |
| D | Tutor + árbol con proveedor `fake` y luego real; UI escritorio/móvil; reemplazo de `/resolver` | 3 |
| E | 2-3 conceptos de Aritmética curados con actividad de transferencia; comprobación y evidencias | 2 |
| F | Prueba con un postulante, ajustes y guion de demo | 1 |
| **P0** | | **11** |
| G (P0-b) | Mis cursos: subida TXT/MD/PDF con texto, trabajo de importación, fragmentos FTS, árbol sobre fragmento | 3-4 |

Si la fecha no alcanza para G, se presenta como siguiente paso con su diseño documentado, no como pantalla simulada.

### 15.8 Decisiones a aprobar

1. Recorte: fuentes externas a P1; Mis cursos como P0-b, después del tutor.
2. Stack de 15.3 (en especial zod en lugar de class-validator y Vitest en el backend).
3. Workspaces y traslado de `motor` a `packages/motor`.
4. Proveedor de IA (Anthropic propuesto) y tope de gasto.
5. Hosting de un solo servicio, mismo origen y volumen persistente. **Propuesta reemplazada por la separación frontend/backend solicitada después; ver sección 16.**

## 16. Estado implementado y verificación para entrega

Actualización del 30/10/2026. El usuario solicitó carpetas separadas y autorizó Docker para el backend; prevé frontend en Vercel y backend Docker en VM Azure, sin abordar todavía ese despliegue. Esta decisión reemplaza el frontend en raíz y el servicio único propuestos antes.

### Estructura actual

```text
frontend/             React/Vite y assets; salida frontend/dist/
backend/src/          NestJS: identidad, contenido, práctica, tutor y seguimiento
backend/data/         Banco privado y datos UNMSM, con fuentes originales preservadas
backend/workers/      Extracción documental aislada
backend/test/         Pruebas HTTP con PostgreSQL real
packages/motor/       Núcleo compartido: armado, corrección, Leitner, molde y temario
scripts/              Verificación del monorepo e importación desde extracción externa
```

Un solo lockfile npm en la raíz. Los demás motores de renderizado/cálculo de la demo se conservan en frontend; no se trasladó código ajeno al flujo compartido por mera simetría. La API ya no sirve el frontend. Las dependencias se actualizaron a versiones sin hallazgos en la auditoría npm realizada, manteniendo React 18 y adoptando Vite 6, React Router 7, Vitest 5 y Zod 4.

### Flujos conectados

| Área | Implementado | Límite relevante |
| --- | --- | --- |
| Persistencia | PostgreSQL/TypeORM, migraciones, snapshot importado de forma repetible, sesiones y autorización por actor | Sesión invitada; sin recuperación entre dispositivos |
| Práctica | Crear, responder con versión, revelar cuando corresponde, entregar y corregir; diagnóstico/simulacros y repasos | Los exámenes históricos son selecciones disponibles; no cuadernillos íntegros |
| Tutor | Adaptador Anthropic, salida estructurada validada, idempotencia, árbol, expansión y aclaración con revisión anterior | Sin credenciales, error explícito; la prueba controlada no valida IA real |
| Comprobación | Actividades propias de tres conceptos, resultado numérico y justificación persistida, bloqueo de ayudas durante el intento | La justificación no se califica automáticamente; no certifica comprensión profunda |
| Mis cursos | Cursos personales, importación privada PDF con texto/TXT/Markdown, worker, trabajos recuperables, fragmentos y citas; propuestas de práctica guardadas | Organización IA sobre muestra acotada; revisión manual; prácticas generadas no revisadas |
| Ejecución | Dockerfile backend, Compose con DB y volúmenes; frontend separado y cliente HTTP configurable | Arranque local, no despliegue cloud ni configuración final de producción |

El prompt versionado actual está en `backend/src/modules/tutor/ai.ts` (`tutor-v1`), no en una carpeta de prompts separada. El modelo real se proporciona por configuración; no se garantiza disponibilidad de los nombres exploratorios propuestos en la sección 15. Los trabajos de documentos tienen concurrencia uno en este alcance. La búsqueda full-text está indexada, pero no se presenta como un buscador completo del curso; el tutor utiliza el fragmento seleccionado.

### Verificaciones realizadas

- `npm run verify`: lint, tipos frontend/backend, **384 pruebas en 38 archivos**, compilación de los workspaces, **22 pruebas HTTP con PostgreSQL Docker real** y auditoría npm sin vulnerabilidades reportadas.
- Imagen backend construida y ejecutada con Node 22 y PostgreSQL 16. Ambos servicios saludables; se comprobó práctica/corrección, PDF en worker, conservación de sesión/datos tras reinicio y borrado del original/derivados.
- Banco con claves fuera de los assets públicos. Los recursos existentes se trasladan, no se eliminan ni se regeneran desde la extracción privada.
- Comprobación básica en navegador: inicio, navegación a Admisión, 26 exámenes cargados desde la API, sin alertas de error ni desbordamiento horizontal al ancho observado. No sustituye un recorrido visual completo móvil/escritorio con IA real.
- Las pruebas habituales no llaman modelos de pago. El arranque local conserva `AI_PROVIDER=disabled` salvo configuración explícita.

Comando único antes de entregar cambios: `npm run verify`. Consultar `README.md` y `backend/README.md` para arranque y contratos. No dar una fase por terminada por la existencia de un archivo: contrastar siempre con estas comprobaciones y con los límites de cada flujo.

### Pendiente, sin presentarlo como terminado

- Configurar credenciales/modelo y evaluar respuestas reales, incluyendo calidad pedagógica, exactitud y resistencia a instrucciones maliciosas del material.
- Validación con postulantes/docentes, revisión académica de actividades y retención diferida real. Una prueba técnica no acredita eficacia educativa.
- OCR, fuentes externas, edición avanzada de cursos, recuperación de cuentas e importación voluntaria del historial local legado.
- Definir retención/respaldos, cuotas/coste real y completar revisión operativa antes de uso público.
- Despliegue en Azure/Vercel, HTTPS, dominios y política final de cookies/CORS. No se ejecutó ninguno de esos pasos.

**Criterio para push:** verificaciones técnicas correctas, diferencias revisadas, sin secretos/archivos generados y commits locales coherentes. Esto permite compartir la primera versión funcional; no equivale a declararla lista para producción o a afirmar que todo P0/P1 fue validado.
