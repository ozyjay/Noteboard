import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { normaliseMathDelimiters } from "../core/math";
export function Markdown({
  text,
  onSource,
  maths = true,
}: {
  text: string;
  onSource: (id: string) => void;
  maths?: boolean;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={maths ? [remarkGfm, remarkMath] : [remarkGfm]}
      rehypePlugins={
        maths
          ? [[rehypeKatex, { trust: false, maxExpand: 1000, maxSize: 20 }]]
          : []
      }
      urlTransform={(url) =>
        url.startsWith("inquiry://note/")
          ? url
          : /^https?:\/\//.test(url)
            ? url
            : ""
      }
      components={{
        a: ({ href, children }) =>
          href?.startsWith("inquiry://note/") ? (
            <button
              className="source-link"
              onClick={() => onSource(href.slice("inquiry://note/".length))}
            >
              {children}
            </button>
          ) : (
            <span title={href}>{children}</span>
          ),
        img: ({ alt }) => <span>[Image: {alt}]</span>,
      }}
    >
      {maths ? normaliseMathDelimiters(text) : text}
    </ReactMarkdown>
  );
}
