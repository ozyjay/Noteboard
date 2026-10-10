// Normalise common model-emitted TeX delimiters only outside Markdown code.
// This is a display transformation: the original response remains immutable.
export function normaliseMathDelimiters(text: string): string {
  const codeStarts =
    /(^ {0,3}(`{3,}|~{3,})[^\n]*(?:\n|$))|(^ {4}[^\n]*(?:\n|$))|(`+)/gm;
  const convert = (value: string) =>
    value
      .replace(
        /\\\[([\s\S]*?)\\\]/g,
        (_, maths: string) => `\n$$\n${maths.trim()}\n$$\n`,
      )
      .replace(/\\\(([^\n]*?)\\\)/g, (_, maths: string) => `$${maths}$`);
  let end = 0;
  let result = "";
  for (
    let match = codeStarts.exec(text);
    match;
    match = codeStarts.exec(text)
  ) {
    let codeEnd = codeStarts.lastIndex;
    if (match[2]) {
      const fence = match[2];
      const closing = new RegExp(
        `^ {0,3}${fence[0]}{${fence.length},}[ \\t]*(?:\\n|$)`,
        "gm",
      );
      closing.lastIndex = codeEnd;
      codeEnd = closing.exec(text) ? closing.lastIndex : text.length;
    } else if (match[4]) {
      const closing = new RegExp(`(?<!\x60)${match[4]}(?!\x60)`, "g");
      closing.lastIndex = codeEnd;
      if (!closing.exec(text)) continue;
      codeEnd = closing.lastIndex;
    }
    result +=
      convert(text.slice(end, match.index)) + text.slice(match.index, codeEnd);
    end = codeEnd;
    codeStarts.lastIndex = codeEnd;
  }
  return result + convert(text.slice(end));
}
