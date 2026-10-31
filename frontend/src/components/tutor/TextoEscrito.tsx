import { useEffect, useRef, useState } from "react";
import { MathMarkdown } from "@/components/shared/MathMarkdown";
import {
  caracteresVisibles,
  duracionEscritura,
  prefijoSeguro,
} from "@/lib/tutor/escritura";
import { useMovimientoReducido } from "@/lib/tutor/useMovimientoReducido";

/**
 * Revela una respuesta que ya llegó completa y validada, para que se lea con ritmo.
 * Solo anima si el mensaje es nuevo al montarse; al recargar o al volver a una charla se muestra entero.
 * Clic en el texto o Escape lo completan al instante. Con movimiento reducido no hay animación.
 */
export function TextoEscrito({
  texto,
  animar,
  demo = false,
  onAvance,
  onTermina,
}: {
  texto: string;
  animar: boolean;
  demo?: boolean;
  onAvance?: () => void;
  onTermina?: () => void;
}) {
  const reducido = useMovimientoReducido();
  const [activo, setActivo] = useState(animar && !reducido);
  const [n, setN] = useState(0);
  const avance = useRef(onAvance);
  const termina = useRef(onTermina);
  avance.current = onAvance;
  termina.current = onTermina;
  const finalizado = useRef(false);
  const terminar = () => {
    setActivo(false);
    if (!finalizado.current) {
      finalizado.current = true;
      termina.current?.();
    }
  };
  useEffect(() => {
    if (!activo) {
      if (!finalizado.current) {
        finalizado.current = true;
        termina.current?.();
      }
      return;
    }
    const duracion = duracionEscritura(texto.length, demo);
    const inicio = performance.now();
    let cuadro = 0;
    const paso = (ahora: number) => {
      const visibles = caracteresVisibles(
        texto.length,
        ahora - inicio,
        duracion,
      );
      setN(visibles);
      avance.current?.();
      if (visibles >= texto.length) terminar();
      else cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    // Red de seguridad: si la pestaña está en segundo plano, los cuadros se pausan.
    const seguro = window.setTimeout(terminar, duracion + 600);
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") terminar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => {
      cancelAnimationFrame(cuadro);
      window.clearTimeout(seguro);
      window.removeEventListener("keydown", alTeclear);
    };
  }, [activo, texto, demo]);
  if (!activo) return <MathMarkdown content={texto} />;
  return (
    <span
      className="tw-escribiendo"
      data-escribiendo="true"
      onClick={terminar}
      title="Clic o Esc para ver todo el mensaje"
    >
      {/* Lectores de pantalla: el mensaje completo una sola vez, sin anunciar cada fragmento. */}
      <span className="sr-only">{texto}</span>
      <span aria-hidden="true">
        <MathMarkdown content={prefijoSeguro(texto, n)} />
      </span>
    </span>
  );
}
