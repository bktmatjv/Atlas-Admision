import {
  ChartNoAxesColumnIncreasing,
  BookOpen,
  Compass,
  TriangleAlert,
  CircleDashed,
} from "lucide-react";
import { resumenDelMapa } from "@/lib/tutor/presentacion";
import type { Grafo } from "@/lib/tutor/grafo";

export function TutorProgress({
  grafo,
  arbolId,
}: {
  grafo?: Grafo;
  arbolId?: string;
}) {
  const r = grafo ? resumenDelMapa(grafo, arbolId) : null;
  const metrics = [
    {
      label: "Ideas aplicadas",
      note: "con evidencia registrada",
      value: r?.aplicados,
      icon: BookOpen,
      color: "wine",
    },
    {
      label: "En exploración",
      note: "ideas que estás conectando",
      value: r?.explorados,
      icon: Compass,
      color: "blue",
    },
    {
      label: "Para revisar",
      note: "errores pendientes de reforzar",
      value: r?.revisar,
      icon: TriangleAlert,
      color: "red",
    },
    {
      label: "Por descubrir",
      note: "nodos aún sin explorar",
      value: r?.sinExplorar,
      icon: CircleDashed,
      color: "amber",
    },
  ];
  return (
    <section className="tutor-progress" aria-labelledby="tutor-progress-title">
      <div className="tutor-progress-intro">
        <span className="tutor-icon-tile">
          <ChartNoAxesColumnIncreasing size={26} />
        </span>
        <div>
          <h2 id="tutor-progress-title">
            Tu recorrido{arbolId ? " en este tema" : " de aprendizaje"}
          </h2>
          <p>
            Explorar es un comienzo. Aplicarlo por tu cuenta aporta evidencia.
          </p>
        </div>
      </div>
      <div className="tutor-progress-total">
        <span className="tutor-count-ring">{r?.total ?? "—"}</span>
        <div>
          <strong>Ideas en tu mapa</strong>
          <span>No es una nota de comprensión</span>
        </div>
      </div>
      {metrics.map(({ label, note, value, icon: Icon, color }) => (
        <div
          className={`tutor-progress-metric tutor-progress-metric--${color}`}
          key={label}
        >
          <span className="tutor-metric-icon">
            <Icon size={25} />
          </span>
          <div>
            <strong>{value ?? "—"}</strong>
            <span>{label}</span>
            <small>{note}</small>
          </div>
        </div>
      ))}
    </section>
  );
}
