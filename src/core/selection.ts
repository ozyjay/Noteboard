import { type Highlight, type Note, response } from "./model";
// Range offsets use the exact rendered text surface, not ambiguous indexOf matching.
export function captureHighlight(
  root: HTMLElement,
  note: Note,
  selection: Selection | null,
): Highlight | undefined {
  if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return;
  const range = selection.getRangeAt(0).cloneRange();
  if (
    !root.contains(range.startContainer) ||
    !root.contains(range.endContainer)
  )
    return;
  // A typeset equation is one selectable unit. Keep its exact TeX alongside
  // rendered offsets rather than sending flattened superscripts to the model.
  const equations = Array.from(root.querySelectorAll(".katex")).filter(
    (element) => range.intersectsNode(element),
  );
  for (const element of equations) {
    if (element.contains(range.startContainer)) range.setStartBefore(element);
    if (element.contains(range.endContainer)) range.setEndAfter(element);
  }
  const before = range.cloneRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  const text = range.toString();
  if (!text.trim()) return;
  const readable = range.cloneContents();
  for (const equation of readable.querySelectorAll(".katex")) {
    const source = equation.querySelector(
      'annotation[encoding="application/x-tex"]',
    )?.textContent;
    if (source)
      equation.replaceWith(document.createTextNode(`\\(${source}\\)`));
  }
  return {
    sourceId: note.id,
    versionId: response(note).id,
    text,
    start,
    end: start + text.length,
    surface: "rendered",
    renderedText: root.textContent || "",
    renderedMath: root.dataset.maths !== "false",
    ...(equations.length
      ? {
          latexSources: equations
            .map(
              (element) =>
                element.querySelector(
                  'annotation[encoding="application/x-tex"]',
                )?.textContent || "",
            )
            .filter(Boolean),
          displayText: readable.textContent || text,
        }
      : {}),
  };
}
export function findHighlightRange(
  root: HTMLElement,
  h: Highlight,
): Range | undefined {
  if (h.surface !== "rendered" || root.textContent !== h.renderedText) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let start: Text | undefined,
    end: Text | undefined,
    startOffset = 0,
    endOffset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const length = node.data.length;
    if (!start && h.start >= offset && h.start < offset + length) {
      start = node;
      startOffset = h.start - offset;
    }
    if (h.end > offset && h.end <= offset + length) {
      end = node;
      endOffset = h.end - offset;
      break;
    }
    offset += length;
  }
  if (!start || !end) return;
  const range = document.createRange();
  range.setStart(start, startOffset);
  range.setEnd(end, endOffset);
  return range;
}
