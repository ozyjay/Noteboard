import { useReactFlow } from "@xyflow/react";
import {
  noteAtVersion,
  type Artefact,
  type Board,
  type Note,
} from "../../core/model";
export function useSourceNavigation({
  board,
  mode,
  artefact,
  activeArtefact,
  read,
  setSourcePreview,
  setError,
}: {
  board: Board | undefined;
  mode: "explore" | "synthesis";
  artefact: Artefact | undefined;
  activeArtefact: string | undefined;
  read: (id: string, versionId?: string) => void;
  setSourcePreview: (note: Note | undefined) => void;
  setError: (error: string) => void;
}) {
  const { setCenter } = useReactFlow();
  function goSource(id: string) {
    const sourceVersionId =
      mode === "synthesis" ? artefact?.sourceVersions[id] : undefined;
    if (!board?.notes.some((n) => n.id === id)) {
      const sourceArtefact =
        board?.artefacts.find(
          (a) =>
            a.id === activeArtefact &&
            a.archivedSources?.some((n) => n.id === id),
        ) ??
        board?.artefacts.find((a) =>
          a.archivedSources?.some((n) => n.id === id),
        );
      const archived = sourceArtefact?.archivedSources?.find(
        (n) => n.id === id,
      );
      if (archived && sourceArtefact) {
        setSourcePreview(
          noteAtVersion(archived, sourceArtefact.sourceVersions[id]),
        );
        return;
      }
      setError("The source Note is not in this Board");
      return;
    }
    setSourcePreview(undefined);
    read(id, sourceVersionId);
    const n = board.notes.find((n) => n.id === id)!;
    void setCenter(n.position.x + 150, n.position.y + 100, {
      zoom: 1,
      duration: 300,
    });
  }

  return goSource;
}
