import { Markdown } from "../../components/Markdown";
import { response } from "../../core/model";
import { captureHighlight } from "../../core/selection";
import type { ReaderPanelProps } from "./ReaderPanel";
type Props = Pick<
  ReaderPanelProps,
  | "busy"
  | "setHighlight"
  | "setRevisionTarget"
  | "note"
  | "version"
  | "anchor"
  | "readerSurface"
  | "readingNote"
  | "goSource"
>;
export function ResponseSurface({
  busy,
  setHighlight,
  setRevisionTarget,
  note,
  version,
  anchor,
  readerSurface,
  readingNote,
  goSource,
}: Props) {
  return (
    <div
      className="reader-response prose editable-note-text"
      role="region"
      aria-label="Response — double-click or press Enter to edit"
      aria-keyshortcuts="Enter"
      tabIndex={busy ? -1 : 0}
      title="Double-click to edit response. Select text to explore a passage."
      onDoubleClick={(event) => {
        if (
          busy ||
          (event.target as HTMLElement).closest(
            "button, a, input, textarea, select",
          )
        )
          return;
        setHighlight(undefined);
        setRevisionTarget({
          noteId: note.id,
          versionId: version!.id,
          mode: "edit",
        });
      }}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          event.target === event.currentTarget &&
          !busy
        ) {
          event.preventDefault();
          setRevisionTarget({
            noteId: note.id,
            versionId: version!.id,
            mode: "edit",
          });
        }
      }}
      data-maths={!(anchor?.surface === "rendered" && !anchor.renderedMath)}
      ref={readerSurface}
      onMouseUp={() => {
        const h = captureHighlight(
          readerSurface.current!,
          readingNote!,
          window.getSelection(),
        );
        setHighlight(h);
      }}
      onKeyUp={() =>
        setHighlight(
          captureHighlight(
            readerSurface.current!,
            readingNote!,
            window.getSelection(),
          ),
        )
      }
    >
      <Markdown
        text={response(readingNote!).text}
        citations={
          version?.origin === "generated"
            ? version.webResearch?.citations
            : undefined
        }
        onSource={goSource}
        maths={!(anchor?.surface === "rendered" && !anchor.renderedMath)}
      />
    </div>
  );
}
