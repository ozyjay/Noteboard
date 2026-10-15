import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  safeStorage,
  shell,
  systemPreferences,
} from "electron";
import path from "node:path";
import { z } from "zod";
import { Store } from "./store";
import { MessageSchema, SettingsSchema } from "../src/core/model";
import { demoProvider } from "../src/core/providers";
import { ollamaProvider, localEndpoint } from "./ollama";
import { assertBudget } from "../src/core/context";
import { ChatGPTAuth } from "./chatgpt-auth";
import { chatGPTProvider } from "./chatgpt";
let auth: ChatGPTAuth;
let store: Store;
let window: BrowserWindow | null = null;
const pending = new Map<string, AbortController>();
const requestSchema = z.object({
  id: z.string().uuid(),
  messages: z.array(MessageSchema).min(1).max(1000),
  settings: SettingsSchema,
  purpose: z.enum(["explore", "synthesis"]),
});
function handle(channel: string, fn: (...args: unknown[]) => unknown) {
  ipcMain.handle(channel, (event, ...args) => {
    if (
      event.sender !== window?.webContents ||
      event.senderFrame !== event.sender.mainFrame
    )
      throw new Error("Untrusted IPC sender");
    return fn(...args);
  });
}
function createWindow() {
  const icon = path.join(
    __dirname,
    process.env.INQUIRY_DEV === "1"
      ? "../public/noteboard-icon.png"
      : "../dist/noteboard-icon.png",
  );
  app.dock?.setIcon(icon);
  window = new BrowserWindow({
    icon,
    width: 1480,
    height: 950,
    minWidth: 960,
    minHeight: 650,
    title: "Noteboard",
    backgroundColor: "#f7f6f2",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  if (process.platform === "darwin") {
    const editMenu = Menu.buildFromTemplate([
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "pasteAndMatchStyle" },
      { type: "separator" },
      { role: "selectAll" },
    ]);
    window.webContents.on("context-menu", (_event, params) => {
      if (!params.isEditable || !params.frame || !window) return;
      // macOS adds Writing Tools only when the native menu has a target frame.
      editMenu.popup({ window, frame: params.frame });
    });
  }
  window.on("closed", () => {
    for (const c of pending.values()) c.abort();
    pending.clear();
    auth.cancel();
    window = null;
  });
  if (process.env.INQUIRY_DEV === "1")
    void window.loadURL("http://127.0.0.1:5173");
  else void window.loadFile(path.join(__dirname, "../dist/index.html"));
}
app.setName("Inquiry");
// Retain the existing storage location when changing the displayed app name.
const existingUserData = app.getPath("userData");
app.setName("Noteboard");
app.setPath("userData", process.env.INQUIRY_DATA_DIR || existingUserData);
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on("second-instance", () => {
  if (window?.isMinimized()) window.restore();
  window?.focus();
});
if (primaryInstance)
  app.whenReady().then(() => {
    // App-local Cocoa preference: a deep trackpad press must not invoke Look Up
    // while interacting with the canvas. Ordinary selection remains available.
    if (process.platform === "darwin")
      systemPreferences.setUserDefault(
        "com.apple.trackpad.forceClick",
        "boolean",
        false,
      );
    auth = new ChatGPTAuth(
      path.join(app.getPath("userData"), "chatgpt-credentials.bin"),
      {
        available: () =>
          safeStorage.isEncryptionAvailable() &&
          (process.platform !== "linux" ||
            safeStorage.getSelectedStorageBackend() !== "basic_text"),
        encrypt: (value) => safeStorage.encryptString(value),
        decrypt: (value) => safeStorage.decryptString(value),
      },
      (url) => shell.openExternal(url),
    );
    const chatgpt = chatGPTProvider(auth);
    const provider = (settings: z.infer<typeof SettingsSchema>) =>
      ({ demo: demoProvider, ollama: ollamaProvider, chatgpt })[
        settings.provider
      ];
    const idle = () => {
      if (pending.size)
        throw new Error("Finish or cancel generation before changing accounts");
    };
    handle("chatgpt:accounts", () => auth.accounts());
    handle("chatgpt:signin", (id) => {
      idle();
      return auth.signIn(z.string().max(200).optional().parse(id));
    });
    handle("chatgpt:cancel", () => auth.cancel());
    handle("chatgpt:signout", (id) => {
      idle();
      return auth.signOut(z.string().max(200).parse(id));
    });
    handle("chatgpt:usage", () =>
      shell.openExternal("https://chatgpt.com/settings/usage"),
    );
    store = new Store(path.join(app.getPath("userData"), "inquiry.sqlite"));
    handle("boards:list", () => store.list());
    handle("boards:save", (b) => store.save(b));
    handle("boards:delete", (id) => store.delete(id));
    handle("settings:get", () => store.settings());
    handle("settings:save", (s) => {
      const parsed = SettingsSchema.parse(s);
      if (parsed.provider === "ollama") localEndpoint(parsed.endpoint);
      store.saveSettings(parsed);
    });
    handle("provider:models", (s) => {
      const settings = SettingsSchema.parse(s);
      return provider(settings).models(settings);
    });
    handle("provider:generate", async (value) => {
      const req = requestSchema.parse(value);
      if (pending.size) throw new Error("A generation is already in progress");
      assertBudget(req.messages, req.settings.contextLimit);
      const controller = new AbortController();
      pending.set(req.id, controller);
      try {
        return await provider(req.settings).generate(
          req,
          (text) =>
            window?.webContents.send("provider:delta", { id: req.id, text }),
          controller.signal,
        );
      } finally {
        pending.delete(req.id);
      }
    });
    handle("provider:cancel", (id) => {
      pending.get(z.string().parse(id))?.abort();
    });
    createWindow();
    app.on("activate", () => {
      if (!window) createWindow();
    });
  });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  for (const c of pending.values()) c.abort();
  auth?.cancel();
  store?.close();
});
