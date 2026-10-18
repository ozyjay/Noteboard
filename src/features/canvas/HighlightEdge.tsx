import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useViewport,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type HighlightFlowEdge = Edge<
  { text: string; onOpenSource: () => void },
  "highlight"
>;

export function HighlightEdge(props: EdgeProps<HighlightFlowEdge>) {
  const [path, x, y] = getSmoothStepPath(props);
  const viewport = useViewport();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const label = useRef<HTMLButtonElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const previewId = `edge-preview-${props.id}`;

  function cancelClose() {
    clearTimeout(closeTimer.current);
  }
  function show() {
    cancelClose();
    setOpen(true);
  }
  function openSource() {
    cancelClose();
    setOpen(false);
    props.data?.onOpenSource();
  }
  function hideSoon() {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      const active = document.activeElement;
      if (active !== label.current && !preview.current?.contains(active))
        setOpen(false);
    }, 150);
  }

  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    setOpen(false);
  }, [viewport.x, viewport.y, viewport.zoom]);
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (preview.current?.contains(document.activeElement))
        label.current?.focus();
      clearTimeout(closeTimer.current);
      setOpen(false);
    };
    window.addEventListener("keydown", dismiss, true);
    return () => window.removeEventListener("keydown", dismiss, true);
  }, [open]);
  useLayoutEffect(() => {
    if (!open || !label.current || !preview.current) return;
    const anchor = label.current.getBoundingClientRect();
    const box = preview.current.getBoundingClientRect();
    const below = anchor.bottom + 8;
    setPosition({
      left: Math.max(
        8,
        Math.min(
          anchor.x + anchor.width / 2 - box.width / 2,
          window.innerWidth - box.width - 8,
        ),
      ),
      top: Math.max(
        8,
        Math.min(
          below + box.height <= window.innerHeight - 8
            ? below
            : anchor.top - box.height - 8,
          window.innerHeight - box.height - 8,
        ),
      ),
    });
  }, [open]);

  if (!props.data) return null;
  return (
    <>
      <g
        data-source-side={props.sourcePosition}
        data-target-side={props.targetPosition}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onClick={() => setOpen(false)}
      >
        <BaseEdge
          id={props.id}
          path={path}
          style={props.style}
          markerEnd={props.markerEnd}
          interactionWidth={props.interactionWidth}
        />
      </g>
      <EdgeLabelRenderer>
        <button
          ref={label}
          className={`edge-label nodrag nopan${viewport.zoom <= 0.55 && !open ? " edge-label-distant" : ""}`}
          style={{
            transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
          }}
          aria-label={`Open source: ${props.data.text}`}
          aria-describedby={open ? previewId : undefined}
          aria-keyshortcuts="ArrowDown"
          onMouseEnter={show}
          onMouseLeave={hideSoon}
          onFocus={show}
          onBlur={hideSoon}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && open) {
              event.preventDefault();
              event.stopPropagation();
              preview.current?.focus();
            }
          }}
          onClick={openSource}
        >
          <span>{props.data.text}</span>
        </button>
      </EdgeLabelRenderer>
      {open &&
        createPortal(
          <div
            ref={preview}
            id={previewId}
            role="region"
            aria-label="Full connection text"
            tabIndex={0}
            className="edge-preview nodrag nopan"
            style={position}
            onMouseEnter={cancelClose}
            onMouseLeave={hideSoon}
            onFocus={cancelClose}
            onBlur={hideSoon}
          >
            <div className="edge-preview-text">{props.data.text}</div>
            <div className="edge-preview-hint">
              Press ↓ on the label to read here.
            </div>
            <button onClick={openSource}>Open source Note</button>
          </div>,
          document.body,
        )}
    </>
  );
}
