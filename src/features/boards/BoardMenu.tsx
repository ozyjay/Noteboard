import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

export type BoardMenuTarget = {
  boardId: string;
  x: number;
  y: number;
  trigger: HTMLButtonElement;
};

export function BoardMenu({
  target,
  onClose,
  onRename,
  onDelete,
}: {
  target: BoardMenuTarget;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    menu.current?.querySelector("button")?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) onClose();
    };
    const dismissOnResize = () => onClose();
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", dismissOnResize);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", dismissOnResize);
    };
  }, [target, onClose]);
  function close() {
    target.trigger.focus();
    onClose();
  }
  return (
    <div
      ref={menu}
      className="board-context-menu"
      role="menu"
      aria-label="Board actions"
      style={{
        left: Math.max(8, Math.min(target.x, window.innerWidth - 188)),
        top: Math.max(8, Math.min(target.y, window.innerHeight - 100)),
      }}
      onKeyDown={(event) => {
        const items = Array.from(menu.current!.querySelectorAll("button"));
        const index = items.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? items.length - 1
                : (index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    items.length) %
                  items.length;
          items[next].focus();
        } else if (event.key === "Escape" || event.key === "Tab") {
          if (event.key === "Escape") event.preventDefault();
          close();
        }
      }}
    >
      <button
        role="menuitem"
        onClick={() => {
          close();
          onRename();
        }}
      >
        <Pencil size={15} /> Rename
      </button>
      <button
        role="menuitem"
        onClick={() => {
          close();
          onDelete();
        }}
      >
        <Trash2 size={15} /> Delete
      </button>
    </div>
  );
}
