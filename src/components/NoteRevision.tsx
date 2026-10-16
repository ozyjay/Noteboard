import { useEffect, useState, type FormEvent } from "react";
import { X, LoaderCircle } from "lucide-react";
import { bridge } from "../bridge";
import { useChatGPTModels } from "../model-discovery";
import {
  type Board,
  type Note,
  type Settings,
  type ResponseVersion,
  type Message,
  versionPrompt,
  uid,
  now,
} from "../core/model";
import {
  revisionContext,
  improvementContext,
  improvementPrompt,
  estimateTokens,
  versionFiles,
  versionPath,
} from "../core/context";
import {
  providerMessages,
  type GenerationResult,
  type ModelChoice,
} from "../core/providers";
import { ResearchInputs } from "./ResearchInputs";
import { type Attachment, combineFiles } from "../core/research";

export type RevisionMode = "prompt" | "regenerate" | "edit" | "improve";
export function NoteRevision({
  board,
  note,
  versionId,
  mode,
  settings,
  busy,
  onGenerate,
  onSave,
  onClose,
  onCancel,
}: {
  board: Board;
  note: Note;
  versionId: string;
  mode: RevisionMode;
  settings: Settings;
  busy: boolean;
  onGenerate: (
    messages: Message[],
    settings: Settings,
  ) => Promise<GenerationResult>;
  onSave: (version: ResponseVersion) => void;
  onClose: () => void;
  onCancel: () => void;
}) {
  const base = note.versions.find((v) => v.id === versionId)!;
  const [prompt, setPrompt] = useState(versionPrompt(note, base));
  const [text, setText] = useState(base.text);
  const [reviewPrompt, setReviewPrompt] = useState(improvementPrompt);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [readingFiles, setReadingFiles] = useState(false);
  const [webSearch, setWebSearch] = useState(
    settings.provider === "chatgpt" && settings.webSearch !== false,
  );
  const [model, setModel] = useState(settings.model);
  const [reasoningEffort, setReasoningEffort] = useState(
    settings.reasoningEffort,
  );
  const [localChoices, setChoices] = useState<ModelChoice[]>([]);
  const [localDiscovering, setDiscovering] = useState(false);
  const catalogue = useChatGPTModels(settings, mode !== "edit");
  const choices =
    settings.provider === "chatgpt" ? catalogue.choices : localChoices;
  const discovering =
    settings.provider === "chatgpt" ? catalogue.loading : localDiscovering;
  const [error, setError] = useState("");
  useEffect(() => {
    if (catalogue.error) setError(catalogue.error);
  }, [catalogue.error]);
  const title =
    mode === "prompt"
      ? "Edit prompt and regenerate"
      : mode === "improve"
        ? "Sanity check & improve"
        : mode === "edit"
          ? "Edit response"
          : "Regenerate response";
  const requestSettings = {
    ...settings,
    model,
    reasoningEffort,
    webSearch,
  };
  async function discover() {
    if (settings.provider === "chatgpt") {
      setError("");
      await catalogue.refresh();
      return;
    }
    setDiscovering(true);
    setError("");
    try {
      setChoices(await bridge.models(requestSettings));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDiscovering(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      busy ||
      discovering ||
      readingFiles ||
      !prompt.trim() ||
      (mode === "edit" && !text.trim()) ||
      (mode === "improve" && !reviewPrompt.trim())
    )
      return;
    setError("");
    try {
      const question = mode === "prompt" ? prompt.trim() : prompt;
      if (question.length > 30000)
        throw new Error(
          "The prompt exceeds the 30,000-character revision limit. Edit it explicitly before regenerating; nothing has been truncated.",
        );
      const { messages, ancestryVersions } =
        mode === "improve"
          ? improvementContext(
              board,
              note.id,
              base.id,
              reviewPrompt.trim(),
              settings.customInstructions,
              files,
            )
          : revisionContext(
              board,
              note.id,
              base.id,
              question,
              settings.customInstructions,
              files,
            );
      const common = {
        id: uid(),
        createdAt: now(),
        prompt: question,
        ancestryVersions,
        basedOnVersionId: base.id,
        files: combineFiles(versionFiles(base), files).length
          ? combineFiles(versionFiles(base), files)
          : undefined,
      };
      if (mode === "edit") {
        onSave({
          ...common,
          origin: "edited",
          text,
          provider: "human",
          model: "editor",
          context: null,
          estimatedTokens: null,
        });
      } else {
        const context = providerMessages(
          messages,
          settings.provider,
          webSearch,
        );
        const result = await onGenerate(context, requestSettings);
        onSave({
          ...common,
          origin: "generated",
          text: result.text,
          provider: settings.provider,
          model: result.model,
          reasoningEffort: result.reasoningEffort,
          webResearch: result.webResearch,
          context,
          estimatedTokens: estimateTokens(context),
          usage: result.usage,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  const modelOptions = new Map([
    [settings.model, settings.model || "Provider default"],
  ]);
  for (const choice of choices)
    modelOptions.set(
      typeof choice === "string" ? choice : choice.id,
      typeof choice === "string" ? choice : choice.name,
    );
  return (
    <div className="modal-backdrop">
      <section
        className="modal revision-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="panel-head">
          <span>REVISE NOTE</span>
          <button
            aria-label="Close Note revision"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <h2>{title}</h2>
        <p className="muted">
          A new version will be added. Existing branches and synthesis keep
          their original source versions.
        </p>
        <form onSubmit={submit}>
          <label>
            Prompt
            <textarea
              aria-label="Revised prompt"
              autoFocus={mode === "prompt"}
              required
              maxLength={30000}
              value={prompt}
              disabled={busy || mode !== "prompt"}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          {mode === "improve" && (
            <label>
              Follow-up prompt
              <textarea
                aria-label="Improvement prompt"
                autoFocus
                required
                maxLength={30000}
                value={reviewPrompt}
                disabled={busy}
                onChange={(event) => setReviewPrompt(event.target.value)}
              />
              <span className="muted">
                Reviews the viewed response and returns a complete improved
                answer as a new version.
              </span>
            </label>
          )}
          {mode === "edit" ? (
            <>
              <p className="muted">
                Saved as Human-edited. No model request is made. Markdown and
                LaTeX are supported.
              </p>
              <label>
                Response
                <textarea
                  className="response-editor"
                  aria-label="Revised response"
                  autoFocus
                  required
                  value={text}
                  disabled={busy}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <p className="muted">
                {settings.provider === "demo"
                  ? "Synthetic demo response"
                  : `Provider: ${settings.provider}`}
                . Uses the complete ancestral path for the source version and
                your current response preferences.
              </p>
              {base.origin === "imported" && (
                <p className="muted">
                  The imported original’s generation context is unknown. This
                  creates a new request from the preserved visible conversation.
                </p>
              )}
              {settings.provider !== "demo" && (
                <div className="revision-model">
                  <label>
                    Model
                    <select
                      aria-label="Revision model"
                      disabled={busy || discovering}
                      value={model}
                      onChange={(e) => {
                        setModel(e.target.value);
                        setReasoningEffort(undefined);
                      }}
                    >
                      {[...modelOptions].map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="secondary"
                    type="button"
                    disabled={busy || discovering}
                    onClick={() => void discover()}
                  >
                    {discovering
                      ? "Discovering…"
                      : settings.provider === "chatgpt"
                        ? "Refresh models"
                        : "Discover models"}
                  </button>
                </div>
              )}
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {mode !== "edit" && settings.provider === "chatgpt" && (
            <ResearchInputs
              files={files}
              existing={versionPath(board, note.id, base.id).flatMap(
                ({ version }) => versionFiles(version),
              )}
              onChange={setFiles}
              webSearch={webSearch}
              onSearchChange={setWebSearch}
              disabled={busy || discovering}
              onLoading={setReadingFiles}
            />
          )}
          {busy && (
            <div className="generation-progress" role="status">
              <LoaderCircle className="spin" size={18} />
              Generating a new version…
            </div>
          )}
          <div className="modal-actions">
            <button
              className="secondary"
              type="button"
              onClick={busy ? onCancel : onClose}
            >
              {busy ? "Cancel generation" : "Cancel"}
            </button>
            <button
              className="primary"
              disabled={
                busy ||
                discovering ||
                readingFiles ||
                !prompt.trim() ||
                (mode === "edit" && !text.trim()) ||
                (mode === "improve" && !reviewPrompt.trim())
              }
            >
              {mode === "edit"
                ? "Save edited version"
                : mode === "improve"
                  ? "Check & improve"
                  : "Generate new version"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
