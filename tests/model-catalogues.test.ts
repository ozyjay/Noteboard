import { it, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Store } from "../electron/store";
import { ChatGPTModelCatalogues } from "../electron/model-catalogues";
import { defaults } from "../src/core/model";
import { type ModelChoice } from "../src/core/providers";

it("persists account-specific model capabilities across reopening and replaces only a successfully refreshed catalogue", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "inquiry-catalogue-"));
  const file = path.join(dir, "test.sqlite");
  let store = new Store(file);
  const settings = {
    ...defaults,
    provider: "chatgpt" as const,
    chatgptAccountId: "account-a",
  };
  const models = [
    {
      id: "model-a",
      name: "Model A",
      defaultReasoningEffort: "low",
      reasoningEfforts: [
        { effort: "low", description: "Faster" },
        { effort: "high", description: "Deeper" },
        { effort: "future-level" },
      ],
    },
    { id: "unknown", name: "Unknown levels" },
    { id: "no-levels", name: "No levels", reasoningEfforts: [] },
  ];
  try {
    store.saveSettings(defaults);
    const discover = vi.fn(async (): Promise<ModelChoice[]> => models);
    let catalogues = new ChatGPTModelCatalogues(store, discover);
    expect(await catalogues.models(settings, false)).toEqual(models);
    const saved = store.modelCatalogue("account-a")!;
    expect(saved.models).toEqual(models);
    expect(saved.discoveredAt).toMatch(/^\d{4}-/);
    store.saveModelCatalogue("account-b", {
      discoveredAt: saved.discoveredAt,
      models: [{ id: "b", name: "Account B" }],
    });
    store.close();
    store = new Store(file);
    catalogues = new ChatGPTModelCatalogues(store, discover);
    expect(await catalogues.models(settings, false)).toEqual(models);
    expect(discover).toHaveBeenCalledTimes(1);
    expect(
      await catalogues.models(
        { ...settings, chatgptAccountId: "account-b" },
        false,
      ),
    ).toEqual([{ id: "b", name: "Account B" }]);
    discover.mockRejectedValueOnce(new Error("Unavailable"));
    await expect(catalogues.models(settings, true)).rejects.toThrow(
      "Unavailable",
    );
    expect(store.modelCatalogue("account-a")).toEqual(saved);
    discover.mockResolvedValueOnce([
      { id: "updated", name: "Updated", reasoningEfforts: [] },
    ]);
    expect(await catalogues.models(settings, true)).toEqual([
      { id: "updated", name: "Updated", reasoningEfforts: [] },
    ]);
    expect(store.modelCatalogue("account-b")?.models[0].id).toBe("b");
    expect(store.settings()).toEqual(defaults);
    expect(store.list()).toEqual([]);
    expect(() => store.saveModelCatalogue("", saved)).toThrow();
    expect(() =>
      store.saveModelCatalogue("account-a", {
        ...saved,
        discoveredAt: "yesterday",
      }),
    ).toThrow();
    expect(() =>
      store.saveModelCatalogue("account-a", {
        ...saved,
        models: [{ id: "bad", name: "Bad", reasoningEfforts: "high" }],
      }),
    ).toThrow();
    catalogues.invalidate("account-a");
    expect(store.modelCatalogue("account-a")).toBeUndefined();
    expect(store.modelCatalogue("account-b")).toBeDefined();
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

it("deduplicates discovery and prevents an invalidated request from restoring a signed-out account's catalogue", async () => {
  const store = new Store(":memory:");
  try {
    let complete!: (models: ModelChoice[]) => void;
    const discover = vi.fn(
      () =>
        new Promise<ModelChoice[]>((resolve) => {
          complete = resolve;
        }),
    );
    const catalogues = new ChatGPTModelCatalogues(store, discover);
    const settings = {
      ...defaults,
      provider: "chatgpt" as const,
      chatgptAccountId: "account",
    };
    const first = catalogues.models(settings, false);
    const second = catalogues.models(settings, false);
    await Promise.resolve();
    expect(discover).toHaveBeenCalledTimes(1);
    catalogues.invalidate("account");
    const failure = expect(Promise.all([first, second])).rejects.toThrow(
      "account changed",
    );
    complete([{ id: "old", name: "Old catalogue" }]);
    await failure;
    expect(store.modelCatalogue("account")).toBeUndefined();
    discover.mockImplementation(async () => []);
    expect(await catalogues.models(settings, false)).toEqual([]);
    expect(await catalogues.models(settings, false)).toEqual([]);
    expect(discover).toHaveBeenCalledTimes(2);
  } finally {
    store.close();
  }
});
