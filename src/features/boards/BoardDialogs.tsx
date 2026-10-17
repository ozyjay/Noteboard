import type { Dispatch, SetStateAction } from "react";
import type { Board } from "../../core/model";
import { BoardMenu } from "./BoardMenu";
import { DeleteDialog } from "./DeleteDialog";
import { RenameBoardDialog } from "./RenameBoardDialog";
import type { useBoardActions } from "./useBoardActions";
export function BoardDialogs({
  actions,
  setBoards,
}: {
  actions: ReturnType<typeof useBoardActions>;
  setBoards: Dispatch<SetStateAction<Board[]>>;
}) {
  const {
    boardMenu,
    closeBoardMenu,
    renameDraft,
    renameBoard,
    setRenameDraft,
    deleteTarget,
    deletionBoard,
    deleting,
    deleteError,
    setDeleteTarget,
    confirmDeletion,
  } = actions;
  return (
    <>
      {" "}
      {boardMenu && (
        <BoardMenu
          target={boardMenu}
          onClose={closeBoardMenu}
          onRename={() => {
            actions.requestRename(boardMenu.boardId);
          }}
          onDelete={() => {
            actions.requestDelete(undefined, boardMenu.boardId);
          }}
        />
      )}
      {renameDraft !== undefined && renameBoard && (
        <RenameBoardDialog
          renameDraft={renameDraft}
          renameBoard={renameBoard}
          setBoards={setBoards}
          setRenameDraft={setRenameDraft}
        />
      )}
      {deleteTarget && deletionBoard && (
        <DeleteDialog
          deleteTarget={deleteTarget}
          deletionBoard={deletionBoard}
          deleteError={deleteError}
          deleting={deleting}
          setDeleteTarget={setDeleteTarget}
          confirmDeletion={confirmDeletion}
        />
      )}
    </>
  );
}
