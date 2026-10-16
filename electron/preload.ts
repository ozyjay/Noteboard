import { contextBridge, ipcRenderer } from "electron";
import { type InquiryBridge } from "../src/bridge";
const bridge: InquiryBridge = {
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
  models: (s) => ipcRenderer.invoke("provider:models", s),
  generate: (r) => ipcRenderer.invoke("provider:generate", r),
  cancel: (id) => ipcRenderer.invoke("provider:cancel", id),
  onDelta(listener) {
    const handler = (_event: unknown, data: { id: string; text: string }) =>
      listener(data);
    ipcRenderer.on("provider:delta", handler);
    return () => ipcRenderer.removeListener("provider:delta", handler);
  },
};
contextBridge.exposeInMainWorld("inquiry", bridge);
