import { useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, BookmarkCheck, BookOpen, Eraser, Eye, ListOrdered, Maximize2, Minimize2 } from "lucide-react";
import { MathMarkdown } from "@/components/shared/MathMarkdown";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { PreguntaDelIntento } from "@/integrations/supabase/admision";
import type { RespuestaLocal, Revelado } from "@/hooks/useIntentoDeAdmision";
import { letrasDe } from "@/lib/admision/intento";
import { cursoPorId } from "@/lib/admision/temario";
import { textoLegible } from "@/lib/admision/texto-legible";
import { esCursoDeCalculo } from "@/lib/stem/resolucion";
import { cn } from "@/lib/utils";

const CONFIANZA: [number, string][] = [[1, "Dudo"], [2, "Más o menos"], [3, "Seguro"]];

interface Props {
  intentoId?: string;
  pregunta: PreguntaDelIntento;
  indice: number;
  total: number;
  respuesta: RespuestaLocal | undefined;
  urls: Record<string, string>;
  /** Entregado: ya hay clave y solución, y no se puede responder. */
  corregida: boolean;
  revelado?: Revelado;
  puedeRevelar: boolean;
  onResponder: (letra: string | null) => void;
  onMarcar: () => void;
  onRevelar: () => void;
  /** Qué tan seguro está de la que marcó (1 dudo, 2 más o menos, 3 seguro). Opcional: sin él, no hay fichas. */
  onConfiar?: (nivel: number) => void;
  /** Lo que va al final de la columna de la pregunta: la navegación entre preguntas. */
  pie?: React.ReactNode;
}

/**
 * Una pregunta del examen. Antes de entregar, todas las opciones se ven igual (como en la práctica):
 * nada adelanta cuál es la buena. Corregida, la buena en menta y la tuya, si fallaste, en coral, con
 * palabras además del color; y debajo, la solución de Atlas.
 */
export function PreguntaDeAdmision({
  intentoId, pregunta, indice, total, respuesta, urls, corregida, revelado, puedeRevelar, onResponder, onMarcar, onRevelar, onConfiar, pie,
}: Props) {
  const [ampliado, setAmpliado] = useState<string | null>(null);
  const [rotos, setRotos] = useState<Record<string, boolean>>({});
  const elegida = respuesta?.opcion ?? null;
  const clave = revelado?.clave ?? pregunta.clave;
  const solucion = revelado?.solucion ?? pregunta.solucion;
  const mostrarCorreccion = (corregida || Boolean(revelado) || Boolean(respuesta?.revelada)) && clave !== null;
  const bloqueada = corregida || Boolean(respuesta?.revelada);
  const curso = pregunta.curso ? cursoPorId(pregunta.curso)?.nombre ?? pregunta.curso : null;

  const estadoDe = (letra: string) => {
    if (!mostrarCorreccion) return elegida === letra ? "elegida" : "libre";
    if (letra === clave) return "correcta";
    if (letra === elegida) return "fallada";
    return "apagada";
  };

  // Lectura y gráficos son el «soporte»: en escritorio van en su columna, que baja por su cuenta,
  // y la pregunta queda al lado con todas sus opciones a la vista. Sin soporte, una sola columna.
  const conSoporte = Boolean(pregunta.texto_cuerpo) || pregunta.graficos.length > 0;
  const rotuloDeLectura = `Lectura${pregunta.texto_etiqueta ? ` · ${pregunta.texto_etiqueta}` : ""}`;

  return (
    <article aria-labelledby={`pregunta-${pregunta.pregunta_id}`} className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`pregunta-${pregunta.pregunta_id}`} className="text-lg font-extrabold text-foreground">
          Pregunta {indice + 1} <span className="font-semibold text-muted-foreground">de {total}</span>
        </h2>
        {curso && <span className="text-sm font-semibold text-muted-foreground">{curso}</span>}
      </header>

      <div className={cn("space-y-4", conSoporte && "lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0")}>
        {conSoporte && (
          // `dvh` menos la barra del intento y el encabezado: la columna nunca empuja la página.
          <div className="space-y-3 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7.5rem)] lg:overflow-y-auto lg:pr-1">
            {pregunta.texto_cuerpo && (
              <>
                {/* Móvil: la lectura y las cinco opciones no caben juntas en ninguna pantalla. Una barra
                    abre el texto entero desde abajo; al cerrarlo, las opciones siguen donde estaban. */}
                <Sheet>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 text-left hover:bg-muted lg:hidden"
                    >
                      <BookOpen className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-bold text-foreground">{rotuloDeLectura}</span>
                      <span className="text-sm font-semibold text-primary">Leer</span>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
                    <SheetHeader className="mb-3 text-left">
                      <SheetTitle>{rotuloDeLectura}</SheetTitle>
                    </SheetHeader>
                    <div className="text-[0.97rem] leading-relaxed">
                      <MathMarkdown content={pregunta.texto_cuerpo} />
                    </div>
                  </SheetContent>
                </Sheet>

                <details open className="hidden rounded-xl border border-border bg-muted/40 p-4 lg:block">
                  <summary className="cursor-pointer font-bold text-foreground">{rotuloDeLectura}</summary>
                  <div className="mt-3 text-[0.97rem] leading-relaxed">
                    <MathMarkdown content={pregunta.texto_cuerpo} />
                  </div>
                </details>
              </>
            )}

            {pregunta.graficos.map((ruta) => (
              // «Ampliar» va sobre la esquina del gráfico: en su propia fila costaba 44 px que en móvil
              // eran justo los de la última opción.
              <figure key={ruta} className="relative">
                {urls[ruta] && !rotos[ruta] ? (
                  <img
                    src={urls[ruta]}
                    onError={() => setRotos((r) => ({ ...r, [ruta]: true }))}
                    alt={`Gráfico de la pregunta ${indice + 1}`}
                    className={cn("mx-auto rounded-lg border border-border bg-white object-contain", ampliado === ruta ? "max-h-none w-full" : "max-h-40 sm:max-h-52 lg:max-h-80")}
                  />
                ) : (
                  <div className="grid h-40 place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                    No se pudo cargar el gráfico
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setAmpliado(ampliado === ruta ? null : ruta)}
                  aria-expanded={ampliado === ruta}
                  className="absolute bottom-1.5 right-1.5 flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-background/90 px-2.5 text-sm font-semibold text-primary shadow-sm backdrop-blur hover:bg-muted"
                >
                  {ampliado === ruta ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
                  {ampliado === ruta ? "Reducir" : "Ampliar"}
                </button>
              </figure>
            ))}
          </div>
        )}

        <div className="min-w-0 space-y-4">
          <div className="text-[1.05rem] leading-relaxed text-foreground">
            <MathMarkdown content={pregunta.enunciado} />
          </div>

          <div role="radiogroup" aria-label={`Opciones de la pregunta ${indice + 1}`} className="flex flex-col gap-2">
            {letrasDe(pregunta.opciones).map((letra) => {
              const estado = estadoDe(letra);
              return (
                <button
                  key={letra}
                  type="button"
                  role="radio"
                  aria-checked={elegida === letra}
                  aria-label={`${letra}: ${textoLegible(pregunta.opciones[letra] ?? "")}${estado === "correcta" ? " (correcta)" : estado === "fallada" ? " (tu respuesta)" : ""}`}
                  disabled={bloqueada}
                  onClick={() => onResponder(letra)}
                  data-estado={estado}
                  className="arc-opcion arc-opcion--compacta min-h-12 px-3 py-1.5 text-left disabled:cursor-default sm:px-4"
                >
                  <span className="arc-tecla" aria-hidden="true">{letra}</span>
                  <span className="min-w-0 flex-1 text-base leading-snug"><MathMarkdown content={pregunta.opciones[letra]} /></span>
                  {estado === "correcta" && <span className="text-sm font-bold">Correcta</span>}
                  {estado === "fallada" && <span className="text-sm font-bold">Tu respuesta</span>}
                </button>
              );
            })}
          </div>

          {!bloqueada && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onMarcar}
                aria-pressed={Boolean(respuesta?.marcada)}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted"
              >
                {respuesta?.marcada ? <BookmarkCheck className="h-4 w-4" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}
                {respuesta?.marcada ? "Marcada para revisar" : "Marcar para revisar"}
              </button>
              {elegida && (
                <button type="button" onClick={() => onResponder(null)} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted">
                  <Eraser className="h-4 w-4" aria-hidden /> Dejar en blanco
                </button>
              )}
              {onConfiar && elegida && (
                // Opcional y en la misma fila: no frena el cronometrado. Alimenta la estrategia de marcado.
                <div role="group" aria-label="¿Qué tan seguro estás?" className="flex items-center gap-1 rounded-lg border border-border p-1">
                  {CONFIANZA.map(([nivel, rotulo]) => (
                    <button
                      key={nivel}
                      type="button"
                      aria-pressed={respuesta?.confianza === nivel}
                      onClick={() => onConfiar(nivel)}
                      className={cn("min-h-9 rounded-md px-2.5 text-sm font-semibold", respuesta?.confianza === nivel ? "bg-primary text-primary-foreground hover:bg-primary-hover" : "text-muted-foreground hover:bg-muted")}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
              )}
              {puedeRevelar && elegida && (
                <button type="button" onClick={onRevelar} className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
                  <Eye className="h-4 w-4" aria-hidden /> Ver la solución
                </button>
              )}
            </div>
          )}

          {mostrarCorreccion && (
            <section aria-label="Solución de CALIBRA" className="space-y-2 rounded-xl border border-border bg-muted/40 p-4">
              <p className="font-bold text-foreground">
                {elegida === null ? "La dejaste en blanco." : elegida === clave ? "¡Bien! Acertaste." : `La correcta es la ${clave}.`}
              </p>
              {solucion && <div className="text-[0.97rem] leading-relaxed"><MathMarkdown content={solucion} /></div>}
              {/* La solución de arriba se lee; esto la hace él, con Atlas guiando cada paso. */}
              {intentoId && (
                <Link
                  to={`/aprender?intento=${encodeURIComponent(intentoId)}&pregunta=${encodeURIComponent(pregunta.pregunta_id)}`}
                  className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-primary hover:bg-muted"
                >
                  <ListOrdered className="h-4 w-4" aria-hidden /> Entender esta pregunta con CALIBRA
                </Link>
              )}
            </section>
          )}

          {pie}
        </div>
      </div>
    </article>
  );
}
