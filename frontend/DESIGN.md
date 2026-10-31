---
name: CALIBRA
description: El marcador de tu preparación para San Marcos. Aprende a pensar.
colors:
  cancha: "hsl(162 62% 14%)"
  cancha-vivo: "hsl(158 58% 24%)"
  cancha-claro: "hsl(145 38% 90%)"
  menta: "hsl(151 62% 52%)"
  ambar: "hsl(40 100% 58%)"
  ambar-hover: "hsl(40 100% 64%)"
  coral: "hsl(358 75% 59%)"
  coral-texto: "hsl(358 68% 47%)"
  grafito: "hsl(220 13% 9%)"
  grafito-2: "hsl(220 11% 14%)"
  tiza: "hsl(96 27% 96%)"
  superficie: "hsl(0 0% 100%)"
  tinta: "hsl(150 21% 10%)"
  tinta-suave: "hsl(152 7% 34%)"
  muted: "hsl(120 14% 92%)"
  linea: "hsl(125 12% 86%)"
  noche: "hsl(220 13% 8%)"
  noche-superficie: "hsl(220 12% 12%)"
  noche-linea: "hsl(220 9% 21%)"
  tiza-noche: "hsl(96 27% 94%)"
  exito: "hsl(152 62% 28%)"
  aviso: "hsl(33 92% 40%)"
  info: "hsl(205 70% 38%)"
typography:
  scoreboard:
    fontFamily: "Big Shoulders Display, Figtree, system-ui, sans-serif"
    fontSize: "clamp(3.5rem, 11vw, 6rem)"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "tnum"
  display:
    fontFamily: "Big Shoulders Display, Figtree, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.005em"
  headline:
    fontFamily: "Big Shoulders Display, Figtree, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1
  title:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.08em"
  reading:
    fontFamily: "Zilla Slab, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.64
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.cancha}"
    textColor: "{colors.superficie}"
    rounded: "{rounded.sm}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.cancha-vivo}"
  button-scoreboard:
    backgroundColor: "{colors.ambar}"
    textColor: "{colors.grafito}"
    rounded: "{rounded.sm}"
    padding: "0 24px"
    height: "48px"
  button-scoreboard-hover:
    backgroundColor: "{colors.ambar-hover}"
  scoreboard:
    backgroundColor: "{colors.grafito}"
    textColor: "{colors.superficie}"
    rounded: "{rounded.xl}"
    padding: "32px 28px"
  scoreboard-digit:
    textColor: "{colors.ambar}"
    typography: "{typography.scoreboard}"
  top-bar:
    backgroundColor: "{colors.cancha}"
    textColor: "{colors.superficie}"
    height: "56px"
  count-chip:
    backgroundColor: "{colors.grafito}"
    textColor: "{colors.ambar}"
    rounded: "{rounded.sm}"
    size: "44px"
  ruled-panel:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.xl}"
    padding: "16px 20px"
---

# Design System: CALIBRA

## Overview

**Creative North Star: "El Marcador de Partido"**

CALIBRA reads like a stadium scoreboard for exam preparation: a deep pitch-green field carries the navigation and the main actions, a graphite board holds the student's real score in amber stadium figures, and everything else sits on chalk-white ground divided by thin chalk lines. Only what the student scores alone goes on the board; when there is no number yet, the board shows unlit cells instead of inventing one.

The system is flat and ruled. Rank comes from weight, uppercase condensed display type and the inverted graphite panel, not from shadows, gradients or card stacks. Lists are rows in a single bordered sheet, not grids of equal floating cards. Motion is reserved for one signature moment: the scoreboard digits roll vertically into place. Dark mode is a night match: graphite ground, mint tint for text accents, and the pitch green kept as the action fill.

Confirmed rejections (from the direction thesis): the SaaS dashboard of identical cards, and pastel edtech with streaks. No streak, flame or day-count gamification appears in the shipped surfaces.

**Key Characteristics:**
- Pitch-green top bar with an amber underline on the active destination.
- Graphite scoreboard with giant amber tabular figures against small uppercase stat labels.
- Ruled sheets: grouped rows and three-cell bands share one border and internal 1px dividers.
- Condensed uppercase display (Big Shoulders Display) for screen titles and figures; Figtree for all interface text.
- Short corners (4–10px), 1px shadows at most, no glass.
- Rolling digit strips as the only celebratory motion, frozen under reduced motion.

## Colors

A committed three-material palette: pitch green as the field, graphite as the board, amber as the figures, with coral held back for errors.

### Primary
- **Verde Cancha** (`cancha`): the committed field color. Fills the sticky top bar, the welcome pitch, and green action buttons in light mode. It is also the light-mode `--primary` and `--action`.
- **Cancha Vivo** (`cancha-vivo`): hover for green fills in light mode; in dark mode it becomes the action fill itself (`--relleno`, with `hsl(158 55% 30%)` on hover) so white button text keeps about 9:1.
- **Cancha Claro** (`cancha-claro`): pale pitch tint for secondary surfaces and secondary-button fills in light mode.
- **Menta** (`menta`): dark-mode `--primary`. Used as a text and icon tint on graphite (links, active tab, inline actions), never as a large fill behind white text. Also the single dot inside the brand mark.

### Secondary
- **Ámbar Marcador** (`ambar`): the scoreboard's figure color. Score digits, count chips, the active-nav underline, focus outlines on green, text selection (at 45%), the brand C, and the CTA placed on graphite or on the pitch. `ambar-hover` is its hover.

### Tertiary
- **Coral** (`coral`): errors only. `coral-texto` is the light-mode destructive text/fill that passes contrast on chalk.

### Neutral
- **Grafito** (`grafito`): the scoreboard panel, count chips and brand-mark tile. `grafito-2` is the scoreboard in dark mode (ringed with a 1px white/10 line so it lifts off the night ground).
- **Blanco Tiza** (`tiza`): the light app background.
- **Superficie** (`superficie`): cards, ruled sheets, the mobile tab bar.
- **Tinta** (`tinta`) / **Tinta Suave** (`tinta-suave`): body text and secondary text on chalk.
- **Muted** (`muted`): hover fill for rows and cells, disabled button fill.
- **Línea de Cal** (`linea`): borders and row dividers.
- **Noche** (`noche`), **Noche Superficie** (`noche-superficie`), **Noche Línea** (`noche-linea`), **Tiza Noche** (`tiza-noche`): the dark-mode ground, surfaces, dividers and text.
- **Status** (`exito`, `aviso`, `info`): the shared state vocabulary for evidence states; dark mode lifts them (success to menta, warning to ámbar).

### Named Rules
**The Coral Is For Errors Rule.** Coral marks wrong answers, failures and destructive actions. It is never decoration, never a brand accent.

**The Split Green Rule.** In dark mode, green has two jobs: menta for text and icons on graphite, cancha-vivo for filled actions with white text. Never put white text on menta, never fill a button with menta.

**The Amber On Graphite Rule.** Any primary action placed on the graphite board or the green pitch is amber with graphite text. Green on graphite is too weak; green on green disappears.

## Typography

**Display Font:** Big Shoulders Display (self-hosted variable woff2, with Figtree, system-ui fallback)
**Body Font:** Figtree (self-hosted variable woff2, with system-ui fallback)
**Reading Font:** Zilla Slab (self-hosted; lesson reading only)

**Character:** A condensed stadium face shouts the score and the screen title in uppercase; a friendly geometric sans carries every label, row and paragraph at ordinary size. The contrast is scale and case, not ornament.

### Hierarchy
- **Scoreboard** (800, `clamp(3.5rem, 11vw, 6rem)`, line-height 1, tabular numerals): the student's score on the board, always amber. Secondary figures (last admitted score) drop to 700 at 2.25rem in white/90.
- **Display** (800, 2.25rem mobile / 3rem desktop, line-height 1, uppercase): every `h1`, applied globally. The scoreboard headline uses 1.9rem / 2.4rem.
- **Headline** (800, 1.75rem, line-height 1, uppercase, display face): section titles such as course lists and "Tus intentos".
- **Title** (Figtree 600, 1rem, 1.4): row and cell titles.
- **Body** (Figtree 400, 0.875rem small screens / 1rem from `sm`, 1.55–1.6): descriptions, kept to `max-w-prose`.
- **Label** (Figtree 600, 0.75rem, 0.08em tracking, uppercase): stat labels attached to a figure on the scoreboard ("Tu puntaje", "Último ingresante"). Only as the caption of a figure.
- **Reading** (Zilla Slab 400, 1.0625rem, 1.64): long chapter text in the lesson only, with `heading` 1.625rem and `subheading` 1.3125rem above it.

### Named Rules
**The Big Figure, Small Label Rule.** A number that matters is set huge in the display face; its name sits above it in a small uppercase label. Never the reverse, and never a label without its figure.

**The Uppercase Is The Display Voice Rule.** Uppercase belongs to the condensed display face (titles, brand wordmark, footer signature) and to figure labels. Interface text in Figtree stays sentence case.

## Layout

Content sits in a centered column (`max-width: 72rem`) with 16px side padding, 24px from `md`. The top bar is 56px tall and sticky. Below `md`, the five destinations move to a fixed bottom tab bar (60px rows, icon over an 11px label, safe-area padded) and the top bar carries only brand and the theme toggle; on the tutor and exam screens a compact five-link row sits inside the green bar instead.

The home rhythm is a stack: full-width scoreboard, then a three-cell accesses band, then two-column content (main column plus a narrower side column) on desktop that collapses to one column on mobile. Vertical gaps between blocks are about 24px; cells pad 16px vertical by 20px horizontal; the scoreboard pads 24–32px by 20–28px. Tap targets are at least 44px (green buttons), 48px (amber CTA), 56px (welcome CTA).

**The Equal Weight Rule.** Sibling accesses (Simulacro, Repasar errores, Tutor) share one band with equal columns and dividers. None is promoted with color or size over the others; an access with nothing to do today is shown dimmed (75% opacity, no action line) rather than hidden or faked.

## Elevation & Depth

The system is flat. Depth comes from material inversion (graphite board on chalk), 1px chalk-line borders and hover fills, not from lifting. The shadow tokens exist only as hairlines.

### Shadow Vocabulary
- **Hairline** (`box-shadow: 0 1px 2px hsl(160 30% 10% / 0.06)`): the `xs` and `medium` tokens; small controls at most.
- **Card rule** (`box-shadow: 0 1px 0 hsl(160 30% 10% / 0.05)`): the `card` token, a one-pixel base line.

### Named Rules
**The No Lift Rule.** Nothing floats. No diffuse shadows, no blur, no glass, no gradient fills; the gradient tokens are flattened to a single color. Hover changes the fill (muted at 50–60%), not the elevation.

## Shapes

Short, square-shouldered corners. Buttons, digit cells and count chips use 4px; the base radius token is 6px; grouped panels, the scoreboard and ruled sheets use 10px. Borders are 1px chalk lines; inside a grouped panel, rows and cells are separated by 1px dividers and lose their own corners. The brand mark is a 6px-radius graphite tile with a segmented amber C, the same seven-segment logic as the scoreboard digits. The welcome screen draws a half-pitch in 3px white/9% chalk lines (center line, center circle, both boxes, outer boundary).

## Components

### Buttons
Flat, bold, decisive.
- **Shape:** short corner (4px).
- **Primary (green):** cancha fill, white bold text, min-height 44px, 20px horizontal padding; hover to cancha-vivo. In dark mode the fill is cancha-vivo with white text.
- **Scoreboard / pitch CTA (amber):** ámbar fill, graphite bold text at 1rem, min-height 48px (56px on the welcome pitch), 24px padding, trailing arrow that nudges 2px right on hover; hover lightens to ámbar-hover; active scales to 0.98; focus is a 2px amber (or white on the pitch) outline offset 4px.
- **Inline action:** bold primary-colored text with a trailing arrow, used at the foot of cells and rows.
- **Disabled:** muted fill with muted-foreground text, not a half-transparent button.

### Navigation
- **Top bar:** cancha fill, white text. Brand lockup (graphite tile mark plus uppercase display wordmark) on the left, five destinations, theme toggle on the right (40px, white/80, hover white/10 fill).
- **Links:** Figtree 600 at 0.9375rem, white/70 at rest, white on hover; the active link is white with a 3px amber underline flush to the bar's bottom edge.
- **Mobile tab bar:** surface fill with a top chalk line; active tab in primary (cancha / menta), inactive in muted-foreground.
- **Focus:** amber outline on green surfaces, ring color elsewhere.

### Marcador (signature)
The graphite scoreboard at the top of Inicio. A header strip (career · area on the left, days to exam with an amber calendar icon on the right) over a white/10 divider; below, the score block and, separated by a vertical white/10 rule on desktop, the uppercase verdict headline, one line of detail at white/70, and the amber CTA. With no score, four unlit digit cells (4px radius, white/15 border, white/4% fill) wait for a figure.

### Cifras de Marcador (signature motion)
Each digit is a 0–9 strip that rolls vertically to its value over 900ms with `cubic-bezier(0.16, 1, 0.3, 1)`, staggered 70ms per digit. It is the only movement on the home screen; with reduced motion the strip arrives still.

### Ruled Sheets
- **Rows:** one bordered sheet (10px radius, 1px border, surface fill) with 1px dividers; each row is min 64px, 16–20px padding, title plus muted description, trailing inline action. Hover fills muted at 60%.
- **Count chip:** a 44px graphite square (4px radius) at the start of a row holding an amber display figure (the course's question count).
- **Tutor starters:** the four conversation openers are rows of the same sheet (two columns, one under 560px); hover and pressed fill muted, the pressed row gains a 3px amber inset bar on its left edge.

### Accesses Band
Three equal cells in one bordered 10px panel (stacked with horizontal dividers on mobile). Each cell: primary-colored icon with a semibold title, a muted one-line state, and an inline action at the bottom. Inactive cells show at 75% opacity with no action.

### Page Header
Breadcrumb in meta size above an uppercase display `h1`; a graphite chip with amber tabular figures may sit beside the title to carry a count.

### Ilustraciones 3D del tutor (añadido el 31/10/2026, a pedido del usuario)

El tutor usa dibujos 3D de arcilla con fondo transparente para dar calidez a la conversación: el icono de cada tipo de bloque, las cinco estaciones de «Tu camino» (lupa, mano levantada, lápiz, diana, objetivo cumplido; candado si no hay datos), las acciones rápidas, los comienzos y temas del inicio del tutor, y un aplauso animado una sola vez al acertar una comprobación.

- Componentes: `src/components/arcade/Ilustracion.tsx` (`Ilustracion` e `IlustracionAnimada`).
- Archivos: `public/arcade/<id>-160|320.webp` (estáticos) y `public/animadas/<id>.webp` (WebP animado con alfa, bucle de 4 s). Solo se copiaron los que se usan.
- Procedencia: banco de ilustraciones del proyecto hermano `komu-flow-magic` (mismo equipo).
- Reglas: decorativos (`alt=""`); la animación solo corre en pantalla y nunca con movimiento reducido o ahorro de datos; las estaciones pendientes van en gris al 45 %. Es una excepción deliberada a la regla de «sin sombras ni volumen»: el volumen vive en el dibujo, nunca en los contenedores. No usar rachas, trofeos ni medallas de ese banco: contradicen la tesis.

## Do's and Don'ts

### Do:
- **Do** put the student's score, counts and timers in the display face with tabular numerals, amber on graphite.
- **Do** use amber for any CTA on graphite or on the pitch, and green fills for actions on chalk.
- **Do** group sibling items into one ruled sheet with 1px dividers and a single 10px outer radius.
- **Do** show unlit cells, a dimmed cell or a plain instruction when there is no data, instead of a placeholder number.
- **Do** keep the active destination marked by the 3px amber underline in the green bar.
- **Do** respect reduced motion: digit strips and entrances arrive still.

### Don't:
- **Don't** show streaks, day counts as rewards, flames or any gamified tally; progress moves only with evidence.
- **Don't** build grids of identical floating cards with shadows; use ruled rows or the equal-weight band.
- **Don't** use diffuse shadows, glass, blur or gradient fills; shadows stop at the 1px hairline tokens.
- **Don't** put a small uppercase label above a heading as an eyebrow; uppercase labels caption figures only.
- **Don't** use coral for anything but errors and destructive actions.
- **Don't** fill a button with menta or put white text on menta in dark mode.
- **Don't** round past 10px on panels or past 4px on buttons and chips.
