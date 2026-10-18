import {
  Handle,
  Position,
  useStore,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { ArrowUpRight, GitBranch } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { NoteLayoutMenu, type LayoutAction } from "./NoteLayoutMenu";
import type { Size } from "../../core/layout";
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
    onLayout: (id: string, action: LayoutAction) => void;
    onMeasure: (id: string, size: Size) => void;
    layoutDisabled: boolean;
    moving: boolean;
  },
  "note"
>;
export function NoteCard({ data, selected }: NodeProps<CardNode>) {
  const card = useRef<HTMLElement>(null);
  const zoom = useStore((s) => s.transform[2]);
  const style = data.noteStyle;
  const takeawayFirst = style === "sticky" || style === "studio";
  const detailed = zoom > 0.55;
  const updateNodeInternals = useUpdateNodeInternals();
  useLayoutEffect(() => {
    const element = card.current!;
    let frame = 0;
    const measure = () => {
      const clone = element.cloneNode(true) as HTMLElement;
      // Measuring must not join the live radio groups or duplicate DOM IDs.
      clone.querySelectorAll("[name], [id]").forEach((node) => {
        node.removeAttribute("name");
        node.removeAttribute("id");
      });
      clone.classList.remove("overview");
      clone
        .querySelectorAll(".note-layout[open]")
        .forEach((menu) => menu.removeAttribute("open"));
      Object.assign(clone.style, {
        position: "fixed",
        left: "-10000px",
        top: "0",
        visibility: "hidden",
        transform: "none",
      });
      clone.inert = true;
      document.body.append(clone);
      const { width, height } = clone.getBoundingClientRect();
      clone.remove();
      data.onMeasure(data.note.id, { width, height });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    const appearanceObserver = new MutationObserver(schedule);
    appearanceObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        "data-note-style",
        "data-interface-font",
        "data-reading-font",
        "data-text-size",
      ],
    });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      appearanceObserver.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [data.note, data.children, style, detailed, data.onMeasure]);
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
      ref={card}
      className={`note-card colour-${data.index % 4} ${zoom <= 0.55 ? "overview" : ""} ${selected ? "focused" : ""} ${data.chosen ? "chosen" : ""} ${data.moving ? "layout-moving" : ""}`}
    >
      {[Position.Left, Position.Right, Position.Top, Position.Bottom].flatMap(
        (position) =>
          (["source", "target"] as const).map((type) => (
            <Handle
              key={`${type}-${position}`}
              id={`${type}-${position}`}
              type={type}
              position={position}
              isConnectable={false}
            />
          )),
      )}
      {style === "index" && (
        <span className="note-index" aria-hidden="true">
          {String(data.index + 1).padStart(2, "0")}
        </span>
      )}
      <div className="note-top note-drag-handle" title="Drag to move this Note">
        <span className="note-number">
          {String(data.index + 1).padStart(2, "0")} /{" "}
          {data.index === 0 ? "STARTING QUESTION" : "EXPLORATION"}
        </span>
        <input
          className="nodrag"
          type="checkbox"
          disabled={data.layoutDisabled}
          aria-label={`Select Note ${data.index + 1} for synthesis`}
          checked={data.chosen}
          onChange={() => data.onChoose(data.note.id)}
        />
      </div>
      <NoteLayoutMenu
        note={data.note}
        index={data.index}
        disabled={data.layoutDisabled}
        onAction={data.onLayout}
      />
      {takeawayFirst && <div className="note-detail">{takeaway}</div>}
      <button
        className="note-prompt nodrag"
        disabled={data.layoutDisabled}
        onClick={() => data.onRead(data.note.id)}
      >
        {data.note.title ?? versionPrompt(data.note)}
      </button>
      <div className="note-detail">
        {style === "blueprint" ? (
          <details className="note-peek nodrag nowheel">
            <summary
              aria-disabled={data.layoutDisabled}
              onClick={(e) => {
                if (data.layoutDisabled) e.preventDefault();
              }}
            >
              Peek takeaway
            </summary>
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
            disabled={data.layoutDisabled}
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
      </div>
    </article>
  );
}
