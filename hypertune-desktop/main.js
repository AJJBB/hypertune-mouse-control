const { app, BrowserWindow, session, ipcMain, clipboard, shell } = require("electron");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const HID = require("node-hid");

// Vendor ids the native HID bridge will enumerate/open at all. Kept narrow on
// purpose — this bypasses the browser's WebHID permission model entirely, so
// it must never become a general "read any HID device" backdoor. Extend this
// only when a specific model needs it (see mouse-protocol-source's
// `nativeOnly` flag, which is what actually decides a device uses this path).
const NATIVE_HID_VENDOR_IDS = new Set([0x1532]); // Razer

/** Open native HID handles, keyed by "vendorId:productId". Which of a Razer
    device's several USB interfaces carries the writable control channel varies
    by model and can't be read from the descriptor, so the interface is
    resolved by probing when the device is opened (see openNativeDevice). */
const nativeHidDevices = new Map();

/** Probe buffer size: Razer's control packets are 90 bytes + a report-id byte;
    a generous read length is fine, the caller trims. */
const NATIVE_PROBE_LENGTH = 91;

function nativeDeviceKey(vendorId, productId) {
  return `${vendorId}:${productId}`;
}

function listNativeHidDevices() {
  const candidates = HID.devices().filter((info) => NATIVE_HID_VENDOR_IDS.has(info.vendorId));

  // One synthetic device per physical mouse (vendorId:productId), not per
  // interface. The control channel's interface differs across Razer models
  // (the Viper V3 Pro answers on interface 0's Generic Desktop Mouse
  // collection; the DeathAdder V3 Pro does not), so rather than guess a
  // collection here, present a single mouse-control device and let open()
  // discover the interface that actually accepts feature reports.
  const byDevice = new Map();
  for (const info of candidates) {
    const key = nativeDeviceKey(info.vendorId, info.productId);
    if (!byDevice.has(key)) byDevice.set(key, info);
  }

  return [...byDevice.entries()].map(([key, info]) => ({
    key,
    vendorId: info.vendorId,
    productId: info.productId,
    productName: info.product || "",
    // Presented as a lone Generic Desktop Mouse control collection so the
    // Razer driver's isSupported() claims it; the real interface is bound on
    // open(). children:[] because some drivers recurse into it.
    collections: [{
      usagePage: 0x01,
      usage: 0x02,
      inputReports: [],
      outputReports: [],
      featureReports: [],
      children: [],
    }],
  }));
}

/** Interface paths for a physical device, in a stable order, deduped (node-hid
    lists one entry per top-level collection, several sharing one interface
    path). */
function interfacePathsFor(vendorId, productId) {
  const seen = new Set();
  const paths = [];
  for (const info of HID.devices()) {
    if (info.vendorId !== vendorId || info.productId !== productId || !info.path) continue;
    if (seen.has(info.path)) continue;
    seen.add(info.path);
    paths.push({ path: info.path, interface: info.interface ?? 0 });
  }
  return paths.sort((a, b) => a.interface - b.interface).map((entry) => entry.path);
}

/** Open the given device by trying each of its interfaces and keeping the
    first whose feature-report channel actually responds — that is the Razer
    control interface. An input-only interface (a plain mouse/keyboard/consumer
    endpoint) throws a DeviceIoControl error on GetFeature, so it is skipped.
    This is what makes every Razer model work without a per-model interface
    table: the device tells us which interface answers. */
function openNativeDevice(key) {
  const [vendorId, productId] = key.split(":").map((part) => Number.parseInt(part, 10));
  if (!NATIVE_HID_VENDOR_IDS.has(vendorId)) throw new Error(`Native HID device not offered: ${key}`);
  const paths = interfacePathsFor(vendorId, productId);
  if (paths.length === 0) throw new Error(`Native HID device is gone: ${key}`);

  let lastError = null;
  for (const path of paths) {
    let handle = null;
    try {
      handle = new HID.HID(path);
      // Read-only probe: succeeds on an interface that exposes feature report 0
      // (the control channel), throws on one that does not. No command is sent,
      // so it has no side effects on the mouse's settings.
      handle.getFeatureReport(0, NATIVE_PROBE_LENGTH);
      return handle;
    } catch (error) {
      lastError = error;
      if (handle) { try { handle.close(); } catch { /* ignore */ } }
    }
  }
  throw lastError || new Error(`No writable control interface found for ${key}`);
}

function requireOpenDevice(key) {
  const device = nativeHidDevices.get(key);
  if (!device) throw new Error(`Native HID device is not open: ${key}`);
  return device;
}

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

// Fixed, not ephemeral: 127.0.0.1:5173 doubles as the Vite dev server's own
// port, so both dev and packaged builds serve the app from the same origin
// without extra setup.
const WEB_SERVER_PORT = 5173;

/** Serves the built web app from a plain local HTTP server rather than
    file://. Vite emits root-absolute asset paths (/assets/...) that file://
    can't resolve, and the app's service worker / manifest need a real
    http(s) origin anyway — a normal browser tab would have both. */
function serveWebDir(webDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split("?")[0]);
      let filePath = path.join(webDir, urlPath === "/" ? "index.html" : urlPath);
      if (!filePath.startsWith(webDir)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          // SPA fallback: unknown paths resolve to index.html.
          fs.readFile(path.join(webDir, "index.html"), (err2, indexData) => {
            if (err2) {
              res.writeHead(404);
              res.end();
              return;
            }
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(indexData);
          });
          return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.on("error", reject);
    server.listen(WEB_SERVER_PORT, "127.0.0.1", () => resolve(server.address().port));
  });
}

// The hosted web app this shell loads. Override with HYPERTUNE_APP_URL plus one
// rebuild to point it elsewhere. The web app updates itself server-side; the
// shell only needs re-shipping when the native HID bridge below changes.
const HOSTED_APP_URL = process.env.HYPERTUNE_APP_URL || "https://hypertune-mouse-control.vercel.app";
const LOCAL_FALLBACK_ORIGIN = `http://127.0.0.1:${WEB_SERVER_PORT}`;

// Handshake header sent only on requests to HOSTED_APP_URL. The host's
// gatekeeper (middleware.js) serves the app only when this matches its
// SHELL_TOKEN. Supplied at build/run time via the HYPERTUNE_SHELL_TOKEN env
// var; the shell reaches the gated host only when it is set to match.
const SHELL_TOKEN = process.env.HYPERTUNE_SHELL_TOKEN || "";

function safeOrigin(url) {
  try { return new URL(url).origin; } catch { return null; }
}

/** Origins the shell will load and expose the native HID bridge to. Kept tight
    on purpose: the hosted app, the local offline fallback, and a dev server when
    one is set. Everything else opens in the user's real browser instead. */
function isTrustedOrigin(origin) {
  if (!origin) return false;
  const trusted = new Set([LOCAL_FALLBACK_ORIGIN, safeOrigin(HOSTED_APP_URL)]);
  const dev = process.env.HYPERTUNE_DEV_SERVER;
  if (dev) trusted.add(safeOrigin(dev));
  return trusted.has(origin);
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0d0b0c",
    title: "Hypertune Mouse Control",
    icon: path.join(__dirname, "icon.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Keep the shell pinned to trusted origins: external links open in the user's
  // real browser, and in-app navigation can't wander off the Hypertune origin —
  // which matters because the native HID bridge (preload) is exposed to whatever
  // this window loads.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedOrigin(safeOrigin(url))) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedOrigin(safeOrigin(url))) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  // Load the hosted web app so updates ship server-side without a new exe. If it
  // can't be reached (offline / host down), fall back to the copy bundled in this
  // build so the app still opens and can drive a plugged-in mouse.
  let usingFallback = false;
  async function loadLocalFallback() {
    if (usingFallback) return;
    usingFallback = true;
    try {
      const port = await serveWebDir(path.join(__dirname, "web"));
      await win.loadURL(`http://127.0.0.1:${port}/`);
    } catch {
      /* nothing else to try */
    }
  }
  win.webContents.on("did-fail-load", (_event, errorCode, _desc, validatedURL, isMainFrame) => {
    // ERR_ABORTED (-3) is a normal navigation cancel, not a real failure.
    if (!isMainFrame || errorCode === -3) return;
    if (safeOrigin(validatedURL) === LOCAL_FALLBACK_ORIGIN) return;
    void loadLocalFallback();
  });

  const devServer = process.env.HYPERTUNE_DEV_SERVER;
  win.loadURL(devServer || HOSTED_APP_URL).catch(() => undefined);
}

app.whenReady().then(() => {
  const ses = session.defaultSession;

  // Electron shows no built-in device chooser the way Chrome does, so a
  // WebHID requestDevice() call needs a handler here or it just hangs.
  // This is a single-purpose mouse-control app (not a general browser), so
  // auto-granting the first match is the right call rather than building a
  // custom chooser UI on top of it.
  ses.on("select-hid-device", (event, details, callback) => {
    event.preventDefault();
    if (details.deviceList.length > 0) {
      callback(details.deviceList[0].deviceId);
    } else {
      callback();
    }
  });

  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) =>
    permission === "hid" && isTrustedOrigin(requestingOrigin));
  ses.setDevicePermissionHandler((details) =>
    details.deviceType === "hid" && isTrustedOrigin(details.origin));

  // Attach the secret handshake to requests bound for the hosted app only, so the
  // host serves it to this shell but 404s a plain browser. Scoped by URL so the
  // token is never sent to font/CDN or any other origin.
  const hostedOrigin = safeOrigin(HOSTED_APP_URL);
  if (hostedOrigin) {
    ses.webRequest.onBeforeSendHeaders({ urls: [`${hostedOrigin}/*`] }, (details, callback) => {
      callback({ requestHeaders: { ...details.requestHeaders, "x-hypertune-shell": SHELL_TOKEN } });
    });
  }

  // Native HID bridge (see native-hid.ts on the app side): a small set of
  // devices — currently just the Razer Viper V3 Pro receiver — have a real
  // control channel WebHID refuses to write to at all, confirmed on real
  // hardware. node-hid talks to that same channel directly, bypassing the
  // browser layer entirely, with no elevated privileges and nothing beyond
  // ordinary HID access any desktop app already has.
  ipcMain.handle("native-clipboard:write", (_event, text) => {
    clipboard.writeText(String(text ?? ""));
    return true;
  });

  // Raw node-hid enumeration for allow-listed vendors — every interface with
  // its interface number and usage, undeduped. Diagnostics only: the device
  // dump uses it to reveal the interfaces WebHID hides on Windows (e.g. a
  // Razer control channel), so interface selection can be fixed from data.
  ipcMain.handle("native-hid:listRaw", () => {
    try {
      return HID.devices()
        .filter((info) => NATIVE_HID_VENDOR_IDS.has(info.vendorId))
        .map((info) => ({
          vendorId: info.vendorId,
          productId: info.productId,
          product: info.product || "",
          interface: info.interface,
          usagePage: info.usagePage ?? 0,
          usage: info.usage ?? 0,
        }));
    } catch {
      return [];
    }
  });

  ipcMain.handle("native-hid:list", () => listNativeHidDevices());

  ipcMain.handle("native-hid:open", (_event, key) => {
    if (nativeHidDevices.has(key)) return true;
    nativeHidDevices.set(key, openNativeDevice(key));
    return true;
  });

  ipcMain.handle("native-hid:close", (_event, key) => {
    const device = nativeHidDevices.get(key);
    if (device) {
      device.close();
      nativeHidDevices.delete(key);
    }
    return true;
  });

  ipcMain.handle("native-hid:sendFeatureReport", (_event, key, reportId, data) => {
    requireOpenDevice(key).sendFeatureReport([reportId, ...data]);
    return true;
  });

  // `length` is the total buffer size to request from node-hid, report-id
  // byte included — the caller (native-hid.ts) knows how many data bytes it
  // actually wants and adds one. The full raw buffer is returned as-is; it's
  // the caller's job to drop that leading report-id byte.
  ipcMain.handle("native-hid:receiveFeatureReport", (_event, key, reportId, length) =>
    Array.from(requireOpenDevice(key).getFeatureReport(reportId, length)));

  void createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  for (const device of nativeHidDevices.values()) device.close();
  nativeHidDevices.clear();
});
