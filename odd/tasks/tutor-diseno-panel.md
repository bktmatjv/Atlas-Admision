# Tutor CALIBRA: panel conversacional y mapa de comprensión

## Alcance

Implementar la referencia visual proporcionada por el usuario sobre el tutor agente existente. `main` se actualizó por fast-forward hasta `a826a2e` (merge del tutor agente); la rama de trabajo es `feat/tutor-diseno-panel`. Los archivos locales sin seguimiento anteriores a esta tarea no se modifican.

### Presentación

- Cabecera CALIBRA, navegación existente, búsqueda de ideas en el mapa y selector de tema claro/oscuro.
- Hero editorial crema/carmesí con una ilustración SVG local de montaña y camino, sin texto ni controles incrustados en una captura.
- Conversación a la izquierda, acciones rápidas y compositor; mapa y detalle a la derecha; disposición apilada en pantallas pequeñas.
- Bloques del tutor existentes, contraste con fórmulas y visuales según el contenido real que devuelve el servidor.
- Mapa SVG estable con estados, glifos y conexiones reales. La vista local muestra hasta ocho vecinos del nodo centrado e informa de las ideas restantes; la lista jerárquica conserva todos los nodos.
- Pestañas Resumen/Evidencia/Ejercicios, exploración de cada idea y resumen inferior de estados por árbol de la conversación.

El lienzo con física se sustituye en este componente por SVG para controlar legibilidad, foco y densidad en el panel de la referencia. No se cambia el contrato de `/grafo` ni la lógica del agente. La dependencia anterior se conserva para no mezclar una limpieza del lockfile con el cambio visual.

## Funcionalidad y veracidad

- Analizar error y Explicar concepto envían solicitudes al agente existente. La comprobación usa el endpoint actual y mantiene su bloqueo de ayudas.
- El adjunto conduce a Mis cursos, donde existe la importación; no simula una subida desde el compositor.
- No se copian el 68%, los 12 ejercicios ni la racha ficticia de la referencia. El resumen cuenta los estados reales del grafo, sin presentarlos como porcentaje de comprensión.
- Seleccionar un nodo, buscar o alternar vistas no cambia su estado ni registra aprendizaje.
- La cabecera distingue IA configurada, configuración ausente, pruebas y fallo de conexión. No afirma que haya una persona conectada ni comprueba la disponibilidad/calidad del modelo mediante llamadas de pago.
- Se conservan el mensaje de error, el borrador tras fallo y la clave de idempotencia del turno. No se modifican backend, proveedor, credenciales ni migraciones.

## Verificación

- Pruebas de `presentacion.test.ts`: conteos, alcance por árbol, búsqueda sin tildes, conexiones reales, límite de densidad, fallback de foco, vacío y render accesible de mapa/pestañas/resumen.
- `npm run test:tutor-ui`: navegador Chromium local (o ruta `CHROME_PATH`) con transporte de prueba aislado. Importa la página y componentes reales; nunca llama a Groq ni reutiliza sus credenciales.
- Viewports: 1672, 1440, 1200, 1199, 900, 899, 600, 599, 390 y 360 px. Verifica ausencia de desbordamiento horizontal, pestañas, teclado, mapa/lista, búsqueda, selección, envío con idempotencia, conservación del borrador tras error y tema oscuro.
- Capturas generadas en `.atl/tutor-1672.png` y `.atl/tutor-390.png`, ignoradas por Git. Los contenidos poblados de esas capturas son fixtures de interfaz, no una sesión con IA real.
- Cierre técnico: lint, tipos y compilación correctos; frontend **419 pruebas en 42 archivos**. Integración Docker: **247 pruebas en 8 archivos** aprobadas al repetir. La primera corrida encontró un caso intermitente de HTTP 429 (polling de documentos) donde la prueba esperaba 404; no se cambió el backend ni se relajaron sus límites.
- `npm audit --audit-level=moderate` conserva **14 avisos moderados** de las dependencias ya presentes en `main` (documentados también en `tutor-agente.md`). No se agregaron dependencias ni se modificó `package-lock.json`. Por esa auditoría, `npm run verify` no queda completamente verde.
- Las capturas de escritorio/móvil se revisaron visualmente. Los diez anchos y los controles descritos pasaron sin excepciones de JavaScript. Las pruebas visuales no validan la calidad pedagógica del modelo.
