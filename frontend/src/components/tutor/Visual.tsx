import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { Visual } from "@/lib/tutor/chat";
import {
  marcasDeRecta,
  posicionEnRecta,
  tramosDeCadena,
} from "@/lib/tutor/visual";
const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
const ANCHO = 360;
// Los datos ya fueron recalculados y verificados por el servidor: aquí solo se dibujan.
function Cadena({ v }: { v: Extract<Visual, { forma: "cadena_porcentual" }> }) {
  const tramos = tramosDeCadena(v.pasos);
  const texto = `Cadena de cambios porcentuales: ${fmt(v.pasos[0].valor)}${tramos
    .map((t) => `, ${t.op || "cambia"} a ${fmt(t.hasta)}`)
    .join("")}`;
  return (
    <div className="tb-cadena" role="img" aria-label={texto}>
      <span className="tb-cadena-valor">{fmt(v.pasos[0].valor)}</span>
      {tramos.map((t, i) => (
        <span key={i} className="tb-cadena-tramo">
          <span
            className={`tb-cadena-flecha ${t.sube ? "tb-sube" : "tb-baja"}`}
          >
            <small>{t.op}</small>
            <svg viewBox="0 0 64 20" aria-hidden="true">
              <path
                d="M2 10h54m0 0-8-7m8 7-8 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="tb-cadena-valor">{fmt(t.hasta)}</span>
        </span>
      ))}
    </div>
  );
}
function Barra({ v }: { v: Extract<Visual, { forma: "barra_de_partes" }> }) {
  const hueco = 4;
  const ancho = (ANCHO - hueco * (v.partes - 1)) / v.partes;
  return (
    <figure className="tb-figura">
      <svg
        viewBox={`0 0 ${ANCHO} 74`}
        className="tb-svg"
        role="img"
        aria-label={`Barra de ${v.partes} partes iguales con ${v.marcadas} marcadas${
          v.fraccion ? ` (${v.fraccion})` : ""
        }; total ${fmt(v.total)}`}
      >
        {Array.from({ length: v.partes }, (_, i) => (
          <rect
            key={i}
            x={i * (ancho + hueco)}
            y="8"
            width={ancho}
            height="34"
            rx="6"
            className={i < v.marcadas ? "tb-seg tb-seg--on" : "tb-seg"}
          />
        ))}
        {v.marcadas > 0 && (
          <path
            d={`M0 54v6h${v.marcadas * (ancho + hueco) - hueco}v-6`}
            fill="none"
            className="tb-llave"
          />
        )}
        <text x="0" y="72" className="tb-svg-texto">
          {v.marcadas} de {v.partes} partes
          {v.fraccion ? ` = ${v.fraccion}` : ""}
        </text>
      </svg>
      <figcaption>Total: {fmt(v.total)}</figcaption>
    </figure>
  );
}
function Tabla({ v }: { v: Extract<Visual, { forma: "tabla_proporcion" }> }) {
  const [a, b] = v.filas[0];
  const directa = v.relacion === "directa";
  const Flecha = directa ? ArrowUpRight : ArrowDownRight;
  return (
    <figure className="tb-figura">
      <table className="tb-tabla">
        <caption>
          <Flecha size={18} aria-hidden="true" />
          Relación {v.relacion}
          <small>
            {directa
              ? "Si una cantidad aumenta, la otra aumenta en la misma proporción."
              : "Si una cantidad aumenta, la otra disminuye en la misma proporción."}
          </small>
        </caption>
        <thead>
          <tr>
            {v.columnas.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {v.filas.map(([x, y], i) => (
            <tr key={i}>
              <td>{fmt(x)}</td>
              <td>{fmt(y)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption>
        {directa
          ? `Constante: ${v.columnas[1]} ÷ ${v.columnas[0]} = ${fmt(b / a)}`
          : `Constante: ${v.columnas[0]} × ${v.columnas[1]} = ${fmt(a * b)}`}
      </figcaption>
    </figure>
  );
}
function Recta({ v }: { v: Extract<Visual, { forma: "recta_numerica" }> }) {
  const x = (n: number) => 20 + posicionEnRecta(n, v.min, v.max) * (ANCHO - 40);
  const marcas = marcasDeRecta(v.min, v.max);
  return (
    <figure className="tb-figura">
      <svg
        viewBox={`0 0 ${ANCHO} 96`}
        className="tb-svg"
        role="img"
        aria-label={`Recta numérica de ${fmt(v.min)} a ${fmt(v.max)} con los puntos ${v.puntos
          .map((p) =>
            p.etiqueta ? `${p.etiqueta} (${fmt(p.valor)})` : fmt(p.valor),
          )
          .join(", ")}`}
      >
        <line x1="20" y1="52" x2={ANCHO - 20} y2="52" className="tb-eje" />
        {marcas.map((m) => (
          <g key={m}>
            <line x1={x(m)} y1="46" x2={x(m)} y2="58" className="tb-eje" />
            <text x={x(m)} y="76" textAnchor="middle" className="tb-svg-texto">
              {fmt(m)}
            </text>
          </g>
        ))}
        {v.puntos.map((p, i) => (
          <g key={i}>
            <line
              x1={x(p.valor)}
              y1="26"
              x2={x(p.valor)}
              y2="52"
              className="tb-pin-tallo"
            />
            <circle cx={x(p.valor)} cy="52" r="6" className="tb-pin" />
            <text
              x={x(p.valor)}
              y="16"
              textAnchor="middle"
              className="tb-svg-texto tb-svg-texto--punto"
            >
              {p.etiqueta ? `${p.etiqueta} (${fmt(p.valor)})` : fmt(p.valor)}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
export function VisualView({ v }: { v: Visual }) {
  switch (v.forma) {
    case "cadena_porcentual":
      return <Cadena v={v} />;
    case "barra_de_partes":
      return <Barra v={v} />;
    case "tabla_proporcion":
      return <Tabla v={v} />;
    case "recta_numerica":
      return <Recta v={v} />;
  }
}
