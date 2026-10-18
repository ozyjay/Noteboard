import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useViewport,
  type NodeChange,
} from "@xyflow/react";
import { Compass, Plus } from "lucide-react";
import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { alignmentGuides, bounds } from "../../core/layout";
import type { CanvasLayout } from "./useCanvasLayout";
import { type Appearance, type Board, type Highlight } from "../../core/model";
import { HighlightEdge, type HighlightFlowEdge } from "./HighlightEdge";
import { NoteCard, type CardNode } from "./NoteCard";

interface Props {
  readerExpanded: boolean;
  nodes: CardNode[];
  edges: HighlightFlowEdge[];
  trackDimensions: (changes: NodeChange<CardNode>[]) => void;
  read: (id: string, versionId?: string) => void;
  changeBoard: (update: (board: Board) => Board) => void;
  openEdgeSource: (id: string) => void;
  appearance: Appearance;
  board: Board | undefined;
  setPrompt: Dispatch<SetStateAction<string>>;
  openComposer: (highlight?: Highlight) => void;
  layout: CanvasLayout;
}
export function BoardCanvas({
  readerExpanded,
  nodes,
  edges,
  trackDimensions,
  read,
  changeBoard,
  openEdgeSource,
  appearance,
  board,
  setPrompt,
  openComposer,
  layout,
}: Props) {
  const viewport = useViewport();
  const controls = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!layout.previewing) return;
    const changed: { element: HTMLElement; inert: boolean }[] = [];
    let element = controls.current?.closest<HTMLElement>(".canvas");
    while (element?.parentElement && !element.classList.contains("app-shell")) {
      for (const sibling of element.parentElement.children) {
        if (sibling !== element && sibling instanceof HTMLElement) {
          changed.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      element = element.parentElement;
    }
    return () => {
      for (const item of changed) item.element.inert = item.inert;
    };
  }, [layout.previewing]);
  useEffect(() => {
    if (layout.current) controls.current?.focus();
  }, [layout.current?.kind, layout.current?.root]);
  const guideSizes = { ...layout.sizes };
  for (const node of nodes)
    if (node.measured?.width && node.measured?.height)
      guideSizes[node.id] = {
        width: node.measured.width,
        height: node.measured.height,
      };
  const movingNote = board?.notes.find((n) => n.id === layout.current?.root);
  const guides =
    layout.current && movingNote && layout.current.kind !== "tidy" && board
      ? alignmentGuides(
          bounds(movingNote, guideSizes, layout.preview),
          board.notes
            .filter((n) => !layout.current!.ids.has(n.id))
            .map((n) => bounds(n, guideSizes)),
          viewport.zoom,
        )
      : [];
  return (
    <div
      className="canvas"
      inert={readerExpanded || undefined}
      onKeyDown={(event) => {
        if (
          (event.target as HTMLElement).closest(
            "input, textarea, select, [contenteditable=true]",
          )
        )
          return;
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "z"
        ) {
          event.preventDefault();
          if (event.shiftKey) layout.redo();
          else layout.undo();
        }
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={trackDimensions}
        minZoom={0.2}
        maxZoom={1.5}
        nodesConnectable={false}
        deleteKeyCode={null}
        onNodeDoubleClick={(_, n) => {
          if (!layout.locked && !layout.disabled) read(n.id);
        }}
        onNodeDragStart={(_, n) => layout.dragStart(n.id)}
        onNodeDragStop={(_, n) => {
          layout.move(n.id, n.position);
          layout.finish();
        }}
        autoPanOnNodeFocus={false}
        nodesFocusable={!layout.disabled && !layout.previewing}
        disableKeyboardA11y={true}
        edgeTypes={edgeTypes}
        onEdgeClick={(_, edge) => {
          if (!layout.locked) openEdgeSource(edge.id);
        }}
        onMoveEnd={(_, viewport) => changeBoard((b) => ({ ...b, viewport }))}
      >
        {appearance.showGrid && (
          <Background color="var(--grid)" gap={24} size={1} />
        )}
        <Controls showInteractive={false} />
        <MiniMap
          style={{ width: 135, height: 90 }}
          nodeColor={(n) =>
            [
              "var(--note-0)",
              "var(--note-1)",
              "var(--note-2)",
              "var(--note-3)",
            ][(n.data as CardNode["data"]).index % 4]
          }
          maskColor="var(--minimap-mask)"
          pannable
          zoomable
        />
      </ReactFlow>
      <svg className="layout-guides" aria-hidden="true">
        {guides.map((guide, index) => (
          <line
            key={index}
            x1={
              guide.axis === "x"
                ? guide.value * viewport.zoom + viewport.x
                : guide.start * viewport.zoom + viewport.x
            }
            x2={
              guide.axis === "x"
                ? guide.value * viewport.zoom + viewport.x
                : guide.end * viewport.zoom + viewport.x
            }
            y1={
              guide.axis === "y"
                ? guide.value * viewport.zoom + viewport.y
                : guide.start * viewport.zoom + viewport.y
            }
            y2={
              guide.axis === "y"
                ? guide.value * viewport.zoom + viewport.y
                : guide.end * viewport.zoom + viewport.y
            }
          />
        ))}
      </svg>
      <div
        className="layout-controls"
        tabIndex={-1}
        ref={controls}
        aria-label="Graph layout controls"
      >
        <button disabled={!layout.canUndo} onClick={layout.undo}>
          Undo layout
        </button>
        <button disabled={!layout.canRedo} onClick={layout.redo}>
          Redo layout
        </button>
        {layout.current && (
          <>
            <span role="status">
              {layout.previewing ? "Tidy preview" : "Moving"}:{" "}
              {layout.current.ids.size}{" "}
              {layout.current.ids.size === 1 ? "Note" : "Notes"}.
              {!layout.previewing &&
                " Drag the marked header or use arrow keys; Shift moves faster. Enter applies; Escape cancels."}
            </span>
            <button onClick={layout.finish}>
              {layout.previewing ? "Apply" : "Done"}
            </button>
            <button onClick={layout.cancel}>Cancel</button>
          </>
        )}
      </div>
      {!board?.notes.length && (
        <div className="empty-board">
          <span>
            <Compass size={34} />
          </span>
          <h2>Where will your curiosity take you?</h2>
          <p>Start with a question. Follow the ideas that interest you.</p>
          <button
            className="primary"
            onClick={() => {
              setPrompt("");
              openComposer();
            }}
          >
            <Plus size={16} /> Ask your first question
          </button>
        </div>
      )}
      <div className="canvas-guide">
        <span className="guide-dot" />{" "}
        {board?.notes.length
          ? "Open a Note. Highlight a passage. Follow a new branch."
          : "Your inquiry starts with you."}
      </div>
    </div>
  );
}

const nodeTypes = { note: NoteCard };
const edgeTypes = { highlight: HighlightEdge };
