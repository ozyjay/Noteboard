import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export function ReaderTools({
  compact,
  children,
}: {
  compact: boolean;
  children: ReactNode;
}) {
  return compact ? (
    <details className="reader-tools">
      <summary>Versions, editing & connected Notes</summary>
      {children}
    </details>
  ) : (
    <>{children}</>
  );
}

export function NoteReader({
  expanded,
  className,
  children,
}: {
  expanded: boolean;
  className: string;
  children: ReactNode;
}) {
  const reader = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const [width, setWidth] = useState(410);
  const [workspaceWidth, setWorkspaceWidth] = useState(0);
  const [resizing, setResizing] = useState(false);
  useLayoutEffect(() => {
    const workspace = reader.current!.parentElement!;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setWorkspaceWidth(workspace.getBoundingClientRect().width),
      );
    });
    setWorkspaceWidth(workspace.getBoundingClientRect().width);
    observer.observe(workspace);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  // Keep some canvas visible, including in a narrow window.
  const maximum = Math.max(
    0,
    workspaceWidth - Math.min(240, workspaceWidth * 0.3),
  );
  const minimum = Math.min(320, maximum);
  const clamp = (value: number) => Math.min(maximum, Math.max(minimum, value));
  const actualWidth = clamp(width);
  return (
    <aside
      ref={reader}
      className={`${className} ${resizing ? "reader-resizing" : ""}`}
      style={expanded ? undefined : { width: actualWidth }}
    >
      {!expanded && (
        <div
          className="reader-resize-handle"
          role="separator"
          tabIndex={0}
          aria-label="Resize Note reader"
          aria-orientation="vertical"
          aria-valuemin={Math.round(minimum)}
          aria-valuemax={Math.round(maximum)}
          aria-valuenow={Math.round(actualWidth)}
          aria-valuetext={`${Math.round(actualWidth)} pixels wide`}
          title="Drag to resize. Use Left and Right arrows when focused."
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, width: actualWidth };
            setResizing(true);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            setWidth(
              clamp(drag.current.width + drag.current.x - event.clientX),
            );
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            drag.current = null;
            setResizing(false);
          }}
          onLostPointerCapture={() => {
            drag.current = null;
            setResizing(false);
          }}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 80 : 32;
            const widths: Record<string, number> = {
              ArrowLeft: actualWidth + step,
              ArrowRight: actualWidth - step,
              Home: minimum,
              End: maximum,
            };
            const next = widths[event.key];
            if (next === undefined) return;
            event.preventDefault();
            setWidth(clamp(next));
          }}
        />
      )}
      {children}
    </aside>
  );
}
