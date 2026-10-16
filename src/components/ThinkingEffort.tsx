import { ReasoningEffortSchema, type ReasoningEffort } from "../core/model";
import { type ModelChoice } from "../core/providers";

const labels: Record<ReasoningEffort, string> = {
  none: "None",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Maximum",
  ultra: "Ultra",
};
const label = (value: string) => labels[value as ReasoningEffort] || value;

export function ThinkingEffort({
  choices,
  model,
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  choices: ModelChoice[];
  model: string;
  value?: ReasoningEffort;
  onChange: (value?: ReasoningEffort) => void;
  disabled: boolean;
  ariaLabel: string;
}) {
  const metadata = choices.find(
    (choice) => typeof choice !== "string" && choice.id === model,
  );
  const levels =
    typeof metadata === "object" ? metadata.reasoningEfforts : undefined;
  const defaultLevel =
    typeof metadata === "object" ? metadata.defaultReasoningEffort : undefined;
  const unlisted = value && !levels?.some((level) => level.effort === value);
  return (
    <label>
      Thinking effort
      <select
        aria-label={ariaLabel}
        value={value ?? ""}
        disabled={disabled || !model}
        onChange={(event) =>
          onChange(
            event.target.value
              ? ReasoningEffortSchema.parse(event.target.value)
              : undefined,
          )
        }
      >
        <option value="">
          {defaultLevel
            ? `Model default (${label(defaultLevel)})`
            : "Model default"}
        </option>
        {unlisted && (
          <option value={value} disabled>
            {label(value)} (support unconfirmed)
          </option>
        )}
        {levels?.map((level) => (
          <option
            key={level.effort}
            value={level.effort}
            title={level.description}
            disabled={!ReasoningEffortSchema.safeParse(level.effort).success}
          >
            {label(level.effort)}
          </option>
        ))}
      </select>
      {model && levels === undefined && (
        <span className="muted small">
          Thinking levels were not provided for this model. Refresh models to
          check again.
        </span>
      )}
      {unlisted && (
        <span className="muted small">
          Your selected level is retained, but is not listed in this model’s
          catalogue. Choose Model default or a listed level to change it.
        </span>
      )}
    </label>
  );
}
