import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "../src/components/Markdown";
import { normaliseMathDelimiters } from "../src/core/math";

const render = (text: string, maths = true) =>
  renderToStaticMarkup(
    <Markdown text={text} maths={maths} onSource={() => {}} />,
  );

describe("Markdown maths", () => {
  it("renders Markdown, inline/block maths and alternative TeX delimiters", () => {
    const html = render(String.raw`# Maths

**Energy** $E=mc^2$ and \(a^2+b^2=c^2\).

$$
\frac{1}{2}
$$

\[\sum_{i=1}^{n} i\]

[Source Note](inquiry://note/source)`);
    expect(html).toContain("<h1>Maths</h1>");
    expect(html).toContain("<strong>Energy</strong>");
    expect(html.match(/class="katex"/g)).toHaveLength(4);
    expect(html.match(/class="katex-display"/g)).toHaveLength(2);
    expect(html).toContain('encoding="application/x-tex"');
    expect(html).toContain('class="source-link"');
  });

  it("preserves literal maths inside inline and fenced code", () => {
    const text =
      "`\\(x\\)`\n\n```tex\n\\[x\\]\n$x$\n```\n\n~~~text\n\\(y\\)\n~~~";
    expect(normaliseMathDelimiters(text)).toBe(text);
    expect(render(text)).not.toContain('class="katex"');
    for (const code of [
      "```tex\n\\(x\\)\n````",
      "~~~text\n\\[x\\]",
      "    \\(x\\)\n    \\[y\\]",
      "``literal ` \\(x\\)``",
    ]) {
      expect(normaliseMathDelimiters(code)).toBe(code);
      expect(render(code)).not.toContain('class="katex"');
    }
  });

  it("keeps invalid maths readable and prevents trusted TeX HTML commands", () => {
    expect(render(String.raw`$\frac{1}{$`)).toContain("katex-error");
    expect(render(String.raw`$\notARealCommand{x}$`)).toContain(
      "\\notARealCommand",
    );
    const html = render(String.raw`$\href{javascript:alert(1)}{click}$`);
    expect(html).not.toContain('href="javascript:');
    expect(render("<script>alert(1)</script>")).not.toContain("<script>");
  });

  it("can reproduce the original pre-maths rendering for existing anchors", () => {
    expect(render("Read $x^2$", false)).toBe("<p>Read $x^2$</p>");
  });
});
