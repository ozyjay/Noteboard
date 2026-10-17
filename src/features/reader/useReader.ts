import { useReactFlow } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { versionPath } from "../../core/context";
import {
  noteAtVersion,
  response,
  type Board,
  type Highlight,
  type Note,
} from "../../core/model";
import { type RevisionMode } from "./NoteRevision";

export function useReader(
  board: Board | undefined,
  setMode: (mode: "explore" | "synthesis") => void,
) {
  const [sourcePreview, setSourcePreview] = useState<Note>();
  const [readerVersionId, setReaderVersionId] = useState<string>();
  const [revisionTarget, setRevisionTarget] = useState<{
    noteId: string;
    versionId: string;
    mode: RevisionMode;
  }>();
  const [readerExpanded, setReaderExpanded] = useState(false);
  const [readerId, setReaderId] = useState<string>(),
    [highlight, setHighlight] = useState<Highlight>(),
    [anchor, setAnchor] = useState<Highlight>();
  const [continuationTarget, setContinuationTarget] = useState("");
  const readerSurface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setContinuationTarget("");
    if (!readerId) setReaderExpanded(false);
  }, [readerId]);
  const note = board?.notes.find((n) => n.id === readerId);
  const version = note
    ? (note.versions.find(
        (v) =>
          v.id ===
          (anchor?.sourceId === note.id ? anchor.versionId : readerVersionId),
      ) ?? response(note))
    : undefined;
  const readingNote =
    note && version ? noteAtVersion(note, version.id) : undefined;
  const read = useCallback((id: string, versionId?: string) => {
    setMode("explore");
    setReaderId(id);
    setReaderVersionId(versionId);
    setAnchor(undefined);
    setHighlight(undefined);
  }, []);
  function openEdgeSource(id: string) {
    const e = board!.edges.find((edge) => edge.id === id)!;
    read(
      e.source,
      e.highlight?.versionId ??
        board!.notes.find((n) => n.id === e.source)!.versions[0].id,
    );
    setAnchor(e.highlight);
    setHighlight(undefined);
  }
  const incoming = board?.edges.find((e) => e.target === readerId);
  function readParent() {
    if (!board || !note || !version || !incoming) return;
    const parent = versionPath(board, note.id, version.id).at(-2)!;
    read(parent.note.id, parent.version.id);
    if (incoming.highlight?.versionId === parent.version.id)
      setAnchor(incoming.highlight);
  }
  function resetReader() {
    setReaderId(undefined);
    setReaderVersionId(undefined);
    setRevisionTarget(undefined);
    setHighlight(undefined);
    setAnchor(undefined);
  }

  const { setCenter } = useReactFlow();
  function openCreatedNote(note: Note) {
    setReaderId(note.id);
    setReaderVersionId(undefined);
    setAnchor(undefined);
    setHighlight(undefined);
    void setCenter(note.position.x + 150, note.position.y + 100, {
      zoom: 0.95,
      duration: 350,
    });
  }
  return {
    openCreatedNote,
    sourcePreview,
    setSourcePreview,
    readerVersionId,
    setReaderVersionId,
    revisionTarget,
    setRevisionTarget,
    readerExpanded,
    setReaderExpanded,
    readerId,
    setReaderId,
    highlight,
    setHighlight,
    anchor,
    setAnchor,
    continuationTarget,
    setContinuationTarget,
    readerSurface,
    note,
    version,
    readingNote,
    read,
    readParent,
    openEdgeSource,
    incoming,
    resetReader,
  };
}
