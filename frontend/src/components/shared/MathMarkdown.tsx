import { Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import { enUnRatoLibre } from "@/lib/rato-libre";
import { tipoDeTexto } from "@/lib/markdown/tipo-de-texto";
import { normalizarFormulas } from "@/lib/markdown/formulas";
import { repararMarkdown } from "@/lib/markdown/reparar-markdown";

export interface MathMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Los renderizadores de verdad pesan más que la pantalla que los usa: react-markdown ~35 KB
 * gz, y con KaTeX ~115 KB gz y 650 KB de JS que un móvil tiene que compilar. Iban estáticos
 * en el chat, el material, las clases y la transcripción, así que un móvil con 4G lento los
 * descargaba y evaluaba ANTES de pintar nada.
 *
 * Por eso este módulo es solo un envoltorio, con el mismo nombre y las mismas props de
 * siempre, que pide cada texto al renderizador más barato que le basta (`tipoDeTexto`): el
 * texto plano no baja nada, el markdown baja solo react-markdown, y KaTeX solo llega cuando
 * un texto trae un `$`. `lazyWithRetry` y no `lazy` a secas porque tras un despliegue el
 * chunk con el hash viejo ya no existe y `Suspense` se quedaría colgado.
 */
const cargarMarkdown = () => import("./MarkdownRenderer");

const RenderizadorDeMarkdown = lazyWithRetry(() => cargarMarkdown().then((m) => ({ default: m.MarkdownRenderer })));
const RenderizadorDeFormulas = lazyWithRetry(() =>
  import("./MathMarkdownRenderer").then((m) => ({ default: m.MathMarkdownRenderer })),
);

/**
 * La precarga del markdown empieza en cuanto se evalúa este módulo, es decir, en cuanto carga
 * la pantalla (o el panel diferido) que lo importa, y en un rato libre para no pisar su primer
 * pintado. Lo normal es que esté aquí cuando llega el primer mensaje o la lección, y el texto
 * plano del `fallback` ni se vea. KaTeX NO se precarga: la mayoría de los textos no lo usan.
 */
enUnRatoLibre(() => {
  void cargarMarkdown().catch(() => {
    // Si falla aquí, el `lazyWithRetry` del render lo reintentará cuando haga falta.
  });
});

export function MathMarkdown({ content: original, className = "" }: MathMarkdownProps) {
  // La forma rota del modelo —una tabla en una sola línea, comillas dobladas— se arregla aquí,
  // por donde pasan TODOS sus textos (chat, resúmenes, lecciones, tarjetas), no solo el chat.
  // Después, `\(…\)` pasa a `$…$` y el `$` del dinero se escapa: remark-math solo entiende lo
  // primero y pintaría lo segundo como una fórmula rota.
  const content = normalizarFormulas(repararMarkdown(original));
  const tipo = tipoDeTexto(content);
  // El mismo contenedor y el mismo párrafo que pintan los renderizadores: misma tipografía y
  // casi la misma altura, para que al cambiar no salte el layout.
  const contenedor = `prose prose-sm dark:prose-invert max-w-none break-words ${className}`;

  if (tipo === "plano") {
    return (
      <div className={contenedor}>
        <p className="mb-2 last:mb-0 leading-relaxed">{content}</p>
      </div>
    );
  }

  const Renderizador = tipo === "formulas" ? RenderizadorDeFormulas : RenderizadorDeMarkdown;
  return (
    <Suspense
      fallback={
        // Mientras llega el renderizador, el texto tal cual. `whitespace-pre-wrap` conserva
        // los saltos de línea del markdown, que es lo que más separa el alto de uno y otro.
        <div className={contenedor}>
          <p className="mb-2 last:mb-0 leading-relaxed whitespace-pre-wrap">{original}</p>
        </div>
      }
    >
      <Renderizador content={content} className={className} />
    </Suspense>
  );
}
