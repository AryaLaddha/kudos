import React from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

function highlightTokens(children: React.ReactNode): React.ReactNode {
  const pattern = /(@\w+|\+\d+)/g;
  return React.Children.map(children, (child) => {
    if (typeof child !== "string") return child;
    if (!pattern.test(child)) return child;
    pattern.lastIndex = 0;

    const parts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(child)) !== null) {
      if (m.index > last) parts.push(child.slice(last, m.index));
      parts.push(
        <span key={m.index} className="font-semibold text-indigo-600">{m[0]}</span>
      );
      last = m.index + m[0].length;
    }
    if (last < child.length) parts.push(child.slice(last));
    return parts;
  });
}

export default function MarkdownMessage({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0">{highlightTokens(children)}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900">{highlightTokens(children)}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{highlightTokens(children)}</em>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
