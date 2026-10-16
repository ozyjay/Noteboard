import { useState } from "react";
import type { Note } from "../core/model";

export function NoteTitle({
  note,
  onSave,
  onEditPrompt,
  busy,
}: {
  note: Note;
  onSave: (title: string | undefined) => void;
  onEditPrompt: () => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.title ?? "");
  const prompt = (
    <span
      className="editable-note-text"
      role="button"
      tabIndex={busy ? -1 : 0}
      aria-label="Edit displayed prompt and regenerate"
      aria-disabled={busy}
      title="Double-click to edit prompt and regenerate"
      onDoubleClick={() => {
        if (!busy) onEditPrompt();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (!busy) onEditPrompt();
        }
      }}
    >
      {note.prompt}
    </span>
  );
  return (
    <div className="note-title">
      <h2 aria-label={note.title ?? note.prompt}>{note.title ?? prompt}</h2>
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave(draft.trim() || undefined);
            setEditing(false);
          }}
        >
          <label>
            Note title
            <input
              autoFocus
              maxLength={200}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <p className="muted">Leave blank to use the original prompt.</p>
          <div className="title-actions">
            <button type="submit">Save title</button>
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => {
            setDraft(note.title ?? "");
            setEditing(true);
          }}
        >
          Edit title
        </button>
      )}
      {note.title && (
        <div className="original-prompt">
          <strong>Prompt</strong>
          <p>{prompt}</p>
        </div>
      )}
    </div>
  );
}
