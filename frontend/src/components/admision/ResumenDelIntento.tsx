import type { InformeDeIntento } from "@/integrations/supabase/admision";
import { cursoPorId } from "@/lib/admision/temario";

/**
 * El resultado al entregar: el puntaje sobre el máximo y el recuento, y debajo cada curso. El informe
 * completo (si habrías ingresado, temas débiles, consejos) es del plan 3.
 */
export function ResumenDelIntento({ informe }: { informe: InformeDeIntento }) {
  const cursos = Object.entries(informe.porCurso).sort((a, b) => (b[1].errores + b[1].blancos) - (a[1].errores + a[1].blancos));
  return (
    <section aria-label="Tu resultado" className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <p className="text-4xl font-extrabold tabular-nums text-foreground">
          {/* "es" y no "es-PE": es-PE pone punto decimal (18.875 se lee como dieciocho mil) y aquí, como en el banco, va coma. */}
          {informe.puntaje.toLocaleString("es", { maximumFractionDigits: 3 })}
          <span className="text-xl font-bold text-muted-foreground"> / {informe.maximo}</span>
        </p>
        <ul className="flex flex-wrap gap-2 text-sm font-semibold">
          <li className="rounded-full bg-muted px-3 py-1">{informe.aciertos} {informe.aciertos === 1 ? "correcta" : "correctas"}</li>
          <li className="rounded-full bg-muted px-3 py-1">{informe.errores} {informe.errores === 1 ? "incorrecta" : "incorrectas"}</li>
          <li className="rounded-full bg-muted px-3 py-1">{informe.blancos} en blanco</li>
        </ul>
      </div>
      <p className="text-sm text-muted-foreground">+20 por correcta, −1,125 por incorrecta y 0 en blanco, como en San Marcos.</p>
      {cursos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Resultado por curso</caption>
            <thead>
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="py-1 pr-3 font-semibold">Curso</th>
                <th scope="col" className="py-1 pr-3 text-right font-semibold">Bien</th>
                <th scope="col" className="py-1 pr-3 text-right font-semibold">Mal</th>
                <th scope="col" className="py-1 text-right font-semibold">En blanco</th>
              </tr>
            </thead>
            <tbody>
              {cursos.map(([id, c]) => (
                <tr key={id} className="border-t border-border">
                  <th scope="row" className="py-1.5 pr-3 text-left font-semibold">{cursoPorId(id)?.nombre ?? id}</th>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{c.aciertos}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{c.errores}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.blancos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
