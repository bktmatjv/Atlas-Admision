import { useEffect, useRef, useState } from "react";
import { Check, LockKeyhole, MoveRight } from "lucide-react";
import type { Grafo, NodoGrafo } from "@/lib/tutor/grafo";
import {
  caminoComprension,
  momentoComprension,
  type Evidencia,
} from "@/lib/tutor/wow";
import { MathMarkdown } from "@/components/shared/MathMarkdown";

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
  const actual =
    nodo.estado === "fallo"
      ? 2
      : estaciones.reduce((ultimo, e, i) => (e.hecho ? i : ultimo), 0);
  const textoActual = nodo.estado === "fallo" ? "Volvamos a practicar" : estaciones.some(e => e.hecho) ? estaciones[actual].texto : "Aún sin registros";
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
        {estaciones.map((e, i) => (
          <li key={e.texto} data-hecho={e.hecho} data-actual={actual === i} className={encendidas.includes(i) ? "tw-estacion--nueva" : undefined}>
            <button
              type="button"
              aria-disabled={!e.disponible}
              aria-label={`${e.texto}: ${e.hecho ? "registrado" : !e.disponible ? "sin datos disponibles" : "sin registro"}. ${e.nota}`}
              title={e.nota}
            >
              <span className="tw-estacion" aria-hidden="true">
                {e.hecho ? (
                  <Check size={13} />
                ) : !e.disponible ? (
                  <LockKeyhole size={11} />
                ) : (
                  i + 1
                )}
              </span>
              <span className="tw-estacion-texto">{e.texto}</span>
            </button>
          </li>
        ))}
      </ol>
      {nodo.estado === "fallo" && (
        <p className="tw-retro-nota" aria-live="polite">
          Hay un fallo pendiente. Volvemos a «Practicaste»; no implica que haya
          una práctica registrada.
        </p>
      )}
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
