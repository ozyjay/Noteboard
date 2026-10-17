import {
  childPosition,
  estimateTokens,
  pathVersions,
  takeaway,
} from "./context";
import {
  uid,
  now,
  type Board,
  type Note,
  type Highlight,
  type Message,
  type Settings,
} from "./model";
import type { Attachment } from "./research";
import type { GenerationResult } from "./providers";

export function completedNote(
  board: Board,
  question: string,
  highlight: Highlight | undefined,
  files: Attachment[],
  provider: Settings["provider"],
  result: GenerationResult,
  context: Message[],
): Note {
  const parent = highlight
    ? board.notes.find((note) => note.id === highlight.sourceId)
    : undefined;
  const note: Note = {
    id: uid(),
    prompt: question,
    takeaway: takeaway(result.text),
    createdAt: now(),
    position: parent ? childPosition(board, parent) : { x: 100, y: 180 },
    versions: [
      {
        id: uid(),
        text: result.text,
        createdAt: now(),
        provider,
        model: result.model,
        reasoningEffort: result.reasoningEffort,
        files: files.length ? files : undefined,
        webResearch: result.webResearch,
        context,
        origin: "generated",
        estimatedTokens: estimateTokens(context),
        usage: result.usage,
        ancestryVersions: highlight
          ? pathVersions(board, highlight.sourceId, highlight.versionId)
          : {},
      },
    ],
  };

  return note;
}
export function appendNote(
  board: Board,
  note: Note,
  highlight?: Highlight,
): Board {
  return {
    ...board,
    title:
      !board.notes.length && board.title === "Untitled inquiry"
        ? note.prompt.slice(0, 200)
        : board.title,
    notes: [...board.notes, note],
    edges: highlight
      ? [
          ...board.edges,
          {
            kind: "highlight",
            id: uid(),
            source: highlight.sourceId,
            target: note.id,
            highlight: highlight,
          },
        ]
      : board.edges,
  };
}
