import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import { X, ChevronRight, Compass, Sparkles, EyeOff, Eye } from "lucide-react";
import { CalibraGeckoSvg, GeckoMood, GeckoOrientation } from "./CalibraGeckoSvg";
import { getGeckoMessages, GeckoMessage } from "./geckoMessages";
import { cn } from "@/lib/utils";

export type GeckoPerch = "bottom-left" | "right-edge" | "top-right";

const PERCH_ORDER: GeckoPerch[] = ["bottom-left", "right-edge", "top-right"];

/**
 * Calibra Gecko Companion — Mascota interactiva socrática de CALIBRA.
 *
 * Características UX:
 * - 3 perchas dinámicas (evita tapar el logo de CALIBRA en bottom-right).
 * - Mensajes contextuales por ruta sin métricas falsas.
 * - Recordatorio activo si existe un intento pendiente o falta configurar carrera.
 * - Modo concentración (minimizable a pestaña discreta).
 * - Desactivado en evaluaciones activas (/admision/intento) para evitar distracciones.
 */
export function CalibraGeckoCompanion() {
  const location = useLocation();
  const pathname = location.pathname;

  // En exámenes cronometrados (/admision/intento), se silencia por completo o inicia colapsado
  const isEnExamenActivo = pathname.startsWith("/admision/intento");

  // Estado de percha actual
  const [perchIndex, setPerchIndex] = useState<number>(0);
  const perch = PERCH_ORDER[perchIndex];

  // Estado de visibilidad de la burbuja de diálogo
  const [bubbleOpen, setBubbleOpen] = useState<boolean>(true);

  // Estado de minimización (modo concentración)
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("calibra_gecko_minimized") === "true";
    } catch {
      return false;
    }
  });

  // Índice de mensaje actual
  const [messageIndex, setMessageIndex] = useState<number>(0);

  // Animación de reacción al interactuar
  const [isReacting, setIsReacting] = useState<boolean>(false);

  // Lista de mensajes según la ruta y almacenamiento real
  const messages: GeckoMessage[] = useMemo(() => {
    return getGeckoMessages(pathname);
  }, [pathname]);

  const currentMessage: GeckoMessage | undefined = messages[messageIndex % messages.length];

  // Al cambiar de ruta, reiniciamos el mensaje a la novedad contextual
  useEffect(() => {
    setMessageIndex(0);
    // Si la burbuja estaba cerrada, se puede abrir si hay un recordatorio activo
    const hayRecordatorio = messages.some((m) => m.id === "intento-activo");
    if (hayRecordatorio) {
      setBubbleOpen(true);
    }
  }, [pathname, messages]);

  // Rotar al siguiente mensaje con reacción
  const handleNextMessage = useCallback(() => {
    setIsReacting(true);
    setTimeout(() => setIsReacting(false), 450);
    setMessageIndex((prev) => (prev + 1) % messages.length);
    if (!bubbleOpen) setBubbleOpen(true);
  }, [messages.length, bubbleOpen]);

  // Cambiar de percha (lugar donde se posa)
  const handleCyclePerch = useCallback(() => {
    setIsReacting(true);
    setTimeout(() => setIsReacting(false), 450);
    setPerchIndex((prev) => (prev + 1) % PERCH_ORDER.length);
  }, []);

  // Minimizar / Restaurar (Modo Concentración)
  const handleToggleMinimize = useCallback(() => {
    setIsMinimized((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem("calibra_gecko_minimized", next ? "true" : "false");
      } catch {
        // Silencioso en navegadores restringidos
      }
      return next;
    });
  }, []);

  // Click directo en el Gecko
  const handleGeckoClick = useCallback(() => {
    if (!bubbleOpen) {
      setBubbleOpen(true);
      setIsReacting(true);
      setTimeout(() => setIsReacting(false), 400);
    } else {
      handleNextMessage();
    }
  }, [bubbleOpen, handleNextMessage]);

  // Si estamos en un examen activo, no renderizamos para garantizar concentración total
  if (isEnExamenActivo) {
    return null;
  }

  // Si está minimizado, mostrar botón sutil en el borde izquierdo
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-6 z-40">
        <button
          type="button"
          onClick={handleToggleMinimize}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/90 border border-primary/20 text-foreground text-xs font-semibold shadow-md backdrop-blur-md hover:border-primary transition-all cursor-pointer group"
          aria-label="Restaurar compañero Calibra Gecko"
          title="Ver compañero Calibra Gecko"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <CalibraGeckoSvg mood="curious" orientation="horizontal" className="w-5 h-5" />
          </div>
          <span className="hidden sm:inline text-muted-foreground group-hover:text-foreground">Gecko</span>
          <Eye className="w-3.5 h-3.5 text-primary" />
        </button>
      </div>
    );
  }

  // Determinación de clases y orientaciones según el perch
  let containerPosition = "fixed bottom-6 left-6 z-40";
  let geckoOrientation: GeckoOrientation = "horizontal";
  let bubblePosition = "bottom-full mb-3 left-0";

  if (perch === "right-edge") {
    // En móvil se fuerza a bottom-left para no desbordar
    containerPosition = "fixed bottom-6 left-6 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:right-4 md:left-auto z-40";
    geckoOrientation = "vertical-left";
    bubblePosition = "bottom-full mb-3 left-0 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:right-full md:mr-3 md:left-auto";
  } else if (perch === "top-right") {
    // Debajo de la cabecera en el lateral derecho
    containerPosition = "fixed bottom-6 left-6 md:bottom-auto md:top-24 md:right-6 md:left-auto z-40";
    geckoOrientation = "horizontal";
    bubblePosition = "bottom-full mb-3 left-0 md:bottom-auto md:top-full md:mt-3 md:right-0 md:left-auto";
  }

  const mood: GeckoMood = currentMessage?.mood ?? "curious";

  return (
    <div
      role="region"
      aria-label="Compañero Calibra Gecko"
      className={cn("flex items-center select-none transition-all duration-300", containerPosition)}
    >
      <div className="relative flex items-center justify-center">
        {/* BURBUJA DE DIÁLOGO */}
        {bubbleOpen && currentMessage && (
          <div
            className={cn(
              "absolute w-72 sm:w-80 p-4 rounded-2xl shadow-xl transition-all duration-300 pointer-events-auto",
              // Paleta: modo claro blanco cálido con borde carmesí sutil; modo oscuro superficie profunda con blur
              "bg-card/95 text-card-foreground border border-primary/25 backdrop-blur-xl dark:bg-[#30262D]/95 dark:border-[#E56B83]/30 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]",
              bubblePosition
            )}
          >
            {/* Cabecera de la burbuja */}
            <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">
                  GECKO • {currentMessage.tag}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {/* Botón cambiar de lugar */}
                <button
                  type="button"
                  onClick={handleCyclePerch}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                  title="Cambiar de lugar en pantalla"
                  aria-label="Mover a otra posición"
                >
                  <Compass className="w-3.5 h-3.5" />
                </button>
                {/* Botón modo concentración */}
                <button
                  type="button"
                  onClick={handleToggleMinimize}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                  title="Minimizar (Modo concentración)"
                  aria-label="Minimizar compañero"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
                {/* Botón cerrar burbuja */}
                <button
                  type="button"
                  onClick={() => setBubbleOpen(false)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                  title="Cerrar mensaje"
                  aria-label="Cerrar burbuja"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Texto del mensaje */}
            <p className="text-xs sm:text-[13px] leading-relaxed text-foreground font-medium">
              {currentMessage.texto}
            </p>

            {/* Acción contextual si existe */}
            {currentMessage.accion && (
              <div className="mt-3 pt-2.5 border-t border-border/30">
                <Link
                  to={currentMessage.accion.href}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline underline-offset-4"
                >
                  <span>{currentMessage.accion.label}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {/* Pie de burbuja con botón de siguiente consejo */}
            <div className="flex items-center justify-between mt-3 pt-2 text-[11px] text-muted-foreground border-t border-border/20">
              <span className="text-[10px] opacity-75">Toca el gecko para más</span>
              <button
                type="button"
                onClick={handleNextMessage}
                className="inline-flex items-center gap-1 font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
              >
                <span>Siguiente</span>
                <Sparkles className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* BOTÓN DEL GECKO SVG INTERACTIVO */}
        <button
          type="button"
          onClick={handleGeckoClick}
          className="relative group p-1.5 rounded-full hover:bg-primary/10 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={bubbleOpen ? "Siguiente consejo de Calibra Gecko" : "Abrir consejo de Calibra Gecko"}
          aria-expanded={bubbleOpen}
          title={bubbleOpen ? "Haz clic para otro consejo" : "Abrir mensaje de Calibra Gecko"}
        >
          {/* Halo sutil en hover */}
          <div className="absolute inset-0 rounded-full bg-primary/10 scale-90 group-hover:scale-110 opacity-0 group-hover:opacity-100 transition-all duration-300 blur-sm pointer-events-none" />

          {/* Gecko SVG Renderizado */}
          <CalibraGeckoSvg
            mood={mood}
            orientation={geckoOrientation}
            isReacting={isReacting}
            className="w-14 h-14 sm:w-16 sm:h-16"
          />

          {/* Indicador de burbuja cerrada */}
          {!bubbleOpen && (
            <span
              className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-background animate-pulse"
              aria-hidden="true"
            />
          )}
        </button>
      </div>
    </div>
  );
}
