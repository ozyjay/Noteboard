import { useEffect, useSyncExternalStore } from "react";
import { bridge } from "./bridge";
import { type Settings } from "./core/model";
import { type ModelChoice } from "./core/providers";

type Catalogue = {
  choices: ModelChoice[];
  loading: boolean;
  error?: string;
};
const catalogues = new Map<string, Catalogue>();
const listeners = new Set<() => void>();
const empty: Catalogue = { choices: [], loading: false };
const notify = () => listeners.forEach((listener) => listener());

export function invalidateChatGPTModels(accountId: string) {
  catalogues.delete(accountId);
  notify();
}

async function load(settings: Settings, refresh = false) {
  const id = settings.chatgptAccountId;
  if (!id || settings.provider !== "chatgpt") return;
  const previous = catalogues.get(id);
  if (previous?.loading || (previous && !refresh)) return;
  const pending: Catalogue = {
    choices: previous?.choices || [],
    loading: true,
  };
  catalogues.set(id, pending);
  notify();
  try {
    const accounts = await bridge.chatgptAccounts();
    if (catalogues.get(id) !== pending) return;
    const account = accounts.find((value) => value.id === id);
    const choices =
      account?.connected && account.planEnabled
        ? await bridge.models(settings, refresh)
        : [];
    if (catalogues.get(id) === pending)
      catalogues.set(id, { choices, loading: false });
  } catch (error) {
    if (catalogues.get(id) === pending)
      catalogues.set(id, {
        choices: pending.choices,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
  }
  notify();
}

// Shared UI cache; the desktop bridge also persists catalogues per account.
export function useChatGPTModels(settings: Settings, enabled: boolean) {
  const id =
    settings.provider === "chatgpt" ? settings.chatgptAccountId : undefined;
  const catalogue = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => (id && catalogues.get(id)) || empty,
  );
  useEffect(() => {
    if (enabled && id) void load(settings);
  }, [enabled, id, catalogue]);
  return { ...catalogue, refresh: () => load(settings, true) };
}
