import { type Dispatch, type SetStateAction } from "react";
import { subtreeIds } from "../../core/deletion";
import { type Board } from "../../core/model";

interface Props {
  deleteTarget: { boardId: string; noteId?: string };
  deletionBoard: Board;
  deleteError: string;
  deleting: boolean;
  setDeleteTarget: Dispatch<
    SetStateAction<{ boardId: string; noteId?: string } | undefined>
  >;
  confirmDeletion: () => Promise<void>;
}
export function DeleteDialog({
  deleteTarget,
  deletionBoard,
  deleteError,
  deleting,
  setDeleteTarget,
  confirmDeletion,
}: Props) {
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={deleteTarget.noteId ? "Delete Note" : "Delete Board"}
      >
        <h2>
          {deleteTarget.noteId ? "Delete this Note?" : "Delete this Board?"}
        </h2>
        {deleteTarget.noteId ? (
          <>
            <p>
              “
              {deletionBoard.notes.find((n) => n.id === deleteTarget.noteId)
                ?.title ??
                deletionBoard.notes.find((n) => n.id === deleteTarget.noteId)
                  ?.prompt}
              ” and its descendants will be removed:{" "}
              {subtreeIds(deletionBoard, deleteTarget.noteId).size} Notes in
              total.
            </p>
            <p>
              Existing synthesis documents keep read-only copies of their
              deleted source Notes.
            </p>
          </>
        ) : (
          <p>
            “{deletionBoard.title}” and all its {deletionBoard.notes.length}{" "}
            Notes and {deletionBoard.artefacts.length} synthesis documents will
            be deleted.
          </p>
        )}
        <p>This cannot be undone.</p>
        {deleteError && (
          <p className="form-error" role="alert">
            {deleteError}
          </p>
        )}
        <div className="modal-actions">
          <button
            className="secondary"
            disabled={deleting}
            onClick={() => setDeleteTarget(undefined)}
          >
            Cancel
          </button>
          <button
            className="danger"
            disabled={deleting}
            onClick={() => void confirmDeletion()}
          >
            {deleting
              ? "Deleting…"
              : deleteTarget.noteId
                ? "Delete Note and descendants"
                : "Delete Board permanently"}
          </button>
        </div>
      </section>
    </div>
  );
}
