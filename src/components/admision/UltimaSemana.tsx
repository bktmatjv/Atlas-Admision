import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ExternalLink } from "lucide-react";
import { admisionDb, type AreaDeAdmision } from "@/integrations/supabase/admision";
import { useDatosDeSanMarcos } from "@/hooks/useAdmisionDatos";
import type { ItemDelDia } from "@/lib/admision/datos-unmsm";
import { diasHasta, enUltimaSemana, jornadaDe, planUltimaSemana } from "@/lib/admision/ultima-semana";
import { diaDeLima, paraHoy } from "@/lib/admision/motor/admision-leitner";

const CATEGORIAS: Record<ItemDelDia["categoria"], string> = {
  documentos: "Documentos", llevar: "Qué llevar", horario: "Horario y local", prohibido: "Prohibido", durante: "Durante el examen",
};
const fecha = (dia: string) => new Date(`${dia}T12:00:00`).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
const tarjeta = "min-w-0 space-y-3 rounded-2xl border border-border bg-card p-5";
/** Solo la primera letra: `capitalize` de CSS pondría «16 De Octubre». */
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function Sello({ item }: { item: ItemDelDia }) {
  if (/^Recomendaci[oó]n de Atlas/.test(item.fuente)) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Consejo de Atlas</span>;
  const url = item.fuente.match(/https?:\/\/\S+/)?.[0];
  const texto = item.verificado ? "Dato oficial" : "Por verificar";
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs font-semibold hover:underline">
      {texto} <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  ) : <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{texto}</span>;
}

/** Lo marcado en la lista es solo de este navegador (una comodidad): si no hay almacenamiento, no pasa nada. */
function useMarcados(clave: string) {
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try { setMarcados(JSON.parse(localStorage.getItem(clave) ?? "{}")); } catch { setMarcados({}); }
  }, [clave]);
  const cambiar = (id: string) => setMarcados((m) => {
    const siguiente = { ...m, [id]: !m[id] };
    try { localStorage.setItem(clave, JSON.stringify(siguiente)); } catch { /* sin almacenamiento */ }
    return siguiente;
  });
  return { marcados, cambiar };
}

/**
 * «Tu examen» (tramo 6 de Audix): cuándo es su jornada (Medicina Humana tiene la suya) y, a 7 días o menos,
 * el plan de los últimos días y la lista del día del examen con la fuente de cada punto. Fechas de prensa:
 * por verificar, y se dice. Sin datos todavía (migración sin aplicar), no sale.
 */
export function UltimaSemana({ userId, area }: { userId: string | null; area: AreaDeAdmision }) {
  const datos = useDatosDeSanMarcos(!!userId);
  const hoy = diaDeLima(new Date());
  const jornada = datos.data ? jornadaDe(datos.data.procesos, area, hoy) : null;
  const dias = jornada ? diasHasta(hoy, jornada.fecha) : null;
  const ultima = dias !== null && enUltimaSemana(dias);

  const lista = useQuery({
    queryKey: ["admision-dia-examen"],
    enabled: !!userId && ultima,
    retry: false,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await admisionDb.from("admision_dia_examen").select("*").order("orden");
      if (error) throw error;
      return data ?? [];
    },
  });
  const cuaderno = useQuery({
    queryKey: ["admision-cuaderno", userId],
    enabled: !!userId && ultima,
    retry: false,
    queryFn: async () => {
      const { data, error } = await admisionDb.from("admision_errores").select("pregunta_id, caja, proxima, dominada");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { marcados, cambiar } = useMarcados(`admision-checklist:${jornada?.ciclo ?? ""}`);

  if (!userId || !jornada || dias === null) return null;
  const quien = area === "medicina" ? "Medicina Humana" : `Área ${area}`;
  const cuando = dias === 0 ? "es hoy" : dias === 1 ? "es mañana" : `es en ${dias} días`;

  if (!ultima) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <CalendarClock className="h-4 w-4" aria-hidden /> Tu examen ({quien}, {jornada.ciclo}): {fecha(jornada.fecha)}, faltan {dias} días.
        {!jornada.verificado && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">Fecha por verificar</span>}
      </p>
    );
  }

  const plan = planUltimaSemana(hoy, jornada.fecha, cuaderno.data ? paraHoy(cuaderno.data, hoy).length : 0);
  const items = lista.data ?? [];
  return (
    <div className="space-y-4">
      <section aria-labelledby="ultima-titulo" className={tarjeta}>
        <div className="flex flex-wrap items-start gap-3">
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-muted">
            <CalendarClock className="h-5 w-5 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="ultima-titulo" className="text-lg font-extrabold text-foreground">Tu examen {cuando}</h2>
            <p className="text-sm text-muted-foreground">
              {quien} · {fecha(jornada.fecha)} ({jornada.ciclo}).{" "}
              {jornada.verificado ? "" : "Fecha de prensa, por verificar en el portal de admisión."}
            </p>
          </div>
        </div>
        <ol className="space-y-2">
          {plan.map((d) => (
            <li key={d.fecha} className="rounded-xl border border-border p-3 text-sm">
              <span className="block font-semibold text-foreground">{d.diasAlExamen === 0 ? "El día del examen" : mayuscula(fecha(d.fecha))}</span>
              <ul className="mt-1 space-y-1">
                {d.actividades.map((a, i) => (
                  <li key={i}>
                    {a.enlace.startsWith("/") ? <Link to={a.enlace} className="font-semibold text-primary hover:underline">{a.titulo}</Link>
                      : <a href={a.enlace} className="font-semibold text-primary hover:underline">{a.titulo}</a>}
                    <span className="text-muted-foreground"> · {a.detalle}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      {items.length > 0 && (
        <section id="el-dia-del-examen" aria-labelledby="dia-titulo" className={tarjeta}>
          <h2 id="dia-titulo" className="text-lg font-extrabold text-foreground">El día del examen</h2>
          <p className="text-sm text-muted-foreground">Márcalo mientras lo alistas. Cada punto dice de dónde sale: confírmalo en tu carné y en el reglamento 2027-I.</p>
          {(Object.keys(CATEGORIAS) as ItemDelDia["categoria"][]).map((cat) => {
            const deLaCategoria = items.filter((x) => x.categoria === cat);
            if (!deLaCategoria.length) return null;
            return (
              <div key={cat} className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">{CATEGORIAS[cat]}</h3>
                <ul className="space-y-1">
                  {deLaCategoria.map((x) => (
                    <li key={x.id} className="flex flex-wrap items-start gap-2 text-sm">
                      <label className="flex min-h-11 min-w-0 flex-1 items-start gap-2 py-1">
                        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={!!marcados[x.id]} onChange={() => cambiar(x.id)} />
                        <span className="min-w-0">
                          <span className="font-semibold text-foreground">{x.texto}</span>
                          {x.detalle && <span className="block text-muted-foreground">{x.detalle}</span>}
                        </span>
                      </label>
                      <Sello item={x} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
