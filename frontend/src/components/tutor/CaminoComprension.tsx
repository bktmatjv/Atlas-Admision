import { useEffect, useRef, useState } from "react";
import { Check, MoveRight } from "lucide-react";
import { Ilustracion, IlustracionAnimada, type IdIlustracion } from "@/components/arcade/Ilustracion";
import type { Grafo, NodoGrafo } from "@/lib/tutor/grafo";
import {
  caminoComprension,
  momentoComprension,
  type Evidencia,
} from "@/lib/tutor/wow";
import { MathMarkdown } from "@/components/shared/MathMarkdown";

// Exploraste, lo explicaste, practicaste, lo comprobaste solo, lo aplicaste.
const DIBUJO_ESTACION: IdIlustracion[] = ["lupa", "mano-levantada", "lapiz", "diana-flecha", "objetivo-cumplido"];
const COMPROBAR = 3;
const APLICAR = 4;

/**
 * El siguiente paso, dicho en concreto. El camino solo avanza con evidencia, y hoy las
 * comprobaciones existen solo para tres temas de Aritmética: se dice, no se insinúa.
 */
function siguientePaso(hechas: boolean[], fallo: boolean): string {
  if (hechas[APLICAR]) return "Completaste el camino de esta idea: la corregiste y la resolviste por tu cuenta.";
  if (fallo)
    return "Fallaste una comprobación. Repasa la idea con el tutor y luego pide otra con «Dame una comprobación»; si la resuelves sin ayuda, se marca «Lo aplicaste».";
  if (hechas[COMPROBAR])
    return "Siguiente: «Lo aplicaste» se marca cuando aciertas sin ayuda una idea en la que antes fallaste.";
  return "Para avanzar, toca «Dame una comprobación» y resuélvela sin ayuda del tutor. Por ahora hay comprobaciones solo de porcentajes, proporciones y fracciones.";
}

export function CaminoComprension({
  nodo,
  evidencias,
}: {
  nodo: NodoGrafo;
  evidencias: Evidencia[];
}) {
  const estaciones = caminoComprension(nodo, evidencias);
  const firma = estaciones.map(e => e.hecho ? "1" : "0").join("");
  const anterior = useRef<{ nodo: string; firma: string } | null>(null);
  const [encendidas, setEncendidas] = useState<number[]>([]);
  useEffect(() => {
    const previa = anterior.current;
    setEncendidas(previa?.nodo === nodo.id ? [...firma].flatMap((v, i) => v === "1" && previa.firma[i] !== "1" ? [i] : []) : []);
    anterior.current = { nodo: nodo.id, firma };
    const timer = window.setTimeout(() => setEncendidas([]), 300);
    return () => window.clearTimeout(timer);
  }, [firma, nodo.id]);
  const fallo = nodo.estado === "fallo";
  // Con un fallo, lo que toca es volver a comprobar.
  const actual = fallo ? COMPROBAR : estaciones.reduce((ultimo, e, i) => (e.hecho ? i : ultimo), 0);
  const textoActual = fallo ? "Volvamos a practicar" : estaciones.some(e => e.hecho) ? estaciones[actual].texto : "Aún sin registros";
  // Solo se muestran las etapas que el sistema puede registrar hoy: un candado permanente
  // («Lo explicaste», «Practicaste» sin historial en la API) se leía como un nivel por desbloquear.
  const visibles = estaciones.map((e, i) => ({ ...e, i })).filter((e) => e.disponible);
  const paso = siguientePaso(estaciones.map((e) => e.hecho), fallo);
  return (
    <div
      className="tw-camino"
      aria-label={`Camino de comprensión: ${nodo.titulo}`}
    >
      <header>
        <span className="tw-eyebrow">TU CAMINO</span>
        <strong>{nodo.titulo}</strong>
        <span className="tw-camino-actual">
          {textoActual}
        </span>
      </header>
      <span className="sr-only" role="status" aria-live="polite">{textoActual}</span>
      <ol>
        {visibles.map(({ i, ...e }) => (
          <li key={e.texto} data-hecho={e.hecho} data-actual={actual === i} className={encendidas.includes(i) ? "tw-estacion--nueva" : undefined}>
            <button
              type="button"
              aria-label={`${e.texto}: ${e.hecho ? "registrado" : "sin registro"}. ${e.nota}`}
              title={e.nota}
            >
              <span className="tw-estacion" aria-hidden="true">
                {actual === i ? (
                  <IlustracionAnimada nombre={DIBUJO_ESTACION[i] ?? "lupa"} className="tw-estacion-dibujo" sizes="40px" />
                ) : (
                  <Ilustracion nombre={DIBUJO_ESTACION[i] ?? "lupa"} className="tw-estacion-dibujo" sizes="40px" />
                )}
                {e.hecho && (
                  <span className="tw-estacion-check">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="tw-estacion-texto">{e.texto}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className={fallo ? "tw-camino-paso tw-retro-nota" : "tw-camino-paso"} aria-live="polite">
        {paso}
      </p>
    </div>
  );
}
export function MomentoComprension({
  nodo,
  evidencias,
  nuevo = false,
}: {
  nodo: NodoGrafo;
  evidencias: Evidencia[];
  nuevo?: boolean;
}) {
  const m = momentoComprension(nodo, evidencias);
  if (!m) return null;
  return (
    <article className={`tw-momento${nuevo ? " tw-momento--nuevo" : ""}`} aria-label="Momento de comprensión">
      <header>
        <Check size={17} />
        <span className="tw-eyebrow">DE REVISAR A APLICAR</span>
      </header>
      <div className="tw-antes-ahora">
        <section>
          <small>ANTES · TU RESPUESTA</small>
          <blockquote>
            «{m.antes}» <span aria-label="incorrecta">✗</span>
          </blockquote>
        </section>
        <MoveRight aria-hidden="true" />
        <section>
          <small>AHORA · COMPROBACIÓN CORRECTA</small>
          <MathMarkdown content={m.ahora} />
          <span>✓ Sin ayudas de CALIBRA</span>
        </section>
      </div>
      <footer>
        {m.titulo}: lo aplicaste por tu cuenta.
        <small>
          Se verificó el resultado numérico, no el dominio del tema.
        </small>
      </footer>
    </article>
  );
}
export function MomentosComprension({
  grafo,
  evidencias,
  arbolId,
}: {
  grafo?: Grafo;
  evidencias?: Evidencia[];
  arbolId: string;
}) {
  const previas = useRef<Set<string> | null>(null);
  const [nuevos, setNuevos] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!evidencias) return;
    const ids = evidencias.filter(e => e.tipo === "corrigio_tras_error").map(e => e.id);
    setNuevos(new Set(previas.current ? ids.filter(id => !previas.current!.has(id)) : []));
    previas.current = new Set(ids);
  }, [evidencias]);
  const vistos = new Set<string>();
  return (
    <>
      {grafo?.nodos
        .filter((n) => n.arbol_id === arbolId)
        .map((n) => {
          const m = momentoComprension(n, evidencias ?? []);
          if (!m || vistos.has(m.id)) return null;
          vistos.add(m.id);
          return (
            <MomentoComprension key={m.id} nodo={n} evidencias={evidencias ?? []} nuevo={nuevos.has(m.id)} />
          );
        })}
    </>
  );
}
