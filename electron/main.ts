import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { z } from "zod";
import { Store } from "./store";
import { MessageSchema, SettingsSchema } from "../src/core/model";
import { demoProvider } from "../src/core/providers";
import { ollamaProvider, localEndpoint } from "./ollama";
import { assertBudget } from "../src/core/context";
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
  window = new BrowserWindow({
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
  window.on("closed", () => {
    for (const c of pending.values()) c.abort();
    pending.clear();
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
app.whenReady().then(() => {
  store = new Store(path.join(app.getPath("userData"), "inquiry.sqlite"));
  handle("boards:list", () => store.list());
  handle("boards:save", (b) => store.save(b));
  handle("settings:get", () => store.settings());
  handle("settings:save", (s) => {
    const parsed = SettingsSchema.parse(s);
    if (parsed.provider === "ollama") localEndpoint(parsed.endpoint);
    store.saveSettings(parsed);
  });
  handle("provider:models", (s) => {
    const settings = SettingsSchema.parse(s);
    return (
      settings.provider === "demo" ? demoProvider : ollamaProvider
    ).models(settings);
  });
  handle("provider:generate", async (value) => {
    const req = requestSchema.parse(value);
    if (pending.size) throw new Error("A generation is already in progress");
    assertBudget(req.messages, req.settings.contextLimit);
    const controller = new AbortController();
    pending.set(req.id, controller);
    try {
      return await (
        req.settings.provider === "demo" ? demoProvider : ollamaProvider
      ).generate(
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
  store?.close();
});
