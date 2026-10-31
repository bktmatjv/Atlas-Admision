# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Postulantes a la Universidad Nacional Mayor de San Marcos (UNMSM), mayoritariamente jóvenes en edad escolar o recién egresados, muchos menores de edad. Estudian solos, a menudo desde el celular, entre clases de academia o en casa, preparándose para un examen de admisión de alta presión. Su trabajo: practicar con preguntas reales, saber cuánto les falta para su carrera y entender por qué fallan.

## Product Purpose

CALIBRA es una plataforma de preparación para la admisión a San Marcos que usa la IA para hacer pensar, no para entregar respuestas. El estudiante practica con preguntas de exámenes anteriores; cuando falla, el sistema rastrea el error hasta la idea que lo explica, el tutor conversa sobre su razonamiento y el estudiante lo comprueba con un problema nuevo sin ayuda. Éxito: que el postulante pueda resolver solo lo que antes solo había leído.

Acción principal (decisión del usuario, 31/10/2026): **practicar para San Marcos**. La entrada a la app gira en torno a la práctica y los simulacros por carrera; el tutor y el árbol de comprensión entran cuando el estudiante falla o quiere entender.

## Positioning

«La IA aporta la conversación; el sistema aporta la verdad.» El progreso (grafo de comprensión) solo cambia con evidencia: resolver una variante nueva sin ayuda cuenta; leer una explicación o abrir una rama no. Ataca el problema de «aprender sin pensar».

## Operating Context

- Práctica de admisión: 2.027 preguntas de 26 exámenes UNMSM anteriores; práctica por curso y tema, diagnóstico y simulacros cronometrados; corrección en el servidor.
- Elección de carrera con puntaje de corte («¿ingresarías hoy?»).
- Cuaderno de errores con repaso espaciado (Leitner).
- Tutor conversacional con artefactos (pregunta socrática, contraste, ejemplo paso a paso, visuales verificados, comprobaciones).
- Grafo / árbol de comprensión con estados derivados de evidencia (sin explorar, explorado, falló, aplicado).
- Mis cursos: el estudiante sube PDF con texto, TXT o Markdown y el tutor lo cita.
- Temario oficial: 19 cursos y 151 temas.
- Sesión invitada sin registro (cookie de 30 días); no hay recuperación de cuenta.

## Capabilities and Constraints

- Frontend React 18 + Vite + Tailwind 3 en `frontend/`; API NestJS separada. Rutas: `/admision`, `/admision/temas`, `/admision/intento/:id`, `/tutor`, `/aprender`, `/cursos`.
- Las comprobaciones curadas cubren solo Aritmética (porcentajes, proporciones, fracciones).
- La IA puede estar deshabilitada; la interfaz debe comunicar el fallo sin simular respuestas.
- Identificadores técnicos con el nombre anterior (clases `atlas-*`, cookie `atlas_sid`, paquetes `@atlas/*`) se conservan.

## Brand Commitments

- Nombre: **CALIBRA**. Lema: **«Aprende a pensar»**. Son lo único que se conserva del branding anterior.
- Rebrand completo aprobado por el usuario el 31/10/2026: el logo C, la paleta carmesí/crema y el gecko mascota anteriores no son vinculantes.
- Tono: cercano, en español peruano neutro, tuteo; sin promesas de ingreso ni de dominio.

## Evidence on Hand

- Banco real de preguntas UNMSM (servido por la API, claves privadas).
- Gráficos públicos de preguntas en `frontend/public/graficos/`.
- No hay testimonios, cifras de ingresantes ni validación con estudiantes: no inventarlos.

## Product Principles

1. Practicar primero: la acción principal siempre está a un clic.
2. Lo leído no es lo demostrado: nunca presentar navegación o uso de IA como progreso.
3. Honestidad sobre el resultado: puntajes y estados vienen del sistema, con incertidumbre explícita.
4. Ayuda graduada: pista antes que respuesta; permitir «no sé por dónde empezar».
5. Simple para alguien con nervios de examen: pocas decisiones por pantalla.

## Accessibility & Inclusion

Público mayoritariamente menor de edad y con uso frecuente desde celulares de gama media: contraste AA, objetivos táctiles amplios, respeto a `prefers-reduced-motion`, textos claros sin jerga técnica.
