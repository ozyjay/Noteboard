import {
  type Board,
  type Highlight,
  type Message,
  type Note,
  versionPrompt,
  type ResponseVersion,
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
    for (const { note: n, version: v } of versionPath(
      board,
      highlight.sourceId,
      highlight.versionId,
    )) {
      messages.push(
        { role: "user", content: versionPrompt(n, v) },
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
// Resolve backwards from the selected revision. Legacy Highlight branches pin
// their parent; imported continuations always retain their original source turn.
export function versionPath(
  board: Board,
  noteId: string,
  versionId: string,
): { note: Note; version: ResponseVersion }[] {
  const path = ancestry(board, noteId);
  const hints = new Map([[noteId, versionId]]);
  const result: { note: Note; version: ResponseVersion }[] = [];
  for (let i = path.length - 1; i >= 0; i--) {
    const note = path[i];
    const version = note.versions.find((v) => v.id === hints.get(note.id));
    if (!version) throw new Error("Source response version is unavailable");
    result.unshift({ note, version });
    if ("ancestryVersions" in version && version.ancestryVersions)
      for (const [id, versionId] of Object.entries(version.ancestryVersions))
        if (!hints.has(id)) hints.set(id, versionId);
    if (i) {
      const parent = path[i - 1];
      const edge = board.edges.find((e) => e.target === note.id)!;
      if (!hints.has(parent.id))
        hints.set(
          parent.id,
          edge.kind === "highlight"
            ? edge.highlight.versionId
            : parent.versions[0].id,
        );
    }
  }
  return result;
}
export const pathVersions = (board: Board, noteId: string, versionId: string) =>
  Object.fromEntries(
    versionPath(board, noteId, versionId).map(({ note, version }) => [
      note.id,
      version.id,
    ]),
  );

export function revisionContext(
  board: Board,
  noteId: string,
  versionId: string,
  prompt: string,
  instructions: string,
) {
  const path = versionPath(board, noteId, versionId).slice(0, -1);
  const incoming = board.edges.find((e) => e.target === noteId);
  const highlight = incoming?.highlight;
  const applicableHighlight =
    highlight && path.at(-1)?.version.id === highlight.versionId
      ? highlight
      : undefined;
  const base = buildContext(board, prompt, undefined, instructions);
  let last = applicableHighlight
    ? buildContext(board, prompt, applicableHighlight, instructions).at(-1)!
    : base.at(-1)!;
  // Preserve the exact recorded Highlight framing when regenerating. A later
  // retrospective annotation must not replace the passage used by this version.
  const note = board.notes.find((n) => n.id === noteId)!;
  let source = note.versions.find((v) => v.id === versionId)!;
  while (source.origin === "edited") {
    const baseId = source.basedOnVersionId;
    source = note.versions.find((v) => v.id === baseId)!;
  }
  if (source.origin === "generated") {
    const recorded = source.context.at(-1);
    const oldPrompt = versionPrompt(note, source);
    if (recorded?.role === "user" && recorded.content.endsWith(oldPrompt))
      last = {
        role: "user",
        content: recorded.content.slice(0, -oldPrompt.length) + prompt,
      };
  }
  return {
    messages: [
      base[0],
      ...path.flatMap(({ note, version }) => [
        { role: "user" as const, content: versionPrompt(note, version) },
        { role: "assistant" as const, content: version.text },
      ]),
      last,
    ],
    ancestryVersions: Object.fromEntries(
      path.map(({ note, version }) => [note.id, version.id]),
    ),
  };
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
