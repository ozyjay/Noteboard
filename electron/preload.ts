import { contextBridge, ipcRenderer } from "electron";
import { type InquiryBridge } from "../src/bridge";
const bridge: InquiryBridge = {
  listBoards: () => ipcRenderer.invoke("boards:list"),
  saveBoard: (b) => ipcRenderer.invoke("boards:save", b),
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
