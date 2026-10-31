import type { Visual } from "@/lib/tutor/chat";
const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
// Los datos ya fueron recalculados y verificados por el backend: aquí solo se dibujan.
export function VisualView({ v }: { v: Visual }) {
  if (v.forma === "cadena_porcentual")
    return (
      <ol
        className="flex flex-wrap items-center gap-2"
        aria-label="Cadena de cambios porcentuales"
      >
        {v.pasos.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            {p.op && (
              <span className="rounded-full bg-muted px-2 py-1 text-xs font-bold">
                {p.op}
              </span>
            )}
            <span className="rounded-lg border border-border bg-background px-3 py-1 font-bold">
              {fmt(p.valor)}
            </span>
          </li>
        ))}
      </ol>
    );
  if (v.forma === "barra_de_partes")
    return (
      <figure>
        <div
          className="flex h-8 overflow-hidden rounded-lg border border-border"
          role="img"
          aria-label={`${v.marcadas} de ${v.partes} partes marcadas`}
        >
          {Array.from({ length: v.partes }, (_, i) => (
            <div
              key={i}
              className={`flex-1 border-r border-border last:border-r-0 ${i < v.marcadas ? "bg-primary" : "bg-background"}`}
            />
          ))}
        </div>
        <figcaption className="mt-1 text-xs text-muted-foreground">
          {v.marcadas} de {v.partes} partes
          {v.fraccion ? ` (${v.fraccion})` : ""} · total {fmt(v.total)}
        </figcaption>
      </figure>
    );
  if (v.forma === "tabla_proporcion")
    return (
      <table className="w-full max-w-sm text-sm">
        <caption className="mb-1 text-left text-xs text-muted-foreground">
          Relación {v.relacion}
        </caption>
        <thead>
          <tr>
            {v.columnas.map((c) => (
              <th key={c} className="border-b border-border p-2 text-left">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {v.filas.map(([a, b], i) => (
            <tr key={i}>
              <td className="border-b border-border p-2">{fmt(a)}</td>
              <td className="border-b border-border p-2">{fmt(b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  const ancho = 320,
    x = (n: number) => 20 + ((n - v.min) / (v.max - v.min)) * (ancho - 40);
  return (
    <figure>
      <svg
        viewBox={`0 0 ${ancho} 70`}
        className="w-full max-w-md"
        role="img"
        aria-label={`Recta numérica de ${fmt(v.min)} a ${fmt(v.max)} con los puntos ${v.puntos.map((p) => fmt(p.valor)).join(", ")}`}
      >
        <line x1="20" y1="35" x2={ancho - 20} y2="35" stroke="currentColor" />
        <text
          x="20"
          y="62"
          fontSize="11"
          textAnchor="middle"
          fill="currentColor"
        >
          {fmt(v.min)}
        </text>
        <text
          x={ancho - 20}
          y="62"
          fontSize="11"
          textAnchor="middle"
          fill="currentColor"
        >
          {fmt(v.max)}
        </text>
        {v.puntos.map((p, i) => (
          <g key={i}>
            <circle cx={x(p.valor)} cy="35" r="5" fill="currentColor" />
            <text
              x={x(p.valor)}
              y="20"
              fontSize="11"
              textAnchor="middle"
              fill="currentColor"
            >
              {p.etiqueta ? `${p.etiqueta} (${fmt(p.valor)})` : fmt(p.valor)}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
