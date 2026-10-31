# Fuentes de los datos de San Marcos (UNMSM)

Consultado el **2026-10-15** por Audix Admisión y traído a CALIBRA el mismo día. Regla: todo registro lleva
`fuente` y `verificado`. `verificado: true` solo si el dato sale de un sitio oficial de la UNMSM. Lo demás se
muestra en CALIBRA con la etiqueta **«Dato por verificar»** hasta que Axel lo confirme.

Estos JSON son la fuente única: `node scripts/admision/sql-de-datos-unmsm.mjs` los pasa a SQL
(`docs/despliegue/admision-audix/`) y `node scripts/admision/importar-oca.mjs 20271 20262 20261` los regenera
desde la OCA cuando salgan resultados nuevos.

## Resumen

| Dato | Dónde vive en CALIBRA | Fuente | Verificado |
|---|---|---|---|
| 5 áreas (A–E) y sus nombres | código (`AREAS` en `src/pages/Admision.tsx`) | API oficial `unmsm.edu.pe/pagina_unmsm/api/v1/carreras-pregrado/areas` | ✅ |
| 120 escuelas (incluye sedes Chilca, Huaral, S.J.L., Villa Rica, Oyón, Chancay) con su área | `carreras.json` → `admision_carreras` | Área: API oficial de carreras por área. Escuelas: listas oficiales de la OCA | ✅ (salvo Geofísica) |
| 206 registros: inscritos, asistentes, ingresantes, último ingresante y puntaje máximo por escuela, procesos **2026-I** y **2026-II**, modalidad EBR/EBA | `resultados.json` → `admision_resultados` y `admision_puntajes_minimos` | Páginas oficiales de resultados de la OCA: `admision.unmsm.edu.pe/Website20261/` y `/Website20262/` | ✅ |
| Preguntas por curso y área (100 preguntas, 180 min) | `supabase/functions/_shared/admision-molde.ts` (igual curso a curso a la de Audix) | Infobae, 15-ago-2025 (2026-I); Infobae, 23-feb-2026 (3 horas) | ❌ |
| +20 / −1,125 / 0; actitudinal sin descuento; ingreso con puntaje positivo; en empate ingresan todos | `supabase/functions/_shared/admision-correccion.ts` y `src/lib/admision/formula.ts` | Infobae, 23-feb-2026; copia del Reglamento 2026-I en Scribd | ❌ |
| 2026-I, 2026-II, 2027-I con jornadas por área y vacantes totales | `procesos.json` → `admision_procesos` | Andina (2026-I), Infobae (2026-II y 2027-I) | ❌ |
| Checklist del día del examen | `dia-examen.json` → `admision_dia_examen` | Portal OCA (carné) y Academia Savia (el resto) | ❌ salvo el carné |
| Distribución de puntajes por escuela (solo conteos) | `distribuciones.json` → `admision_distribuciones` | Listas oficiales de la OCA | ✅ |

## Detalle y por qué algo no está verificado

### Resultados por escuela ✅
Se generan con `node scripts/admision/importar-oca.mjs 20262 20261`. El script recorre la lista oficial de escuelas de la
modalidad **EBR/EBA** (examen general) y, para cada una, cuenta filas, ausentes, anulados (Art. 5 del
reglamento) y postulantes con observación **"ALCANZÓ VACANTE"**. Solo guarda **agregados**: nunca nombres ni
códigos de postulantes.

- `postulantes` = inscritos en la escuela; `asistentes` = inscritos menos ausentes.
- `puntajeUltimoIngresante` = menor puntaje entre quienes alcanzaron vacante.
- `vacantes` = `null`: esa página no publica vacantes. El número de ingresantes sirve de referencia, aunque
  puede superar las vacantes por empates o reasignaciones.
- `puntajeMinimo` = `null`: desde el proceso 2025-I San Marcos eliminó el mínimo de 900 puntos
  ([La República, 2024](https://larepublica.pe/sociedad/2024/03/16/unmsm-examen-de-admision-san-marcos-2024-cuanto-es-el-puntaje-minimo-y-que-significa-la-segunda-opcion-sabado-16-de-marzo-1033936),
  [Andina](https://andina.pe/Agencia/noticia-san-marcos-a-acuerdos-se-llego-sobre-examen-admision-2025i-989276.aspx)).

**Contraste:** Medicina Humana 2026-I da 4 709 postulantes, 55 ingresantes y un máximo de 1 679,125, igual que
[Andina](https://andina.pe/agencia/noticia-admision-2026i-unmsm-conoce-aqui-los-resultados-las-cuatro-jornadas-evaluacion-1048087.aspx).
En Psicología, Ing. de Sistemas, Derecho, Estadística y Gastronomía, el último ingresante y el máximo coinciden
con la tabla de [Academia Savia](https://savia.school/puntajes-minimos-de-ingreso-a-san-marcos/).
Hay una diferencia: Savia publica 1 469,125 como último ingresante de Medicina, y la lista oficial da 1 469,000.
Se usa el dato oficial.

### Áreas y carreras ✅
Las carreras por área vienen de la API que usa `unmsm.edu.pe/formacion-academica/carreras-de-pregrado`
(`POST /carreras-pregrado/area`). Los nombres de escuela de la OCA se mapean a esa API. Los alias están en el
script: "Tec. Med. …" → Tecnología Médica; "Educación Inicial/Primaria/Secundaria" → Educación.

- **Geofísica** no figura en la API. Se asignó al Área B (Facultad de Ciencias Físicas) con
  `verificado: false`.

### Estructura del examen ❌
Fuente: [Infobae, 15-ago-2025](https://www.infobae.com/peru/2025/08/15/asi-se-estructurara-el-examen-de-admision-de-san-marcos-2026-i-esta-es-la-cantidad-de-preguntas-por-asignatura-segun-el-area/).
Son 100 preguntas: 10 actitudinales, 10 de Habilidad Verbal, 10 de Habilidad Lógico-Matemática y 70 de
conocimientos según el área. Duración de 3 horas según
[Infobae, 23-feb-2026](https://www.infobae.com/peru/2026/02/23/examen-de-admision-san-marcos-2026-ii-fechas-clave-vacantes-y-todo-lo-que-debes-saber-para-ingresar-a-la-unmsm/).

**Por qué no está verificada:** el Reglamento de Admisión oficial
(`appadmision.unmsm.edu.pe/app/admision/20271/reglamento`) solo se descarga con un recibo de pago del Banco de
la Nación. Otras fuentes de prensa reparten la sección de habilidades de otra forma (15 + 15, o 25 en total).

### Fórmula de puntaje ❌
- Correcta **+20**, incorrecta **−1,125**, blanco o doble marca **0**. Así lo dicen Infobae (2026-II), Andina
  (2025-II) y una copia del [Reglamento 2026-I en Scribd](https://es.scribd.com/document/896424951/Reglamento-de-Admision-2026-I-UNMSM).
- La sección **actitudinal no descuenta**. En el examen real algunas alternativas dan puntaje parcial. Aquí se
  modela como correcta = 20 e incorrecta = 0.
- **Ingreso:** por orden de mérito, con puntaje positivo. Si hay empate en el último puesto, ingresan todos.
- **Puntaje máximo:** 2 000 (100 × 20).

### Procesos ❌
| Proceso | Jornadas | Vacantes totales | Fuente |
|---|---|---|---|
| 2026-I | 4-oct D/E · 5-oct B/C · 11-oct A (sin Medicina) · 12-oct Medicina (2025) | 2 771 | Andina |
| 2026-II | 7-mar D/E · 8-mar B/C · 14-mar A · 15-mar Medicina (2026) | — | Infobae |
| 2027-I | 17-oct D/E · 18-oct B/C · 24-oct A · 25-oct Medicina (2026) | 2 581 | [Infobae, 1-oct-2026](https://www.infobae.com/peru/2026/10/01/examen-de-admision-san-marcos-2027-i-postulantes-podran-inscribirse-hasta-el-9-de-octubre-para-competir-por-una-de-las-2581-vacantes/) |

## Pendiente para Axel
1. Comprar o descargar el **Reglamento de Admisión 2027-I** y confirmar: distribución de preguntas por área,
   fórmula de puntaje (incluido el puntaje parcial de la sección actitudinal) y cronograma. Luego cambiar
   `verificado` en `procesos.json` (y regenerar el SQL), en `FORMULA_UNMSM` (`src/lib/admision/formula.ts`) y en
   `MOLDE_FUENTE` (`supabase/functions/_shared/admision-molde.ts`).
2. Cargar el **cuadro de vacantes** por escuela (anexo del reglamento) en `resultados.json` (`vacantes`),
   editando el JSON y regenerando el SQL.
3. Cuando salgan los resultados 2027-I (fines de octubre de 2026), correr
   `node scripts/admision/importar-oca.mjs 20271 20262 20261` y después `node scripts/admision/sql-de-datos-unmsm.mjs`.
4. Confirmar el área de **Geofísica**.
5. Procesos anteriores a 2026-I: la OCA ya no tiene sus páginas de resultados en línea (404). Si se consiguen
   los PDF oficiales, se cargan editando `resultados.json`.

### Checklist del día del examen (`dia-examen.json`)
| Ítem | Fuente | Verificado |
|---|---|---|
| Carné de postulante – declaración jurada | Portal oficial OCA 2027-I ofrece su descarga | ✅ (el plazo de 1 semana, ❌) |
| DNI original vigente / pasaporte o carné de extranjería | [Academia Savia, disposiciones 2026-II](https://savia.school/admision-2026-ii-conoce-las-disposiciones-obligatorias-para-el-dia-del-examen-en-la-unmsm/) | ❌ |
| Lápiz 2B, no doblar ni manchar la hoja | idem | ❌ |
| Ingreso de 6:00 a 8:30 a. m. | idem | ❌ |
| Prohibidos celulares y aparatos electrónicos | idem | ❌ |
| Duración 3 horas | Infobae (ver estructura) | ❌ |
| Borrador/tajador, recorrido al local, dormir bien | Consejos de CALIBRA (no son reglas) | — |

Nota: esa misma publicación indica que la universidad "exhorta a evitar respuestas al azar". La pantalla de
estrategia lo menciona junto al cálculo de valor esperado (+3,1 al adivinar entre 5), que es un promedio y no
elimina el riesgo de cada pregunta.

**Pendiente para Axel:** confirmar estas disposiciones con el Reglamento 2027-I y cambiar `verificado`.

### Distribución de puntajes por escuela (`distribuciones.json`) ✅
Generada por `scripts/admision/importar-oca.mjs` desde las mismas listas oficiales de la OCA (2026-I y 2026-II, EBR/EBA):
histograma en tramos de 50 puntos de los puntajes de quienes rindieron el examen (sin ausentes ni anulados).
Solo se guardan **conteos por tramo**: ningún nombre, código ni puntaje individual. Se usa en «Tu progreso» para
el percentil frente a los postulantes reales de la carrera. El percentil «frente a usuarios» que tenía Audix (una
distribución de ejemplo) no se trajo.
