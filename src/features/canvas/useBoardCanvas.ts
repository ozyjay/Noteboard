import {
  MarkerType,
  useNodesInitialized,
  useReactFlow,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { edgeLabel, type Appearance, type Board } from "../../core/model";
import { type HighlightFlowEdge } from "./HighlightEdge";
import { type CardNode } from "./NoteCard";
import { bounds, connectionSides } from "../../core/layout";
import type { CanvasLayout } from "./useCanvasLayout";

export function useBoardCanvas({
  board,
  boardId,
  ready,
  readerId,
  selected,
  appearance,
  read,
  choose,
  changeBoard,
  openEdgeSource,
  layout,
}: {
  board: Board | undefined;
  boardId: string;
  ready: boolean;
  readerId: string | undefined;
  selected: string[];
  appearance: Appearance;
  read: (id: string) => void;
  choose: (id: string) => void;
  changeBoard: (fn: (board: Board) => Board) => void;
  openEdgeSource: (id: string) => void;
  layout: CanvasLayout;
}) {
  const [nodeDimensions, setNodeDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const { fitView, setViewport } = useReactFlow();
  const nodesInitialised = useNodesInitialized();
  const layoutBoard = useRef<string | undefined>(undefined);
  useEffect(() => {
    layoutBoard.current = undefined;
  }, [boardId]);
  useEffect(() => {
    if (!board || !nodesInitialised || layoutBoard.current === boardId) return;
    layoutBoard.current = boardId;
    if (board.viewport) void setViewport(board.viewport);
    else void fitView({ padding: 0.22 });
  }, [boardId, ready, nodesInitialised, fitView, setViewport]);
  const nodes: CardNode[] =
    board?.notes.map((n, index) => ({
      id: n.id,
      type: "note",
      position: layout.preview[n.id] ?? n.position,
      dragHandle: ".note-drag-handle, .note-card.overview",
      draggable:
        !layout.disabled &&
        !layout.previewing &&
        (!layout.current || layout.current.root === n.id),
      focusable: !layout.pending.has(n.id),
      style: layout.pending.has(n.id) ? { visibility: "hidden" } : undefined,
      measured: nodeDimensions[n.id],
      selected: readerId === n.id,
      data: {
        note: n,
        noteStyle: appearance.noteStyle,
        index,
        children: board.edges.filter((e) => e.source === n.id).length,
        chosen: selected.includes(n.id),
        onRead: (id) => {
          if (!layout.locked && !layout.disabled) read(id);
        },
        onChoose: (id) => {
          if (!layout.locked && !layout.disabled) choose(id);
        },
        onLayout: layout.action,
        onMeasure: layout.onMeasure,
        layoutDisabled: layout.disabled || layout.locked,
        moving: layout.current?.ids.has(n.id) ?? false,
      },
    })) || [];
  const trackDimensions = useCallback(
    (changes: NodeChange<CardNode>[]) => {
      const movements = changes.filter(
        (change) => change.type === "position" && change.position,
      );
      for (const change of movements)
        if (change.type === "position" && change.position)
          layout.move(change.id, change.position);
      const updates = changes.filter(
        (change) => change.type === "dimensions" && change.dimensions,
      );
      if (!updates.length) return;
      setNodeDimensions((current) => {
        let next = current;
        for (const change of updates) {
          if (change.type !== "dimensions" || !change.dimensions) continue;
          const previous = current[change.id];
          if (
            previous?.width !== change.dimensions.width ||
            previous?.height !== change.dimensions.height
          ) {
            if (next === current) next = { ...current };
            next[change.id] = change.dimensions;
          }
        }
        return next;
      });
    },
    [layout.move],
  );
  const edges: HighlightFlowEdge[] =
    board?.edges.map((e) => {
      const source = board.notes.find((n) => n.id === e.source)!;
      const target = board.notes.find((n) => n.id === e.target)!;
      const sides = connectionSides(
        bounds(source, { ...layout.sizes, ...nodeDimensions }, layout.preview),
        bounds(target, { ...layout.sizes, ...nodeDimensions }, layout.preview),
      );
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: `source-${sides.source}`,
        targetHandle: `target-${sides.target}`,
        data: {
          text: edgeLabel(e),
          onOpenSource: () => {
            if (!layout.locked) openEdgeSource(e.id);
          },
        },
        type: "highlight",
        focusable: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--edge)" },
        style: {
          stroke: "var(--edge)",
          strokeWidth: 1.5,
          ...(e.kind === "continuation" ? { strokeDasharray: "6 4" } : {}),
        },
      };
    }) || [];

  return { nodes, edges, trackDimensions };
}
