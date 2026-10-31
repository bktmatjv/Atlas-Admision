import { describe, expect, it } from "vitest";
import { cn } from "./utils";

/**
 * `cn` y la escala semántica.
 *
 * Estas pruebas existen por un fallo real: `tailwind-merge` no conocía `text-body` ni
 * `text-meta`, los tomaba por colores de texto, y `cn("text-meta text-muted-foreground")`
 * devolvía solo el color. El tamaño de fuente desaparecía sin avisar en todo componente
 * que combinara ambas cosas.
 */

describe("cn con la escala semántica", () => {
  it("conserva el tamaño junto al color, que son grupos distintos", () => {
    for (const size of ["text-figure", "text-title", "text-body", "text-meta", "text-label"]) {
      const out = cn(size, "text-muted-foreground");
      expect(out, size).toContain(size);
      expect(out, size).toContain("text-muted-foreground");
    }
  });

  it("da igual el orden", () => {
    expect(cn("text-muted-foreground", "text-meta")).toContain("text-meta");
    expect(cn("text-muted-foreground", "text-meta")).toContain("text-muted-foreground");
  });

  it("resuelve un tamaño semántico contra otro: gana el último", () => {
    expect(cn("text-body", "text-meta")).toBe("text-meta");
    expect(cn("text-meta", "text-figure")).toBe("text-figure");
  });

  it("resuelve un tamaño semántico contra la escala antigua, en los dos sentidos", () => {
    // Este es el caso que fallaba: las bases de shadcn traen `text-sm`.
    expect(cn("text-sm", "text-meta")).toBe("text-meta");
    expect(cn("text-meta", "text-sm")).toBe("text-sm");
    expect(cn("text-lg", "text-title")).toBe("text-title");
  });

  it("no estorba a los colores entre sí", () => {
    expect(cn("text-muted-foreground", "text-foreground")).toBe("text-foreground");
  });

  it("deja intacto lo que no es ni tamaño ni color", () => {
    const out = cn("text-meta", "font-medium", "tabular-nums", "text-muted-foreground");
    for (const cls of ["text-meta", "font-medium", "tabular-nums", "text-muted-foreground"]) {
      expect(out, cls).toContain(cls);
    }
  });

  it("sigue resolviendo los grupos normales de Tailwind", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("rounded-md", "rounded-lg")).toBe("rounded-lg");
  });
});
