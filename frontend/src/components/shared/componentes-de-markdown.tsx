import type { Components } from "react-markdown";

/**
 * Las piezas con las que se pinta el markdown de Atlas. Las comparten el renderizador sin
 * fórmulas y el de KaTeX, para que un mensaje se vea igual traiga o no matemáticas.
 */
export const componentesDeMarkdown: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
  li: ({ children }) => <li className="mb-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  h1: ({ children }) => <h3 className="text-base font-bold mt-3 mb-1">{children}</h3>,
  h2: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>,
  h3: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1">{children}</h4>,
  code: ({ className: codeClass, children, ...props }) => {
    const isInline = !codeClass;
    return isInline ? (
      // `prose` le pone una comilla invertida delante y detrás por CSS: el alumno veía
      // «`systemd`» con sus comillas (14-10-2026). El fondo ya dice que es código.
      <code className="bg-muted/50 px-1 py-0.5 rounded text-xs font-mono before:content-none after:content-none" {...props}>{children}</code>
    ) : (
      <pre className="bg-muted/50 p-2 rounded text-xs overflow-x-auto my-2">
        <code className={codeClass} {...props}>{children}</code>
      </pre>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/50 pl-3 my-2 italic opacity-80">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-xs border-collapse border border-border">{children}</table>
    </div>
  ),
  /*
   * Lo que pinta este markdown lo escribe un modelo, y un material subido puede traer
   * instrucciones escondidas: una imagen que apunte fuera con datos en la URL la pediría el
   * navegador del alumno solo. Ninguna pantalla mete imágenes propias por markdown, así que no
   * se carga ninguna: se deja su descripción (bucle de calidad, vuelta 9).
   */
  img: ({ alt }) => (alt ? <span className="italic text-muted-foreground">[{alt}]</span> : null),
  // Un enlace en la misma pestaña sacaba al alumno de Atlas a mitad de la conversación.
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  ),
  th: ({ children }) => <th className="border border-border px-2 py-1 bg-muted font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
};
