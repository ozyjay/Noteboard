import { type Settings } from "../src/core/model";
import { type ModelChoice } from "../src/core/providers";
import { type Store } from "./store";

export class ChatGPTModelCatalogues {
  private pending = new Map<string, Promise<ModelChoice[]>>();
  constructor(
    private store: Store,
    private discover: (settings: Settings) => Promise<ModelChoice[]>,
  ) {}
  invalidate(id: string) {
    this.pending.delete(id);
    this.store.deleteModelCatalogue(id);
  }
  async models(settings: Settings, refresh: boolean): Promise<ModelChoice[]> {
    const id = settings.chatgptAccountId;
    if (!id) throw new Error("Select a ChatGPT account first");
    if (!refresh) {
      const saved = this.store.modelCatalogue(id);
      if (saved) return saved.models;
    }
    const existing = this.pending.get(id);
    if (existing) return existing;
    const request = Promise.resolve().then(async () => {
      const models = await this.discover(settings);
      if (this.pending.get(id) !== request)
        throw new Error(
          "ChatGPT account changed during model discovery. Try again.",
        );
      this.store.saveModelCatalogue(id, {
        discoveredAt: new Date().toISOString(),
        models,
      });
      return models;
    });
    this.pending.set(id, request);
    try {
      return await request;
    } finally {
      if (this.pending.get(id) === request) this.pending.delete(id);
    }
  }
}
