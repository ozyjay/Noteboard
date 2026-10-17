import { X } from "lucide-react";
import { type Dispatch, type SetStateAction } from "react";
import { Markdown } from "../../components/Markdown";
import { ResearchRecord } from "../../components/ResearchInputs";
import { versionFiles, versionResearch } from "../../core/context";
import { response, type Note } from "../../core/model";

interface Props {
  setSourcePreview: Dispatch<SetStateAction<Note | undefined>>;
  sourcePreview: Note;
  goSource: (id: string) => void;
}
export function ArchivedSource({
  setSourcePreview,
  sourcePreview,
  goSource,
}: Props) {
  return (
    <div className="modal-backdrop">
      <section
        className="modal archived-source"
        role="dialog"
        aria-modal="true"
        aria-label="Archived source Note"
      >
        <div className="panel-head">
          <span>ARCHIVED SOURCE NOTE</span>
          <button
            aria-label="Close source Note"
            onClick={() => setSourcePreview(undefined)}
          >
            <X size={18} />
          </button>
        </div>
        <p className="muted">
          Deleted from the Board. This read-only source is preserved for
          synthesis provenance.
        </p>
        <h2>{sourcePreview.title ?? sourcePreview.prompt}</h2>
        {sourcePreview.title && <p>{sourcePreview.prompt}</p>}
        <p className="muted small">
          {response(sourcePreview).origin === "edited"
            ? "HUMAN-EDITED"
            : response(sourcePreview).provider === "demo"
              ? "SYNTHETIC DEMO"
              : response(sourcePreview).origin === "imported"
                ? "Imported from ChatGPT"
                : response(sourcePreview).provider}
          {" · Model: "}
          {response(sourcePreview).model ?? "Unknown"}
          {" · Source version: "}
          {response(sourcePreview).id}
        </p>
        <div className="prose">
          <Markdown
            text={response(sourcePreview).text}
            citations={versionResearch(response(sourcePreview))?.citations}
            onSource={goSource}
          />
          <ResearchRecord
            files={versionFiles(response(sourcePreview))}
            research={versionResearch(response(sourcePreview))}
          />
        </div>
      </section>
    </div>
  );
}
