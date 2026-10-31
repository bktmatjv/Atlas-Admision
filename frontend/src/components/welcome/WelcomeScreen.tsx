import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import "./welcome.css";

export interface WelcomeScreenProps {
  onComplete: () => void;
}

/**
 * Pantalla de Bienvenida Oficial de CALIBRA ("CALIBRA Welcome Experience").
 *
 * Diseñada bajo la estética Liquid Glass y paleta semántica oscura (#211B20 / #941F3D / #E56B83).
 * Implementada con un patrón Non-Invasive Session Gatekeeper que preserva deep-links intactos.
 */
export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleEnter = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);

    setTimeout(() => {
      try {
        sessionStorage.setItem("calibra_welcome_seen_v1", "true");
      } catch {
        // En caso de modo incógnito estricto o permisos bloqueados
      }
      onComplete();
    }, 650);
  }, [isExiting, onComplete]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        const target = e.target as HTMLElement | null;
        if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
        e.preventDefault();
        handleEnter();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleEnter]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenida a CALIBRA"
      className={cn(
        "fixed inset-0 z-[100] min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#211B20] text-[#F7F1E8] select-none",
        isExiting && "calibra-welcome-fade-out"
      )}
    >
      {/* Fondo Inmersivo (Orbes y Caustics) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {/* Orbe 1 (Carmesí principal #941F3D/30, top -15%, centrado horizontalmente) */}
        <div className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[540px] h-[540px] rounded-full bg-[#941F3D]/30 calibra-animate-liquid-1" />

        {/* Orbe 2 (Carmesí secundario #B83A56/22, top-[32%] -left-[15%]) */}
        <div className="absolute top-[32%] -left-[15%] w-[460px] h-[460px] rounded-full bg-[#B83A56]/22 calibra-animate-liquid-2" />

        {/* Orbe 3 (Rosa #E56B83/16, -bottom-[10%] -right-[12%]) */}
        <div className="absolute -bottom-[10%] -right-[12%] w-[520px] h-[520px] rounded-full bg-[#E56B83]/16 calibra-animate-liquid-1" />

        {/* Orbe 4 (Superficie #30262D/60, top-[48%] left-[52%]) */}
        <div className="absolute top-[48%] left-[52%] w-[340px] h-[340px] rounded-full bg-[#30262D]/60 calibra-animate-liquid-3" />

        {/* Anillos Caustic */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] rounded-full border border-white/[0.04] calibra-animate-caustic" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[920px] h-[920px] rounded-full border border-white/[0.02]" />

        {/* Textura micro-grain */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(rgba(247, 241, 232, 0.8) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      {/* Píldora Superior ("CALIBRA • ESPACIO PARA PENSAR") */}
      <div className="absolute top-6 inset-x-0 mx-auto w-fit z-20 flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#E56B83] shadow-[0_0_8px_#E56B83]" aria-hidden="true" />
        <span className="font-['Montserrat',_'Plus_Jakarta_Sans',_sans-serif] text-[10px] tracking-[0.2em] uppercase font-medium text-[#F7F1E8]/75">
          CALIBRA • ESPACIO PARA PENSAR
        </span>
      </div>

      {/* Clúster Central Flotante */}
      <div className="relative z-10 w-full max-w-[460px] min-h-screen px-6 py-12 flex flex-col items-center justify-between">
        {/* Espaciador superior */}
        <div className="w-full pt-8" />

        {/* Núcleo de Identidad: Isotipo Hero + Título + Separador + Eslogan */}
        <div className="flex flex-col items-center text-center my-auto">
          {/* Isotipo Hero */}
          <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center mb-8">
            {/* Halo orgánico pulsante */}
            <div className="absolute inset-0 rounded-full bg-[#E56B83]/20 blur-2xl calibra-animate-halo" aria-hidden="true" />
            {/* Anillo óptico de cristal líquido */}
            <div className="absolute inset-0 rounded-full border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm shadow-[inset_0_0_24px_rgba(255,255,255,0.03)]" aria-hidden="true" />
            {/* Isotipo Oficial CALIBRA (C rompecabezas + Destello cognitivo central) */}
            <img
              src="/brand/calibra-symbol-dark.png"
              alt="Isotipo CALIBRA"
              className="relative z-10 w-28 h-28 sm:w-32 sm:h-32 object-contain drop-shadow-[0_8px_24px_rgba(229,107,131,0.25)] select-none pointer-events-none"
              loading="eager"
            />
          </div>

          {/* Título Principal (<h1>) */}
          <h1 className="text-[40px] sm:text-[46px] leading-tight font-bold tracking-[0.22em] uppercase text-[#F7F1E8] drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)] pl-[0.22em] font-['Montserrat',_'Plus_Jakarta_Sans',_sans-serif]">
            CALIBRA
          </h1>

          {/* Separador de Calibración Minimalista */}
          <div className="flex items-center justify-center gap-3 w-48 my-4" aria-hidden="true">
            <span className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#B83A56]" />
            <div className="relative flex items-center justify-center">
              <span className="w-1.5 h-1.5 rotate-45 bg-[#E56B83] shadow-[0_0_8px_#E56B83]" />
              <span className="absolute h-3 w-[1px] bg-[#E56B83]/50" />
            </div>
            <span className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#B83A56]" />
          </div>

          {/* Eslogan Oficial (<p>) */}
          <p className="text-xs sm:text-sm font-medium tracking-[0.22em] text-[#F7F1E8]/90 uppercase font-['Montserrat',_'Plus_Jakarta_Sans',_sans-serif]">
            Aprende a pensar.
          </p>
        </div>

        {/* Botón de Acción Principal ("Entrar a CALIBRA") */}
        <div className="w-full pb-4">
          <button
            type="button"
            onClick={handleEnter}
            disabled={isExiting}
            className="calibra-btn-liquid-glass w-full py-4 px-8 rounded-full flex items-center justify-center gap-3 group text-[#F7F1E8] cursor-pointer"
            aria-label="Entrar a CALIBRA"
          >
            <span className="calibra-btn-light-sweep" aria-hidden="true" />
            <span className="relative z-10 font-['Montserrat',_'Plus_Jakarta_Sans',_sans-serif] font-semibold tracking-wider text-sm sm:text-base">
              Entrar a CALIBRA
            </span>
            <span
              className="relative z-10 w-7 h-7 rounded-full bg-white/[0.08] border border-white/20 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5"
              aria-hidden="true"
            >
              <svg
                className="w-3.5 h-3.5 text-[#F7F1E8]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

