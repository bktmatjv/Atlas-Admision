import { flushSync } from "react-dom";
export const nombreTransicion = (id: string) =>
  `calibra-artefacto-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
/** Solo la tarjeta que viaja participa en la captura: las otras siguen siendo accionables. */
export function transicionArtefacto(cambio: () => void, id?: string) {
  if (
    typeof document !== "undefined" &&
    "startViewTransition" in document &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    const tarjeta = id ? document.getElementById(`abrir-${id}`) : null;
    if (tarjeta && tarjeta.getAttribute("aria-expanded") !== "true")
      tarjeta.style.viewTransitionName = nombreTransicion(id!);
    const transicion = document.startViewTransition(() => {
      flushSync(cambio);
      if (tarjeta)
        tarjeta.style.viewTransitionName =
          tarjeta.getAttribute("aria-expanded") === "true"
            ? "none"
            : nombreTransicion(id!);
    });
    void transicion.finished
      .catch(() => undefined)
      .finally(() => {
        if (tarjeta) tarjeta.style.viewTransitionName = "none";
      });
  } else cambio();
}
