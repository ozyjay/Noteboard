import { useState } from "react";
import type { Note } from "../core/model";

export function NoteTitle({
  note,
  onSave,
}: {
  note: Note;
  onSave: (title: string | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.title ?? "");
  return (
    <div className="note-title">
      <h2>{note.title ?? note.prompt}</h2>
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
          <p>{note.prompt}</p>
        </div>
      )}
    </div>
  );
}
