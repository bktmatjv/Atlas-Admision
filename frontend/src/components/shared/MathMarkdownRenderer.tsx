import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import type { MathMarkdownProps } from "./MathMarkdown";
import { componentesDeMarkdown } from "./componentes-de-markdown";

/**
 * El renderizador con fórmulas: KaTeX, react-markdown y remark/rehype, unos 115 KB gz. Nadie
 * lo importa directamente; `MathMarkdown` lo pide solo cuando el texto trae un `$`, y su CSS
 * (el de KaTeX) viaja con este chunk y no con el de la pantalla.
 */
export function MathMarkdownRenderer({ content, className = "" }: MathMarkdownProps) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none break-words ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={componentesDeMarkdown}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
