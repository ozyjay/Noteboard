import {
  type Board,
  type Settings,
  validateBoard,
  defaults,
  SettingsSchema,
} from "./core/model";
import {
  demoProvider,
  type GenerationRequest,
  type GenerationResult,
  type ModelChoice,
} from "./core/providers";
export interface ChatGPTAccount {
  id: string;
  label: string;
  connected: boolean;
  planEnabled: boolean;
}
export interface InquiryBridge {
  chatgptAccounts(): Promise<ChatGPTAccount[]>;
  chatgptSignIn(accountId?: string): Promise<ChatGPTAccount[]>;
  chatgptCancelSignIn(): Promise<void>;
  chatgptSignOut(accountId: string): Promise<{ revoked: boolean }>;
  chatgptUsage(): Promise<void>;
  listBoards(): Promise<Board[]>;
  saveBoard(board: Board): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  models(settings: Settings): Promise<ModelChoice[]>;
  generate(request: GenerationRequest): Promise<GenerationResult>;
  cancel(id: string): Promise<void>;
  onDelta(listener: (event: { id: string; text: string }) => void): () => void;
}
declare global {
  interface Window {
    inquiry?: InquiryBridge;
  }
}
const controllers = new Map<string, AbortController>();
const listeners = new Set<(event: { id: string; text: string }) => void>();
const desktopOnly = async (): Promise<never> => {
  throw new Error(
    "ChatGPT account support is available in the desktop app. Run npm run dev.",
  );
};
const preview: InquiryBridge = {
  chatgptAccounts: async () => [],
  chatgptSignIn: desktopOnly,
  chatgptCancelSignIn: desktopOnly,
  chatgptSignOut: desktopOnly,
  chatgptUsage: desktopOnly,
  async listBoards() {
    return JSON.parse(localStorage.getItem("inquiry.boards") || "[]")
      .map(validateBoard)
      .sort((a: Board, b: Board) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async saveBoard(board) {
    validateBoard(board);
    const boards = await this.listBoards();
    localStorage.setItem(
      "inquiry.boards",
      JSON.stringify([board, ...boards.filter((b) => b.id !== board.id)]),
    );
  },
  async getSettings() {
    const stored = localStorage.getItem("inquiry.settings");
    return stored ? SettingsSchema.parse(JSON.parse(stored)) : defaults;
  },
  async saveSettings(settings) {
    localStorage.setItem(
      "inquiry.settings",
      JSON.stringify(SettingsSchema.parse(settings)),
    );
  },
  async models() {
    return ["synthetic-demo"];
  },
  async generate(req) {
    if (req.settings.provider !== "demo")
      throw new Error(
        "Live inference is available in the desktop app. Run npm run dev.",
      );
    const controller = new AbortController();
    controllers.set(req.id, controller);
    try {
      return await demoProvider.generate(
        req,
        (text) => listeners.forEach((l) => l({ id: req.id, text })),
        controller.signal,
      );
    } finally {
      controllers.delete(req.id);
    }
  },
  async cancel(id) {
    controllers.get(id)?.abort();
  },
  onDelta(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
export const bridge = window.inquiry || preview;
export const desktop = Boolean(window.inquiry);
