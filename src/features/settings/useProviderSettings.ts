import { useEffect, useRef, useState, type FormEvent } from "react";
import { bridge } from "../../bridge";
import { defaults, SettingsSchema, type Settings } from "../../core/model";
import { type ModelChoice } from "../../core/providers";
import { useChatGPTModels } from "../../model-discovery";
import { errorText } from "../workspace/browser-actions";

export function useProviderSettings({
  setSettings,
  setError,
}: {
  setSettings: (settings: Settings) => void;
  setError: (error: string) => void;
}) {
  const [providerOpen, setProviderOpen] = useState(false);
  const [localModels, setModels] = useState<ModelChoice[]>([]),
    [settingsDraft, setSettingsDraft] = useState<Settings>(defaults),
    [localDiscovering, setDiscovering] = useState(false),
    [accountBusy, setAccountBusy] = useState(false);
  const settingsCatalogue = useChatGPTModels(
    settingsDraft,
    providerOpen && !accountBusy,
  );
  const models =
    settingsDraft.provider === "chatgpt"
      ? settingsCatalogue.choices
      : localModels;
  const discovering =
    settingsDraft.provider === "chatgpt"
      ? settingsCatalogue.loading
      : localDiscovering;
  useEffect(() => {
    if (providerOpen && settingsCatalogue.error)
      setError(settingsCatalogue.error);
  }, [providerOpen, settingsCatalogue.error]);
  const currentSettingsDraft = useRef(settingsDraft);
  currentSettingsDraft.current = settingsDraft;
  async function discover() {
    if (settingsDraft.provider === "chatgpt") {
      setError("");
      await settingsCatalogue.refresh();
      return;
    }
    setDiscovering(true);
    setError("");
    const matchesCurrent = () => {
      const current = currentSettingsDraft.current;
      return (
        current.provider === settingsDraft.provider &&
        current.chatgptAccountId === settingsDraft.chatgptAccountId &&
        current.endpoint === settingsDraft.endpoint
      );
    };
    try {
      const choices = await bridge.models(settingsDraft);
      if (matchesCurrent()) setModels(choices);
    } catch (e) {
      if (matchesCurrent()) setError(errorText(e));
    } finally {
      setDiscovering(false);
    }
  }
  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    try {
      const validated = SettingsSchema.parse(settingsDraft);
      await bridge.saveSettings(validated);
      setSettings(validated);
      setProviderOpen(false);
    } catch (e) {
      setError(errorText(e));
    }
  }

  function openSettings(settings: Settings) {
    setSettingsDraft(settings);
    setModels([]);
    setError("");
    setProviderOpen(true);
  }
  return {
    openSettings,
    providerOpen,
    setProviderOpen,
    settingsDraft,
    setSettingsDraft,
    setModels,
    accountBusy,
    setAccountBusy,
    models,
    discovering,
    discover,
    saveSettings,
  };
}
