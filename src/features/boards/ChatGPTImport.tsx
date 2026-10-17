import { X } from "lucide-react";
import { useRef, useState } from "react";
import {
  importChatGPTPath,
  MAX_EXPORT_BYTES,
  parseChatGPTExport,
  previewChatGPTPath,
  type ImportConversation,
} from "../../core/chatgpt-import";
import type { Board } from "../../core/model";

export function ChatGPTImport({
  onClose,
  onImport,
  onSaving,
}: {
  onClose: () => void;
  onImport: (board: Board) => Promise<void>;
  onSaving: (saving: boolean) => void;
}) {
  const [conversations, setConversations] = useState<ImportConversation[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number>();
  const [pathId, setPathId] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const pending = useRef<{ key: string; board: Board } | undefined>(undefined);
  const loadSequence = useRef(0);
  const conversation =
    selected === undefined ? undefined : conversations[selected];
  let preview,
    pathError = "";
  if (conversation && pathId) {
    try {
      preview = previewChatGPTPath(conversation, pathId);
    } catch (e) {
      pathError = (e as Error).message;
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Import ChatGPT conversation"
      >
        <div className="panel-head">
          <span>IMPORT CHATGPT CONVERSATION</span>
          <button
            aria-label="Close ChatGPT import"
            disabled={saving}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="import-body">
          <h2>Bring a conversation into your Board.</h2>
          <p className="muted">
            Choose an extracted conversations.json file. Text-only import runs
            locally, without sign-in or inference. Your original ChatGPT
            instructions, memory and hidden context are not reproduced.
          </p>
          <fieldset disabled={saving} className="appearance-fields">
            <label>
              ChatGPT export file
              <input
                type="file"
                accept="application/json,.json"
                aria-label="ChatGPT export file"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const sequence = ++loadSequence.current;
                  setError("");
                  setConversations([]);
                  setSelected(undefined);
                  setPathId("");
                  pending.current = undefined;
                  setLoading(true);
                  try {
                    if (file.size > MAX_EXPORT_BYTES)
                      throw new Error(
                        "ChatGPT export files must be at most 50 MiB. No content was truncated.",
                      );
                    const parsed = parseChatGPTExport(await file.text());
                    if (sequence === loadSequence.current)
                      setConversations(parsed);
                  } catch (e) {
                    if (sequence === loadSequence.current)
                      setError((e as Error).message);
                  } finally {
                    if (sequence === loadSequence.current) setLoading(false);
                  }
                }}
              />
            </label>
            {loading && <p role="status">Reading export…</p>}
            {!!conversations.length && (
              <>
                <label>
                  Search conversations
                  <input
                    aria-label="Search conversations"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label>
                  Conversation
                  <select
                    aria-label="Conversation"
                    value={selected ?? ""}
                    onChange={(e) => {
                      const index =
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value);
                      setSelected(index);
                      setPathId(
                        index === undefined
                          ? ""
                          : conversations[index].defaultPathId || "",
                      );
                      setTitle(
                        index === undefined
                          ? ""
                          : conversations[index].title.slice(0, 200),
                      );
                      setError("");
                    }}
                  >
                    <option value="">Choose a conversation</option>
                    {conversations.map(
                      (c, index) =>
                        (index === selected ||
                          c.title
                            .toLocaleLowerCase()
                            .includes(search.toLocaleLowerCase())) && (
                          <option key={index} value={index}>
                            {c.title} ·{" "}
                            {c.createdAt
                              ? new Date(c.createdAt).toLocaleDateString(
                                  "en-AU",
                                )
                              : "Date unknown"}{" "}
                            · {c.pathIds.length} paths
                          </option>
                        ),
                    )}
                  </select>
                </label>
              </>
            )}
            {conversation && (
              <>
                <label>
                  Conversation path
                  <select
                    aria-label="Conversation path"
                    value={pathId}
                    onChange={(e) => {
                      setPathId(e.target.value);
                      setError("");
                    }}
                  >
                    <option value="">Choose a path</option>
                    {conversation.pathIds.map((id, index) => {
                      let label: string;
                      try {
                        const p = previewChatGPTPath(conversation, id);
                        label = `${p.turns.length} Notes · ${p.turns.at(-1)!.prompt.slice(0, 65)}`;
                      } catch (e) {
                        label = `Unsupported: ${(e as Error).message}`;
                      }
                      return (
                        <option key={id} value={id}>
                          Path {index + 1}
                          {id === conversation.defaultPathId
                            ? " (current)"
                            : ""}
                          : {label}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label>
                  Board title
                  <input
                    aria-label="Imported Board title"
                    maxLength={200}
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setError("");
                    }}
                  />
                </label>
                <p>
                  Only this path will be imported. Other paths will remain in
                  your export file.
                </p>
              </>
            )}
          </fieldset>
          {pathError && (
            <p className="form-error" role="alert">
              {pathError}
            </p>
          )}
          {preview && (
            <div className="import-preview">
              <p>
                {preview.turns.length} Notes in chronological order.{" "}
                {preview.excludedInstructions} system/developer records
                excluded; these will not be used as instructions.
              </p>
              {preview.turns.map((turn, index) => (
                <article key={turn.responseMessageId}>
                  <h3>Note {index + 1}</h3>
                  <strong>Question</strong>
                  <pre>{turn.prompt}</pre>
                  <strong>Answer</strong>
                  <pre>{turn.response}</pre>
                </article>
              ))}
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button className="secondary" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={!preview || !title.trim() || saving || loading}
            onClick={async () => {
              if (!conversation || !pathId) return;
              setSaving(true);
              onSaving(true);
              setError("");
              try {
                const key = JSON.stringify([selected, pathId, title.trim()]);
                if (pending.current?.key !== key)
                  pending.current = {
                    key,
                    board: importChatGPTPath(conversation, pathId, title),
                  };
                await onImport(pending.current.board);
              } catch (e) {
                setError(
                  `Import could not be saved: ${(e as Error).message}. The preview is retained for retry.`,
                );
              } finally {
                setSaving(false);
                onSaving(false);
              }
            }}
          >
            {saving ? "Importing…" : "Import conversation"}
          </button>
        </div>
      </section>
    </div>
  );
}
