import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  applyLayout,
  placeChild,
  snapshot,
  subtreeIds,
  tidyBranch,
  translate,
  type LayoutSnapshot,
  type Point,
  type Positions,
  type Size,
  type Sizes,
} from "../../core/layout";
import type { Board } from "../../core/model";
import type { LayoutAction } from "./NoteLayoutMenu";

type Operation = {
  boardId: string;
  root: string;
  ids: Set<string>;
  before: LayoutSnapshot;
  positions: Positions;
  kind: "move" | "branch" | "tidy";
};
type Entry = { before: LayoutSnapshot; after: LayoutSnapshot };
type History = { undo: Entry[]; redo: Entry[]; structure: string };
const structure = (board: Board) =>
  JSON.stringify([
    board.notes.map((n) => n.id),
    board.edges.map((e) => [e.id, e.source, e.target]),
  ]);

export function useCanvasLayout({
  board,
  appearanceKey,
  disabled,
  changeBoard,
}: {
  board: Board | undefined;
  appearanceKey: string;
  disabled: boolean;
  changeBoard: (fn: (b: Board) => Board) => void;
}) {
  const histories = useRef(new Map<string, History>());
  const visited = useRef(new Map<string, Set<string>>());
  const [, setRevision] = useState(0);
  const [measurements, setMeasurements] = useState<Record<string, Sizes>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [operation, setOperation] = useState<Operation>();
  const active = useRef<Operation | undefined>(undefined);
  const sizes = measurements[appearanceKey] ?? {};
  const current = operation?.boardId === board?.id ? operation : undefined;
  const preview = current?.positions ?? {};
  const locked = !!current;
  const previewing = current?.kind === "tidy";
  const onMeasure = useCallback(
    (id: string, size: Size) => {
      setMeasurements((all) => {
        const previous = all[appearanceKey]?.[id];
        if (previous?.width === size.width && previous?.height === size.height)
          return all;
        return {
          ...all,
          [appearanceKey]: { ...all[appearanceKey], [id]: size },
        };
      });
    },
    [appearanceKey],
  );

  function update(value?: Operation) {
    active.current = value;
    setOperation(value);
  }
  function cancel() {
    update();
  }
  useEffect(() => {
    cancel();
  }, [board?.id, disabled]);
  useEffect(
    () => () => {
      active.current = undefined;
    },
    [],
  );
  useLayoutEffect(() => {
    if (!board) return;
    const signature = structure(board);
    const history = histories.current.get(board.id);
    if (!history || history.structure !== signature) {
      histories.current.set(board.id, {
        undo: [],
        redo: [],
        structure: signature,
      });
      setRevision((n) => n + 1);
      cancel();
    }
    const oldIds = visited.current.get(board.id);
    const newIds = new Set(
      board.notes
        .filter(
          (n) =>
            oldIds &&
            !oldIds.has(n.id) &&
            board.edges.some((e) => e.target === n.id),
        )
        .map((n) => n.id),
    );
    visited.current.set(board.id, new Set(board.notes.map((n) => n.id)));
    setPending(newIds);
  }, [board?.id, board && structure(board)]);

  useLayoutEffect(() => {
    if (!board || !pending.size || [...pending].some((id) => !sizes[id]))
      return;
    const id = board.id;
    changeBoard((latest) => {
      if (latest.id !== id) return latest;
      let result = latest;
      for (const key of pending) {
        const edge = result.edges.find((e) => e.target === key);
        const parent = result.notes.find((n) => n.id === edge?.source);
        if (!parent) continue;
        const position = placeChild(
          { ...result, notes: result.notes.filter((n) => n.id !== key) },
          parent,
          sizes[key],
          sizes,
        );
        result = applyLayout(result, { [key]: position });
      }
      return result;
    });
    setPending(new Set());
  }, [board, pending, sizes]);

  function commit(before: LayoutSnapshot, after: LayoutSnapshot) {
    if (!board || JSON.stringify(before) === JSON.stringify(after)) {
      cancel();
      return;
    }
    const history = histories.current.get(board.id)!;
    history.undo = [...history.undo.slice(-49), { before, after }];
    history.redo = [];
    changeBoard((latest) => applyLayout(latest, after));
    cancel();
    setRevision((n) => n + 1);
  }
  function finish() {
    const op = active.current;
    if (!board || !op || op.boardId !== board.id) return;
    const after = { ...op.before };
    for (const [id, p] of Object.entries(op.positions))
      after[id] = { ...after[id], ...p };
    commit(op.before, after);
  }
  function action(id: string, action: LayoutAction) {
    if (!board || disabled || locked || pending.size) return;
    const before = snapshot(board);
    if (action === "right" || action === "below") {
      commit(before, {
        ...before,
        [id]: { ...before[id], childDirection: action },
      });
      return;
    }
    const ids = action === "move" ? new Set([id]) : subtreeIds(board, id);
    const positions =
      action === "tidy"
        ? tidyBranch(board, id, sizes)
        : Object.fromEntries(
            [...ids].map((key) => [
              key,
              board.notes.find((n) => n.id === key)!.position,
            ]),
          );
    update({
      boardId: board.id,
      root: id,
      ids,
      before,
      positions,
      kind: action,
    });
  }
  function dragStart(id: string) {
    if (!active.current) action(id, "move");
  }
  function move(id: string, point: Point) {
    const op = active.current;
    if (!op || op.root !== id || op.kind === "tidy") return;
    const positions = Object.fromEntries(
      [...op.ids].map((key) => [key, op.before[key]]),
    );
    update({
      ...op,
      positions: translate(positions, {
        x: point.x - op.before[id].x,
        y: point.y - op.before[id].y,
      }),
    });
  }
  useEffect(() => {
    if (!current) return;
    const keydown = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).closest(
          "input, textarea, select, [contenteditable=true]",
        )
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancel();
        return;
      }
      if (current.kind === "tidy") return;
      if (event.key === "Enter") {
        event.preventDefault();
        finish();
        return;
      }
      const delta = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }[event.key];
      if (!delta) return;
      event.preventDefault();
      event.stopPropagation();
      const op = active.current!;
      const p = op.positions[op.root];
      const step = event.shiftKey ? 50 : 10;
      move(op.root, { x: p.x + delta[0] * step, y: p.y + delta[1] * step });
    };
    window.addEventListener("keydown", keydown, true);
    return () => window.removeEventListener("keydown", keydown, true);
  }, [current, board]);

  function historyStep(direction: "undo" | "redo") {
    if (!board || locked || disabled || pending.size) return;
    const history = histories.current.get(board.id)!;
    const entry = history[direction].pop();
    if (!entry) return;
    history[direction === "undo" ? "redo" : "undo"].push(entry);
    changeBoard((latest) =>
      applyLayout(latest, entry[direction === "undo" ? "before" : "after"]),
    );
    setRevision((n) => n + 1);
  }
  const history = board && histories.current.get(board.id);
  return {
    sizes,
    preview,
    pending,
    current,
    locked,
    previewing,
    onMeasure,
    action,
    dragStart,
    move,
    finish,
    cancel,
    undo: () => historyStep("undo"),
    redo: () => historyStep("redo"),
    canUndo: !!history?.undo.length && !locked && !disabled && !pending.size,
    canRedo: !!history?.redo.length && !locked && !disabled && !pending.size,
    disabled: disabled || pending.size > 0,
  };
}
export type CanvasLayout = ReturnType<typeof useCanvasLayout>;
