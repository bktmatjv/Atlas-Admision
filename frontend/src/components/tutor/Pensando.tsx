import { useEffect, useState } from "react";
import { mensajeDeEspera } from "@/lib/tutor/escritura";
import { TutorAvatar } from "./TutorAvatar";

export function Pensando() {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    const inicio = Date.now();
    const t = window.setInterval(
      () => setSegundos(Math.floor((Date.now() - inicio) / 1000)),
      1000,
    );
    return () => window.clearInterval(t);
  }, []);
  const texto = mensajeDeEspera(segundos);
  return (
    <div className="tc-msg tw-pensando">
      <TutorAvatar small estado="pensando" />
      <div className="tw-pensando-cuerpo">
        <p role="status" className="tc-thinking">
          <span />
          <span />
          <span />
          <span className="sr-only">{texto}</span>
        </p>
        {segundos >= 5 && (
          <p className="tw-espera" aria-hidden="true">
            {texto}
          </p>
        )}
      </div>
    </div>
  );
}
