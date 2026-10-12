import {
  type Board,
  type Highlight,
  type Message,
  type Note,
  response,
} from "./model";
import {
  defaultCustomInstructions,
  withCustomInstructions,
} from "./instructions";
export const explorationInstruction: Message = {
  role: "system",
  content:
    'You are Noteboard, a human-directed inquiry assistant. Answer the actual question naturally in Markdown. Start with the useful answer and keep detail proportionate. Explain broader context or connections only when they help; a "Where this fits" section is optional. Do not require a concluding Takeaway section. Use only the supplied ancestral conversation and selected passage to describe the inquiry; do not imply you have seen unrelated Notes. Do not create investigative branches or rearrange the Board.',
};
export function ancestry(board: Board, id: string): Note[] {
  const path: Note[] = [];
  const seen = new Set<string>();
  let current: string | undefined = id;
  while (current) {
    if (seen.has(current)) throw new Error("Cycle in ancestry");
    seen.add(current);
    const note = board.notes.find((n) => n.id === current);
    if (!note) throw new Error("Missing ancestral Note");
    path.unshift(note);
    current = board.edges.find((e) => e.target === current)?.source;
  }
  return path;
}
export function buildContext(
  board: Board,
  prompt: string,
  highlight?: Highlight,
  customInstructions = defaultCustomInstructions,
): Message[] {
  const messages: Message[] = [
    {
      ...explorationInstruction,
      content: withCustomInstructions(
        explorationInstruction.content,
        customInstructions,
      ),
    },
  ];
  if (highlight)
    for (const n of ancestry(board, highlight.sourceId)) {
      const v =
        n.id === highlight.sourceId
          ? n.versions.find((v) => v.id === highlight.versionId)
          : response(n);
      if (!v) throw new Error("Source response version is unavailable");
      messages.push(
        { role: "user", content: n.prompt },
        { role: "assistant", content: v.text },
      );
    }
  messages.push({
    role: "user",
    content: highlight
      ? `Selected passage from the preceding response:\n<highlight>\n${highlight.text}\n</highlight>${highlight.latexSources?.length ? `\n\nExact LaTeX for selected equations:\n${highlight.latexSources.map((source) => `\\[${source}\\]`).join("\n")}` : ""}\n\n${prompt}`
      : prompt,
  });
  return messages;
}
// Conservative estimate, not a tokenizer. Allow framing and reserve output separately.
export function estimateTokens(messages: Message[]): number {
  return messages.reduce(
    (sum, m) =>
      sum + Math.ceil(new TextEncoder().encode(m.content).length / 3) + 12,
    0,
  );
}
export function assertBudget(messages: Message[], limit: number) {
  const estimate = estimateTokens(messages);
  if (estimate + 1024 > limit)
    throw new Error(
      `Estimated context ${estimate.toLocaleString()} tokens plus 1,024 response tokens exceeds the ${limit.toLocaleString()} token budget. No history has been removed. Select a model with a larger context or start a new Board.`,
    );
  return estimate;
}
export function childPosition(board: Board, parent: Note) {
  const x = parent.position.x + 390;
  let y = parent.position.y;
  while (
    board.notes.some(
      (n) =>
        Math.abs(n.position.x - x) < 330 && Math.abs(n.position.y - y) < 250,
    )
  )
    y += 280;
  return { x, y };
}
export function takeaway(text: string) {
  const explicit = text.match(
    /(?:^|\n)(?:\*\*)?Takeaway:(?:\*\*)?\s*([^\n]+)/i,
  )?.[1];
  if (explicit) return explicit.trim();
  const paragraphs = text
    .split(/\n\s*\n/)
    .filter((p) => !p.trim().startsWith("#"));
  const principal =
    paragraphs[0]?.replace(/[*_`#]/g, "").trim() ||
    "Open the Note to read the response.";
  return principal.length > 230 ? principal.slice(0, 227) + "…" : principal;
}
