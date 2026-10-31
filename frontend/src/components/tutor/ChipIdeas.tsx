import { Network } from "lucide-react";
import { etiquetaIdeas } from "@/lib/tutor/eventos";

/** Aviso discreto de que el tutor sumó ideas al mapa; abre el grafo. */
export function ChipIdeas({
  ideas,
  onAbrir,
}: {
  ideas: number;
  onAbrir?: () => void;
}) {
  const etiqueta = etiquetaIdeas(ideas);
  if (!etiqueta) return null;
  return (
    <button
      type="button"
      className="tw-chip-ideas"
      onClick={onAbrir}
      aria-label={`${etiqueta}. Abrir el grafo`}
    >
      <Network size={15} aria-hidden="true" /> {etiqueta}
    </button>
  );
}
