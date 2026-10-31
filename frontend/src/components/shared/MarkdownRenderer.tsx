import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { MathMarkdownProps } from "./MathMarkdown";
import { componentesDeMarkdown } from "./componentes-de-markdown";

/**
 * Markdown sin KaTeX: react-markdown y nada más, unos 35 KB gz frente a los ~115 del de
 * fórmulas. Es lo que pinta casi todo —mensajes del chat, tarjetas, lecciones— porque la
 * mayoría de los textos no llevan ni un `$`.
 *
 * `remark-gfm` es lo que hace que una tabla sea una tabla (y el ~~tachado~~). Sin él, las
 * tablas que el chat escribe para comparar se veían como barras y guiones (14-10-2026).
 */
export function MarkdownRenderer({ content, className = "" }: MathMarkdownProps) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none break-words ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={componentesDeMarkdown}>{content}</ReactMarkdown>
    </div>
  );
}
