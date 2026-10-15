const { contextBridge, ipcRenderer } = require("electron");

// The only privileged surface exposed to the renderer: a thin, promise-based
// wrapper around the native HID IPC handlers in main.js. See
// app/src/native-hid.ts for what calls this and why — WebHID
// cannot reach a small set of devices (currently the Razer Viper V3 Pro
// receiver) at all, confirmed on real hardware, and this is the app's own
// bypass for exactly those, not a general HID backdoor (main.js narrows which
// vendor ids it will even list or open).
contextBridge.exposeInMainWorld("nativeHid", {
  list: () => ipcRenderer.invoke("native-hid:list"),
  open: (key) => ipcRenderer.invoke("native-hid:open", key),
  close: (key) => ipcRenderer.invoke("native-hid:close", key),
  sendFeatureReport: (key, reportId, data) =>
    ipcRenderer.invoke("native-hid:sendFeatureReport", key, reportId, data),
  receiveFeatureReport: (key, reportId, length) =>
    ipcRenderer.invoke("native-hid:receiveFeatureReport", key, reportId, length),
  listRaw: () => ipcRenderer.invoke("native-hid:listRaw"),
});

// Reliable clipboard write for the packaged app — the renderer's async
// Clipboard API is permission-gated and often denied, so the diagnostics
// "Copy device info" button routes through the main process instead.
contextBridge.exposeInMainWorld("nativeClipboard", {
  write: (text) => ipcRenderer.invoke("native-clipboard:write", text),
});
