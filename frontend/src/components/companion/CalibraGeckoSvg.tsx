import { useId } from "react";
import { cn } from "@/lib/utils";

export type GeckoMood = "curious" | "focused" | "celebrating";
export type GeckoOrientation = "horizontal" | "vertical-left" | "peek-top";

export interface CalibraGeckoSvgProps {
  className?: string;
  mood?: GeckoMood;
  orientation?: GeckoOrientation;
  isReacting?: boolean;
}

/**
 * Calibra Gecko SVG — Mascota y compañero de enfoque de CALIBRA.
 *
 * Diseño vectorial estilizado y minimalista en paleta carmesí oficial:
 * - Cuerpo en degradado Carmesí (#941F3D a #B83A56).
 * - Crestas dorsales y almohadillas digitales en Rosa Luminoso (#E56B83).
 * - Ojos expresivos en Crema (#F7F1E8) con pupila oscura (#211B20).
 * - Micro-animaciones CSS: respiración, suave meneo de cola y parpadeo.
 */
export function CalibraGeckoSvg({
  className,
  mood = "curious",
  orientation = "horizontal",
  isReacting = false,
}: CalibraGeckoSvgProps) {
  const uid = useId();
  const gradId = `gecko-body-grad-${uid.replace(/:/g, "")}`;
  const eyeGradId = `gecko-eye-grad-${uid.replace(/:/g, "")}`;

  // Orientaciones según el borde donde se posa
  const orientationClass =
    orientation === "vertical-left"
      ? "-rotate-90"
      : orientation === "peek-top"
        ? "rotate-180"
        : "";

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center transition-transform duration-500 select-none",
        orientationClass,
        isReacting && "scale-110 -translate-y-1",
        className
      )}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible drop-shadow-[0_4px_12px_rgba(148,31,61,0.35)]"
        aria-hidden="true"
      >
        <defs>
          {/* Degradado principal del cuerpo del gecko */}
          <linearGradient id={gradId} x1="50" y1="12" x2="50" y2="95" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#B83A56" />
            <stop offset="50%" stopColor="#941F3D" />
            <stop offset="100%" stopColor="#75152E" />
          </linearGradient>

          {/* Degradado sutil de ojos */}
          <radialGradient id={eyeGradId} cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="#F7F1E8" />
            <stop offset="100%" stopColor="#EADECF" />
          </radialGradient>

          <style>
            {`
              @keyframes calibra-gecko-breath {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.028); }
              }
              @keyframes calibra-gecko-tail {
                0%, 100% { transform: rotate(0deg); }
                30% { transform: rotate(4deg); }
                70% { transform: rotate(-5deg); }
              }
              @keyframes calibra-gecko-blink {
                0%, 88%, 94%, 100% { transform: scaleY(1); }
                91% { transform: scaleY(0.1); }
              }
              @keyframes calibra-gecko-sparkle {
                0%, 100% { opacity: 0.3; transform: scale(0.85); }
                50% { opacity: 1; transform: scale(1.15); }
              }
              .calibra-gecko-body-anim {
                transform-origin: 50px 45px;
                animation: calibra-gecko-breath 3.6s ease-in-out infinite;
              }
              .calibra-gecko-tail-anim {
                transform-origin: 50px 64px;
                animation: calibra-gecko-tail 4.4s ease-in-out infinite;
              }
              .calibra-gecko-eye-anim {
                transform-origin: center;
                animation: calibra-gecko-blink 4.8s ease-in-out infinite;
              }
              .calibra-gecko-sparkle-anim {
                animation: calibra-gecko-sparkle 1.8s ease-in-out infinite;
              }
              @media (prefers-reduced-motion: reduce) {
                .calibra-gecko-body-anim,
                .calibra-gecko-tail-anim,
                .calibra-gecko-eye-anim,
                .calibra-gecko-sparkle-anim {
                  animation: none !important;
                }
              }
            `}
          </style>
        </defs>

        {/* Patas traseras con almohadillas digitales */}
        <g id="patas-traseras">
          {/* Pata trasera izquierda */}
          <path
            d="M 43 60 C 33 61, 25 64, 21 70 C 18 73, 20 76, 24 73 C 28 69, 36 66, 45 64 Z"
            fill="#801833"
          />
          {/* Almohadillas pie izquierdo */}
          <circle cx="16" cy="69" r="2.2" fill="#E56B83" />
          <circle cx="17.5" cy="74.5" r="2.2" fill="#E56B83" />
          <circle cx="21.5" cy="77" r="2.2" fill="#E56B83" />
          <circle cx="26" cy="76" r="2.2" fill="#E56B83" />

          {/* Pata trasera derecha */}
          <path
            d="M 57 60 C 67 61, 75 64, 79 70 C 82 73, 80 76, 76 73 C 72 69, 64 66, 55 64 Z"
            fill="#801833"
          />
          {/* Almohadillas pie derecho */}
          <circle cx="84" cy="69" r="2.2" fill="#E56B83" />
          <circle cx="82.5" cy="74.5" r="2.2" fill="#E56B83" />
          <circle cx="78.5" cy="77" r="2.2" fill="#E56B83" />
          <circle cx="74" cy="76" r="2.2" fill="#E56B83" />
        </g>

        {/* Cola sinuosa animada */}
        <g className="calibra-gecko-tail-anim">
          <path
            d="M 47 64 C 47 74, 57 79, 63 85 C 69 91, 64 97, 56 97 C 49 97, 46 92, 49 88 C 52 84, 57 84, 55 79 C 53 74, 46 71, 44 64 Z"
            fill="url(#"
            style={{ fill: `url(#${gradId})` }}
          />
          {/* Mancha luminosa en punta de cola */}
          <circle cx="53" cy="94" r="2" fill="#E56B83" opacity="0.85" />
          <circle cx="59" cy="86" r="1.6" fill="#E56B83" opacity="0.75" />
        </g>

        {/* Patas delanteras con almohadillas digitales */}
        <g id="patas-delanteras">
          {/* Pata delantera izquierda */}
          <path
            d="M 40 32 C 30 30, 22 26, 18 21 C 16 18, 19 16, 22 18 C 27 22, 34 26, 42 28 Z"
            fill="#941F3D"
          />
          {/* Almohadillas mano izquierda */}
          <circle cx="15.5" cy="18" r="2.2" fill="#E56B83" />
          <circle cx="18" cy="14" r="2.2" fill="#E56B83" />
          <circle cx="22.5" cy="13.5" r="2.2" fill="#E56B83" />
          <circle cx="26" cy="16" r="2.2" fill="#E56B83" />

          {/* Pata delantera derecha */}
          <path
            d="M 60 32 C 70 30, 78 26, 82 21 C 84 18, 81 16, 78 18 C 73 22, 66 26, 58 28 Z"
            fill="#941F3D"
          />
          {/* Almohadillas mano derecha */}
          <circle cx="84.5" cy="18" r="2.2" fill="#E56B83" />
          <circle cx="82" cy="14" r="2.2" fill="#E56B83" />
          <circle cx="77.5" cy="13.5" r="2.2" fill="#E56B83" />
          <circle cx="74" cy="16" r="2.2" fill="#E56B83" />
        </g>

        {/* Torso y Cabeza animados con respiración sutil */}
        <g className="calibra-gecko-body-anim">
          {/* Cuerpo principal contorneado */}
          <path
            d="M 44 26 C 36 29, 36 40, 37 48 C 38 56, 41 62, 46 65 C 50 66, 54 66, 56 64 C 60 61, 62 55, 63 47 C 64 39, 63 29, 56 26 Z"
            fill={`url(#${gradId})`}
          />

          {/* Cabeza aerodinámica tipo cuña redondeada */}
          <path
            d="M 40 25 C 37 20, 42 12, 50 11 C 58 12, 63 20, 60 25 C 57 28, 43 28, 40 25 Z"
            fill="#B83A56"
          />

          {/* Crestas dorsales / Escamas geométricas en Rosa Luminoso (#E56B83) */}
          <g opacity="0.95">
            {/* Escama nuca */}
            <path d="M 50 24 L 51.5 26.5 L 50 29 L 48.5 26.5 Z" fill="#E56B83" />
            {/* Escama torso 1 */}
            <path d="M 50 33 L 52.2 36 L 50 39 L 47.8 36 Z" fill="#E56B83" />
            {/* Escama central (Chispa de Calibra) */}
            <path d="M 50 43 L 53 46.5 L 50 50 L 47 46.5 Z" fill="#E56B83" />
            {/* Escama torso 3 */}
            <path d="M 50 54 L 52 56.5 L 50 59 L 48 56.5 Z" fill="#E56B83" />
          </g>

          {/* Ojos expresivos grandes con parpadeo */}
          <g className="calibra-gecko-eye-anim">
            {/* Cuenca y ojo izquierdo */}
            <circle cx="39" cy="18" r="5" fill="#75152E" />
            <circle cx="39" cy="18" r="4.2" fill={`url(#${eyeGradId})`} />
            {/* Pupila */}
            <ellipse
              cx={mood === "focused" ? "39" : mood === "curious" ? "38.2" : "39"}
              cy="18"
              rx={mood === "celebrating" ? "3.2" : "2.2"}
              ry={mood === "celebrating" ? "1.8" : "3.2"}
              fill="#211B20"
            />
            {/* Brillo destello blanco */}
            <circle cx="37.8" cy="16.5" r="1.1" fill="#FFFFFF" />

            {/* Cuenca y ojo derecho */}
            <circle cx="61" cy="18" r="5" fill="#75152E" />
            <circle cx="61" cy="18" r="4.2" fill={`url(#${eyeGradId})`} />
            {/* Pupila */}
            <ellipse
              cx={mood === "focused" ? "61" : mood === "curious" ? "61.8" : "61"}
              cy="18"
              rx={mood === "celebrating" ? "3.2" : "2.2"}
              ry={mood === "celebrating" ? "1.8" : "3.2"}
              fill="#211B20"
            />
            {/* Brillo destello blanco */}
            <circle cx="59.8" cy="16.5" r="1.1" fill="#FFFFFF" />
          </g>

          {/* Hocico y sonrisa discreta */}
          <circle cx="48.5" cy="13" r="0.6" fill="#75152E" />
          <circle cx="51.5" cy="13" r="0.6" fill="#75152E" />
        </g>

        {/* Efecto de celebración: chispitas flotantes */}
        {mood === "celebrating" && (
          <g className="calibra-gecko-sparkle-anim" fill="#E56B83">
            <path d="M 28 8 L 29.5 11 L 32.5 12.5 L 29.5 14 L 28 17 L 26.5 14 L 23.5 12.5 L 26.5 11 Z" />
            <path d="M 72 8 L 73.5 11 L 76.5 12.5 L 73.5 14 L 72 17 L 70.5 14 L 67.5 12.5 L 70.5 11 Z" />
          </g>
        )}
      </svg>
    </div>
  );
}

