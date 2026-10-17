import { ArrowUpRight, GitBranch, LoaderCircle, Square, X } from "lucide-react";
import { type Dispatch, type FormEvent, type SetStateAction } from "react";
import { bridge } from "../../bridge";
import { ResearchInputs } from "../../components/ResearchInputs";
import { ThinkingEffort } from "../../components/ThinkingEffort";
import {
  ancestry,
  buildContext,
  estimateTokens,
  versionFiles,
  versionPath,
} from "../../core/context";
import { highlightLabel, type Board, type Settings } from "../../core/model";
import { type ModelChoice } from "../../core/providers";
import { errorText } from "../workspace/browser-actions";
import { type ComposerDraft } from "./types";
import { GenerationView } from "../generation/GenerationView";
import { type GenerationPreview } from "../generation/useGeneration";

interface Props {
  composer: ComposerDraft;
  busy: boolean;
  setComposer: Dispatch<SetStateAction<ComposerDraft | null>>;
  submitPrompt: (event: FormEvent) => Promise<void>;
  prompt: string;
  setPrompt: Dispatch<SetStateAction<string>>;
  settings: Settings;
  composerDiscovering: boolean;
  composerModelOptions: Map<string, string>;
  discoverComposerModels: () => Promise<void>;
  composerModels: ModelChoice[];
  board: Board | undefined;
  setError: Dispatch<SetStateAction<string>>;
  setComposerReading: Dispatch<SetStateAction<boolean>>;
  error: string;
  onCancel: () => void;
  composerReading: boolean;
  progress?: GenerationPreview;
}
export function NoteComposer({
  composer,
  busy,
  setComposer,
  submitPrompt,
  prompt,
  setPrompt,
  settings,
  composerDiscovering,
  composerModelOptions,
  discoverComposerModels,
  composerModels,
  board,
  setError,
  setComposerReading,
  error,
  onCancel,
  composerReading,
  progress,
}: Props) {
  if (busy && progress)
    return (
      <GenerationView
        question={prompt.trim()}
        progress={progress}
        synthetic={settings.provider === "demo"}
        onCancel={onCancel}
      />
    );
  return (
    <div className="modal-backdrop">
      <section
        className="modal composer"
        role="dialog"
        aria-modal="true"
        aria-label={
          composer.highlight ? "Explore a passage" : "Start an inquiry"
        }
      >
        <div className="panel-head">
          <span>
            <GitBranch size={16} />
            {composer.highlight ? "FOLLOW A NEW THREAD" : "START AN INQUIRY"}
          </span>
          <button
            aria-label="Close composer"
            disabled={busy}
            onClick={() => {
              setComposer(null);
            }}
          >
            <X size={18} />
          </button>
        </div>
        <h2>
          {composer.highlight
            ? "What would you like to explore?"
            : "Begin with a question."}
        </h2>
        {composer.highlight && (
          <blockquote>{highlightLabel(composer.highlight)}</blockquote>
        )}
        <form onSubmit={submitPrompt}>
          <label>
            Your question
            <textarea
              autoFocus
              required
              maxLength={30000}
              value={prompt}
              disabled={busy}
              onChange={(e) => setPrompt(e.target.value)}
              aria-describedby="prompt-keyboard-hint"
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  e.nativeEvent.keyCode !== 229
                ) {
                  e.preventDefault();
                  if (!e.repeat && !busy && prompt.trim())
                    e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="What are you curious about?"
            />
          </label>
          <p id="prompt-keyboard-hint" className="muted keyboard-hint">
            Enter to send · Shift+Enter for a new line
          </p>
          {settings.provider !== "demo" && (
            <>
              <div className="revision-model">
                <label>
                  Model
                  <select
                    aria-label="Note model"
                    value={composer.model}
                    disabled={busy || composerDiscovering}
                    onChange={(event) =>
                      setComposer(
                        (current) =>
                          current && {
                            ...current,
                            model: event.target.value,
                            reasoningEffort: undefined,
                          },
                      )
                    }
                  >
                    {[...composerModelOptions].map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy || composerDiscovering}
                  onClick={() => void discoverComposerModels()}
                >
                  {composerDiscovering
                    ? "Discovering…"
                    : settings.provider === "chatgpt"
                      ? "Refresh models"
                      : "Discover models"}
                </button>
              </div>
              {settings.provider === "chatgpt" && (
                <ThinkingEffort
                  ariaLabel="Note thinking effort"
                  choices={composerModels}
                  model={composer.model}
                  value={composer.reasoningEffort}
                  disabled={busy || composerDiscovering}
                  onChange={(reasoningEffort) =>
                    setComposer(
                      (current) =>
                        current && {
                          ...current,
                          reasoningEffort,
                        },
                    )
                  }
                />
              )}
              <p className="muted">
                Applies to this Note only. Saved provider settings stay the
                same.
                {settings.provider === "chatgpt" &&
                  " Higher thinking effort can take longer and use more of your plan. Supported levels vary by model."}
              </p>
            </>
          )}
          {composer.highlight &&
            board &&
            ancestry(board, composer.highlight.sourceId).length >=
              settings.depthReminder && (
              <p className="reminder">
                This branch will reach{" "}
                {ancestry(board, composer.highlight.sourceId).length} steps.
                Consider consolidating when you are ready; you can continue
                exploring.
              </p>
            )}
          <div className="composer-meta">
            <span>
              {settings.provider === "demo" ? "Synthetic demo" : composer.model}{" "}
              {settings.provider === "chatgpt" && composer.reasoningEffort
                ? `· ${composer.reasoningEffort} thinking `
                : ""}
              · ~
              {board
                ? estimateTokens(
                    buildContext(
                      board,
                      prompt,
                      composer.highlight,
                      settings.customInstructions,
                      composer.files,
                    ),
                  ).toLocaleString()
                : 0}{" "}
              context tokens
            </span>
            {settings.provider === "chatgpt" ? (
              <span>
                Using ChatGPT plan ·{" "}
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    void bridge
                      .chatgptUsage()
                      .catch((e) => setError(errorText(e)))
                  }
                >
                  Manage usage
                </button>
              </span>
            ) : (
              <span>History stays complete</span>
            )}
          </div>
          {settings.provider === "chatgpt" && (
            <ResearchInputs
              files={composer.files}
              existing={
                composer.highlight
                  ? versionPath(
                      board!,
                      composer.highlight.sourceId,
                      composer.highlight.versionId,
                    ).flatMap(({ version }) => versionFiles(version))
                  : []
              }
              onChange={(files) =>
                setComposer((current) => current && { ...current, files })
              }
              webSearch={composer.webSearch}
              onSearchChange={(webSearch) =>
                setComposer((current) => current && { ...current, webSearch })
              }
              disabled={busy || composerDiscovering}
              onLoading={setComposerReading}
            />
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {busy && (
            <div className="generation-progress" role="status">
              <LoaderCircle className="spin" size={18} aria-hidden="true" />
              Generating your response…
            </div>
          )}
          <div className="modal-actions">
            {busy ? (
              <button
                type="button"
                className="secondary"
                data-modal-focus
                onClick={onCancel}
              >
                <Square size={13} /> Cancel generation
              </button>
            ) : (
              <button
                type="button"
                className="secondary"
                onClick={() => setComposer(null)}
              >
                Cancel
              </button>
            )}
            <button
              className="primary"
              disabled={
                busy || composerDiscovering || composerReading || !prompt.trim()
              }
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <ArrowUpRight size={16} />
              )}{" "}
              {busy
                ? "Exploring…"
                : composer.highlight
                  ? "Create branch"
                  : "Ask & explore"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
