import { useEffect, useRef, useState } from "react";
import {
  combineFiles,
  fileAccept,
  fileTypes,
  MAX_FILE_BYTES,
  MAX_REQUEST_FILE_BYTES,
  type Attachment,
  type WebResearch,
} from "../core/research";
import { bridge } from "../bridge";

export function ResearchInputs({
  files,
  onChange,
  existing = [],
  webSearch,
  onSearchChange,
  disabled,
  onLoading,
}: {
  files: Attachment[];
  existing?: Attachment[];
  onChange: (files: Attachment[]) => void;
  webSearch: boolean;
  onSearchChange: (enabled: boolean) => void;
  disabled: boolean;
  onLoading: (loading: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function attach(selected: File[]) {
    setLoading(true);
    onLoading(true);
    setError("");
    try {
      if (
        [...selected, ...files, ...existing].reduce(
          (sum, file) => sum + file.size,
          0,
        ) > MAX_REQUEST_FILE_BYTES
      )
        throw new Error(
          "Attachments exceed the 10 MB request limit, including history.",
        );
      if (selected.length + files.length + existing.length > 5)
        throw new Error(
          "Attach up to five files per request, including inherited files.",
        );
      const added = await Promise.all(
        selected.map(async (file): Promise<Attachment> => {
          const mime =
            fileTypes[file.name.split(".").at(-1)?.toLowerCase() ?? ""];
          if (!mime) throw new Error(`Unsupported file type: ${file.name}`);
          if (!file.size || file.size > MAX_FILE_BYTES)
            throw new Error(
              `${file.name}: files must be non-empty and no larger than 5 MB.`,
            );
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () =>
              reject(new Error(`Could not read ${file.name}`));
            reader.readAsDataURL(new Blob([file], { type: mime }));
          });
          return { name: file.name, size: file.size, data };
        }),
      );
      combineFiles(existing, files, added);
      if (mounted.current) onChange(combineFiles(files, added));
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mounted.current) {
        setLoading(false);
        onLoading(false);
      }
    }
  }
  return (
    <div className="research-inputs">
      <label className="research-search">
        <input
          type="checkbox"
          aria-label="Allow web search"
          checked={webSearch}
          disabled={disabled || loading}
          onChange={(event) => onSearchChange(event.target.checked)}
        />{" "}
        Allow web search when useful
      </label>
      <label>
        Attach files
        <input
          type="file"
          aria-label="Attach files"
          accept={fileAccept}
          multiple
          disabled={disabled || loading}
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (selected.length) void attach(selected);
          }}
        />
      </label>
      <p className="muted">
        PDF, Word, PowerPoint, Excel and text files. Up to 5 MB each, 10 MB and
        five files per request, including history. Files are sent to ChatGPT and
        saved with the Board and its exports. File token estimates are
        approximate; model support varies.
      </p>
      {[...existing, ...files].some((file) =>
        /\.(?:csv|tsv|xlsx)$/i.test(file.name),
      ) && (
        <p className="muted">
          ChatGPT processes spreadsheets using summaries and up to the first
          1,000 rows per sheet. For full-data reading, provide a text document
          instead.
        </p>
      )}
      {[...existing, ...files].some((file) =>
        /\.(?:docx|pptx)$/i.test(file.name),
      ) && (
        <p className="muted">
          Word and PowerPoint inputs provide extracted text. Attach a PDF to
          include page images and diagrams.
        </p>
      )}
      {!!existing.length && (
        <p className="muted">
          Retained files: {existing.map((file) => file.name).join(", ")}
        </p>
      )}
      {!!files.length && (
        <ul className="attachment-list">
          {files.map((file, index) => (
            <li key={index}>
              <span>
                {file.name} · {Math.ceil(file.size / 1024)} KB
              </span>
              <button
                type="button"
                disabled={disabled || loading}
                aria-label={`Remove ${file.name}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {loading && <p role="status">Reading files…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function ResearchRecord({
  files = [],
  research,
}: {
  files?: Attachment[];
  research?: WebResearch;
}) {
  const [error, setError] = useState("");
  if (!files.length && !research) return null;
  return (
    <div className="research-record">
      {research && (
        <p>
          {research.searched
            ? "Web search used"
            : research.requested
              ? "Web search enabled · not used"
              : "Web search disabled"}
        </p>
      )}
      {!!files.length && (
        <p>Attached files: {files.map((file) => file.name).join(", ")}</p>
      )}
      {!!research?.citations.length && (
        <ol aria-label="Web sources">
          {research.citations.map((citation, index) => (
            <li key={index}>
              <button
                type="button"
                className="source-link"
                title={citation.url}
                onClick={() => {
                  void bridge
                    .openWebLink?.(citation.url)
                    .catch(() =>
                      setError("Could not open this source in your browser."),
                    );
                }}
              >
                {citation.title || citation.url}
              </button>
            </li>
          ))}
        </ol>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
