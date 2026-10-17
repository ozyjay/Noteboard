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
}) {
  const [nodePositions, setNodePositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [nodeDimensions, setNodeDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const { fitView, setViewport } = useReactFlow();
  const nodesInitialised = useNodesInitialized();
  const layoutBoard = useRef<string | undefined>(undefined);
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
      position: nodePositions[`${boardId}:${n.id}`] || n.position,
      measured: nodeDimensions[n.id],
      selected: readerId === n.id,
      data: {
        note: n,
        noteStyle: appearance.noteStyle,
        index,
        children: board.edges.filter((e) => e.source === n.id).length,
        chosen: selected.includes(n.id),
        onRead: read,
        onChoose: choose,
      },
    })) || [];
  const trackDimensions = useCallback(
    (changes: NodeChange<CardNode>[]) => {
      const movements = changes.filter(
        (change) => change.type === "position" && change.position,
      );
      if (movements.length)
        setNodePositions((current) => {
          const next = { ...current };
          for (const change of movements)
            if (change.type === "position" && change.position)
              next[`${boardId}:${change.id}`] = change.position;
          return next;
        });
      const settled = movements.filter(
        (change) => change.type === "position" && !change.dragging,
      );
      if (settled.length)
        changeBoard((b) => ({
          ...b,
          notes: b.notes.map((n) => {
            const change = settled.find(
              (change) => change.type === "position" && change.id === n.id,
            );
            return change?.type === "position" && change.position
              ? { ...n, position: change.position }
              : n;
          }),
        }));
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
    [boardId],
  );
  const edges: HighlightFlowEdge[] =
    board?.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      data: { text: edgeLabel(e), onOpenSource: () => openEdgeSource(e.id) },
      type: "highlight",
      focusable: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--edge)" },
      style: {
        stroke: "var(--edge)",
        strokeWidth: 1.5,
        ...(e.kind === "continuation" ? { strokeDasharray: "6 4" } : {}),
      },
    })) || [];

  return { nodes, edges, trackDimensions };
}
