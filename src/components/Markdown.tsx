"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-brief text-[15px] text-zinc-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Citations from web search should open away from the app.
          a: ({ ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
          table: ({ ...props }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full text-sm" {...props} />
            </div>
          ),
          th: ({ ...props }) => (
            <th
              className="border-b border-zinc-700 px-3 py-2 text-left font-medium text-zinc-200"
              {...props}
            />
          ),
          td: ({ ...props }) => (
            <td className="border-b border-zinc-800/70 px-3 py-2" {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
