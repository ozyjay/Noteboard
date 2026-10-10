import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export function Markdown({
  text,
  onSource,
}: {
  text: string;
  onSource: (id: string) => void;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
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
      {text}
    </ReactMarkdown>
  );
}
