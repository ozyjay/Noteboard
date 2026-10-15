import { type Board, type ResponseVersion, validateBoard, now } from "./model";
import { takeaway } from "./context";

export function appendRevision(
  board: Board,
  noteId: string,
  version: ResponseVersion,
): Board {
  if (!board.notes.some((n) => n.id === noteId))
    throw new Error("The Note is not in this Board");
  return validateBoard({
    ...board,
    updatedAt: now(),
    notes: board.notes.map((n) =>
      n.id === noteId
        ? {
            ...n,
            versions: [...n.versions, version],
            takeaway: takeaway(version.text),
          }
        : n,
    ),
  });
}
