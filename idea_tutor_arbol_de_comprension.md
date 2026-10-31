# Idea: árbol de comprensión dentro de un tutor con IA

## Descripción general

El sistema funciona como un tutor que ayuda al estudiante a comprender conceptos, relacionarlos y utilizarlos. Una de sus funcionalidades es un **árbol de comprensión**: un espacio interactivo que organiza la información a partir de una pregunta, un tema o una dificultad planteada por el estudiante.

La raíz representa el tema solicitado. Sus nodos hijos desarrollan subtemas, preguntas, ejemplos o información complementaria relevante. Cada rama permite profundizar en una parte concreta sin perder la relación con la consulta original.

El árbol organiza la exploración del conocimiento. No establece un plan de estudio, un calendario ni una ruta obligatoria de aprendizaje.

## Propósito

Ayudar al estudiante a construir una comprensión propia de lo que consulta, mediante explicaciones conectadas y oportunidades para aplicar los conceptos.

La funcionalidad responde al riesgo de consultar una IA, recibir una respuesta y continuar sin comprobar si se comprendió. Propone que el estudiante pueda explorar las ideas que sostienen una explicación, formular nuevas dudas y poner a prueba lo que está entendiendo.

Su aporte al aprendizaje debe validarse; mostrar información en forma de árbol no garantiza por sí solo la comprensión.

## Estructura del árbol

### Nodo raíz

Nace de la solicitud del estudiante, por ejemplo:

- «Quiero entender los verbos».
- «¿Por qué esta oración está mal escrita?».
- «No entiendo cómo funciona una derivada».
- «Explícame esta solución de programación».

Contiene una explicación inicial breve que responde la consulta y presenta el contexto necesario para explorarla.

### Nodos hijos

Amplían o aclaran aspectos de su nodo padre. Cada uno desarrolla una idea concreta y tiene una relación comprensible con el contenido del que nace.

Pueden aportar:

- **Aclaraciones:** explicar términos o partes que resultan confusas.
- **Subpreguntas:** desarrollar dudas relevantes para comprender el concepto.
- **Ejemplos:** mostrar cómo funciona una idea en un caso concreto.
- **Contrastes:** distinguir conceptos que suelen confundirse.
- **Conexiones:** explicar relaciones con otras ideas pertinentes.
- **Aplicaciones:** proponer situaciones en las que utilizar lo comprendido.

Estas funciones orientan la generación del contenido; no necesitan aparecer como categorías técnicas en la interfaz.

## Funcionamiento

1. **El estudiante plantea una necesidad.** Escribe un tema, una pregunta o una dificultad.
2. **El tutor crea la raíz.** Ofrece una explicación inicial y propone pocas ramas relevantes.
3. **El estudiante elige qué explorar.** Al seleccionar un nodo, accede a su explicación y a información complementaria.
4. **La exploración genera nuevas ramas.** Puede pedir ejemplos, aclaraciones o relaciones sobre una parte concreta.
5. **El tutor adapta el contenido al contexto.** Las nuevas ramas conservan el vínculo con la duda original y con las preguntas posteriores.
6. **El estudiante puede aplicar lo comprendido.** En momentos pertinentes, el tutor propone una pregunta breve, una justificación o una situación nueva y ofrece retroalimentación.

La exploración es libre. El estudiante puede volver a la raíz, cambiar de rama o profundizar sin seguir una secuencia impuesta.

## Interacción dentro de un nodo

Cada nodo presenta un título claro, una explicación enfocada y, cuando aporte valor, un ejemplo.

El estudiante puede solicitar acciones como:

- «Explícalo más sencillo».
- «Dame un ejemplo».
- «¿Por qué ocurre esto?».
- «¿En qué se diferencia de este otro concepto?».
- «¿Cómo se relaciona con lo anterior?».
- «Quiero intentar aplicarlo».

Una solicitud puede ajustar la explicación del nodo o crear un hijo cuando introduce una idea que conviene explorar por separado. No es necesario convertir cada mensaje en una rama nueva.

## Ejemplo: comunicación y verbos

El estudiante solicita: «Quiero comprender los verbos».

**Raíz:** «Verbos: qué expresan y cómo funcionan».

Ramas iniciales posibles:

- **¿Qué pueden expresar?** Acciones, estados y procesos, con ejemplos.
- **¿Por qué cambia su forma?** Persona, número, tiempo y modo, desarrollados según la exploración.
- **¿Cómo funcionan en una oración?** Relación con el sujeto y concordancia.

Si pregunta «¿Por qué está mal decir “ayer nosotros caminó”?», el tutor enfoca la explicación en la concordancia: «nosotros» requiere una forma verbal correspondiente a la primera persona del plural. Puede abrir una rama que contraste «él caminó» con «nosotros caminamos» y explicar cómo «ayer» sitúa el ejemplo en el pasado.

Después puede proponer: «Corrige “mañana ellos viajará” y explica qué cambiaste».

Si la respuesta muestra una dificultad, el tutor aclara esa parte o propone una rama relacionada. La interacción permite observar qué necesita reforzar, sin atribuir automáticamente una causa a cada error.

## Cómo promueve una participación activa

Además de explorar información, el estudiante puede:

- Explicar una idea con sus propias palabras.
- Justificar una elección.
- Predecir un resultado.
- Detectar y corregir un error.
- Aplicar un concepto en una situación distinta.

Estas actividades acompañan la explicación cuando son útiles. No convierten cada nodo en una evaluación obligatoria ni bloquean el acceso a la ayuda. El estudiante también puede indicar que no sabe por dónde empezar y recibir un ejemplo o una explicación inicial.

Abrir o leer un nodo registra una interacción, no demuestra dominio. Las respuestas y aplicaciones aportan evidencia limitada sobre lo comprendido en esas actividades concretas.

## Criterios para generar ramas relevantes

- Responder a la consulta actual o a una duda surgida durante la exploración.
- Mantener una relación explícita con el nodo padre.
- Desarrollar una idea concreta por nodo.
- Evitar contenido repetido o tangencial.
- Mostrar pocas opciones inicialmente y ampliar bajo demanda.
- Ajustar profundidad, vocabulario y ejemplos a lo que el estudiante comunica.
- Mantener accesibles la raíz y el contexto de la rama explorada.
- Conservar la precisión de las explicaciones y revisar el contenido utilizado.

## Relación con el sistema

El árbol de comprensión es una funcionalidad del tutor, no la totalidad de la plataforma. Puede utilizarse cuando surge una duda durante el estudio o la revisión de un ejercicio.

En CALIBRA, una entrada posible sería una pregunta fallada o una solución que el postulante no comprende. Desde ahí se exploran los conceptos relevantes y se ofrecen oportunidades de aplicación. Esto describe una integración posible, no una funcionalidad ya implementada.

La idea central es **transformar una consulta aislada en una exploración de explicaciones, preguntas y ejemplos conectados, donde el estudiante participa y puede comprobar qué logra comprender y aplicar**.
