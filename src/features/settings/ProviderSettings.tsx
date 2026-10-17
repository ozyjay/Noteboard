import { Check, Settings2, X } from "lucide-react";
import { type Dispatch, type FormEvent, type SetStateAction } from "react";
import { desktop } from "../../bridge";
import { ThinkingEffort } from "../../components/ThinkingEffort";
import {
  defaultCustomInstructions,
  MAX_CUSTOM_INSTRUCTIONS,
} from "../../core/instructions";
import { type Settings } from "../../core/model";
import { type ModelChoice } from "../../core/providers";
import { ChatGPTSettings } from "./ChatGPTSettings";

interface Props {
  accountBusy: boolean;
  setProviderOpen: Dispatch<SetStateAction<boolean>>;
  saveSettings: (event: FormEvent) => Promise<void>;
  settingsDraft: Settings;
  setModels: Dispatch<SetStateAction<ModelChoice[]>>;
  setError: Dispatch<SetStateAction<string>>;
  setSettingsDraft: Dispatch<SetStateAction<Settings>>;
  setAccountBusy: Dispatch<SetStateAction<boolean>>;
  discovering: boolean;
  models: ModelChoice[];
  discover: () => Promise<void>;
  error: string;
}
export function ProviderSettings({
  accountBusy,
  setProviderOpen,
  saveSettings,
  settingsDraft,
  setModels,
  setError,
  setSettingsDraft,
  setAccountBusy,
  discovering,
  models,
  discover,
  error,
}: Props) {
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Provider settings"
      >
        <div className="panel-head">
          <span>
            <Settings2 size={16} /> PROVIDER SETTINGS
          </span>
          <button
            aria-label="Close provider settings"
            disabled={accountBusy}
            onClick={() => setProviderOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <h2>Your model. Your inquiry.</h2>
        <p className="muted">
          Choose the connection used for your next Note. Existing Notes keep
          their original model and context.
        </p>
        <form onSubmit={saveSettings}>
          <label>
            Provider
            <select
              aria-label="Provider"
              value={settingsDraft.provider}
              disabled={accountBusy}
              onChange={(e) => {
                setModels([]);
                setError("");
                setSettingsDraft((s) => ({
                  ...s,
                  model: "",
                  reasoningEffort: undefined,
                  provider: e.target.value as Settings["provider"],
                }));
              }}
            >
              <option value="demo">Demo — synthetic responses</option>
              <option value="chatgpt" disabled={!desktop}>
                ChatGPT — use your plan
              </option>
              <option value="ollama" disabled={!desktop}>
                Ollama — local inference
              </option>
            </select>
          </label>
          {settingsDraft.provider === "chatgpt" && (
            <ChatGPTSettings
              accountId={settingsDraft.chatgptAccountId}
              onAccount={(id) => {
                setError("");
                setModels([]);
                setSettingsDraft((s) => ({
                  ...s,
                  chatgptAccountId: id,
                  model: "",
                  reasoningEffort: undefined,
                }));
              }}
              onError={setError}
              onBusy={setAccountBusy}
            />
          )}
          {settingsDraft.provider === "ollama" && (
            <>
              <label>
                Local server address
                <input
                  value={settingsDraft.endpoint}
                  required
                  onChange={(e) =>
                    setSettingsDraft((s) => ({
                      ...s,
                      endpoint: e.target.value,
                    }))
                  }
                />
              </label>
            </>
          )}
          {settingsDraft.provider !== "demo" && (
            <>
              <label>
                Model
                <div className="model-input">
                  {settingsDraft.provider === "chatgpt" ? (
                    <select
                      required
                      aria-label="Model"
                      value={settingsDraft.model}
                      disabled={discovering || accountBusy}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s,
                          model: e.target.value,
                          reasoningEffort: undefined,
                        }))
                      }
                    >
                      <option value="">Select a model</option>
                      {settingsDraft.model &&
                        !models.some(
                          (m) =>
                            (typeof m === "string" ? m : m.id) ===
                            settingsDraft.model,
                        ) && (
                          <option value={settingsDraft.model}>
                            {settingsDraft.model}
                          </option>
                        )}
                      {models.map((m) => {
                        const id = typeof m === "string" ? m : m.id;
                        return (
                          <option key={id} value={id}>
                            {typeof m === "string" ? m : m.name}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      required
                      list="installed-models"
                      aria-label="Model"
                      placeholder="Select or enter an installed model"
                      value={settingsDraft.model}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s,
                          model: e.target.value,
                        }))
                      }
                    />
                  )}
                  <button
                    type="button"
                    className="secondary"
                    disabled={discovering || accountBusy}
                    onClick={discover}
                  >
                    {discovering
                      ? "Checking…"
                      : settingsDraft.provider === "chatgpt"
                        ? "Refresh models"
                        : "Discover"}
                  </button>
                </div>
                <datalist id="installed-models">
                  {models.map((m) => {
                    const id = typeof m === "string" ? m : m.id;
                    return <option key={id} value={id} />;
                  })}
                </datalist>
              </label>
            </>
          )}
          {settingsDraft.provider === "chatgpt" && (
            <>
              <label className="research-search">
                <input
                  type="checkbox"
                  aria-label="Enable web search by default"
                  checked={settingsDraft.webSearch !== false}
                  disabled={accountBusy}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      webSearch: event.target.checked,
                    }))
                  }
                />
                Enable web search by default for Notes
              </label>
              <ThinkingEffort
                ariaLabel="Thinking effort"
                choices={models}
                model={settingsDraft.model}
                value={settingsDraft.reasoningEffort}
                disabled={accountBusy || discovering}
                onChange={(reasoningEffort) =>
                  setSettingsDraft((s) => ({
                    ...s,
                    reasoningEffort,
                  }))
                }
              />
              <p className="muted">
                Higher effort can take longer and use more of your plan.
                Supported levels vary by model; Model default lets the model
                choose.
              </p>
            </>
          )}
          <label>
            Custom instructions
            <textarea
              aria-label="Custom instructions"
              maxLength={MAX_CUSTOM_INSTRUCTIONS}
              rows={8}
              value={settingsDraft.customInstructions}
              onChange={(e) =>
                setSettingsDraft((s) => ({
                  ...s,
                  customInstructions: e.target.value,
                }))
              }
            />
          </label>
          <p className="muted small">
            Apply to future Notes and generated synthesis across providers.
            Leave blank for the basic Noteboard guidance. Changes take effect
            when you save. Demo responses are scripted and do not follow these
            instructions.
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setSettingsDraft((s) => ({
                ...s,
                customInstructions: defaultCustomInstructions,
              }))
            }
          >
            Restore response preferences
          </button>
          <p className="muted small">
            Noteboard cannot browse the web or access your ChatGPT projects or
            personalisation. Instructions used for a response are recorded with
            it and included in Board exports.
          </p>
          <div className="form-columns">
            <label>
              Context budget (tokens)
              <input
                type="number"
                min={1024}
                max={1000000}
                required
                value={settingsDraft.contextLimit}
                onChange={(e) =>
                  setSettingsDraft((s) => ({
                    ...s,
                    contextLimit: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label>
              Depth reminder (steps)
              <input
                type="number"
                min={1}
                max={100}
                required
                value={settingsDraft.depthReminder}
                onChange={(e) =>
                  setSettingsDraft((s) => ({
                    ...s,
                    depthReminder: Number(e.target.value),
                  }))
                }
              />
            </label>
          </div>
          <p className="muted small">
            Budgets include a 1,024-token response reserve. Context is
            estimated; no historical Notes are silently removed. Ollama model
            capability is checked before generation.
          </p>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button className="primary" disabled={accountBusy}>
              Save settings <Check size={15} />
            </button>
            <button
              type="button"
              className="secondary"
              disabled={accountBusy}
              onClick={() => setProviderOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
