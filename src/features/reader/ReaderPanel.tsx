import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Maximize2,
  Minimize2,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { ResearchRecord } from "../../components/ResearchInputs";
import { annotateContinuation } from "../../core/chatgpt-import";
import { ancestry, versionFiles } from "../../core/context";
import {
  edgeLabel,
  highlightLabel,
  response,
  type Appearance,
  type Board,
  type Highlight,
  type InquiryEdge,
  type Note,
  type ResponseVersion,
} from "../../core/model";
import { GenerationRecord } from "./GenerationRecord";
import { HighlightActions } from "./HighlightActions";
import { NoteReader } from "./NoteReader";
import { type RevisionMode } from "./NoteRevision";
import { NoteTitle } from "./NoteTitle";
import { ReaderVersionTools } from "./ReaderVersionTools";
import { ResponseSurface } from "./ResponseSurface";

export interface ReaderPanelProps {
  readerExpanded: boolean;
  readerFocused: boolean;
  setReaderFocused: Dispatch<SetStateAction<boolean>>;
  board: Board | undefined;
  note: Note;
  busy: boolean;
  onDeleteNote: () => void;
  setReaderExpanded: Dispatch<SetStateAction<boolean>>;
  setReaderId: Dispatch<SetStateAction<string | undefined>>;
  setAnchor: Dispatch<SetStateAction<Highlight | undefined>>;
  setHighlight: Dispatch<SetStateAction<Highlight | undefined>>;
  incoming: InquiryEdge | undefined;
  readParent: () => void;
  version: ResponseVersion | undefined;
  readingNote: Note | undefined;
  setRevisionTarget: Dispatch<
    SetStateAction<
      { noteId: string; versionId: string; mode: RevisionMode } | undefined
    >
  >;
  changeBoard: (update: (board: Board) => Board) => void;
  appearance: Appearance;
  setReaderVersionId: Dispatch<SetStateAction<string | undefined>>;
  read: (id: string, versionId?: string) => void;
  anchor: Highlight | undefined;
  readerSurface: RefObject<HTMLDivElement | null>;
  goSource: (id: string) => void;
  highlight: Highlight | undefined;
  continuationTarget: string;
  setContinuationTarget: Dispatch<SetStateAction<string>>;
  branch: (highlight: Highlight) => void;
}
export function ReaderPanel({
  readerExpanded,
  readerFocused,
  setReaderFocused,
  board,
  note,
  busy,
  onDeleteNote,
  setReaderExpanded,
  setReaderId,
  setAnchor,
  setHighlight,
  incoming,
  readParent,
  version,
  readingNote,
  setRevisionTarget,
  changeBoard,
  appearance,
  setReaderVersionId,
  read,
  anchor,
  readerSurface,
  goSource,
  highlight,
  continuationTarget,
  setContinuationTarget,
  branch,
}: ReaderPanelProps) {
  const backButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (readerFocused) backButton.current?.focus();
  }, [readerFocused, note.id]);
  return (
    <NoteReader
      expanded={readerExpanded || readerFocused}
      className={`reader colour-${board!.notes.findIndex((n) => n.id === note.id) % 4} ${readerExpanded || readerFocused ? "reader-expanded" : ""} ${readerFocused ? "reader-focused" : ""}`}
    >
      <div className="panel-head">
        {readerFocused && (
          <button
            ref={backButton}
            className="back-to-board"
            onClick={() => {
              setReaderFocused(false);
              setReaderExpanded(false);
            }}
          >
            <ArrowLeft size={16} /> Back to Board
          </button>
        )}
        <span>
          <BookOpen size={15} />{" "}
          {readerFocused &&
          version?.origin === "generated" &&
          version.provider === "demo"
            ? "SYNTHETIC DEMO · NOTE"
            : "NOTE"}{" "}
          {String(board!.notes.indexOf(note) + 1).padStart(2, "0")}
        </span>
        <button
          hidden={readerFocused}
          aria-label="Delete Note"
          title="Delete Note"
          disabled={busy}
          onClick={onDeleteNote}
        >
          <Trash2 size={17} />
        </button>
        <button
          hidden={readerFocused}
          aria-label={readerExpanded ? "Collapse Note" : "Expand Note"}
          title={readerExpanded ? "Return to side panel" : "Fill workspace"}
          aria-pressed={readerExpanded}
          onClick={() => setReaderExpanded((value) => !value)}
        >
          {readerExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
        <button
          aria-label="Close Note"
          onClick={() => {
            setReaderId(undefined);
            setAnchor(undefined);
            setHighlight(undefined);
          }}
        >
          <X size={18} />
        </button>
      </div>
      <div className="reader-scroll">
        {incoming && (
          <button className="parent-link" onClick={readParent}>
            <ArrowLeft size={13} /> From “{edgeLabel(incoming).slice(0, 60)}”
          </button>
        )}
        <NoteTitle
          key={`title-${note.id}-${version!.id}`}
          note={readingNote!}
          busy={busy}
          onEditPrompt={() =>
            setRevisionTarget({
              noteId: note.id,
              versionId: version!.id,
              mode: "prompt",
            })
          }
          onSave={(title) =>
            changeBoard((b) => ({
              ...b,
              notes: b.notes.map((n) =>
                n.id === note.id ? { ...n, title } : n,
              ),
            }))
          }
        />
        <ReaderVersionTools
          focused={readerFocused}
          onDeleteNote={onDeleteNote}
          appearance={appearance}
          version={version}
          busy={busy}
          setReaderVersionId={setReaderVersionId}
          setAnchor={setAnchor}
          setHighlight={setHighlight}
          note={note}
          setRevisionTarget={setRevisionTarget}
          incoming={incoming}
          readParent={readParent}
          board={board}
          read={read}
        />
        {response(readingNote!).origin === "imported" && (
          <p className="muted">
            Imported from ChatGPT · Model:{" "}
            {response(readingNote!).model ?? "Unknown"}. Original generation
            context, token estimates and usage are unknown.
          </p>
        )}
        <div className="note-meta" hidden={readerFocused}>
          <span>
            {version?.origin === "edited"
              ? "HUMAN-EDITED"
              : response(readingNote!).provider === "demo"
                ? "SYNTHETIC DEMO"
                : (response(readingNote!).model ?? "Unknown")}
            {version?.origin === "generated" && version.reasoningEffort
              ? ` · ${version.reasoningEffort} thinking`
              : ""}
          </span>
          <span>
            v{note.versions.findIndex((v) => v.id === version!.id) + 1} of{" "}
            {note.versions.length} · {ancestry(board!, note.id).length - 1}{" "}
            steps from root
          </span>
        </div>
        <ResponseSurface
          busy={busy}
          setHighlight={setHighlight}
          setRevisionTarget={setRevisionTarget}
          note={note}
          version={version}
          anchor={anchor}
          readerSurface={readerSurface}
          readingNote={readingNote}
          goSource={goSource}
        />
        <ResearchRecord
          files={version ? versionFiles(version) : []}
          research={
            version?.origin === "generated" ? version.webResearch : undefined
          }
        />
        {anchor && (
          <div className="anchor-info">
            Source Highlight: “{highlightLabel(anchor)}”
          </div>
        )}
        <details className="takeaway-controls" key={note.id}>
          <summary>Edit takeaway</summary>
          <label className="takeaway-editor">
            TAKEAWAY{" "}
            <textarea
              aria-label="Edit Takeaway"
              value={note.takeaway}
              onChange={(e) =>
                changeBoard((b) => ({
                  ...b,
                  notes: b.notes.map((n) =>
                    n.id === note.id ? { ...n, takeaway: e.target.value } : n,
                  ),
                }))
              }
            />
          </label>
        </details>
        {board!.edges.filter((e) => e.source === note.id).length > 0 && (
          <div className="existing-branches">
            <h3>EXPLORED FROM THIS NOTE</h3>
            {board!.edges
              .filter((e) => e.source === note.id)
              .map((e) => (
                <div key={e.id}>
                  <button onClick={() => setAnchor(e.highlight)}>
                    “{edgeLabel(e)}”
                  </button>
                  {e.kind === "continuation" && e.highlight && (
                    <button
                      disabled={busy}
                      aria-label={`Remove retrospective Highlight for ${board!.notes.find((n) => n.id === e.target)!.prompt}`}
                      onClick={() => {
                        changeBoard((b) => annotateContinuation(b, e.id));
                        setAnchor(undefined);
                        setHighlight(undefined);
                      }}
                    >
                      Remove Highlight
                    </button>
                  )}
                  <button
                    aria-label={`Open branch ${edgeLabel(e)}`}
                    onClick={() => read(e.target)}
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              ))}
          </div>
        )}
        <GenerationRecord
          version={version}
          readingNote={readingNote}
          note={note}
        />
      </div>
      <HighlightActions
        readerFocused={readerFocused}
        highlight={highlight}
        version={version}
        board={board}
        note={note}
        continuationTarget={continuationTarget}
        setContinuationTarget={setContinuationTarget}
        busy={busy}
        changeBoard={changeBoard}
        setAnchor={setAnchor}
        setHighlight={setHighlight}
        branch={branch}
      />
    </NoteReader>
  );
}
