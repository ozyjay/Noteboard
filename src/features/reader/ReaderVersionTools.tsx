import { ArrowLeft, ArrowRight } from "lucide-react";
import { response } from "../../core/model";
import { ReaderTools } from "./NoteReader";
import type { ReaderPanelProps } from "./ReaderPanel";
type Props = Pick<
  ReaderPanelProps,
  | "appearance"
  | "version"
  | "busy"
  | "setReaderVersionId"
  | "setAnchor"
  | "setHighlight"
  | "note"
  | "setRevisionTarget"
  | "incoming"
  | "readParent"
  | "board"
  | "read"
> & { focused?: boolean; onDeleteNote?: () => void };
export function ReaderVersionTools({
  appearance,
  version,
  busy,
  setReaderVersionId,
  setAnchor,
  setHighlight,
  note,
  setRevisionTarget,
  incoming,
  readParent,
  board,
  read,
  focused,
  onDeleteNote,
}: Props) {
  return (
    <ReaderTools
      key={appearance.noteStyle}
      compact={
        focused ||
        appearance.noteStyle === "sticky" ||
        appearance.noteStyle === "studio"
      }
    >
      <div className="note-revisions">
        {focused && (
          <button disabled={busy} onClick={onDeleteNote}>
            Delete Note
          </button>
        )}
        <label>
          Version
          <select
            aria-label="Note version"
            value={version!.id}
            disabled={busy}
            onChange={(e) => {
              setReaderVersionId(e.target.value);
              setAnchor(undefined);
              setHighlight(undefined);
              window.getSelection()?.removeAllRanges();
            }}
          >
            {note.versions.map((v, i) => (
              <option key={v.id} value={v.id}>
                v{i + 1} ·{" "}
                {v.origin === "edited"
                  ? "Human-edited"
                  : v.origin === "imported"
                    ? "Imported"
                    : v.provider === "demo"
                      ? "Synthetic demo"
                      : v.model}
                {i === note.versions.length - 1 ? " · Latest" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="revision-actions">
          {(
            [
              ["prompt", "Edit prompt and regenerate"],
              ["regenerate", "Regenerate response"],
              ["improve", "Sanity check & improve"],
              ["edit", "Edit response"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              disabled={busy}
              onClick={() =>
                setRevisionTarget({
                  noteId: note.id,
                  versionId: version!.id,
                  mode,
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
        {version!.id !== response(note).id && (
          <p className="muted small">
            Viewing an earlier version. New branches use this version; the
            canvas and new synthesis use the latest version.
          </p>
        )}
      </div>
      <nav className="note-navigation" aria-label="Connected notes">
        <strong>Previous note</strong>
        {incoming ? (
          <button onClick={readParent}>
            <ArrowLeft size={14} />
            {board!.notes.find((n) => n.id === incoming.source)!.title ??
              board!.notes.find((n) => n.id === incoming.source)!.prompt}
          </button>
        ) : (
          <p className="muted">This is the starting note.</p>
        )}
        <strong>Subsequent notes</strong>
        {board!.edges.some((e) => e.source === note.id) ? (
          board!.edges
            .filter((e) => e.source === note.id)
            .map((e) => {
              const child = board!.notes.find((n) => n.id === e.target)!;
              return (
                <button key={e.id} onClick={() => read(child.id)}>
                  <ArrowRight size={14} />
                  {child.title ?? child.prompt}
                </button>
              );
            })
        ) : (
          <p className="muted">No subsequent notes yet.</p>
        )}
      </nav>
    </ReaderTools>
  );
}
