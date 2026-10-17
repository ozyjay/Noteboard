import { ArrowUpRight, GitBranch } from "lucide-react";
import { annotateContinuation } from "../../core/chatgpt-import";
import { highlightLabel } from "../../core/model";
import type { ReaderPanelProps } from "./ReaderPanel";
type Props = Pick<
  ReaderPanelProps,
  | "highlight"
  | "readerFocused"
  | "version"
  | "board"
  | "note"
  | "continuationTarget"
  | "setContinuationTarget"
  | "busy"
  | "changeBoard"
  | "setAnchor"
  | "setHighlight"
  | "branch"
>;
export function HighlightActions({
  highlight,
  readerFocused,
  version,
  board,
  note,
  continuationTarget,
  setContinuationTarget,
  busy,
  changeBoard,
  setAnchor,
  setHighlight,
  branch,
}: Props) {
  if (readerFocused && !highlight) return null;
  return (
    <div className="reader-footer">
      {highlight ? (
        <>
          <p>
            “
            {highlightLabel(highlight).length > 90
              ? highlightLabel(highlight).slice(0, 87) + "…"
              : highlightLabel(highlight)}
            ”
          </p>
          {version?.origin === "imported" &&
            board!.edges.some(
              (e) => e.kind === "continuation" && e.source === note.id,
            ) && (
              <>
                <label>
                  Imported follow-up
                  <select
                    aria-label="Imported follow-up"
                    value={continuationTarget}
                    onChange={(e) => setContinuationTarget(e.target.value)}
                  >
                    <option value="">Choose follow-up</option>
                    {board!.edges
                      .filter(
                        (e) =>
                          e.kind === "continuation" && e.source === note.id,
                      )
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {board!.notes.find((n) => n.id === e.target)!.prompt}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  disabled={
                    busy ||
                    (board!.edges.filter(
                      (e) => e.kind === "continuation" && e.source === note.id,
                    ).length > 1 &&
                      !board!.edges.some(
                        (e) =>
                          e.id === continuationTarget && e.source === note.id,
                      ))
                  }
                  onClick={() => {
                    const candidates = board!.edges.filter(
                      (e) => e.kind === "continuation" && e.source === note.id,
                    );
                    const target =
                      candidates.length === 1
                        ? candidates[0]
                        : candidates.find((e) => e.id === continuationTarget);
                    if (target) {
                      changeBoard((b) =>
                        annotateContinuation(b, target.id, highlight),
                      );
                      setAnchor(highlight);
                      setHighlight(undefined);
                    }
                  }}
                >
                  Attach Highlight to imported follow-up
                </button>
              </>
            )}
          <button
            className="primary"
            disabled={busy}
            onClick={() => branch(highlight)}
          >
            <GitBranch size={15} /> Explore this passage{" "}
            <ArrowUpRight size={15} />
          </button>
        </>
      ) : (
        <p>Select a passage in the response to begin a new branch.</p>
      )}
    </div>
  );
}
