import {
  Handle,
  Position,
  useStore,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { ArrowUpRight, GitBranch } from "lucide-react";
import { useEffect } from "react";
import {
  response,
  versionPrompt,
  type Appearance,
  type Note,
} from "../../core/model";
export type CardNode = Node<
  {
    note: Note;
    noteStyle: Appearance["noteStyle"];
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
  const style = data.noteStyle;
  const takeawayFirst = style === "sticky" || style === "studio";
  const detailed = zoom > 0.55;
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    // Refresh connector bounds after mounting or changing the card layout.
    // Edges must not depend solely on a ResizeObserver notification.
    updateNodeInternals(data.note.id);
  }, [data.note.id, data.children, style, detailed, updateNodeInternals]);
  const version = response(data.note);
  const origin =
    version.origin === "imported"
      ? "Imported"
      : version.origin === "edited"
        ? "Human-edited"
        : version.provider === "demo"
          ? "Synthetic demo"
          : "Generated";
  const takeaway = (
    <div className="note-extract">
      {takeawayFirst && <span className="note-extract-label">Takeaway</span>}
      <p className="note-takeaway">{data.note.takeaway}</p>
    </div>
  );
  return (
    <article
      className={`note-card colour-${data.index % 4} ${zoom <= 0.55 ? "overview" : ""} ${selected ? "focused" : ""} ${data.chosen ? "chosen" : ""}`}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      {style === "index" && (
        <span className="note-index" aria-hidden="true">
          {String(data.index + 1).padStart(2, "0")}
        </span>
      )}
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
      {detailed && takeawayFirst && takeaway}
      <button
        className="note-prompt nodrag"
        onClick={() => data.onRead(data.note.id)}
      >
        {data.note.title ?? versionPrompt(data.note)}
      </button>
      {detailed && (
        <>
          {style === "blueprint" ? (
            <details className="note-peek nodrag nowheel">
              <summary>Peek takeaway</summary>
              {takeaway}
            </details>
          ) : (
            !takeawayFirst && takeaway
          )}
          {(style === "index" || style === "blueprint") && (
            <p className="note-catalogue-meta">
              v{data.note.versions.length} · {origin}
            </p>
          )}
          <div className="note-bottom">
            <span>
              <GitBranch size={13} /> {data.children}{" "}
              {data.children === 1 ? "branch" : "branches"}
            </span>
            <button
              className="nodrag"
              onClick={() => data.onRead(data.note.id)}
            >
              {style === "index"
                ? "Open reference"
                : style === "studio"
                  ? "Explore this idea"
                  : "Read & explore"}{" "}
              <ArrowUpRight size={14} />
            </button>
          </div>
        </>
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </article>
  );
}
