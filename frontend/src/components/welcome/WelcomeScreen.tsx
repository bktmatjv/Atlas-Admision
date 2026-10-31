import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { CalibraSymbol } from "@/components/brand/CalibraBrand";
import { cn } from "@/lib/utils";
import "./welcome.css";

export interface WelcomeScreenProps {
  onComplete: () => void;
}

/**
 * Bienvenida de CALIBRA, identidad «Marcador»: la cancha antes del partido. Verde cancha con sus
 * líneas de cal, la marca y una sola acción. Respeta los deep-links: solo se muestra una vez por sesión.
 */
export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [isExiting, setIsExiting] = useState(false);
  const enterButton = useRef<HTMLButtonElement>(null);
  const exitTimer = useRef<number | null>(null);
  useEffect(() => {
    enterButton.current?.focus();
    return () => { if (exitTimer.current !== null) window.clearTimeout(exitTimer.current); };
  }, []);

  const handleEnter = useCallback(() => {
    if (isExiting || exitTimer.current !== null) return;
    setIsExiting(true);

    exitTimer.current = window.setTimeout(() => {
      try {
        sessionStorage.setItem("calibra_welcome_seen_v1", "true");
      } catch {
        // En caso de modo incógnito estricto o permisos bloqueados
      }
      onComplete();
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450);
  }, [isExiting, onComplete]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenida a CALIBRA"
      onKeyDown={(e) => {
        if (e.key === "Tab") { e.preventDefault(); enterButton.current?.focus(); }
        if (["Enter", " ", "Escape"].includes(e.key)) { e.preventDefault(); handleEnter(); }
      }}
      className={cn(
        "fixed inset-0 z-[100] flex min-h-screen w-full items-center justify-center overflow-hidden bg-cancha text-white select-none",
        isExiting && "calibra-welcome-fade-out",
      )}
    >
      {/* Líneas de cal de media cancha: dibujo, no decoración de fondo genérica */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1200 800">
        <g fill="none" stroke="hsl(0 0% 100% / 0.09)" strokeWidth="3">
          <line x1="600" y1="0" x2="600" y2="800" />
          <circle cx="600" cy="400" r="150" />
          <rect x="-2" y="230" width="150" height="340" />
          <rect x="1052" y="230" width="150" height="340" />
          <rect x="24" y="24" width="1152" height="752" />
        </g>
        <circle cx="600" cy="400" r="6" fill="hsl(0 0% 100% / 0.12)" />
      </svg>

      <div className="calibra-welcome-entrada relative z-10 flex w-full max-w-md flex-col items-center px-6 text-center">
        <CalibraSymbol size="xl" className="h-20 w-20" />
        <p className="mt-6 font-display text-[clamp(3.5rem,14vw,5.5rem)] font-extrabold uppercase leading-[0.9] tracking-[0.02em] text-white">
          Calibra
        </p>
        <p className="mt-3 font-display text-2xl font-bold uppercase tracking-[0.04em] text-ambar">Aprende a pensar</p>
        <p className="mt-6 max-w-sm text-base leading-relaxed text-white/80">
          Practica con exámenes reales de San Marcos. Cuando fallas, el tutor te ayuda a encontrar dónde se rompió tu
          razonamiento. Solo cuenta lo que resuelves tú.
        </p>
        <button
          ref={enterButton}
          type="button"
          onClick={handleEnter}
          className="group mt-10 inline-flex min-h-14 w-full max-w-xs items-center justify-center gap-2 rounded-md bg-ambar px-8 text-lg font-bold text-grafito transition-[transform,background-color] duration-150 hover:bg-[hsl(40_100%_64%)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Empezar
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
