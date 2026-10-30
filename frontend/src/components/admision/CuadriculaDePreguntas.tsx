import type { EstadoDeCelda } from "@/lib/admision/intento";

const ROTULO: Record<EstadoDeCelda, string> = {
  actual: "actual", acierto: "acertada", fallo: "fallada", marcada: "marcada para revisar", respondida: "respondida", blanco: "en blanco",
};

/**
 * La cuadrícula para saltar entre las preguntas del examen (spec §3). A diferencia del marcador de la
 * práctica, aquí sí se vuelve atrás: en el examen real se puede cambiar una respuesta hasta entregar.
 * Cada celda dice su estado con palabras para el lector de pantalla, no solo con el color.
 */
export function CuadriculaDePreguntas({ estados, actual, onIr }: {
  estados: EstadoDeCelda[];
  actual: number;
  onIr: (indice: number) => void;
}) {
  return (
    <nav aria-label="Preguntas del examen">
      <ol className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(2.25rem,1fr))]">
        {estados.map((estado, i) => (
          <li key={i} className="flex justify-center">
            <button
              type="button"
              onClick={() => onIr(i)}
              aria-current={i === actual ? "step" : undefined}
              aria-label={`Pregunta ${i + 1}, ${ROTULO[i === actual && estado !== "acierto" && estado !== "fallo" ? "actual" : estado]}`}
              data-estado={i === actual && estado !== "acierto" && estado !== "fallo" ? "actual" : estado === "blanco" ? "pendiente" : estado}
              className="arc-pastilla cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {i + 1}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
