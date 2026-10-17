import { ArrowUpRight, BookOpen, Download } from "lucide-react";
import { type Dispatch, type SetStateAction } from "react";
import { Markdown } from "../../components/Markdown";
import { versionPrompt, type Artefact, type Board } from "../../core/model";
import { download } from "../workspace/browser-actions";

interface Props {
  artefact: Artefact | undefined;
  preserveDraft: () => void;
  setDocumentText: Dispatch<SetStateAction<string>>;
  setDocumentDirty: Dispatch<SetStateAction<boolean>>;
  setEditing: Dispatch<SetStateAction<boolean>>;
  editing: boolean;
  documentText: string;
  documentDirty: boolean;
  saveDocument: () => void;
  goSource: (id: string) => void;
  board: Board | undefined;
  setSynthOpen: Dispatch<SetStateAction<boolean>>;
}
export function SynthesisWorkspace({
  artefact,
  preserveDraft,
  setDocumentText,
  setDocumentDirty,
  setEditing,
  editing,
  documentText,
  documentDirty,
  saveDocument,
  goSource,
  board,
  setSynthOpen,
}: Props) {
  return (
    <section className="synthesis-workspace">
      {artefact ? (
        <>
          <div className="document-toolbar">
            <div>
              <span className="eyebrow">
                {artefact.noteIds.length} SOURCE NOTES
              </span>
              <h2>{artefact.title}</h2>
            </div>
            <div>
              <select
                aria-label="Document version"
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  preserveDraft();
                  setDocumentText(
                    artefact.versions.find((v) => v.id === e.target.value)!
                      .text,
                  );
                  setDocumentDirty(true);
                }}
              >
                <option value="">
                  History · {artefact.versions.length} versions
                </option>
                {artefact.versions.map((v, i) => (
                  <option key={v.id} value={v.id}>
                    v{i + 1} · {v.kind} ·{" "}
                    {new Date(v.createdAt).toLocaleString("en-AU")}
                  </option>
                ))}
              </select>
              <button onClick={() => setEditing((v) => !v)}>
                {editing ? "Preview" : "Edit"}
              </button>
              <button
                onClick={() =>
                  download(
                    "noteboard-synthesis.md",
                    documentText,
                    "text/markdown",
                  )
                }
                aria-label="Export synthesis"
              >
                <Download size={16} />
              </button>
              <button
                className="primary"
                disabled={!documentDirty}
                onClick={saveDocument}
              >
                Save revision
              </button>
            </div>
          </div>
          {editing ? (
            <textarea
              className="document-editor"
              aria-label="Synthesis document"
              value={documentText}
              onChange={(e) => {
                setDocumentText(e.target.value);
                setDocumentDirty(true);
              }}
            />
          ) : (
            <div className="document-preview prose">
              <Markdown
                text={documentText}
                onSource={(id) => {
                  preserveDraft();
                  goSource(id);
                }}
              />
            </div>
          )}
          <div className="document-sources">
            <span>Source Notes</span>
            {artefact.noteIds.map((id) => (
              <button
                key={id}
                onClick={() => {
                  preserveDraft();
                  goSource(id);
                }}
              >
                {(() => {
                  const source =
                    board!.notes.find((n) => n.id === id) ??
                    artefact.archivedSources?.find((n) => n.id === id);
                  return source
                    ? versionPrompt(
                        source,
                        source.versions.find(
                          (v) => v.id === artefact.sourceVersions[id],
                        )!,
                      )
                    : "Source Note";
                })()}
                <ArrowUpRight size={12} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="synthesis-empty">
          <BookOpen size={36} />
          <h2>Bring your exploration together.</h2>
          <p>
            Create a learning journey, an integrated explanation, or a
            structured artefact.
            <br />
            Your original Board stays connected and intact.
          </p>
          <button
            className="primary"
            disabled={!board?.notes.length}
            onClick={() => setSynthOpen(true)}
          >
            Consolidate Notes <ArrowUpRight size={15} />
          </button>
        </div>
      )}
    </section>
  );
}
