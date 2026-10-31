import { useEffect, useState } from "react";
import { Check, Workflow } from "lucide-react";
import { etiquetasPasos } from "@/lib/tutor/wow";

export function PasosAgente({
  pasos,
  nuevo = false,
  demo = false,
}: {
  pasos?: string[];
  nuevo?: boolean;
  demo?: boolean;
}) {
  const etiquetas = etiquetasPasos(pasos);
  const [abierto, setAbierto] = useState(nuevo);
  useEffect(() => {
    if (!nuevo) return;
    const timer = window.setTimeout(
      () => setAbierto(false),
      etiquetas.length * 150 * (demo ? 1.25 : 1) + 1800,
    );
    return () => window.clearTimeout(timer);
  }, [nuevo, etiquetas.length, demo]);
  if (!etiquetas.length) return null;
  return (
    <details
      className={`tw-pasos${nuevo ? " tw-pasos--nuevos" : ""}`}
      open={abierto}
      onToggle={(e) => setAbierto(e.currentTarget.open)}
    >
      <summary>
        <Workflow size={15} aria-hidden="true" /> {etiquetas.length}{" "}
        {etiquetas.length === 1 ? "paso del agente" : "pasos del agente"}
        <span>Herramientas reales</span>
      </summary>
      <ol aria-live={nuevo ? "polite" : "off"}>
        {etiquetas.map((etiqueta, i) => (
          <li
            key={i}
            style={{ animationDelay: `${i * 150 * (demo ? 1.25 : 1)}ms` }}
          >
            <Check size={14} aria-hidden="true" />
            {etiqueta}
          </li>
        ))}
      </ol>
    </details>
  );
}
