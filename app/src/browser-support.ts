export interface BrowserEnvironment {
  hasWebHid: boolean;
  handheld: boolean;
  secureContext: boolean;
  chromium: boolean;
}

export interface UnsupportedNotice {
  headline: string;
  detail: string;
}

export function unsupportedNotice(env: BrowserEnvironment): UnsupportedNotice | null {
  if (env.hasWebHid) return null;
  if (env.handheld) {
    return {
      headline: "Use a desktop.",
      detail: "Hypertune cannot reach your mouse from a phone or tablet.",
    };
  }
  if (!env.chromium) {
    return {
      headline: "Use a Chromium browser.",
      detail: "This browser can't reach your mouse — it has no WebHID. Please open Hypertune in a Chromium-based browser: Chrome, Edge, Brave, Opera, or Arc.",
    };
  }
  if (!env.secureContext) {
    return {
      headline: "Open this page over HTTPS.",
      detail: "WebHID is only available on a secure connection. Use an https:// address or localhost.",
    };
  }
  return {
    headline: "Update your browser.",
    detail: "Hypertune needs WebHID, added in Chrome and Edge 89. Update to the latest version.",
  };
}
