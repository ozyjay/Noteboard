import { contextBridge, ipcRenderer } from "electron";
import { type InquiryBridge } from "../src/bridge";
import { GenerationProgressSchema } from "../src/core/generation-progress";
const bridge: InquiryBridge = {
  openDiagnosticLogs: () => ipcRenderer.invoke("diagnostics:open"),
  openWebLink: (url) => ipcRenderer.invoke("web:open", url),
  chatgptAccounts: () => ipcRenderer.invoke("chatgpt:accounts"),
  chatgptSignIn: (id) => ipcRenderer.invoke("chatgpt:signin", id),
  chatgptCancelSignIn: () => ipcRenderer.invoke("chatgpt:cancel"),
  chatgptSignOut: (id) => ipcRenderer.invoke("chatgpt:signout", id),
  chatgptUsage: () => ipcRenderer.invoke("chatgpt:usage"),
  listBoards: () => ipcRenderer.invoke("boards:list"),
  saveBoard: (b) => ipcRenderer.invoke("boards:save", b),
  deleteBoard: (id) => ipcRenderer.invoke("boards:delete", id),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (s) => ipcRenderer.invoke("settings:save", s),
  models: (s, refresh) => ipcRenderer.invoke("provider:models", s, refresh),
  generate: (r) => ipcRenderer.invoke("provider:generate", r),
  cancel: (id) => ipcRenderer.invoke("provider:cancel", id),
  onDelta(listener) {
    const handler = (_event: unknown, data: { id: string; text: string }) =>
      listener(data);
    ipcRenderer.on("provider:delta", handler);
    return () => ipcRenderer.removeListener("provider:delta", handler);
  },
  onProgress(listener) {
    const handler = (_event: unknown, data: unknown) => {
      const parsed = GenerationProgressSchema.safeParse(data);
      if (parsed.success) listener(parsed.data);
    };
    ipcRenderer.on("provider:progress", handler);
    return () => ipcRenderer.removeListener("provider:progress", handler);
  },
};
contextBridge.exposeInMainWorld("inquiry", bridge);
