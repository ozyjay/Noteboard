import { response } from "../../core/model";
import type { ReaderPanelProps } from "./ReaderPanel";
type Props = Pick<ReaderPanelProps, "version" | "readingNote" | "note">;
export function GenerationRecord({ version, readingNote, note }: Props) {
  return (
    <details className="context-details">
      <summary>
        {version?.origin === "edited"
          ? "Human-edited revision · "
          : version?.origin === "imported"
            ? "Import record · "
            : "Generation record · ~"}
        {response(readingNote!).estimatedTokens?.toLocaleString() ?? "Unknown"}{" "}
        context tokens
      </summary>
      <p>
        {new Date(response(readingNote!).createdAt).toLocaleString("en-AU")}
        {version?.origin === "generated" &&
          version.usage &&
          ` · ${version.usage.input || 0} input / ${version.usage.output || 0} output tokens`}
        {version?.origin === "imported" && (
          <span>
            {" "}
            · Imported{" "}
            {new Date(version.provenance.importedAt).toLocaleString("en-AU")} ·
            Conversation {version.provenance.conversationId} · Question{" "}
            {version.provenance.promptMessageId} · Answer{" "}
            {version.provenance.responseMessageId} · Original question date:{" "}
            {version.provenance.promptCreatedAt || "Unknown"} · Original answer
            date: {version.provenance.responseCreatedAt || "Unknown"}
          </span>
        )}
        {version &&
          "basedOnVersionId" in version &&
          version.basedOnVersionId && (
            <span>
              {" "}
              · Based on v
              {note.versions.findIndex(
                (v) => v.id === version.basedOnVersionId,
              ) + 1}
              {version.origin === "edited"
                ? " · Human edit; no inference request"
                : ""}
            </span>
          )}
      </p>
      {(response(readingNote!).context ?? []).map((m, i) => (
        <div key={i}>
          <strong>{m.role}</strong>
          {!!m.files?.length && (
            <p>Files: {m.files.map((file) => file.name).join(", ")}</p>
          )}
          <pre>{m.content}</pre>
        </div>
      ))}
    </details>
  );
}
