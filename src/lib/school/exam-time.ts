/**
 * Ventana del examen y tiempo restante.
 *
 * Separado de la calificación porque responde otra pregunta —cuándo, no cuánto— y
 * porque es donde se cuelan los errores de reloj: un alumno al que se le cierra el
 * examen antes de tiempo pierde la nota igual que si lo hubiera calculado mal.
 */

export type ExamWindow = {
  opens_at: string | null;
  closes_at: string | null;
  duration_minutes: number | null;
};

export type WindowState = "no_abierto" | "abierto" | "cerrado";

export function examWindowState(exam: ExamWindow, now: Date): WindowState {
  const opens = exam.opens_at ? new Date(exam.opens_at).getTime() : null;
  const closes = exam.closes_at ? new Date(exam.closes_at).getTime() : null;
  const at = now.getTime();

  if (opens !== null && at < opens) return "no_abierto";
  if (closes !== null && at >= closes) return "cerrado";
  return "abierto";
}

/**
 * Milisegundos que le quedan al alumno.
 *
 * Es el menor entre su propio tiempo (desde que empezó) y el cierre del examen: si el
 * examen cierra a las 10 y el alumno entra a las 9:50 con una hora de duración, tiene
 * diez minutos, no una hora. Nunca devuelve negativo.
 *
 * `null` significa sin límite: ni duración ni cierre.
 */
export function remainingMs(
  startedAt: string | null,
  exam: ExamWindow,
  now: Date,
): number | null {
  const at = now.getTime();
  const limits: number[] = [];

  if (startedAt && exam.duration_minutes) {
    limits.push(new Date(startedAt).getTime() + exam.duration_minutes * 60_000);
  }
  if (exam.closes_at) {
    limits.push(new Date(exam.closes_at).getTime());
  }
  if (limits.length === 0) return null;

  return Math.max(0, Math.min(...limits) - at);
}

/** El examen ya no admite más respuestas. */
export function isTimeUp(startedAt: string | null, exam: ExamWindow, now: Date): boolean {
  const remaining = remainingMs(startedAt, exam, now);
  return remaining !== null && remaining <= 0;
}

/** Cuenta atrás legible: `mm:ss`, o `h:mm:ss` cuando queda más de una hora. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
