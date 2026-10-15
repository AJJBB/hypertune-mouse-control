import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./control.css";
import { App } from "./app/App";
import { UnsupportedNotice } from "./app/UnsupportedNotice";
import { unsupportedNotice } from "./browser-support";
import { start } from "./device/controller";
import { installNativeHid } from "./native-hid";
import { mountOfflineBanner } from "./offline-banner";
import { registerServiceWorker } from "./register-sw";
import { MIN_HEIGHT, MIN_WIDTH, useViewportTooSmall } from "./app/useViewportTooSmall";

// Early theme bootstrap — runs before the app renders so there's no flash of the
// wrong color scheme. This used to be an inline <script> in index.html; moving it
// into the bundle lets the page ship a strict CSP (script-src 'self', no inline
// exception). The bundle is module-preloaded, so it executes almost immediately.
(() => {
  try {
    const saved = JSON.parse(localStorage.getItem("hypertune-interface-settings-v1") || "{}");
    const dark = saved.colorMode === "Dark"
      || (saved.colorMode !== "Light" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.colorScheme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch {
    /* localStorage/matchMedia unavailable — the app sets the theme on mount anyway */
  }
})();

const controlApp = document.querySelector<HTMLDivElement>("#control-app");

if (!controlApp) {
  throw new Error("Hypertune could not find the control application root.");
}

function isChromium(): boolean {
  const brands = (navigator as Navigator & {
    userAgentData?: { brands?: { brand: string }[] };
  }).userAgentData?.brands;
  if (brands) return brands.some((entry) => /chromium/i.test(entry.brand));
  return /Chrom(e|ium)\/|Edg\//.test(navigator.userAgent);
}

registerServiceWorker();
mountOfflineBanner();

function Root(): ReactNode {
  const tooSmall = useViewportTooSmall();
  if (tooSmall) {
    return (
      <UnsupportedNotice
        notice={{
          headline: "Make the window bigger.",
          detail: `Hypertune lays its device controls out side by side and needs at least ${MIN_WIDTH} × ${MIN_HEIGHT} pixels. Resize the window, or move to a larger display.`,
        }}
      />
    );
  }
  return <App />;
}

const root = createRoot(controlApp);
const notice = unsupportedNotice({
  hasWebHid: Boolean(navigator.hid),
  handheld: window.matchMedia("(pointer: coarse) and (hover: none)").matches,
  secureContext: window.isSecureContext,
  chromium: isChromium(),
});
if (notice) {
  root.render(<UnsupportedNotice notice={notice} />);
} else {
  // A no-op outside the Electron app (see native-hid.ts) — merges in the
  // small set of devices real WebHID cannot reach at all, before the first
  // device scan runs.
  installNativeHid();
  start();
  root.render(<Root />);
}
