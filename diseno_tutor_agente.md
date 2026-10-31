# Tutor agente: sistema + consciencia

> Estado: **implementado en la rama `feat/tutor-agente` (30/10/2026)**, verificado con el proveedor de pruebas y PostgreSQL real; **no validado con Groq real ni con estudiantes**. Fecha: 30/10/2026.
> Implementado: proveedor Groq/Anthropic/fake detrás de una interfaz propia, plantillas, normalizador y evaluador, validadores de las cinco capas, grafo con estados derivados (`GET /grafo`), ciclo agente con las seis herramientas, respuestas a bloques, comprobaciones desde plantillas (S13) y la vista `/tutor`. Contratos y límites en `backend/README.md` y en `PLAN_IMPLEMENTACION_ATLAS.md` §16.
> Diferencias respecto del texto de abajo: el cierre del turno se pide con una herramienta `responder`; `prediccion` y `practica` se emiten como `{ plantilla, semilla }` y el sistema arma el enunciado y las opciones; la verificación de atribución exige citas literales del estudiante; `ejemplo_paso_a_paso` y `en_tus_palabras` no se corrigen por plantilla (solo lectura provisional); las ideas clave fuera del catálogo se ignoran en lugar de descartar la operación.
> Continúa `idea_tutor_harness_comprension.md`, que ya está implementado (mapa de errores, rastros, ideas clave y evidencias). Plan de ejecución: `odd/tasks/tutor-agente.md`.

## 1. La visión

Atlas no busca **enseñar** lecciones: busca que el estudiante **comprenda el contexto detrás de sus errores** y así aprenda, en vez de «aprender sin pensar».

Para eso separamos dos partes:

| | **Sistema** (determinista) | **Consciencia** (el LLM) |
| --- | --- | --- |
| Qué es | El harness: herramientas, estado, reglas y memoria | El agente que conversa |
| Hace | Guarda y valida el grafo, calcula el rastro de error («backward»), corrige respuestas verificables, registra evidencias, bloquea ayudas durante una comprobación | Habla con el estudiante, pregunta por su razonamiento, explica, decide qué herramienta usar y propone cambios al grafo |
| Nunca hace | Redactar la conversación | Decidir qué quedó demostrado, poner notas, ver claves de comprobaciones activas |

> **El LLM aporta la cercanía; el sistema aporta la verdad.**

El estudiante ve dos cosas a la vez: **una charla con el tutor** y **su grafo de comprensión** (estilo Obsidian): qué temas se relacionan, dónde falló, qué exploró y qué ya aplicó solo.

## 2. El ciclo de un turno

```text
Estudiante escribe o responde un bloque
  → Sistema arma la foto: grafo del estudiante, último rastro, evidencias, intento activo
  → LLM (Groq por defecto, vía adaptador) razona y llama herramientas (máx. 4 por turno)
  → Sistema valida cada llamada y cada artefacto (§5)
  → LLM cierra con un mensaje + bloques + operaciones de grafo
  → Sistema valida, aplica las operaciones, recalcula estados y persiste el turno
  → Frontend muestra el mensaje, dibuja los bloques y actualiza el grafo
```

### Herramientas del sistema

| Herramienta | Tipo | Qué devuelve o hace |
| --- | --- | --- |
| `leer_grafo` | Lectura | Nodos, aristas y estados del estudiante (resumidos) |
| `leer_rastro` | Lectura | Último rastro de error: respuesta, idea clave, nivel de ayuda |
| `leer_evidencias` | Lectura | Historial reciente de evidencias |
| `leer_intento` | Lectura | Pregunta del banco y respuesta del estudiante (sin clave si sigue abierta) |
| `generar_practica` | Propuesta | Pide al sistema un ejercicio de **plantilla paramétrica** (§4.2) con distractores ligados a ideas clave |
| `proponer_comprobacion` | Propuesta | Muestra el botón para iniciar la comprobación curada; no la inicia sola |

Las operaciones del grafo no son herramientas: viajan en la respuesta final del turno (§3.1) para validarse juntas.

## 3. Artefactos

Cada turno del agente devuelve:

```json
{ "mensaje": "texto markdown", "bloques": [ ... ], "grafo_ops": [ ... ] }
```

`bloques` es una unión discriminada por `tipo`. El sistema descarta los tipos desconocidos y los bloques que no pasan la validación.

### 3.1 Grafo de comprensión

**El agente no entrega el grafo completo**, solo operaciones. El sistema las valida, las aplica, calcula los estados y entrega el grafo al frontend.

Operaciones del agente:

| Operación | Campos | Regla del sistema |
| --- | --- | --- |
| `crear_nodo` | `ref_temporal`, `tipo`, `titulo`, `resumen`, `idea_clave?`, `padre?` | `idea_clave` del catálogo o `null`; límite de nodos por estudiante |
| `relacionar` | `origen`, `destino`, `tipo` | Ambos nodos del estudiante; sin duplicados; sin ciclos en `subtema`/`requiere` |
| `editar_nodo` | `nodo`, `titulo?`, `resumen?` | Guarda la revisión anterior |
| `fusionar` | `nodos[]`, `en` | Solo nodos sin evidencias propias distintas; conserva aristas |
| `enfocar` | `nodo` | Solo cambia el foco de la vista |

Grafo que recibe el frontend (`GET /grafo`):

```json
{
  "version": 14,
  "foco": "n-cambio-base",
  "camino_error": ["n-porcentajes", "n-cambio-base"],
  "nodos": [
    {
      "id": "n-cambio-base", "tipo": "idea",
      "titulo": "Después de un aumento, la base cambia",
      "resumen": "El 20% de descuento se calcula sobre 120, no sobre 100.",
      "idea_clave": "cambio-de-base", "concepto": "porcentajes",
      "estado": "fallo", "senal": "posible_confusion",
      "origen": "ia", "evidencias": 2
    }
  ],
  "aristas": [
    { "id": "a3", "origen": "n-error-100", "destino": "n-cambio-base", "tipo": "confusion_con", "creada_por": "sistema" }
  ]
}
```

- **Tipos de nodo:** `concepto`, `idea`, `error`, `ejemplo`, `pregunta`.
- **Tipos de arista:** `subtema`, `requiere`, `relacionado`, `contrasta_con`, `ejemplo_de`, `confusion_con`.
- **`estado`** (solo lo calcula el sistema, desde la evidencia): `sin_explorar`, `explorado`, `fallo`, `aplicado`.
- **`senal`** (puede venir de la lectura del LLM, §4.3): `posible_confusion` o `null`. Se dibuja distinto del estado y nunca lo reemplaza.
- **Visualización:** `react-force-graph-2d`. Color por `estado`, tamaño por `evidencias`, `camino_error` resaltado, borde punteado si hay `senal`.

### 3.2 Bloques de conversación

| Tipo | Contenido | Input del estudiante | ¿Se corrige? |
| --- | --- | --- | --- |
| `pregunta_socratica` | `texto`, `respuestas_rapidas[]` | Texto libre o botón | Lectura provisional (§4.3) |
| `contraste` | `tuyo[]`, `correcto[]` | — | Verificado al emitir (§5.3) |
| `razonamiento_anotado` | Pasos de la justificación con `ok`/`revisar` | — | Provisional y verificado contra el texto real (§5.4) |
| `prediccion` | `pregunta`, `opciones[]` ligada a una plantilla | Elegir | **Determinista** (§4.2) |
| `ejemplo_paso_a_paso` | `pasos[]` revelables uno a uno | Botón + intento opcional por paso | Determinista si viene de plantilla |
| `visual` | `forma` + datos (§3.3) | — | Verificado al emitir (§5.3) |
| `practica` | Ejercicio de plantilla, opciones con distractores | Elegir o escribir | **Determinista**, formativa |
| `en_tus_palabras` | Consigna | Texto | Lectura provisional |
| `invitacion_comprobar` | Texto | Botón | Lleva a la comprobación curada |
| `cita` | Documento, página, fragmento | Ver original | Verificada (el fragmento existe y es suyo) |

### 3.3 Visuales declarativos

Sin imágenes generadas: cometen errores numéricos que nadie verifica. El agente describe el visual en JSON, el sistema recalcula y el frontend dibuja.

| Forma | Datos | Verificación |
| --- | --- | --- |
| `cadena_porcentual` | `pasos: [{valor}, {op: "+20%", valor}]` | Recalcula cada paso |
| `barra_de_partes` | `total`, `partes`, `marcadas` | `marcadas ≤ partes`, fracción coherente |
| `tabla_proporcion` | Columnas, filas, `relacion: directa\|inversa` | Productos o cocientes constantes |
| `recta_numerica` | `min`, `max`, `puntos[]` | Puntos dentro del rango |

## 4. Cómo se validan las respuestas del estudiante

Principio: **solo es correcto o incorrecto lo que el sistema puede calcular.** Lo demás es interpretación, y se presenta como tal.

### 4.1 Tres niveles de validación

| Nivel | Qué cubre | Quién decide | ¿Genera evidencia? |
| --- | --- | --- | --- |
| **A. Determinista** | Comprobaciones sin ayuda: actividades curadas y, cuando se agotan, instancias de plantilla con enunciado fijo del sistema | Sistema | Sí, **solo** en modo comprobación (sin ayudas) |
| **B. Formativo verificado** | Prácticas, predicciones y pasos de plantilla durante la charla | Sistema | No: queda como interacción con resultado |
| **C. Lectura provisional** | Texto libre: respuestas socráticas, «en tus palabras», justificaciones | LLM, validado por el sistema | Nunca. Puede dejar una `senal` en el grafo |

### 4.2 Plantillas paramétricas: la pieza que hace verificable lo generado

Problema: si la IA inventa un ejercicio, también inventa la clave, y nadie puede garantizar que sea correcta.

Solución: **el sistema genera los números, la respuesta y los distractores; la IA solo redacta la historia.**

```text
plantilla "porcentaje_encadenado" (concepto: porcentajes)
  parámetros: base ∈ {80, 100, 150, 200, 250}, sube ∈ {10, 20, 25}, baja ∈ {10, 20, 25}
  respuesta:  base × (1 + sube/100) × (1 − baja/100)
  distractores, cada uno con su idea clave:
    base × (1 + (sube − baja)/100)   → cambio-de-base       (sumó los porcentajes)
    base                             → cambio-de-base       (creyó que se compensan)
    base × (1 + sube/100) − baja     → base-del-porcentaje  (restó puntos, no porcentaje)
```

Plantillas mínimas: `porcentaje_encadenado`, `porcentaje_para_volver`, `complemento_de_fraccion`, `fraccion_de_cantidad`, `proporcion_inversa` y `proporcion_directa`.

Por qué es la pieza central:
- La corrección es exacta aunque el enunciado lo escriba la IA.
- **Los distractores ya traen su idea clave**, así que el «backward» funciona también en la práctica de la charla, no solo en las 7 actividades curadas.
- El sistema descarta parámetros que generan un distractor igual a la respuesta.
- La IA no ve la clave mientras redacta; recibe el enunciado base y los valores, no cuál opción es la correcta.

### 4.3 Lectura provisional del texto libre

Cuando el estudiante escribe («porque +20 y −20 se cancelan»), el LLM puede devolver una lectura estructurada:

```json
{
  "ideas_detectadas": ["cambio-de-base"],
  "posible_confusion": "cambio-de-base",
  "cita_del_estudiante": "+20 y −20 se cancelan",
  "confianza": "media"
}
```

El sistema la acepta solo si:
1. Las ideas clave existen en el catálogo del concepto.
2. **`cita_del_estudiante` aparece literalmente en lo que escribió el estudiante** (comparación normalizada). Esto impide atribuirle algo que no dijo.
3. `confianza` es `baja`, `media` o `alta`.

Efecto: puede marcar `senal: "posible_confusion"` en el nodo y guiar el siguiente turno. **Nunca** cambia el `estado`, nunca crea evidencia y la interfaz la muestra como «Me parece que…», no como un veredicto.

### 4.4 Normalización de respuestas numéricas

Antes de comparar: quitar espacios, aceptar coma o punto decimal, aceptar `%` y unidades conocidas (`S/`, `cm`, `ml`, `litros`), aceptar fracciones simples (`3/8`). Comparación exacta con tolerancia relativa de `1e-9`. Un valor no interpretable devuelve «No pude leer tu respuesta como número», sin contarlo como fallo.

### 4.5 Del intento a la evidencia

```text
Charla (B y C) ──▶ interacción registrada, señales en el grafo
                     │
                     ▼  el agente ofrece «invitacion_comprobar»
Comprobación (A) ──▶ sistema corrige ──▶ evidencia + rastro de error ──▶ estado del nodo
```

Solo el nivel A mueve un nodo a `aplicado` o `fallo`. Practicar muchas veces en la charla no pinta nada de verde.

## 5. Cómo se validan las salidas del agente

Cinco capas, en orden. Si una falla, el bloque o la operación se descarta y el resto del turno sigue.

1. **Forma:** esquema zod por tipo de bloque y de operación, límites de tamaño, máximo de bloques por turno. Lo desconocido se descarta.
2. **Referencias:** nodos y fragmentos que existen y pertenecen al actor; ideas clave del catálogo; sin ciclos en `subtema`/`requiere`; límites de nodos y aristas.
3. **Matemática:** los `visual` y los pasos `correcto` de un `contraste` se reescriben como expresiones aritméticas simples (`120 - 24 = 96`) y se evalúan con un evaluador propio (sin `eval`). Si una igualdad no cierra, el bloque se descarta.
4. **Atribución:** el lado `tuyo` de un `contraste` y los pasos de `razonamiento_anotado` tienen que contener la respuesta real del estudiante o fragmentos literales de su justificación.
5. **Filtración:** con una comprobación activa, el agente no tiene herramientas de lectura de intentos ni de práctica, y el sistema rechaza cualquier respuesta que contenga el valor correcto de la actividad activa.

**Reparación:** si el turno entero no pasa la forma (capa 1), se reintenta **una vez** devolviéndole al modelo el error de validación. Si vuelve a fallar, se muestra solo el texto del mensaje, sin bloques, y el turno queda registrado como degradado.

## 6. Datos (resumen)

- **Se reutiliza:** `arboles`, `nodos`, `revisiones_nodo`, `rastros_error`, `comprobaciones`, `evidencias`, `solicitudes_ia`, el catálogo de ideas clave y el mapa de errores.
- **Nuevo:**
  - `conversaciones` (actor, árbol).
  - `mensajes` (rol, texto, bloques, grafo_ops aplicadas, prompt_version, degradado).
  - `aristas` (relaciones tipadas entre nodos del mismo actor, más allá de padre-hijo).
  - `respuestas_bloque` (respuesta del estudiante a un bloque, resultado determinista o lectura provisional).
  - `nodos.tipo` ampliado y `nodos.senal`.
- **El estado de cada nodo se calcula, no se guarda:** se deriva de evidencias, rastros e interacciones en cada lectura del grafo.

## 7. Límites

- No es enseñanza garantizada: el agente conversa bien o mal según el modelo; la verdad del progreso sale del sistema.
- La lectura provisional puede equivocarse. Por eso no tiene efecto sobre estados ni evidencias.
- Las plantillas cubren solo los 3 conceptos actuales. «Mis cursos» queda con lectura provisional y citas, sin práctica verificada.
- Un ciclo agente cuesta varias llamadas por turno: hay tope de herramientas, tiempo máximo y presupuesto por sesión.
- Proveedor: **Groq** (API compatible con OpenAI) como principal; el ciclo es independiente del proveedor y Anthropic queda como alternativa. Los modelos abiertos pueden usar herramientas con menos consistencia que Claude: las capas de validación (§5) descartan o degradan lo que falle. El plan gratuito de Groq tiene límites por minuto que pueden cortar con varios estudiantes a la vez.
