import { BookOpen, GitBranch, X } from "lucide-react";
import { desktop } from "../../bridge";
import type { Board } from "../../core/model";

export function WorkspaceNavigation({
  board,
  mode,
  onMode,
  selectedCount,
  error,
  onDismissError,
}: {
  board: Board | undefined;
  mode: "explore" | "synthesis";
  onMode: (mode: "explore" | "synthesis") => void;
  selectedCount: number;
  error: string;
  onDismissError: () => void;
}) {
  return (
    <>
      <div className="modebar">
        <div className="mode-tabs">
          <button
            className={mode === "explore" ? "active" : ""}
            onClick={() => onMode("explore")}
          >
            <GitBranch size={15} /> Explore
          </button>
          <button
            className={mode === "synthesis" ? "active" : ""}
            onClick={() => onMode("synthesis")}
          >
            <BookOpen size={15} /> Synthesis{" "}
            {board?.artefacts.length ? (
              <span>{board.artefacts.length}</span>
            ) : null}
          </button>
        </div>
        <div className="board-info">
          {selectedCount ? `${selectedCount} selected · ` : ""}
          {board?.notes.length} Notes <span>·</span> {board?.edges.length}{" "}
          connections
        </div>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={onDismissError}>
            <X size={14} />
          </button>
        </div>
      )}
      {!desktop && (
        <div className="preview-banner">
          Browser preview · demo responses and browser storage. Use the desktop
          app for SQLite and Ollama.
        </div>
      )}
    </>
  );
}
