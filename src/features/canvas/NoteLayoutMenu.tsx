import { useEffect, useRef } from "react";
import type { Note } from "../../core/model";

export type LayoutAction = "move" | "branch" | "tidy" | "right" | "below";
export function NoteLayoutMenu({
  note,
  index,
  disabled,
  onAction,
}: {
  note: Note;
  index: number;
  disabled: boolean;
  onAction: (id: string, action: LayoutAction) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (!ref.current?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        ref.current.querySelector("summary")?.focus();
      } else if (ref.current.contains(event.target as Node)) return;
      ref.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  function action(value: LayoutAction) {
    ref.current!.open = false;
    ref.current!.querySelector("summary")?.focus();
    onAction(note.id, value);
  }
  return (
    <details
      ref={ref}
      className="note-layout nodrag nopan"
      onToggle={() => {
        if (disabled && ref.current) ref.current.open = false;
      }}
    >
      <summary
        aria-label={`Layout Note ${index + 1}`}
        aria-disabled={disabled}
        onClick={(e) => {
          if (disabled) e.preventDefault();
        }}
      >
        Layout
      </summary>
      <div className="note-layout-options">
        <button disabled={disabled} onClick={() => action("move")}>
          Move Note
        </button>
        <button disabled={disabled} onClick={() => action("branch")}>
          Move with descendants
        </button>
        <button disabled={disabled} onClick={() => action("tidy")}>
          Tidy branch
        </button>
        <fieldset disabled={disabled}>
          <legend>New children</legend>
          {(["right", "below"] as const).map((direction) => (
            <label key={direction}>
              <input
                type="radio"
                name={`direction-${note.id}`}
                checked={(note.childDirection ?? "right") === direction}
                onChange={() => action(direction)}
              />
              {direction === "right" ? "Right" : "Below"}
            </label>
          ))}
        </fieldset>
      </div>
    </details>
  );
}
