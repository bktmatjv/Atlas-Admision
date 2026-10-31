import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * Iconos 3D de arcilla con fondo transparente (`public/arcade/<id>-160|320.webp`) y su versión
 * animada (`public/animadas/<id>.webp`, WebP con alfa, bucle de 4 s).
 *
 * Procedencia: el banco de ilustraciones del proyecto hermano `komu-flow-magic` (mismo equipo),
 * copiado solo con los dibujos que usa el tutor. Son decorativos: `alt=""` salvo que informen.
 */

/** Los ids de `public/arcade` que se copiaron a este proyecto. */
export type IdIlustracion =
  | "conversacion" | "diana-flecha" | "pila-de-libros" | "mapa-mental" | "grafico-circular"
  | "balanza" | "fracciones" | "duda" | "comparar" | "lupa" | "hipotesis" | "bombilla"
  | "grafico" | "lapiz" | "mano-levantada" | "objetivo-cumplido" | "cita" | "candado"
  | "libro" | "aplauso";

const ANIMADAS = new Set<IdIlustracion>(["hipotesis", "lapiz", "mano-levantada", "objetivo-cumplido", "aplauso"]);

function caerEnLaNeutra(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.dataset.neutra) return;
  img.dataset.neutra = "1";
  img.srcset = "/arcade/bombilla-160.webp 160w, /arcade/bombilla-320.webp 320w";
  img.src = "/arcade/bombilla-320.webp";
}

export function Ilustracion({
  nombre,
  className,
  sizes = "64px",
  alt,
}: {
  nombre: IdIlustracion;
  className?: string;
  sizes?: string;
  alt?: string;
}) {
  return (
    <img
      src={`/arcade/${nombre}-320.webp`}
      srcSet={`/arcade/${nombre}-160.webp 160w, /arcade/${nombre}-320.webp 320w`}
      sizes={sizes}
      alt={alt ?? ""}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={caerEnLaNeutra}
      className={cn("pointer-events-none select-none object-contain", className)}
    />
  );
}

function useSePuedeMover() {
  const [sePuede, setSePuede] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const conexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const decidir = () => setSePuede(!mq.matches && !conexion?.saveData);
    decidir();
    mq.addEventListener("change", decidir);
    return () => mq.removeEventListener("change", decidir);
  }, []);
  return sePuede;
}

/**
 * La misma ilustración, en movimiento cuando se ve. Empieza quieta (el primer fotograma es el
 * dibujo estático, así que no salta) y solo pide la animación al entrar en pantalla. Con
 * movimiento reducido o ahorro de datos se queda quieta. `unaVez` la para tras el primer bucle.
 */
export function IlustracionAnimada({
  nombre,
  className,
  sizes,
  alt,
  unaVez = false,
}: {
  nombre: IdIlustracion;
  className?: string;
  sizes?: string;
  alt?: string;
  unaVez?: boolean;
}) {
  const sePuede = useSePuedeMover();
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [terminada, setTerminada] = useState(false);
  const animable = ANIMADAS.has(nombre) && sePuede;

  useEffect(() => {
    if (!animable || !ref.current) return;
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "80px" });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [animable]);

  useEffect(() => {
    if (!unaVez || !visible) return;
    const t = window.setTimeout(() => setTerminada(true), 4000);
    return () => window.clearTimeout(t);
  }, [unaVez, visible]);

  return (
    <span ref={ref} className={cn("relative inline-flex items-center justify-center", className)}>
      {animable && visible && !terminada ? (
        <img
          src={`/animadas/${nombre}.webp`}
          alt={alt ?? ""}
          aria-hidden={alt ? undefined : true}
          draggable={false}
          decoding="async"
          className="pointer-events-none h-full w-full select-none object-contain"
        />
      ) : (
        <Ilustracion nombre={nombre} sizes={sizes} alt={alt} className="h-full w-full" />
      )}
    </span>
  );
}
