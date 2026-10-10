import {
  type Board,
  type Settings,
  validateBoard,
  defaults,
} from "./core/model";
import {
  demoProvider,
  type GenerationRequest,
  type GenerationResult,
} from "./core/providers";
export interface InquiryBridge {
  listBoards(): Promise<Board[]>;
  saveBoard(board: Board): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  models(settings: Settings): Promise<string[]>;
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
const preview: InquiryBridge = {
  async listBoards() {
    return JSON.parse(localStorage.getItem("inquiry.boards") || "[]").map(
      validateBoard,
    );
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
    return defaults;
  },
  async saveSettings() {},
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
