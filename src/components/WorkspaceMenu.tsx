import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function WorkspaceMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const openAtEnd = useRef(false);
  const id = useId();
  const items = () =>
    Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ) ?? [],
    );
  function close() {
    trigger.current?.focus();
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const buttons = Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ) ?? [],
    );
    (openAtEnd.current ? buttons.at(-1) : buttons[0])?.focus();
    openAtEnd.current = false;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        trigger.current?.focus();
        setOpen(false);
      }
    };
    const resize = () => {
      trigger.current?.focus();
      setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", resize);
    };
  }, [open]);
  return (
    <div ref={root} className="workspace-menu">
      <button
        ref={trigger}
        className="workspace-menu-trigger secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openAtEnd.current = event.key === "ArrowUp";
            setOpen(true);
          }
        }}
      >
        More <ChevronDown size={14} />
      </button>
      {open && (
        <div
          ref={menu}
          id={id}
          className="workspace-menu-items"
          role="menu"
          aria-label="Workspace actions"
          onClick={(event) => {
            const button = (event.target as HTMLElement).closest("button");
            if (button && !button.disabled) close();
          }}
          onKeyDown={(event) => {
            const buttons = items();
            const index = buttons.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : (index +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        buttons.length) %
                      buttons.length;
              buttons[next]?.focus();
            } else if (event.key === "Escape" || event.key === "Tab") {
              if (event.key === "Escape") event.preventDefault();
              close();
            }
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
