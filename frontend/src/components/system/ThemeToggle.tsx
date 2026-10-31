import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Claro/oscuro, una sola implementación.
 *
 * Antes había cuatro, cada una con su icono, su tamaño y su forma de leer el tema —una
 * usaba `theme`, otra `resolvedTheme`, que no son lo mismo cuando el ajuste es «sistema»—.
 * Aquí siempre se lee `resolvedTheme`: es el tema que el usuario está viendo, y es lo que
 * el control tiene que reflejar.
 *
 * Segmentado y no un botón que alterna: así se ve cuál de los dos temas está activo. El
 * patrón anterior era un botón cuyo texto anunciaba la acción («Modo oscuro») mientras el
 * icono mostraba el estado, y las dos lecturas se contradicen.
 *
 * Sin variante de solo icono: las dos barras que lo usan admiten el segmentado, así que
 * una variante más no tendría consumidores.
 */

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div
      role="group"
      aria-label="Tema"
      className={cn("inline-flex gap-0.5 rounded-xl bg-secondary p-0.5", className)}
    >
      {([["light", "Claro", Sun], ["dark", "Oscuro", Moon]] as const).map(([value, label, Icon]) => {
        const selected = (value === "dark") === isDark;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => setTheme(value)}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 h-8 text-meta transition-colors duration-150",
              "focus-visible:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
              selected
                ? "bg-primary text-primary-foreground font-bold shadow-[0_2px_0_hsl(var(--primary-hover))]"
                : "text-muted-foreground font-semibold hover:text-foreground",
            )}
          >
            <Icon className="w-3 h-3" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
