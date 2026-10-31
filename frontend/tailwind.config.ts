import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.25rem",
        md: "1.5rem",
        lg: "2rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', '"Inter Fallback"', '"Inter Fallback Roboto"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        // Solo para titulares de marketing. Los datos y la UI siguen en Inter: una cifra
        // en tipografía display se lee como decoración, no como dato.
        //
        // Grotesca, no serif. El contraste con el texto no lo pone un cambio de género
        // tipográfico sino el peso (800/900), el cuerpo y el tracking negativo: una sola
        // voz, dicha más fuerte. Inter Tight es la compañera de titulares de Inter —más
        // estrecha y con las contraformas ajustadas—, así que a cuerpos grandes tiene el
        // color que Inter pierde y a la vez no desentona con el texto de al lado.
        display: ['"Inter Tight"', '"Inter Tight Fallback"', '"Inter Tight Fallback Roboto"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        // Segunda familia, y la única con un rol que Inter no puede cumplir: la lectura
        // larga del capítulo (ParadaDeLeccion.tsx). Inter está dibujada para interfaz —
        // rótulos, botones, cifras cortas—, no para sostener veinte mil caracteres
        // seguidos, y ahí se lee genérica. La interfaz entera —paneles, botones, el
        // sendero, la lista de materiales— se queda en Inter; esto no es un rebrand, es
        // una segunda voz para un solo sitio.
        //
        // **Zilla Slab y no Literata.** Literata se leía bien, pero es la serif por
        // defecto de Google Fonts: sale en medio internet y no distinguía al producto.
        // Zilla Slab es una losa —remates en bloque, trazo casi sin variación—, así que
        // no tiene finos que perder en el móvil con poco brillo donde se estudia; y está
        // dibujada como sistema de marca, o sea para sostener el titular Y el cuerpo.
        // Eso es lo que permite que la pantalla hable con UNA voz: antes el título de la
        // pantalla iba en Inter y el que traía el PDF en Literata, las mismas palabras en
        // dos letras a cuarenta píxeles de distancia.
        //
        // Se llama `lectura` y no `read`: ya existe `text-read` (tamaño) más abajo, y
        // `text-read` junto a `font-read` (familia) se lee como la misma cosa dicha dos
        // veces. Respaldo con métrica parecida: ancha y de remates generosos.
        lectura: ['"Zilla Slab"', '"Zilla Slab Fallback"', 'Georgia', "'Times New Roman'", 'serif'],
        // Los titulares de la lección —definición, bloques, partes—: redondeada, como pide la
        // dirección de Calibra. Solo titulares: el cuerpo que explica va en Inter.
        redonda: ['Nunito', '"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Escala semántica del sistema. Cinco tamaños, y son los únicos que debe usar
        // código nuevo. Los alias de abajo ('xs'…'5xl') se quedan porque las seis
        // pantallas que aún no se han migrado los usan en 1056 sitios.
        'figure': ['1.1875rem', { lineHeight: '1.15', letterSpacing: '-0.028em' }],
        'title':  ['0.9375rem', { lineHeight: '1.4',  letterSpacing: '-0.012em' }],
        'body':   ['0.8125rem', { lineHeight: '1.55', letterSpacing: '-0.003em' }],
        'meta':   ['0.71875rem', { lineHeight: '1.45', letterSpacing: '0' }],
        'label':  ['0.65625rem', { lineHeight: '1.4',  letterSpacing: '0.055em' }],

        // El sexto, y el único que no es para escanear: leer. Los cinco de arriba están
        // calibrados para paneles, tablas y cifras —13px es density, no lectura—, y un
        // capítulo de veinte mil caracteres a ese cuerpo y con el interlineado de una tabla
        // no se lee: se sobrevuela. Es el registro de lectura, y solo lo usa la lección.
        // No lo uses en UI: para eso está `body`.
        //
        // **17px y no 16.** Dos motivos, y el segundo es duro: en Literata, cuya x-height es
        // generosa pero cuyo cuerpo se dibuja pequeño, 16px se lee un punto por debajo de lo
        // que pide un texto largo; y por debajo de 16px iOS hace zoom al enfocar un campo,
        // así que 16 es el suelo y no el sitio donde ponerse. Medido en el capítulo: 16px.
        //
        // **Interlineado y tracking son ya los definitivos, no los de Inter.** Hasta el
        // cambio a Zilla Slab estos tres números estaban calibrados para Inter y se
        // corregían después en index.css, porque el token era del sistema y la letra de
        // lectura solo una de sus consumidoras. Hoy esta escala la usa SOLO la lección,
        // así que la corrección se ha traído aquí y el bloque de index.css ha
        // desaparecido: un sitio y no dos. Lo que sigue en index.css es lo único que un
        // token no puede decir — la compensación de tema oscuro.
        'read':   ['1.0625rem', { lineHeight: '1.64', letterSpacing: '0' }],

        // El séptimo y el octavo, y también solo para leer: los títulos de una diapositiva o de
        // un apartado DENTRO del capítulo. L1 los pintaba con peso y no con cuerpo, para no
        // inventar jerarquía; con material real se leía «solo texto en negrita». La jerarquía
        // que el material trae —## de una diapositiva, encabezado de un docx— se pinta con
        // tamaño. No los uses en UI: para eso están `title` y `figure`.
        //
        // **Los tamaños suben con el cambio de letra.** Medido en el capítulo real, la
        // escala anterior era 17 → 18 → 22: el salto de cuerpo a subtítulo era 1,06×, o
        // sea invisible — un subtítulo se distinguía solo por la negrita, que es justo lo
        // que L1 ya había intentado y descartado. Ahora es 17 → 21 → 26, 1,24× en los dos
        // peldaños: el mínimo para que dos niveles se lean como dos niveles.
        'heading':    ['1.625rem', { lineHeight: '1.26', letterSpacing: '-0.012em' }],
        'subheading': ['1.3125rem', { lineHeight: '1.34', letterSpacing: '-0.006em' }],

        // El noveno: el título de una pantalla de lectura, y el único que va por ENCIMA de
        // `heading`. Existe porque no había ninguno: el título del tema se pintaba con
        // `figure` (19px) y los títulos que trae el material con `heading` (22), así que el
        // nombre del tema perdía contra el primer subtítulo de su propio PDF. Quien manda en
        // un documento es su título, y para eso tiene que ser el texto más grande.
        // No lo uses en UI: para eso está `figure`.
        //
        // 36px y no 28. El título va en la MISMA letra que el capítulo (ver `lectura`
        // arriba), así que ya no se distingue por cambio de familia: se distingue por
        // cuerpo y por peso. A 28 en Zilla Slab no mandaba sobre un `heading` de 26 —
        // dos peldaños que casi coinciden es una jerarquía que no existe.
        'hero':       ['2.25rem', { lineHeight: '1.06', letterSpacing: '-0.02em' }],

        'xs': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0' }],
        'sm': ['0.8125rem', { lineHeight: '1.55', letterSpacing: '-0.003em' }],
        'base': ['0.9375rem', { lineHeight: '1.6', letterSpacing: '-0.006em' }],
        'lg': ['1.0625rem', { lineHeight: '1.5', letterSpacing: '-0.01em' }],
        'xl': ['1.25rem', { lineHeight: '1.4', letterSpacing: '-0.012em' }],
        '2xl': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.016em' }],
        '3xl': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.02em' }],
        '4xl': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.022em' }],
        '5xl': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.025em' }],
      },
      colors: {
        // Colores semánticos de identidad CALIBRA
        "carmesi-principal": "hsl(var(--carmesi-principal))",
        "carmesi-secundario": "hsl(var(--carmesi-secundario))",
        fondo: "hsl(var(--fondo))",
        superficie: "hsl(var(--superficie))",
        surface: "hsl(var(--superficie))",
        texto: "hsl(var(--texto))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        action: {
          DEFAULT: "hsl(var(--action))",
          foreground: "hsl(var(--action-foreground))",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
        },
        "primary-hover": "hsl(var(--primary-hover))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        teal: "hsl(var(--brand-teal))",
        violet: "hsl(var(--brand-violet))",
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        achievement: {
          DEFAULT: "hsl(var(--achievement))",
          foreground: "hsl(var(--achievement-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        feature: {
          audio: "hsl(var(--feature-audio))",
          video: "hsl(var(--feature-video))",
          class: "hsl(var(--feature-class))",
          docs: "hsl(var(--feature-docs))",
        },
      },
      borderColor: {
        section: "hsl(var(--border-section))",
        row: "hsl(var(--border-row))",
        /* El contorno de la tabla del capítulo: un paso por encima del de sección, para
           que la tabla se lea como un objeto y no como texto con rayas. */
        tabla: "hsl(var(--tabla-contorno))",
      },
      backgroundColor: {
        /* La banda de cabecera de la tabla del capítulo. Compuesta por tema en
           `index.css`, no invertida: en claro es un tinte del primario, en oscuro una
           elevación sobre el lienzo. */
        "tabla-cabecera": "hsl(var(--tabla-cabecera))",
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-surface": "var(--gradient-surface)",
        "gradient-hero": "var(--gradient-hero)",
        "gradient-accion": "var(--gradient-accion)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        medium: "var(--shadow-medium)",
        card: "var(--shadow-card)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
        "3xl": "calc(var(--radius) + 12px)",
      },
      spacing: {
        "4.5": "1.125rem",
        "18": "4.5rem",
        "22": "5.5rem",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Usados por las demos de funcionalidades de la landing.
        // `grow-x` va con scaleX y no con width: animar width recalcula el layout
        // en cada fotograma, scaleX solo compone.
        "fade-out": {
          "0%, 35%": { opacity: "1" },
          "65%, 100%": { opacity: "0" },
        },
        "grow-x": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        "flip-card": {
          "0%, 40%": { transform: "rotateY(0deg)" },
          "55%, 95%": { transform: "rotateY(180deg)" },
          "100%": { transform: "rotateY(0deg)" },
        },
        // Contraparte de fade-out: espera antes de aparecer, para que el cruce de
        // los dos idiomas no muestre ambos a la vez a media opacidad.
        "fade-in-late": {
          "0%, 35%": { opacity: "0" },
          "65%, 100%": { opacity: "1" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-down": {
          "0%": { opacity: "0", transform: "translateY(-16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "scale-in-bounce": {
          "0%": { opacity: "0", transform: "scale(0.3)" },
          "50%": { opacity: "1", transform: "scale(1.1)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-bottom": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-top": {
          "0%": { opacity: "0", transform: "translateY(-20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // El raíl del sendero creciendo hasta donde ha llegado el alumno. Va con scaleY y
        // no con la altura ni con `stroke-dashoffset`: solo `transform` y `opacity` van
        // por el compositor, y el sendero de una ruta larga tiene 125 nodos por encima.
        "grow-y": {
          "0%": { transform: "scaleY(0)" },
          "100%": { transform: "scaleY(1)" },
        },
        // Un único golpe de atención sobre algo que YA está visible, así que arranca en
        // scale(1) y no en 0 — a diferencia de `pop`, que es una entrada.
        "pop-once": {
          "0%, 100%": { transform: "scale(1)" },
          "45%": { transform: "scale(1.08)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "float-subtle": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "25%": { transform: "translateY(-4px) rotate(0.5deg)" },
          "50%": { transform: "translateY(-6px) rotate(0deg)" },
          "75%": { transform: "translateY(-4px) rotate(-0.5deg)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.02)" },
        },
        "wiggle": {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
        "bounce-soft": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "pop": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "50%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "ping-soft": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "75%, 100%": { transform: "scale(1.5)", opacity: "0" },
        },
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--primary) / 0.4)" },
          "50%": { boxShadow: "0 0 0 12px hsl(var(--primary) / 0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out forwards",
        // Registradas para que Tailwind emita sus @keyframes: los valores arbitrarios
        // `animate-[nombre_...]` no los generan por sí solos.
        "fade-out": "fade-out 2.6s ease-in-out forwards",
        "fade-in-late": "fade-in-late 2.6s ease-in-out forwards",
        "grow-x": "grow-x 2.4s cubic-bezier(0.16,1,0.3,1) forwards",
        "flip-card": "flip-card 4s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in-down": "fade-in-down 0.5s ease-out forwards",
        "scale-in": "scale-in 0.3s ease-out forwards",
        "scale-in-bounce": "scale-in-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "slide-in-right": "slide-in-right 0.4s ease-out forwards",
        "slide-in-left": "slide-in-left 0.4s ease-out forwards",
        "slide-in-bottom": "slide-in-bottom 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        // `both` y no `forwards`: estas dos se usan en cascada, con un `animation-delay`
        // por elemento, y sin relleno hacia atrás el elemento se vería en su sitio durante
        // el retardo y luego saltaría al fotograma inicial.
        "slide-in-top": "slide-in-top 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        "grow-y": "grow-y 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        // Sin relleno a propósito: al acabar, el transform vuelve al del CSS y el
        // `active:scale-95` del botón sigue funcionando. Con `forwards` se quedaría
        // clavado en scale(1) y el nodo dejaría de hundirse al pulsarlo.
        "pop-once": "pop-once 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "float": "float 4s ease-in-out infinite",
        "float-subtle": "float-subtle 5s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "wiggle": "wiggle 1s ease-in-out infinite",
        "bounce-soft": "bounce-soft 2s ease-in-out infinite",
        "pop": "pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "spin-slow": "spin-slow 8s linear infinite",
        "ping-soft": "ping-soft 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
        "shake": "shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97)",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
      },
    },
  },
  // `typography` estaba en package.json y NO aquí, así que las clases `prose` de
  // `MathMarkdown` no emitían ni una regla y su comentario describía un mecanismo que no
  // existía. Registrado: ahora `prose` hace lo que dice, y los overrides del capítulo siguen
  // ganándole porque Tailwind Typography usa `:where()` a propósito para eso.
  plugins: [tailwindcssAnimate, typography],
} satisfies Config;
