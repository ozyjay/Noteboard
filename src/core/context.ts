import {
  type Board,
  type Highlight,
  type Message,
  type Note,
  response,
} from "./model";
export const explorationInstruction: Message = {
  role: "system",
  content:
    'You are Noteboard, a human-directed research assistant. Answer the user clearly in Markdown using Australian English. Preserve qualifications and uncertainty. First answer the actual question directly, with explanations and examples as appropriate. Then include a short section headed "## Where this fits": identify the broader topic or field and explain how two or three relevant concepts relate to the question (for example, a prerequisite, contrast, mechanism or application), rather than merely listing terms. For a follow-up question, explain its connection to the selected passage and ancestral conversation when useful. Use only the supplied conversation to describe the inquiry; do not imply you have seen other Notes or unrelated branches. Keep this orientation proportionate to the question, distinguish analogies from established relationships, and acknowledge ambiguous or speculative connections. Do not invent citations, create investigative branches, or tell the user which branch to take. End with a concise principal takeaway of one or two sentences on a single line preceded by "Takeaway:". The takeaway should state the main answer, not summarise the list of related topics.',
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
): Message[] {
  const messages: Message[] = [explorationInstruction];
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
