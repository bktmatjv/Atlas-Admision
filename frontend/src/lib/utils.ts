import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Los cinco tamaños semánticos del sistema, tal como los declara
 * `theme.extend.fontSize` en `tailwind.config.ts`.
 *
 * Hay que declararlos aquí también, y no es duplicación gratuita: `tailwind-merge` trae
 * su propia tabla de valores conocidos y ahí solo están los de la escala por defecto
 * (`xs`…`9xl`). Un `text-meta` le resulta desconocido, y ante un `text-<algo>` que no
 * reconoce como tamaño lo clasifica como **color de texto**. Consecuencia: `cn("text-meta
 * text-muted-foreground")` devolvía solo `text-muted-foreground` —los dos caían en el
 * mismo grupo y ganaba el último—, así que el tamaño de fuente desaparecía en silencio.
 *
 * Pasaba en todo sitio que combinara tamaño y color a través de `cn()`, `StatusCell`
 * incluido. Con el grupo declarado, `text-meta` compite contra `text-sm` (que es lo
 * correcto) y conviven con `text-muted-foreground` (que también).
 */
const SEMANTIC_FONT_SIZES = ["figure", "title", "body", "meta", "label"] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...SEMANTIC_FONT_SIZES] }],
    },
  },
});

/**
 * Une clases de Tailwind resolviendo los conflictos, con `clsx` para las condicionales.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
