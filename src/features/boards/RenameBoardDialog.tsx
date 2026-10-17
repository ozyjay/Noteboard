import { type Dispatch, type SetStateAction } from "react";
import { now, type Board } from "../../core/model";

interface Props {
  renameDraft: string;
  renameBoard: Board;
  setBoards: Dispatch<SetStateAction<Board[]>>;
  setRenameDraft: Dispatch<SetStateAction<string | undefined>>;
}
export function RenameBoardDialog({
  renameDraft,
  renameBoard,
  setBoards,
  setRenameDraft,
}: Props) {
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Rename Board"
      >
        <h2>Rename Board</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const title = renameDraft.trim();
            if (!title || title.length > 200) return;
            if (title !== renameBoard.title)
              setBoards((current) =>
                current.map((b) =>
                  b.id === renameBoard.id
                    ? { ...b, title, updatedAt: now() }
                    : b,
                ),
              );
            setRenameDraft(undefined);
          }}
        >
          <label>
            Board name
            <input
              data-modal-focus
              required
              maxLength={200}
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              onFocus={(event) => event.target.select()}
            />
          </label>
          <div className="modal-actions">
            <button className="primary" disabled={!renameDraft.trim()}>
              Save name
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setRenameDraft(undefined)}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
