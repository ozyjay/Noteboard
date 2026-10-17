import { useEffect, useState } from "react";
import { bridge } from "../../bridge";
import { defaults, type Appearance, type Settings } from "../../core/model";
import { errorText } from "../workspace/browser-actions";

export function useAppearance(
  settings: Settings,
  setSettings: (settings: Settings) => void,
  setError: (error: string) => void,
) {
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [appearanceDraft, setAppearanceDraft] = useState<Appearance>(
    defaults.appearance,
  );
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const appearance = appearanceOpen ? appearanceDraft : settings.appearance;
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      root.dataset.theme =
        appearance.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : appearance.theme;
      root.dataset.accent = appearance.accent;
      root.dataset.noteStyle = appearance.noteStyle;
      root.dataset.textSize = appearance.textSize;
      root.dataset.interfaceFont = appearance.interfaceFont;
      root.dataset.readingFont = appearance.readingFont;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);
  async function saveAppearance() {
    setAppearanceSaving(true);
    setError("");
    try {
      const next = { ...settings, appearance: appearanceDraft };
      await bridge.saveSettings(next);
      setSettings(next);
      setAppearanceOpen(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setAppearanceSaving(false);
    }
  }
  function openAppearance() {
    setAppearanceDraft(settings.appearance);
    setError("");
    setAppearanceOpen(true);
  }

  return {
    appearanceOpen,
    setAppearanceOpen,
    appearanceDraft,
    setAppearanceDraft,
    appearanceSaving,
    appearance,
    saveAppearance,
    openAppearance,
  };
}
