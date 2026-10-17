import { now, uid, type Board } from "./model";

/** Append an editor version without mutating the earlier document or its sources. */
export function appendDocumentRevision(
  board: Board,
  artefactId: string,
  text: string,
): Board {
  return {
    ...board,
    artefacts: board.artefacts.map((artefact) =>
      artefact.id === artefactId
        ? {
            ...artefact,
            versions: [
              ...artefact.versions,
              {
                id: uid(),
                text,
                createdAt: now(),
                kind: "edited",
                provider: "human",
                model: "editor",
                context: [],
              },
            ],
          }
        : artefact,
    ),
  };
}
