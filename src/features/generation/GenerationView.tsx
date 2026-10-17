import { LoaderCircle, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { Markdown } from "../../components/Markdown";
import { type GenerationPreview } from "./useGeneration";

const labels = {
  sending: "Sending request…",
  working: "Working…",
  thinking: "Thinking…",
  searching: "Searching the web…",
  writing: "Writing response…",
};

export function GenerationView({
  question,
  progress,
  synthetic,
  onCancel,
}: {
  question: string;
  progress: GenerationPreview;
  synthetic: boolean;
  onCancel: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () =>
      setElapsed(Math.floor((Date.now() - progress.startedAt) / 1000));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [progress.startedAt]);
  return (
    <div className="modal-backdrop generation-backdrop">
      <section
        className="modal generation-view"
        role="dialog"
        aria-modal="true"
        aria-label="Generating Note"
      >
        <div className="generation-heading">
          <span>
            {synthetic ? "SYNTHETIC DEMO · NOT MODEL INFERENCE" : "NEW NOTE"}
          </span>
          <button
            type="button"
            className="secondary"
            data-modal-focus
            disabled={progress.stopping}
            onClick={onCancel}
          >
            <Square size={13} /> {progress.stopping ? "Stopping…" : "Stop"}
          </button>
        </div>
        <h2>{question}</h2>
        <div className="generation-activity">
          <span role="status">
            <LoaderCircle className="spin" size={16} aria-hidden="true" />
            {progress.stopping
              ? "Stopping…"
              : synthetic
                ? "Preparing synthetic demo…"
                : labels[progress.activity]}
          </span>
          <span aria-label="Elapsed time">{elapsed}s</span>
        </div>
        {progress.text && (
          <div
            className="reader-response prose generation-response"
            aria-label="Response preview"
          >
            <Markdown text={progress.text} onSource={() => {}} />
          </div>
        )}
        <p className="muted">
          {progress.text
            ? "Response in progress · saved only when complete."
            : ""}
        </p>
      </section>
    </div>
  );
}
