import { useCallback, useState } from "react";
import { deleteNote, subtreeIds } from "../../core/deletion";
import { newBoard } from "../../core/model";
import { errorText } from "../workspace/browser-actions";
import { type BoardMenuTarget } from "./BoardMenu";

import type { useBoardStore } from "./useBoardStore";
export function useBoardActions({
  store,
  busy,
  preserveDraft,
  resetPanels,
  onDeletedNotes,
}: {
  store: ReturnType<typeof useBoardStore>;
  busy: boolean;
  preserveDraft: () => void;
  resetPanels: () => void;
  onDeletedNotes: (ids: Set<string>) => void;
}) {
  const { boards, setBoards, boardId, setBoardId, changeBoard, removeBoard } =
    store;
  const [renameDraft, setRenameDraft] = useState<string>();
  const [renameBoardId, setRenameBoardId] = useState("");
  const [boardMenu, setBoardMenu] = useState<BoardMenuTarget>();
  const closeBoardMenu = useCallback(() => setBoardMenu(undefined), []);
  const [deleteTarget, setDeleteTarget] = useState<{
    boardId: string;
    noteId?: string;
  }>();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const renameBoard = boards.find((b) => b.id === renameBoardId);
  const deletionBoard = boards.find((b) => b.id === deleteTarget?.boardId);
  async function confirmDeletion() {
    const targetBoard = deletionBoard;
    if (
      !targetBoard ||
      !deleteTarget ||
      busy ||
      deleting ||
      (deleteTarget.noteId && targetBoard.id !== boardId)
    )
      return;
    setDeleteError("");
    if (deleteTarget.noteId) {
      const ids = subtreeIds(targetBoard, deleteTarget.noteId);
      preserveDraft();
      changeBoard((b) => deleteNote(b, deleteTarget.noteId!));
      onDeletedNotes(ids);
      setDeleteTarget(undefined);
      return;
    }
    setDeleting(true);
    try {
      await removeBoard(targetBoard.id);
      const remaining = boards.filter((b) => b.id !== targetBoard.id);
      if (!remaining.length) remaining.push(newBoard());
      setBoards(remaining);
      if (targetBoard.id === boardId) {
        setBoardId(remaining[0].id);
        resetPanels();
      }
      setDeleteTarget(undefined);
    } catch (e) {
      setDeleteError(`Could not delete the Board: ${errorText(e)}`);
    } finally {
      setDeleting(false);
    }
  }
  function requestRename(id: string) {
    const b = boards.find((b) => b.id === id);
    if (b) {
      setRenameBoardId(id);
      setRenameDraft(b.title);
    }
  }
  function requestDelete(noteId?: string, targetBoardId = boardId) {
    setDeleteError("");
    setDeleteTarget({ boardId: targetBoardId, noteId });
  }

  return {
    renameDraft,
    setRenameDraft,
    renameBoard,
    boardMenu,
    setBoardMenu,
    closeBoardMenu,
    deleteTarget,
    deletionBoard,
    setDeleteTarget,
    deleting,
    deleteError,
    confirmDeletion,
    requestRename,
    requestDelete,
  };
}
