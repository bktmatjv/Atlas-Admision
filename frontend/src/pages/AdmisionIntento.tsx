import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { BarraDelIntento } from "@/components/admision/BarraDelIntento";
import { CuadriculaDePreguntas } from "@/components/admision/CuadriculaDePreguntas";
import { PreguntaDeAdmision } from "@/components/admision/PreguntaDeAdmision";
import { ResumenDelIntento } from "@/components/admision/ResumenDelIntento";
import { Ingresaba } from "@/components/admision/Ingresaba";
import { InformeCompleto } from "@/components/admision/InformeCompleto";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { useIntentoDeAdmision } from "@/hooks/useIntentoDeAdmision";
import { estadoDeCelda, resumenParaEntregar } from "@/lib/admision/intento";
import { puntajeParaIngresaba } from "@/lib/admision/diagnostico";

const AREA: Record<string, string> = { A: "Área A", B: "Área B", C: "Área C", D: "Área D", E: "Área E", medicina: "Medicina" };

/** `/admision/intento/:id`: rendir un examen de admisión y, entregado, repasarlo con las soluciones. */
export default function AdmisionIntentoPagina() {
  const { id } = useParams<{ id: string }>();
  return <AdmisionIntento key={id} />;
}

function AdmisionIntento() {
  const { id } = useParams<{ id: string }>();
  const x = useIntentoDeAdmision(id);
  const userId = useAuthUserId();
  const [actual, setActual] = useState(0);

  useEffect(() => { document.title = "Examen de admisión | CALIBRA"; }, []);
  // Al cambiar de pregunta, a la PREGUNTA, no al principio de la página: corregido, arriba está el
  // resumen del puntaje, y cada clic en la cuadrícula mandaba ahí y perdía la pregunta de vista. Si el
  // encabezado ya se ve, no se mueve nada.
  const arriba = useRef<HTMLDivElement>(null);
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    const el = arriba.current;
    if (!el) return;
    const { top } = el.getBoundingClientRect();
    if (top < 120 || top > window.innerHeight * 0.4) el.scrollIntoView({ block: "start" });
  }, [actual]);

  const corregido = x.intento?.estado === "entregado";
  const estados = useMemo(() => x.preguntas.map((p, i) => {
    const r = x.respuestas[p.pregunta_id];
    return estadoDeCelda({ actual: i === actual, respondida: Boolean(r?.opcion), marcada: Boolean(r?.marcada), correcta: corregido ? r?.correcta ?? null : null });
  }), [x.preguntas, x.respuestas, actual, corregido]);
  const resumen = resumenParaEntregar(x.preguntas.map((p) => p.pregunta_id), x.respuestas);

  const titulo = x.intento
    ? `${x.intento.modo === "real" ? "Examen real" : x.intento.modo === "repaso" ? "Repaso del cuaderno" : x.intento.modo === "diagnostico" ? "Diagnóstico" : x.intento.filtro ? "Práctica" : "Simulacro"} · ${AREA[x.intento.area] ?? x.intento.area}`
    : "Examen de admisión";
  const pregunta = x.preguntas[actual];
  // «¿Ingresaba?» con exámenes y simulacros completos, o con la proyección de un diagnóstico; nunca con una práctica.
  const comparable = x.intento ? puntajeParaIngresaba({ ...x.intento, informe: x.informe ?? x.intento.informe }, x.intento.area) : null;

  return (
    <ResponsiveLayout sinBarraInferior>
      <main className="min-w-0 flex-1 px-4 pb-24 md:px-6 lg:pb-8">
        <div className="mx-auto max-w-6xl space-y-5">
          {x.cargando && <p className="py-10 text-center text-muted-foreground" role="status">Cargando el examen…</p>}
          {x.error && (
            <div role="alert" className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
              <span>{x.error}</span>
              <button type="button" onClick={x.descartarError} className="font-semibold underline">Cerrar</button>
            </div>
          )}

          {!x.cargando && x.intento && (
            <>
              {corregido ? (
                <div className="space-y-3 pt-4">
                  <Link to="/admision" className="text-sm font-semibold text-primary hover:underline">← Volver a Admisión</Link>
                  <h1 className="text-2xl font-extrabold text-foreground">{titulo}</h1>
                  {x.informe && <ResumenDelIntento informe={x.informe} />}
                  {comparable && <Ingresaba userId={userId} puntaje={comparable.puntaje} aviso={comparable.aviso} area={x.intento.area} />}
                  <InformeCompleto area={x.intento.area} preguntas={x.preguntas} respuestas={x.respuestas} userId={userId} onIr={setActual} />
                  <h2 className="pt-2 text-lg font-extrabold text-foreground">Repasa tus respuestas</h2>
                </div>
              ) : (
                <BarraDelIntento
                  titulo={titulo}
                  restante={x.restante}
                  resumen={resumen}
                  pendientes={x.pendientes}
                  entregando={x.entregando}
                  onEntregar={() => void x.entregar()}
                />
              )}

              {!corregido && x.restante === 0 && x.pendientes > 0 && <section className="rounded-xl border border-destructive/30 bg-card p-4"><p>El tiempo terminó. Hay {x.pendientes} respuestas sin confirmar que no se incluirán si entregas ahora.</p><button className="mt-3 min-h-11 rounded-lg border px-4 font-semibold" disabled={x.entregando} onClick={() => { if (window.confirm('¿Entregar solo las respuestas ya guardadas en el servidor? Las pendientes no contarán.')) void x.entregar(true); }}>Entregar únicamente las respuestas guardadas</button></section>}
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
                {/* `scroll-mt-24`: al saltar a una pregunta, su encabezado queda bajo la barra fija. */}
                <div ref={arriba} className="min-w-0 scroll-mt-32 lg:scroll-mt-24">
                  {pregunta && (
                    <PreguntaDeAdmision
                      key={pregunta.pregunta_id}
                      intentoId={x.intento.id}
                      pregunta={pregunta}
                      indice={actual}
                      total={x.preguntas.length}
                      respuesta={x.respuestas[pregunta.pregunta_id]}
                      urls={x.urls}
                      corregida={corregido}
                      revelado={x.revelados[pregunta.pregunta_id]}
                      puedeRevelar={!corregido && x.intento.tipo === "practica" && x.intento.ver_soluciones}
                      onResponder={(letra) => x.responder(pregunta.pregunta_id, letra)}
                      onMarcar={() => x.marcar(pregunta.pregunta_id)}
                      onRevelar={() => void x.revelar(pregunta.pregunta_id)}
                      onConfiar={(nivel) => x.confiar(pregunta.pregunta_id, nivel)}
                      pie={
                        // Bajo las opciones, no bajo la lectura: con un texto largo, «Siguiente» se iba
                        // una pantalla más abajo de donde se responde.
                        <nav aria-label="Cambiar de pregunta" className="sticky bottom-20 z-10 -mx-1 flex justify-between gap-3 border-t border-border bg-background/95 px-1 py-2 backdrop-blur lg:bottom-0">
                          <button type="button" disabled={actual === 0} onClick={() => setActual((i) => i - 1)}
                            className="flex min-h-11 items-center gap-1 rounded-lg border border-border px-4 font-semibold hover:bg-muted disabled:opacity-40">
                            <ChevronLeft className="h-4 w-4" aria-hidden /> Anterior
                          </button>
                          {actual < x.preguntas.length - 1 && (
                            <button type="button" onClick={() => setActual((i) => i + 1)}
                              className="flex min-h-11 items-center gap-1 rounded-lg bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover">
                              Siguiente <ChevronRight className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                        </nav>
                      }
                    />
                  )}
                </div>
                <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
                  <h2 className="text-sm font-bold text-muted-foreground">
                    {corregido ? "Tus respuestas" : `${resumen.respondidas} de ${x.preguntas.length} respondidas`}
                  </h2>
                  <CuadriculaDePreguntas estados={estados} actual={actual} onIr={setActual} />
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
    </ResponsiveLayout>
  );
}
