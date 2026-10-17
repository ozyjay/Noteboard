import { useEffect } from "react";
import { findHighlightRange } from "../../core/selection";
import type { useReader } from "./useReader";

export function useReaderHighlight({
  readerId,
  anchor,
  note,
  version,
  readerSurface,
  highlight,
  composerOpen,
  revisionTarget,
  setHighlight,
}: Pick<
  ReturnType<typeof useReader>,
  | "readerId"
  | "anchor"
  | "note"
  | "version"
  | "readerSurface"
  | "highlight"
  | "revisionTarget"
  | "setHighlight"
> & { composerOpen: boolean }) {
  useEffect(() => {
    setHighlight(undefined);
    if (!anchor || !note || !readerSurface.current) return;
    const root = readerSurface.current;
    let range = findHighlightRange(root, anchor);
    if (!range) {
      const sel = window.getSelection();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const n = walker.currentNode as Text;
        const start = n.data.indexOf(anchor.text);
        if (start >= 0) {
          range = document.createRange();
          range.setStart(n, start);
          range.setEnd(n, start + anchor.text.length);
          break;
        }
      }
      sel?.removeAllRanges();
    }
    if (range) {
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(range);
      range.startContainer.parentElement?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }
  }, [readerId, anchor, note, version?.id]);
  useEffect(() => {
    if (!highlight || composerOpen || revisionTarget) return;
    const clearDeselectedHighlight = () => {
      const root = readerSurface.current;
      const selection = window.getSelection();
      if (
        !root ||
        !selection ||
        selection.rangeCount !== 1 ||
        selection.isCollapsed ||
        !selection.toString().trim() ||
        !root.contains(selection.anchorNode) ||
        !root.contains(selection.focusNode)
      )
        setHighlight(undefined);
    };
    clearDeselectedHighlight();
    document.addEventListener("selectionchange", clearDeselectedHighlight);
    return () =>
      document.removeEventListener("selectionchange", clearDeselectedHighlight);
  }, [
    Boolean(highlight),
    composerOpen,
    Boolean(revisionTarget),
    readerId,
    version?.id,
  ]);
}
