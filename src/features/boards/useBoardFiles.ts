import { useRef, useState, type ChangeEvent } from "react";
import { MAX_EXPORT_BYTES } from "../../core/chatgpt-import";
import { now, uid, validateBoard, type Board } from "../../core/model";
import { download, errorText } from "../workspace/browser-actions";
import type { useBoardStore } from "./useBoardStore";

export function useBoardFiles({
  store,
  board,
  withDocumentDraft,
  preserveDraft,
  resetPanels,
  setError,
}: {
  store: ReturnType<typeof useBoardStore>;
  board: Board | undefined;
  withDocumentDraft: (board: Board) => Board;
  preserveDraft: () => void;
  resetPanels: () => void;
  setError: (error: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importSaving, setImportSaving] = useState(false);

  function openImported(imported: Board) {
    preserveDraft();
    store.setBoards((boards) => [imported, ...boards]);
    store.setBoardId(imported.id);
    resetPanels();
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_EXPORT_BYTES)
        throw new Error("Board files must be at most 50 MiB");
      const source = validateBoard(JSON.parse(await file.text()));
      // Open through the same draft-preserving path as conversation imports.
      openImported({
        ...source,
        id: uid(),
        title: `${source.title.slice(0, 189)} (imported)`,
        updatedAt: now(),
      });
    } catch (error) {
      setError(`Import failed: ${errorText(error)}`);
    }
    event.target.value = "";
  }
  async function importConversation(imported: Board) {
    await store.saveImported(imported);
    openImported(imported);
    setImportOpen(false);
  }
  function exportCurrentBoard() {
    if (!board) return;
    preserveDraft();
    const serialised = JSON.stringify(withDocumentDraft(board), null, 2);
    if (new TextEncoder().encode(serialised).byteLength > MAX_EXPORT_BYTES) {
      setError(
        "This Board exceeds the 50 MB export/import limit, including attached files and recorded contexts. Nothing has been removed.",
      );
      return;
    }
    download("noteboard-board.json", serialised, "application/json");
  }
  function openConversationImport() {
    setImportOpen(true);
    setError("");
  }
  return {
    fileInput,
    importOpen,
    setImportOpen,
    importSaving,
    setImportSaving,
    importFile,
    importConversation,
    exportCurrentBoard,
    openConversationImport,
  };
}
