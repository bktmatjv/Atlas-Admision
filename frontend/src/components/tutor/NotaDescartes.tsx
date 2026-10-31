/** Aviso discreto cuando el sistema descartó recursos del mensaje porque no pasaron la verificación. */
export function NotaDescartes({ descartes }: { descartes: number }) {
  if (!(descartes > 0)) return null;
  return (
    <p className="tc-note" role="status">
      {descartes === 1
        ? "Un recurso de este mensaje no pasó la verificación de CALIBRA y no se muestra."
        : `${descartes} recursos de este mensaje no pasaron la verificación de CALIBRA y no se muestran.`}
    </p>
  );
}
