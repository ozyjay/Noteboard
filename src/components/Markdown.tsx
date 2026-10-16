import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { normaliseMathDelimiters } from "../core/math";
import { citationMarkdown, type Citation } from "../core/research";
import { bridge } from "../bridge";
import { useState } from "react";
export function Markdown({
  text,
  onSource,
  maths = true,
  citations,
}: {
  text: string;
  onSource: (id: string) => void;
  maths?: boolean;
  citations?: Citation[];
}) {
  const [linkError, setLinkError] = useState("");
  const displayText = citationMarkdown(text, citations);
  return (
    <>
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
              <button
                type="button"
                className="source-link"
                title={href}
                onClick={() => {
                  if (href)
                    void bridge
                      .openWebLink?.(href)
                      .catch(() =>
                        setLinkError(
                          "Could not open this link in your browser.",
                        ),
                      );
                }}
              >
                {children}
              </button>
            ),
          img: ({ alt }) => <span>[Image: {alt}]</span>,
        }}
      >
        {maths ? normaliseMathDelimiters(displayText) : displayText}
      </ReactMarkdown>
      {linkError && <span role="alert">{linkError}</span>}
    </>
  );
}
