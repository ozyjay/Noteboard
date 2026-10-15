import { type Board, now, validateBoard } from "./model";

export function subtreeIds(board: Board, noteId: string): Set<string> {
  if (!board.notes.some((n) => n.id === noteId))
    throw new Error("The Note is not in this Board");
  const ids = new Set([noteId]);
  const children = new Map<string, string[]>();
  for (const edge of board.edges)
    children.set(edge.source, [
      ...(children.get(edge.source) ?? []),
      edge.target,
    ]);
  for (const id of ids)
    for (const child of children.get(id) ?? []) ids.add(child);
  return ids;
}

export function deleteNote(board: Board, noteId: string): Board {
  const ids = subtreeIds(board, noteId);
  return validateBoard({
    ...board,
    updatedAt: now(),
    notes: board.notes.filter((n) => !ids.has(n.id)),
    edges: board.edges.filter((e) => !ids.has(e.source) && !ids.has(e.target)),
    artefacts: board.artefacts.map((a) => {
      const sources = board.notes.filter(
        (n) => ids.has(n.id) && a.noteIds.includes(n.id),
      );
      return sources.length
        ? {
            ...a,
            archivedSources: [...(a.archivedSources ?? []), ...sources],
          }
        : a;
    }),
  });
}
