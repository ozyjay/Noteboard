import { useRef, useState } from "react";
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
  const title = useRef<HTMLSpanElement>(null);
  const displayTitle = note.title ?? note.prompt;
  function startEditing() {
    if (busy) return;
    setDraft(note.title ?? (note.prompt.length <= 200 ? note.prompt : ""));
    setEditing(true);
  }
  function finishEditing(save: boolean, restoreFocus = false) {
    if (save) onSave(draft.trim() || undefined);
    setEditing(false);
    if (restoreFocus) requestAnimationFrame(() => title.current?.focus());
  }
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
      <h2 aria-label={displayTitle}>
        {editing ? (
          <input
            className="inline-note-title"
            aria-label="Note title"
            aria-describedby="note-title-hint"
            autoFocus
            maxLength={200}
            value={draft}
            placeholder={note.prompt}
            disabled={busy}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => finishEditing(true)}
            onKeyDown={(event) => {
              if (
                event.nativeEvent.isComposing ||
                event.nativeEvent.keyCode === 229
              )
                return;
              if (event.key === "Enter" || event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                finishEditing(event.key === "Enter", true);
              }
            }}
          />
        ) : (
          <span
            ref={title}
            className="editable-note-text"
            role="button"
            tabIndex={busy ? -1 : 0}
            aria-label="Edit Note title"
            aria-disabled={busy}
            title="Double-click to rename this Note"
            onDoubleClick={startEditing}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                startEditing();
              }
            }}
          >
            {displayTitle}
          </span>
        )}
      </h2>
      {editing && (
        <p id="note-title-hint" className="muted">
          Enter to save · Escape to cancel · Leave blank to use the prompt.
        </p>
      )}
      <div className="original-prompt">
        <strong>Prompt</strong>
        <p>{prompt}</p>
      </div>
    </div>
  );
}
