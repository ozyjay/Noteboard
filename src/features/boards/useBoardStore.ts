import { useEffect, useRef, useState } from "react";
import { bridge } from "../../bridge";
import { exampleBoard } from "../../core/example";
import {
  defaults,
  now,
  SettingsSchema,
  type Board,
  type Settings,
} from "../../core/model";
import { errorText } from "../workspace/browser-actions";

export function useBoardStore(setError: (error: string) => void) {
  const [boards, setBoards] = useState<Board[]>([]),
    [boardId, setBoardId] = useState(""),
    [settings, setSettings] = useState<Settings>(defaults),
    [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Saved locally");
  const deletedBoards = useRef(new Set<string>()),
    saveQueue = useRef(Promise.resolve()),
    loadStarted = useRef(false);
  useEffect(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;
    (async () => {
      try {
        const [loaded, s] = await Promise.all([
          bridge.listBoards(),
          bridge.getSettings(),
        ]);
        const initial = loaded.length ? loaded : [exampleBoard()];
        setBoards(initial);
        setBoardId(initial[0].id);
        setSettings(SettingsSchema.parse(s));
        setReady(true);
      } catch (e) {
        setError(`Could not open local data: ${errorText(e)}`);
      }
    })();
  }, []);
  useEffect(() => {
    if (!ready) return;
    setSaveStatus("Saving…");
    const snapshot = boards;
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(async () => {
        for (const b of snapshot)
          if (!deletedBoards.current.has(b.id)) await bridge.saveBoard(b);
        setSaveStatus("Saved locally");
      })
      .catch((e) => {
        setSaveStatus("Save failed");
        setError(
          `Local save failed: ${errorText(e)}. Export the Board to keep a copy.`,
        );
      });
  }, [boards, ready]);
  function changeBoard(fn: (b: Board) => Board) {
    setBoards((current) =>
      current.map((b) =>
        b.id === boardId ? { ...fn(b), updatedAt: now() } : b,
      ),
    );
  }
  async function removeBoard(id: string) {
    deletedBoards.current.add(id);
    try {
      const deletion = saveQueue.current
        .catch(() => {})
        .then(() => bridge.deleteBoard(id));
      saveQueue.current = deletion;
      await deletion;
    } catch (error) {
      deletedBoards.current.delete(id);
      setBoards((current) => [...current]);
      throw error;
    }
  }

  async function saveImported(board: Board) {
    await saveQueue.current.catch(() => {});
    await bridge.saveBoard(board);
  }
  return {
    saveImported,
    boards,
    setBoards,
    boardId,
    setBoardId,
    settings,
    setSettings,
    ready,
    saveStatus,
    changeBoard,
    removeBoard,
  };
}
