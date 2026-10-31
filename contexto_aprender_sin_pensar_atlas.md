# Contexto para el agente: grieta «Aprender sin pensar» y CALIBRA

Fecha de preparación: 30 de octubre de 2026.

## 1. Propósito y estado de este documento

Este documento reúne el contexto de una hackatón sobre educación peruana hacia 2036 y explica la grieta que se desea abordar: «Aprender sin pensar». También conecta el problema con CALIBRA, una plataforma de preparación para ingresar a la Universidad Nacional Mayor de San Marcos (UNMSM).

El objetivo inmediato es que el agente comprenda el problema antes de proponer cambios. Las mejoras de producto descritas aquí son propuestas e hipótesis para evaluar; no constituyen una especificación funcional aprobada ni una orden de implementar todas las funcionalidades.

Distinguir siempre entre:

- Contexto de la convocatoria proporcionado por el usuario.
- Evidencia publicada y sus limitaciones.
- Descripción de CALIBRA proporcionada por el usuario, sin inspección del código.
- Hipótesis y posibles mejoras que todavía deben validarse.

## 2. Contexto de la hackatón

La temática es «Educación 2036: Las grietas que ya se ven». Busca abordar debilidades actuales de la educación peruana que podrían agravarse hacia 2036.

Los organizadores presentan cuatro puntos de partida:

1. La escalera rota hacia el primer empleo.
2. Aprender sin pensar.
3. Docentes sin sucesores.
4. Los que se quedan atrás.

Estas brechas son orientaciones, no desafíos obligatorios con una solución predefinida. El usuario quiere centrarse en la segunda.

Texto de la grieta compartido por el usuario:

> GRIETA 02. Aprender sin pensar.
>
> HOY: El 95% de los universitarios peruanos usa IA para estudiar. Tras consultar a más de 500 personas en 50 países, Brookings concluye que hoy los riesgos de la IA generativa para los estudiantes superan sus beneficios.
>
> POR QUÉ CRECE: El acceso a la IA solo aumenta, pero las tareas y los exámenes siguen diseñados para un mundo sin ella.
>
> VALIDA CON: estudiantes y docentes.

La referencia a 2036 es un horizonte prospectivo. No hay en este documento una predicción cuantificada de deterioro cognitivo hacia ese año.

## 3. Definición del problema

La preocupación central es que el estudiante pueda completar actividades y producir respuestas correctas con IA sin desarrollar la comprensión y las habilidades que esas actividades pretendían ejercitar.

Conviene distinguir cuatro resultados:

- **Desempeño asistido:** qué consigue mientras dispone de ayuda.
- **Comprensión independiente:** qué puede explicar o resolver por su cuenta.
- **Transferencia:** qué puede hacer ante un problema nuevo que requiere el mismo principio.
- **Retención:** qué conserva y puede aplicar después de un intervalo.

Una respuesta correcta asistida no demuestra por sí sola los otros tres resultados.

La grieta incluye preguntas sobre cómo se estudia, cómo se solicita y utiliza ayuda, cómo se evalúa la comprensión y qué evidencias obtiene el docente. El uso de IA, por sí solo, no es evidencia de dependencia ni de falta de aprendizaje.

### Manifestaciones que se pueden investigar

1. Pedir una solución completa antes de intentar comprender el problema.
2. Leer una explicación clara y confundir familiaridad con dominio.
3. Repetir pasos sin poder justificar las decisiones.
4. Aceptar respuestas sin verificar supuestos, errores o contradicciones.
5. Resolver un ejemplo conocido y fallar cuando cambia su presentación o una condición.
6. Entregar un producto de buena calidad que no permite al docente identificar qué comprendió el estudiante.

Estas manifestaciones son hipótesis de observación, no características atribuidas a todos los estudiantes peruanos.

## 4. Evidencia y límites de las cifras

### 4.1. El dato peruano del 95%

La cifra está vinculada al reporte 2025 de uDocz, «Impacto de la IA en la Educación Superior Peruana: retos y oportunidades para docentes y estudiantes». La página pública señala la participación de más de 450 estudiantes y 250 docentes. La reseña de una presentación publicada por la UPC reporta un 95% de uso estudiantil, un 8% de docentes que integra formalmente IA en su estrategia pedagógica y un 74% que demanda formación continua. [1][2]

Límites: no se pudo comprobar la representatividad nacional ni revisar toda la metodología a partir de la página pública. El informe completo solicita un formulario. La adopción no mide directamente dependencia, pensamiento crítico ni pérdida de aprendizaje.

Formulación apropiada: «El estudio de uDocz reporta un uso elevado de IA entre los estudiantes participantes». No presentarlo como un censo nacional ni extrapolar ese porcentaje a postulantes a San Marcos.

### 4.2. Brookings, enero de 2026

El informe «A new direction for students in an AI world: Prosper, prepare, protect» reúne entrevistas, grupos focales y consultas con más de 500 participantes en 50 países, revisión de más de 400 estudios y un panel Delphi. Los autores concluyen que, en la trayectoria actual, los riesgos en educación infantil superan los beneficios, y reconocen el potencial de herramientas integradas con criterios pedagógicos. [3]

Es una síntesis y evaluación de riesgos, especialmente sobre niños y jóvenes, no un experimento causal con universitarios o postulantes peruanos. No prueba que toda IA educativa perjudique a cualquier estudiante. Entre sus recomendaciones figuran herramientas que enseñen, formación docente y diseño con las comunidades educativas.

### 4.3. Experimento en matemáticas: Bastani y colaboradores, 2025

Estudio publicado en PNAS con cerca de mil escolares de una escuela en Turquía. Comparó práctica tradicional, un asistente general basado en GPT-4 y un tutor con salvaguardas pedagógicas. El asistente general mejoró el desempeño durante la práctica, pero el rendimiento posterior sin IA fue un 17% inferior al del grupo de control. El tutor mitigó el perjuicio; no demostró una mejora posterior frente al control. [4]

El 17% es una diferencia relativa en calificaciones de esa evaluación, no una pérdida de inteligencia ni una diferencia de 17 puntos porcentuales. El estudio fue específico de matemáticas, una escuela y resultados a corto plazo.

### 4.4. Experimento en programación: TUM

Un ensayo con 275 estudiantes comparó un tutor con pistas, ChatGPT y recursos tradicionales en un ejercicio de programación de 90 minutos. Los grupos con IA obtuvieron mejores resultados en el ejercicio, sin mayores ganancias de conocimiento ni de comprensión de código. [5]

Ilustra la separación entre producir una solución funcional y comprenderla; no demuestra que todo uso de IA en programación tenga ese resultado.

### 4.5. Evidencia de beneficios y resultados mixtos

Un ensayo universitario de física publicado en Scientific Reports en 2025 encontró mayores ganancias inmediatas de aprendizaje con un tutor de IA cuidadosamente estructurado que con clases de aprendizaje activo en dos lecciones. No establece superioridad universal ni retención a largo plazo. [6]

Otro ensayo, de 2026, con 371 escolares, no encontró ventajas estadísticamente significativas en conocimiento, esfuerzo o estrategias de elaboración de las intervenciones estudiadas frente a ChatGPT estándar. [7]

La OCDE, en su Digital Education Outlook 2026, distingue entre mejorar la producción de una tarea y adquirir conocimientos, y destaca la importancia del diseño pedagógico. Delegar actividades cognitivas no siempre es perjudicial: importa qué se delega y cuál es el objetivo educativo. [8]

### 4.6. Estudios recientes que requieren cautela adicional

Un documento de trabajo de IZA de julio de 2026 encontró ganancias de conocimiento que persistían una semana después. Observó diferencias según el tipo de uso, pero no debe interpretarse esa asociación como una asignación aleatoria a cada comportamiento. [9]

Otro documento de trabajo, de octubre de 2026 y con 2.379 universitarios, encontró efectos negativos del acceso a un tutor sobre calificaciones y participación en la plataforma del curso. [10]

Ambos se identifican aquí como documentos de trabajo, sin asumir revisión por pares. Refuerzan la necesidad de evaluar cada intervención en su contexto.

## 5. Qué se debe resolver en términos de diseño

Estas son implicaciones de diseño propuestas a partir de la evidencia, no efectos ya comprobados de CALIBRA:

- Hacer que el estudiante participe en la actividad intelectual necesaria para aprender.
- Ofrecer ayuda suficiente para avanzar, adaptada a su conocimiento previo.
- Comprobar la comprensión mediante evidencias distintas de repetir la respuesta recién vista.
- Entrenar la revisión crítica de resultados cuando sea pertinente.
- Recuperar conceptos después de un intervalo.
- Dar al docente información útil con una carga de revisión razonable.

Evitar convertir el esfuerzo en un castigo. Una persona que no sabe empezar necesita un punto de entrada: una explicación, un ejemplo o una pista útil. Solicitar justificaciones en todos los pasos puede volver la experiencia agotadora.

## 6. Qué es CALIBRA según el usuario

CALIBRA es una plataforma que ayuda a postulantes a San Marcos a conocer su nivel, identificar qué reforzar y aprovechar mejor su tiempo de estudio.

Funcionalidades descritas:

- Diagnóstico inicial breve.
- Exámenes anteriores y simulacros, con o sin límite de tiempo.
- Práctica por curso y tema con soluciones explicadas.
- Cuaderno de errores y propuestas de repaso.
- Resultados y recomendaciones sobre qué estudiar después.
- Seguimiento del progreso.
- Referencias históricas de ingreso para la carrera elegida, sin garantizar el ingreso.
- Identificación de temas frecuentes.

El usuario indica que cuenta con más de 2.000 preguntas de 26 exámenes. Esta información no ha sido verificada mediante inspección de la base de datos o del repositorio.

No se han proporcionado aquí el stack, la arquitectura, el modelo de datos, las integraciones, la calidad de clasificación de las preguntas ni el estado de implementación de cada función. No inventar esos detalles.

## 7. Por qué CALIBRA puede encajar en esta grieta

La preparación para admisión exige adquirir conocimientos y capacidad de resolución, no solo producir tareas. Esto permite estudiar la distancia entre comprender una explicación asistida y resolver de forma independiente.

La propuesta actual de CALIBRA aborda principalmente orientación y práctica. Su conexión con la grieta se fortalecería si pudiera:

1. Identificar dificultades mediante evidencia suficiente.
2. Ayudar a trabajar esas dificultades.
3. Comprobar la aplicación en un problema nuevo.
4. Recuperar lo aprendido posteriormente.

El público de CALIBRA es preuniversitario y puede incluir menores y adultos. Las cifras de universitarios no describen automáticamente a este público. Hay que validar sus hábitos reales de estudio y de uso de IA.

Agregar un chatbot no demuestra que se resuelva la grieta. Tampoco basta con hacer una prueba de comprensión: detectar una dificultad debe conducir a un refuerzo útil.

## 8. Hipótesis de problema para validar

«Los postulantes que estudian con ayuda de IA pueden tener dificultades para reconocer qué comprenden de forma independiente. Necesitan comprobar y reforzar su capacidad de aplicar lo estudiado en preguntas nuevas».

Hipótesis relacionadas:

- Algunos estudiantes confunden entender una explicación con poder resolver por su cuenta.
- Una revisión breve de errores podría ayudar si muestra una utilidad inmediata.
- Los docentes podrían valorar evidencias sobre dificultades conceptuales, siempre que no aumenten excesivamente su carga.
- Un recorrido de refuerzo podría mejorar transferencia y retención frente al uso habitual de soluciones explicadas.

Todas deben validarse; no presentarlas como resultados del producto.

## 9. Mejoras propuestas para evaluar en CALIBRA

### 9.1. Práctica con ayuda adaptada

Ante una dificultad, recoger qué intentó el estudiante o dónde se perdió. Permitir explícitamente «no sé por dónde empezar». Ofrecer una pista, un recordatorio conceptual, un ejemplo o una explicación, según el caso.

### 9.2. Comprobación posterior a la explicación

Después de consultar una solución, plantear una variante o pedir justificar una decisión. Cambiar la representación, una condición o el contexto, no únicamente los números. Usar preguntas revisadas y alineadas con el mismo objetivo conceptual.

### 9.3. Cuaderno de errores con seguimiento

Registrar el intento, la ayuda recibida, la evidencia posterior y los repasos. Si se propone una causa del error, indicar el sustento y permitir corregirla. Un fallo puede deberse a cálculo, interpretación, desconocimiento, azar u otros factores.

Estados orientativos posibles: «consultó explicación», «resolvió con ayuda», «resolvió una variante sin ayuda» y «resolvió en un repaso posterior». Son observaciones sobre actividades concretas, no certificaciones generales de dominio.

### 9.4. Retos de revisión crítica

Presentar soluciones correctas e incorrectas para evaluar, justificar y corregir. Para el MVP, preparar y revisar previamente los casos. Revelar y explicar siempre cualquier error introducido deliberadamente al finalizar el reto.

### 9.5. Confianza y recomendaciones

Solicitar ocasionalmente una estimación de seguridad para compararla con desempeño real. Mostrar recomendaciones respaldadas por intentos observados, por ejemplo: «Necesitas practicar porcentajes con cambios sucesivos». No convertir una diferencia de confianza en una etiqueta psicológica.

## 10. Ejemplo de recorrido

Pregunta inicial: «Un producto recibe dos descuentos sucesivos del 20%. ¿El descuento total es del 40%?».

El estudiante responde 40%. CALIBRA pregunta cómo llegó a ese resultado y observa si sumó los porcentajes.

Refuerzo con un precio de S/100:

- Primer descuento: queda S/80.
- Segundo descuento: queda S/64.
- Descuento total: 36%.

Pregunta de transferencia: «Un precio sube 20% y luego baja 20%. ¿Vuelve al valor inicial? Justifica».

En este caso, S/100 pasa a S/120 y luego a S/96. El principio es que cada porcentaje actúa sobre una base distinta.

El objetivo no es memorizar 36%: es comprender la base de aplicación y reconocerla en un escenario nuevo. La devolución debe señalar lo que las respuestas permiten observar y lo que aún requiere práctica.

## 11. Validación con estudiantes y docentes

Punto de partida exploratorio: entrevistar y observar a 8–12 postulantes y 4–6 docentes de uno o dos cursos. Estos tamaños son sugerencias operativas, no muestras representativas.

Preguntas para estudiantes:

- Muéstrame la última pregunta para la que pediste ayuda a una IA.
- ¿Qué intentaste antes y qué hiciste con la respuesta?
- ¿Cómo comprobaste que era correcta?
- ¿Qué parte podrías explicar sin volver a leerla?
- ¿Qué te haría completar una revisión breve de tus errores?

Preguntas para docentes:

- ¿En qué actividades resulta difícil comprobar comprensión?
- ¿Qué dificultades reaparecen después de explicar una solución?
- ¿Qué pregunta breve usaría para comprobar un concepto?
- ¿Qué información permitiría tomar una decisión pedagógica concreta?
- ¿Cuánto tiempo puede dedicar a revisar esa información?

Observar actividades reales con consentimiento. Evitar preguntas que induzcan la respuesta, como «¿la IA hace que piensen menos?». No asumir que todos usan IA ni que todo error se debe a ella.

## 12. Alcance sugerido para la hackatón

Construir y demostrar un recorrido completo en un curso y dos o tres conceptos. Seleccionar una parte del banco de preguntas cuya clasificación y soluciones puedan revisarse.

Recorrido mínimo sugerido:

1. Intento inicial.
2. Identificación orientativa de la dificultad.
3. Ayuda específica.
4. Pregunta nueva sin asistencia durante ese intento.
5. Devolución y registro para repaso.

La IA podría interpretar explicaciones y adaptar ayudas apoyándose en contenido revisado. No es necesario asumir entrenamiento de un modelo propio. La arquitectura debe decidirse después de conocer el proyecto real.

## 13. Cómo evaluar el aporte

Resultado principal propuesto: desempeño en preguntas nuevas sin asistencia, alineadas con el objetivo trabajado.

Otros resultados:

- Retención varios días después.
- Capacidad para justificar decisiones y detectar errores.
- Correspondencia entre confianza y desempeño.
- Cantidad y tipo de ayuda requerida en tareas comparables.
- Tiempo adicional, abandono y utilidad percibida.

Diseño exploratorio posible: comparar el estudio habitual con IA o soluciones explicadas frente al mismo estudio más el recorrido de CALIBRA. Mantener tiempos comparables, medir conocimiento inicial, usar preguntas distintas y de dificultad comparable, y aplicar una rúbrica común. Si es viable, asignar condiciones al azar y revisar sin conocer el grupo.

No usar exclusivamente satisfacción, mensajes enviados, sesiones completadas o aciertos mientras se recibe ayuda como prueba de aprendizaje. Un piloto pequeño produce señales exploratorias; no justifica promesas generales de eficacia.

## 14. Límites y criterios para las propuestas del agente

- Mantener el objetivo de preparación para San Marcos y comprobar su pertinencia con usuarios reales.
- Diferenciar el modo de aprendizaje del modo de simulacro, que debe reflejar las condiciones oficiales verificadas.
- Diseñar refuerzo además de diagnóstico.
- No inferir comprensión profunda a partir de una respuesta de opción múltiple aislada.
- No prometer ingreso ni confundir puntaje de práctica con probabilidad validada de admisión.
- Evitar porcentajes de «comprensión» o etiquetas de «dependencia de IA» sin validación.
- Priorizar evidencias de aprendizaje frente a mecanismos de vigilancia.
- Mostrar criterios de evaluación y permitir revisión docente cuando corresponda.
- Minimizar los datos recogidos y contemplar un diseño adecuado para menores cuando formen parte del público.
- Separar los requisitos confirmados, las hipótesis de producto y las decisiones pendientes.
- No implementar todas las ideas de este documento automáticamente ni afirmar que ya existen en CALIBRA.

## 15. Encargo que este contexto deja al agente

Comprender la grieta y evaluar cómo adaptar CALIBRA para que cada error pueda convertirse en una oportunidad de refuerzo con evidencia posterior de comprensión.

Antes de proponer una solución técnica, identificar el público inicial, el comportamiento problemático a validar, la intervención mínima, el resultado esperado y cómo se medirá. Si se proporciona un repositorio, revisar su estado antes de asumir funcionalidades o arquitectura.

La pregunta orientadora es: «Después de estudiar con ayuda, ¿qué puede explicar y aplicar el postulante por su cuenta, y cómo puede CALIBRA ayudarlo a mejorar eso?».

## 16. Fuentes consultadas en la investigación previa

Las fuentes documentan el problema y resultados de otras intervenciones; no prueban la eficacia de CALIBRA.

1. uDocz. Reporte 2025: Impacto de la IA en la Educación Superior Peruana.
   https://www.udocz.com/academic_report

2. UPC, Innovación Educativa. El impacto de la IA en la educación superior peruana: hallazgos y aprendizajes del primer estudio 2025. Reseña de una presentación del estudio de uDocz, 13 de octubre de 2025.
   https://innovacioneducativa.upc.edu.pe/2025/10/13/el-impacto-de-la-ia-en-la-educacion-superior-peruana-hallazgos-y-aprendizajes-del-primer-estudio-2025-2/

3. Brookings. A new direction for students in an AI world: Prosper, prepare, protect. 14 de enero de 2026.
   https://www.brookings.edu/articles/a-new-direction-for-students-in-an-ai-world-prosper-prepare-protect/

4. Bastani y colaboradores. Generative AI without guardrails can harm learning: Evidence from high school mathematics. PNAS, 2025.
   https://doi.org/10.1073/pnas.2422633122

5. Less stress, better scores, same learning: The dissociation of performance and learning in AI-supported programming education. Computers and Education: Artificial Intelligence, volumen 10, junio de 2026.
   https://doi.org/10.1016/j.caeai.2025.100537

6. Kestin y colaboradores. AI tutoring outperforms in-class active learning: an RCT introducing a novel research-based design in an authentic educational setting. Scientific Reports, 2025.
   https://www.nature.com/articles/s41598-025-97652-6

7. Fütterer y colaboradores. Enhancing School Students’ Self-Regulated Learning through Generative AI Support: A Randomized Controlled Trial. Educational Psychology Review, 2026.
   https://link.springer.com/article/10.1007/s10648-026-10133-8

8. OECD Digital Education Outlook 2026: Exploring Effective Uses of Generative AI in Education.
   https://doi.org/10.1787/062a7394-en

9. Contractor y Reyes. Experimental Evidence on the Learning Impact of Generative AI. IZA Discussion Paper 18792, julio de 2026. Documento de trabajo.
   https://www.iza.org/index.php/publications/dp/18792/experimental-evidence-on-the-learning-impact-of-generative-ai

10. Liu y colaboradores. The Effects of Course-Integrated AI Tutoring on Student Performance and Engagement: A Randomized University Trial. IZA Discussion Paper 18989, octubre de 2026. Documento de trabajo.
    https://www.iza.org/publications/dp/18989/the-effects-of-course-integrated-ai-tutoring-on-student-performance-and-engagement-a-randomized-university-trial
