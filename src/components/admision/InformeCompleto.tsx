import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dumbbell } from "lucide-react";
import { admisionDb, type AreaDeAdmision, type PreguntaDelIntento } from "@/integrations/supabase/admision";
import type { RespuestaLocal } from "@/hooks/useIntentoDeAdmision";
import { usePerfilDeAdmision } from "@/hooks/useAdmisionDatos";
import { usePracticarAdmision } from "@/hooks/usePracticarAdmision";
import { informeDe, evolucion, nombreDelTema } from "@/lib/admision/informe";
import { planDePuntos } from "@/lib/admision/plan";
import { calibracion } from "@/lib/admision/estrategia";
import { consejos } from "@/lib/admision/consejos";
import { cursoPorId } from "@/lib/admision/temario";

const fmt = (x: number) => x.toLocaleString("es", { maximumFractionDigits: 3 });
const pct = (x: number) => `${Math.round(x * 100)} %`;
const nombre = (curso: string | null) => (curso ? cursoPorId(curso)?.nombre ?? curso : "Sin curso");
const tarjeta = "min-w-0 space-y-3 rounded-2xl border border-border bg-card p-5";
const HORAS = [5, 10, 15, 20, 30];
/** Si no nos dijo cuántas horas estudia, el plan supone 10 a la semana, y lo dice. */
const HORAS_SUPUESTAS = 10;

interface Props {
  area: AreaDeAdmision;
  preguntas: PreguntaDelIntento[];
  respuestas: Record<string, RespuestaLocal>;
  userId: string | null;
  /** Lleva a una pregunta del examen (para repasar una fallada). */
  onIr: (indice: number) => void;
}

/**
 * El informe de un intento entregado: dónde se fueron los puntos, los temas flojos con su botón para
 * practicarlos, consejos, el plan de la semana, la estrategia de marcado, la evolución y las falladas. Lo
 * calcula el navegador (src/lib/admision/informe.ts) con lo que el servidor ya corrigió.
 */
export function InformeCompleto({ area, preguntas, respuestas, userId, onIr }: Props) {
  const perfil = usePerfilDeAdmision(userId);
  const [cursoFiltro, setCursoFiltro] = useState("");

  const informe = useMemo(() => informeDe(preguntas, respuestas, area), [preguntas, respuestas, area]);
  const cal = useMemo(() => calibracion(preguntas.filter((p) => p.clave !== null).map((p) => ({
    curso: p.curso, opcion: respuestas[p.pregunta_id]?.opcion ?? null, correcta: respuestas[p.pregunta_id]?.correcta ?? null,
    confianza: respuestas[p.pregunta_id]?.confianza ?? null,
  }))), [preguntas, respuestas]);
  const lista = useMemo(() => consejos(informe, cal), [informe, cal]);
  const horas = perfil.data?.horas_semana ?? HORAS_SUPUESTAS;
  const plan = useMemo(() => planDePuntos(informe.porCurso, area, horas), [informe, area, horas]);

  const { data: historial = [] } = useQuery({
    queryKey: ["admision-intentos-evolucion", userId],
    enabled: !!userId,
    retry: false,
    queryFn: async () => {
      const { data, error: e } = await admisionDb.from("admision_intentos")
        .select("id, modo, filtro, estado, puntaje, informe, created_at").order("created_at", { ascending: false }).limit(20);
      if (e) throw e;
      return data ?? [];
    },
  });
  const evo = useMemo(() => evolucion(historial), [historial]);

  const { armando, error, practicar: armar } = usePracticarAdmision(area);
  const practicar = (clave: string, curso: string, tema?: string) => armar(clave, { curso, ...(tema ? { tema } : {}) });
  // Una función y no un componente: declarado aquí dentro, React lo desmontaría en cada pintado.
  const botonPracticar = (clave: string, curso: string, tema?: string) => (
    <button
      type="button"
      disabled={armando !== null}
      onClick={() => void practicar(clave, curso, tema)}
      className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-primary hover:bg-muted disabled:opacity-60"
    >
      <Dumbbell className="h-4 w-4" aria-hidden /> {armando === clave ? "Preparando…" : "Practicar"}
    </button>
  );

  const cursosConPerdida = informe.porCurso.filter((c) => c.perdidos > 0);
  const temasFlojos = informe.porTema.filter((t) => t.acierto < 0.7);
  const conHoras = plan.prioridades.filter((p) => p.horas > 0);
  const falladas = informe.falladas.filter((f) => !cursoFiltro || f.curso === cursoFiltro);
  const cursosFallados = [...new Set(informe.falladas.map((f) => f.curso ?? ""))];

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}

      {lista.length > 0 && (
        <section aria-labelledby="inf-consejos" className={tarjeta}>
          <h2 id="inf-consejos" className="text-lg font-extrabold text-foreground">Tu siguiente paso</h2>
          <ol className="space-y-2">
            {lista.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1">{c.texto}</span>
                {c.practicar && botonPracticar(`consejo-${i}`, c.practicar.curso, c.practicar.tema)}
              </li>
            ))}
          </ol>
        </section>
      )}

      {cursosConPerdida.length > 0 && (
        <section aria-labelledby="inf-cursos" className={tarjeta}>
          <h2 id="inf-cursos" className="text-lg font-extrabold text-foreground">Dónde se fueron tus puntos</h2>
          <p className="text-sm text-muted-foreground">Primero lo que más pesa: puntos perdidos por cuántas preguntas trae el curso en tu examen.</p>
          <ul className="divide-y divide-border">
            {cursosConPerdida.map((c) => (
              <li key={c.curso} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-foreground">{nombre(c.curso)}</span>
                  <span className="text-muted-foreground"> · {c.aciertos} de {c.preguntas} bien{c.peso ? ` · ${c.peso} en tu examen` : ""}</span>
                </span>
                <span className="tabular-nums font-semibold text-foreground">−{fmt(c.perdidos)} pts</span>
                {botonPracticar(`curso-${c.curso}`, c.curso)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {temasFlojos.length > 0 && (
        <section aria-labelledby="inf-temas" className={tarjeta}>
          <h2 id="inf-temas" className="text-lg font-extrabold text-foreground">Temas para reforzar</h2>
          <p className="text-sm text-muted-foreground">Solo los temas con 3 preguntas o más en este examen.</p>
          <ul className="divide-y divide-border">
            {temasFlojos.map((t) => (
              <li key={`${t.curso}/${t.tema}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-foreground">{t.nombre}</span>
                  <span className="text-muted-foreground"> · {nombre(t.curso)} · {t.aciertos} de {t.preguntas}</span>
                </span>
                {botonPracticar(`tema-${t.curso}-${t.tema}`, t.curso, t.tema)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {conHoras.length > 0 && (
        <section aria-labelledby="inf-plan" className={tarjeta}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="inf-plan" className="text-lg font-extrabold text-foreground">Tu plan para esta semana</h2>
            <label className="text-sm font-semibold">Horas por semana{" "}
              <select
                className="ml-1 min-h-10 rounded-lg border border-border bg-background px-2 text-sm"
                value={horas}
                disabled={!perfil.data || perfil.guardar.isPending}
                onChange={(e) => perfil.guardar.mutate({ horas_semana: Number(e.target.value) })}
              >
                {[...new Set([...HORAS, horas])].sort((a, b) => a - b).map((h) => <option key={h} value={h}>{h} h</option>)}
              </select>
            </label>
          </div>
          <ul className="space-y-1 text-sm">
            {conHoras.map((p) => (
              <li key={p.curso} className="flex flex-wrap justify-between gap-2">
                <span><span className="font-semibold text-foreground">{nombre(p.curso)}</span><span className="text-muted-foreground"> · aciertas {pct(p.acierto)}{p.sinDatos ? " (supuesto: sin preguntas en este examen)" : ""}</span></span>
                <span className="tabular-nums">{fmt(p.horas)} h · +{p.puntosEsperados} pts</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Estimación de Atlas: cuánto cuesta subir en cada curso son supuestos, no datos oficiales.
            {perfil.data?.horas_semana ? "" : ` Supone ${HORAS_SUPUESTAS} horas a la semana: cámbialo arriba${perfil.data ? "" : " cuando elijas tu escuela"}.`}
          </p>
        </section>
      )}

      <section aria-labelledby="inf-marcar" className={tarjeta}>
        <h2 id="inf-marcar" className="text-lg font-extrabold text-foreground">Marcar o dejar en blanco</h2>
        <p className="text-sm text-muted-foreground">
          Una incorrecta resta 1,125 y una correcta suma 20: marcar conviene si tienes más de un {fmt(Math.round(cal.umbral * 1000) / 10)} % de acertar.
          En la actitudinal marca siempre: ahí no resta. Reglas por verificar con el reglamento 2027-I.
        </p>
        {cal.blancos > 0 && (
          <p className="text-sm">Dejaste <strong>{cal.blancos}</strong> en blanco. Marcándolas al azar habrías sumado, en promedio, <strong>{fmt(cal.puntosRegaladosEnBlanco)}</strong> puntos; si descartas opciones, más.</p>
        )}
        {cal.respuestasConConfianza > 0 ? (
          <ul className="grid gap-2 text-sm sm:grid-cols-3">
            {cal.niveles.map((n) => (
              <li key={n.confianza} className="rounded-xl border border-border p-3">
                <span className="block font-semibold text-foreground">{["", "Cuando dudas", "Más o menos", "Cuando estás seguro"][n.confianza]}</span>
                <span className="block text-muted-foreground">
                  {n.preguntas ? `${n.aciertos} de ${n.preguntas} bien` : "Sin respuestas"}
                  {n.recomendacion === "pocos-datos" ? (n.preguntas ? " · aún pocas para concluir" : "") : n.recomendacion === "blanco" ? " · mejor en blanco" : " · te conviene marcar"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">En el próximo simulacro, toca «Dudo», «Más o menos» o «Seguro» al responder: con eso te decimos cuándo te conviene marcar.</p>
        )}
      </section>

      {evo && (
        <section aria-labelledby="inf-evolucion" className={tarjeta}>
          <h2 id="inf-evolucion" className="text-lg font-extrabold text-foreground">Cómo vas</h2>
          <p className="text-sm">
            {evo.serie.map((s) => fmt(s.puntaje)).join(" → ")}{" "}
            <strong className="tabular-nums">({evo.cambio >= 0 ? "+" : ""}{fmt(evo.cambio)} desde el anterior)</strong>
          </p>
          {evo.cursos.length > 0 && (
            <ul className="flex flex-wrap gap-2 text-sm">
              {evo.cursos.map((c) => (
                <li key={c.curso} className="rounded-full border border-border px-3 py-1">
                  {nombre(c.curso)} <span className="text-muted-foreground">{pct(c.antes)} → {pct(c.ahora)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {informe.falladas.length > 0 && (
        <section aria-labelledby="inf-falladas" className={tarjeta}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="inf-falladas" className="text-lg font-extrabold text-foreground">Para repasar ({informe.falladas.length})</h2>
            <label className="text-sm font-semibold">Curso{" "}
              <select className="ml-1 min-h-10 rounded-lg border border-border bg-background px-2 text-sm" value={cursoFiltro} onChange={(e) => setCursoFiltro(e.target.value)}>
                <option value="">Todos</option>
                {cursosFallados.map((c) => <option key={c} value={c}>{nombre(c || null)}</option>)}
              </select>
            </label>
          </div>
          <ul className="flex flex-wrap gap-2">
            {falladas.map((f) => (
              <li key={f.pregunta_id}>
                <button
                  type="button"
                  onClick={() => onIr(f.indice)}
                  className="min-h-10 rounded-lg border border-border px-3 text-left text-sm hover:bg-muted"
                  aria-label={`Pregunta ${f.indice + 1}, ${nombre(f.curso)}${f.tema ? `, ${nombreDelTema(f.curso, f.tema)}` : ""}: ${f.tipo === "blanco" ? "en blanco" : `marcaste ${f.opcion}, era ${f.clave}`}`}
                >
                  <span className="font-semibold">{f.indice + 1}</span>{" "}
                  <span className="text-muted-foreground">{f.tipo === "blanco" ? "en blanco" : `${f.opcion} → ${f.clave}`}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
