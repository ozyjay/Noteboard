import type { Board, Settings } from "../../core/model";
import { appendRevision } from "../../core/revisions";
import type { Generate } from "../generation/useGeneration";
import { NoteRevision } from "./NoteRevision";
import type { useReader } from "./useReader";

export function RevisionDialog({
  board,
  settings,
  busy,
  generate,
  onCancel,
  reader,
  changeBoard,
  setError,
}: {
  board: Board | undefined;
  settings: Settings;
  busy: boolean;
  generate: Generate;
  onCancel: () => void;
  reader: ReturnType<typeof useReader>;
  changeBoard: (fn: (board: Board) => Board) => void;
  setError: (error: string) => void;
}) {
  const target = reader.revisionTarget;
  if (!target || !board) return null;
  return (
    <NoteRevision
      key={`${target.noteId}:${target.versionId}:${target.mode}`}
      board={board}
      note={board.notes.find((note) => note.id === target.noteId)!}
      versionId={target.versionId}
      mode={target.mode}
      settings={settings}
      busy={busy}
      onGenerate={(messages, requestSettings) =>
        generate(messages, "explore", requestSettings)
      }
      onSave={(version) => {
        // Validate before closing the draft; errors leave it available for retry.
        appendRevision(board, target.noteId, version);
        changeBoard((current) =>
          appendRevision(current, target.noteId, version),
        );
        reader.setReaderVersionId(version.id);
        reader.setAnchor(undefined);
        reader.setHighlight(undefined);
        setError("");
        reader.setRevisionTarget(undefined);
      }}
      onClose={() => reader.setRevisionTarget(undefined)}
      onCancel={onCancel}
    />
  );
}
