import { CheckCircle2, ExternalLink, Target } from "lucide-react";
import { useDatosDeSanMarcos, usePerfilDeAdmision, type DatosDeSanMarcos } from "@/hooks/useAdmisionDatos";
import { carrerasAlternativas, evaluarCarrera } from "@/lib/admision/ingresaba";
import { TuCarrera } from "@/components/admision/TuCarrera";
import { areaDelExamen } from "@/lib/admision/buscar-escuela";
import { intentoValidoParaIngresaba, pasoParaSuArea } from "@/lib/admision/ingresaba-del-area";
import type { AreaExamen } from "@/lib/admision/motor/admision-molde";

// "es" y no "es-PE": coma decimal, como la OCA (1 469,125).
const fmt = (x: number) => x.toLocaleString("es", { maximumFractionDigits: 3 });
const preguntas = (n: number) => `${n} ${n === 1 ? "pregunta" : "preguntas"}`;

function Sello({ verificado, fuente }: { verificado: boolean; fuente: string }) {
  if (!verificado) return <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Dato por verificar</span>;
  const url = fuente.match(/https?:\/\/\S+/)?.[0];
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground hover:underline">
      Dato oficial (OCA) <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  ) : <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">Dato oficial (OCA)</span>;
}

/**
 * «¿Ingresaba?»: el puntaje frente al último ingresante de su escuela, proceso por proceso, con lo que
 * le faltó en preguntas y, si no alcanzaba, el siguiente paso. Traído de Audix Admisión.
 */
export function IngresabaVista({ puntaje, aviso, carreraId, datos }: { puntaje: number; aviso: string | null; carreraId: string; datos: DatosDeSanMarcos }) {
  const carrera = datos.carreras.find((c) => c.id === carreraId);
  if (!carrera) return null;
  const v = evaluarCarrera(puntaje, carreraId, datos.resultados, datos.procesos);
  const reciente = v.procesos.find((p) => p.ingresaba !== null) ?? null;
  const alternativas = reciente && !reciente.ingresaba
    ? carrerasAlternativas(puntaje, carrera.area, datos.carreras, datos.resultados, datos.procesos, [carrera.id], 4)
    : [];

  return (
    <section aria-label="¿Ingresabas?" className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center">
          {reciente?.ingresaba ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Target className="h-5 w-5 text-primary" />}
        </span>
        <div className="min-w-0 space-y-1">
          {v.sinDatos || !reciente ? (
            <>
              <h2 className="text-lg font-extrabold text-foreground">¿Ingresabas a {carrera.nombre}?</h2>
              <p className="text-sm text-muted-foreground">Todavía no tenemos resultados oficiales de esta carrera. Compara con otra de tu área mientras tanto.</p>
            </>
          ) : reciente.ingresaba ? (
            <>
              <h2 className="text-lg font-extrabold text-foreground">Con {fmt(puntaje)} ingresabas a {carrera.nombre} en {reciente.ciclo}</h2>
              <p className="text-sm text-muted-foreground">
                {reciente.empate ? "Empatas con el último ingresante, y en San Marcos los empatados ingresan todos." : `Superas al último ingresante por ${fmt(reciente.diferencia ?? 0)} puntos.`}
                {" "}Para no depender de un buen día, repite un simulacro completo antes del examen.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-extrabold text-foreground">
                Te {reciente.preguntasQueFaltan === 1 ? "falta" : "faltan"} {preguntas(reciente.preguntasQueFaltan ?? 0)} para {carrera.nombre}
              </h2>
              <p className="text-sm text-muted-foreground">
                {reciente.cumpleRequisitoGeneral
                  ? `En ${reciente.ciclo} el último ingresante sacó ${fmt(reciente.ultimoIngresante ?? 0)}. Son ${preguntas(reciente.preguntasQueFaltan ?? 0)} bien en lugar de en blanco: empieza por el curso donde más puntos perdiste.`
                  : "San Marcos pide un puntaje positivo para ingresar. Marca solo cuando puedas descartar alguna opción y repasa los cursos con más peso de tu área."}
              </p>
            </>
          )}
          {aviso && <p className="text-xs text-muted-foreground">{aviso}</p>}
        </div>
      </div>

      {v.procesos.length > 0 && (
        <>
        {/* Móvil: un proceso por fila, apilado; cinco columnas no caben en 390 px. */}
        <ul className="space-y-2 sm:hidden" aria-label={`Tu puntaje frente al último ingresante de ${carrera.nombre}, por proceso`}>
          {v.procesos.map((p) => (
            <li key={p.ciclo} className="space-y-1 rounded-xl border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-foreground">{p.ciclo}</span>
                <Sello verificado={p.verificado} fuente={p.fuente} />
              </div>
              <p className="tabular-nums text-muted-foreground">
                Último ingresante {p.ultimoIngresante === null ? "—" : fmt(p.ultimoIngresante)}
                {p.diferencia !== null && <> · tú {p.diferencia > 0 ? "+" : ""}{fmt(p.diferencia)}</>}
              </p>
              <p className="font-semibold text-foreground">
                {p.ingresaba === null ? "Sin dato" : p.ingresaba ? "Ingresabas" : `No ingresabas: faltaban ${preguntas(p.preguntasQueFaltan ?? 0)}`}
              </p>
            </li>
          ))}
        </ul>
        {/* `w-0 min-w-full`: sin eso, la tabla impone su ancho mínimo a los flex de ResponsiveLayout y la
            página entera se sale por la derecha (con overflow-x-clip, sin scroll que lo delate). */}
        <div className="hidden w-0 min-w-full overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <caption className="sr-only">Tu puntaje frente al último ingresante de {carrera.nombre}, por proceso</caption>
            <thead>
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="py-1 pr-3 font-semibold">Proceso</th>
                <th scope="col" className="py-1 pr-3 text-right font-semibold">Último ingresante</th>
                <th scope="col" className="py-1 pr-3 text-right font-semibold">Tú</th>
                <th scope="col" className="py-1 pr-3 font-semibold">Ingresabas</th>
                <th scope="col" className="py-1 font-semibold"><span className="sr-only">Fuente</span></th>
              </tr>
            </thead>
            <tbody>
              {v.procesos.map((p) => (
                <tr key={p.ciclo} className="border-t border-border">
                  <th scope="row" className="py-1.5 pr-3 text-left font-semibold">{p.ciclo}</th>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{p.ultimoIngresante === null ? "—" : fmt(p.ultimoIngresante)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{p.diferencia === null ? "—" : `${p.diferencia > 0 ? "+" : ""}${fmt(p.diferencia)}`}</td>
                  <td className="py-1.5 pr-3 font-semibold">
                    {p.ingresaba === null ? "Sin dato" : p.ingresaba ? "Sí" : `No, faltaban ${preguntas(p.preguntasQueFaltan ?? 0)}`}
                  </td>
                  <td className="py-1.5"><Sello verificado={p.verificado} fuente={p.fuente} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {alternativas.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground">Con este puntaje sí alcanzabas</h3>
          <ul className="flex flex-wrap gap-2 text-sm">
            {alternativas.map((a) => (
              <li key={a.carrera.id} className="rounded-full border border-border px-3 py-1">
                {a.carrera.nombre} <span className="text-muted-foreground">· último {fmt(a.ultimo)} ({a.ciclo})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Desde 2025-I no hay mínimo de 900: ingresa quien supera al último ingresante de su escuela, con puntaje positivo, y los empatados ingresan todos. Reglas por verificar con el reglamento 2027-I.
      </p>
    </section>
  );
}

/**
 * «¿Ingresaba?» con la escuela del perfil. Sin escuela, el buscador en su lugar; si las tablas no
 * existen todavía, nada. Si el intento es de otra área que la de su escuela, no hay veredicto: el
 * siguiente paso (un simulacro del Área A no dice nada de Derecho).
 */
export function Ingresaba({ userId, puntaje, aviso, area }: { userId: string | null; puntaje: number; aviso: string | null; area: AreaExamen }) {
  const datos = useDatosDeSanMarcos(!!userId);
  const perfil = usePerfilDeAdmision(userId);
  if (!userId || datos.isError || perfil.isError || !datos.data || perfil.isLoading) return null;
  if (perfil.data?.universidad && perfil.data.universidad !== "unmsm") return null;
  if (!perfil.data?.carrera_id) return <TuCarrera userId={userId} titulo="¿Ingresabas? Dinos tu carrera" />;
  const carrera = datos.data.carreras.find((c) => c.id === perfil.data?.carrera_id);
  if (carrera && !intentoValidoParaIngresaba({ area }, areaDelExamen(carrera))) {
    return <p className="rounded-2xl border border-border bg-card p-5 text-sm font-semibold text-foreground">{pasoParaSuArea(areaDelExamen(carrera), carrera.nombre)}</p>;
  }
  return <IngresabaVista puntaje={puntaje} aviso={aviso} carreraId={perfil.data.carrera_id} datos={datos.data} />;
}
