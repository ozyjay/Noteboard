import { LoaderCircle, Sparkles, X } from "lucide-react";
import { type Dispatch, type FormEvent, type SetStateAction } from "react";
import { type Artefact, type Board, type Settings } from "../../core/model";

interface Props {
  busy: boolean;
  setSynthOpen: Dispatch<SetStateAction<boolean>>;
  consolidate: (event: FormEvent) => Promise<void>;
  scope: "board" | "branch" | "selected";
  setScope: Dispatch<SetStateAction<"board" | "branch" | "selected">>;
  board: Board | undefined;
  selected: string[];
  readerId: string | undefined;
  format: Artefact["format"];
  setFormat: Dispatch<SetStateAction<Artefact["format"]>>;
  structure: string;
  setStructure: Dispatch<SetStateAction<string>>;
  settings: Settings;
  error: string;
  onCancel: () => void;
}
export function SynthesisDialog({
  busy,
  setSynthOpen,
  consolidate,
  scope,
  setScope,
  board,
  selected,
  readerId,
  format,
  setFormat,
  structure,
  setStructure,
  settings,
  error,
  onCancel,
}: Props) {
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Consolidate Notes"
      >
        <div className="panel-head">
          <span>
            <Sparkles size={16} /> CONSOLIDATE
          </span>
          <button
            aria-label="Close synthesis settings"
            disabled={busy}
            onClick={() => setSynthOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <h2>Turn your path into an account.</h2>
        <form onSubmit={consolidate}>
          <label>
            Source material
            <select
              aria-label="Source material"
              value={scope}
              disabled={busy}
              onChange={(e) => setScope(e.target.value as typeof scope)}
            >
              <option value="board">
                Entire Board ({board?.notes.length} Notes)
              </option>
              <option value="branch" disabled={!selected.length && !readerId}>
                Ancestral branch to the{" "}
                {selected.length ? "first selected" : "open"} Note
              </option>
              <option value="selected" disabled={!selected.length}>
                Selected Notes ({selected.length})
              </option>
            </select>
          </label>
          <label>
            Output
            <select
              aria-label="Output"
              value={format}
              disabled={busy}
              onChange={(e) => setFormat(e.target.value as Artefact["format"])}
            >
              <option value="journey">
                Learning journey — original prompts and responses
              </option>
              <option value="explanation">Integrated explanation</option>
              <option value="structured">Structured artefact</option>
            </select>
          </label>
          {format === "structured" && (
            <label>
              Document structure
              <input
                value={structure}
                required
                disabled={busy}
                onChange={(e) => setStructure(e.target.value)}
                placeholder="Study notes, research brief, tutorial…"
              />
            </label>
          )}
          <p className="muted small">
            {format === "journey"
              ? "Learning journeys preserve the original text and require no model request."
              : settings.provider === "demo"
                ? "Demo synthesis groups takeaways. Choose ChatGPT or Ollama for a model-generated explanation."
                : "Your model will organise the sources and retain links to each Note."}{" "}
            Earlier artefacts are kept when you consolidate again. New synthesis
            uses the latest version of each selected Note.
          </p>
          {error && <p className="form-error">{error}</p>}
          {busy && (
            <div className="generation-progress" role="status">
              <LoaderCircle className="spin" size={18} aria-hidden="true" />
              Synthesising your sources…
            </div>
          )}
          <div className="modal-actions">
            {busy && (
              <button className="secondary" type="button" onClick={onCancel}>
                Cancel generation
              </button>
            )}
            <button className="primary" disabled={busy}>
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Sparkles size={15} />
              )}{" "}
              {busy ? "Synthesising…" : "Create artefact"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
