import { Check, Palette, X } from "lucide-react";
import { defaultAppearance, type Appearance } from "../../core/model";

const noteStyles: Record<
  Appearance["noteStyle"],
  { label: string; description: string }
> = {
  classic: {
    label: "Classic",
    description: "Clean cards, subtle colour tabs and a quiet canvas.",
  },
  sticky: {
    label: "Sticky notes",
    description:
      "Scan Takeaways first, then open a Note for a focused read. Revision and navigation tools fold away.",
  },
  blueprint: {
    label: "Blueprint",
    description:
      "Compact nodes for mapping connections. Peek at a Takeaway in place without opening the reader.",
  },
  index: {
    label: "Index cards",
    description:
      "Wide reference cards with a number rail, version details and roomy ruled extracts.",
  },
  studio: {
    label: "Studio",
    description:
      "Large Takeaways for comparing ideas, a full-width reading action and fold-away reader tools.",
  },
};

export function AppearanceSettings({
  value,
  onChange,
  onClose,
  onSave,
  saving,
  error,
}: {
  value: Appearance;
  onChange: (value: Appearance) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  saving: boolean;
  error: string;
}) {
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Appearance settings"
      >
        <div className="panel-head">
          <span>
            <Palette size={16} /> APPEARANCE
          </span>
          <button
            aria-label="Close appearance settings"
            disabled={saving}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <h2>Make room for your thinking.</h2>
        <p className="muted">
          Preview changes as you go. Save to use this appearance across all your
          Boards.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onSave();
          }}
        >
          <fieldset className="appearance-fields" disabled={saving}>
            <label>
              Note style
              <select
                aria-label="Note style"
                aria-describedby="note-style-description"
                value={value.noteStyle}
                onChange={(event) =>
                  onChange({
                    ...value,
                    noteStyle: event.target.value as Appearance["noteStyle"],
                  })
                }
              >
                {Object.entries(noteStyles).map(([style, { label }]) => (
                  <option key={style} value={style}>
                    {label}
                  </option>
                ))}
              </select>
              <small id="note-style-description" className="muted">
                {noteStyles[value.noteStyle].description}
              </small>
            </label>
            <label>
              Theme
              <select
                aria-label="Theme"
                value={value.theme}
                onChange={(event) =>
                  onChange({
                    ...value,
                    theme: event.target.value as Appearance["theme"],
                  })
                }
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">Follow system</option>
              </select>
            </label>
            <label>
              Accent colour
              <select
                aria-label="Accent colour"
                value={value.accent}
                onChange={(event) =>
                  onChange({
                    ...value,
                    accent: event.target.value as Appearance["accent"],
                  })
                }
              >
                <option value="sage">Sage</option>
                <option value="blue">Blue</option>
                <option value="plum">Plum</option>
              </select>
            </label>
            <label>
              Reading text size
              <select
                aria-label="Reading text size"
                value={value.textSize}
                onChange={(event) =>
                  onChange({
                    ...value,
                    textSize: event.target.value as Appearance["textSize"],
                  })
                }
              >
                <option value="standard">Standard</option>
                <option value="large">Large</option>
                <option value="larger">Larger</option>
              </select>
            </label>
            <label>
              Interface font
              <select
                aria-label="Interface font"
                value={value.interfaceFont}
                onChange={(event) =>
                  onChange({
                    ...value,
                    interfaceFont: event.target
                      .value as Appearance["interfaceFont"],
                  })
                }
              >
                <option value="standard">Standard</option>
                <option value="monospace">Monospace (Consolas style)</option>
              </select>
            </label>
            <label>
              Reading font
              <select
                aria-label="Reading font"
                value={value.readingFont}
                onChange={(event) =>
                  onChange({
                    ...value,
                    readingFont: event.target
                      .value as Appearance["readingFont"],
                  })
                }
              >
                <option value="sans">Sans-serif</option>
                <option value="serif">Serif</option>
                <option value="monospace">Monospace (Consolas style)</option>
              </select>
            </label>
            <label className="appearance-checkbox">
              <input
                type="checkbox"
                checked={value.showGrid}
                onChange={(event) =>
                  onChange({ ...value, showGrid: event.target.checked })
                }
              />{" "}
              Show canvas grid
            </label>
          </fieldset>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary"
              disabled={saving}
              onClick={() => onChange({ ...defaultAppearance })}
            >
              Reset defaults
            </button>
            <button
              type="button"
              className="secondary"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="primary" disabled={saving}>
              {saving ? "Saving…" : "Save appearance"}
              <Check size={15} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
