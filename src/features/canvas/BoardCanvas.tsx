import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type NodeChange,
} from "@xyflow/react";
import { Compass, Plus } from "lucide-react";
import { type Dispatch, type SetStateAction } from "react";
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
}: Props) {
  return (
    <div className="canvas" inert={readerExpanded || undefined}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={trackDimensions}
        minZoom={0.2}
        maxZoom={1.5}
        nodesConnectable={false}
        deleteKeyCode={null}
        onNodeDoubleClick={(_, n) => read(n.id)}
        onNodeDragStop={(_, n) =>
          changeBoard((b) => ({
            ...b,
            notes: b.notes.map((note) =>
              note.id === n.id ? { ...note, position: n.position } : note,
            ),
          }))
        }
        edgeTypes={edgeTypes}
        onEdgeClick={(_, edge) => openEdgeSource(edge.id)}
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
