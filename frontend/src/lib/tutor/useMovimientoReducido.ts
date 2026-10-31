import { useEffect, useState } from "react";
export function useMovimientoReducido() {
  const [reducido, setReducido] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cambiar = () => setReducido(media.matches);
    media.addEventListener("change", cambiar);
    cambiar();
    return () => media.removeEventListener("change", cambiar);
  }, []);
  return reducido;
}
