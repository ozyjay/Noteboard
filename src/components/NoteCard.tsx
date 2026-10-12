import {
  Handle,
  Position,
  useStore,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import { ArrowUpRight, GitBranch } from "lucide-react";
import { type Note } from "../core/model";
export type CardNode = Node<
  {
    note: Note;
    index: number;
    children: number;
    chosen: boolean;
    onRead: (id: string) => void;
    onChoose: (id: string) => void;
  },
  "note"
>;
export function NoteCard({ data, selected }: NodeProps<CardNode>) {
  const zoom = useStore((s) => s.transform[2]);
  return (
    <article
      className={`note-card colour-${data.index % 4} ${zoom <= 0.55 ? "overview" : ""} ${selected ? "focused" : ""} ${data.chosen ? "chosen" : ""}`}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="note-top">
        <span className="note-number">
          {String(data.index + 1).padStart(2, "0")} /{" "}
          {data.index === 0 ? "STARTING QUESTION" : "EXPLORATION"}
        </span>
        <input
          className="nodrag"
          type="checkbox"
          aria-label={`Select Note ${data.index + 1} for synthesis`}
          checked={data.chosen}
          onChange={() => data.onChoose(data.note.id)}
        />
      </div>
      <button
        className="note-prompt nodrag"
        onClick={() => data.onRead(data.note.id)}
      >
        {data.note.title ?? data.note.prompt}
      </button>
      {zoom > 0.55 && (
        <>
          <p className="note-takeaway">{data.note.takeaway}</p>
          <div className="note-bottom">
            <span>
              <GitBranch size={13} /> {data.children}{" "}
              {data.children === 1 ? "branch" : "branches"}
            </span>
            <button
              className="nodrag"
              onClick={() => data.onRead(data.note.id)}
            >
              Read & explore <ArrowUpRight size={14} />
            </button>
          </div>
        </>
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </article>
  );
}
