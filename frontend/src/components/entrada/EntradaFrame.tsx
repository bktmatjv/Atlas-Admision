import { useEffect, useRef, type ReactNode } from "react";
import { CalibraBrand } from "@/components/brand/CalibraBrand";
import { ThemeToggle } from "@/components/system/ThemeToggle";
import "./entrada.css";
export function EntradaFrame({ titulo, children }: { titulo: string; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); document.title = `${titulo} | CALIBRA`; }, [titulo]);
  return <main className="entrada min-h-screen bg-background text-foreground">
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6"><CalibraBrand size="lg" /><ThemeToggle /></header>
    <div className="mx-auto grid max-w-6xl items-start gap-12 px-5 pb-12 pt-4 lg:grid-cols-[.8fr_1.2fr] lg:px-6 lg:pt-14">
      <aside className="hidden space-y-7 lg:block"><p className="text-sm font-bold uppercase tracking-[.2em] text-primary">Aprende a pensar</p><p className="font-display text-5xl leading-tight">Tu punto de partida.<br /><em className="text-primary">Tu forma de aprender.</em></p><p className="max-w-sm leading-relaxed text-muted-foreground">Un espacio para entender, equivocarte y volver a intentarlo. Sin pedirte más datos de los necesarios.</p><div className="entrada-orbita" aria-hidden="true"><CalibraBrand variant="symbol" size="xl" /></div></aside>
      <section className="entrada-panel min-w-0 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-9"><h1 ref={heading} tabIndex={-1} className="mb-6 text-3xl font-extrabold tracking-tight focus:outline-none">{titulo}</h1>{children}</section>
    </div>
  </main>;
}
