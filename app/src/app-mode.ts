// Integrated mode — the native HyperTune desktop shell loads the hosted app with
// `?app=1`, switching it to the v2.0 "integrated" design meant to sit inside the
// native window. The plain browser build (no flag) keeps the standalone design,
// so the public web beta is untouched. The flag is persisted for the session so
// it survives client-side navigation and reloads inside the shell.
//
// CONTRACT: the native shell must append the SAME flag. `?app=1` is the agreed
// string — confirm it with the shell build, and change PARAM here if the shell
// team picks a different name.

const PARAM = "app";
const STORAGE_KEY = "hypertune.app-mode";

export type AppMode = "standalone" | "integrated";

function readMode(): AppMode {
  try {
    if (new URLSearchParams(window.location.search).get(PARAM) === "1") {
      try { sessionStorage.setItem(STORAGE_KEY, "integrated"); } catch { /* storage blocked */ }
      return "integrated";
    }
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "integrated") return "integrated";
    } catch { /* storage blocked */ }
  } catch {
    /* no window/URL (tests/SSR) — treat as standalone */
  }
  return "standalone";
}

/**
 * Resolves the app mode and stamps it on <html> as `data-app-mode`, so CSS can
 * target `[data-app-mode="integrated"]`. Call once at boot, before first render.
 */
export function initAppMode(): AppMode {
  const mode = readMode();
  try {
    document.documentElement.dataset.appMode = mode;
  } catch {
    /* no document */
  }
  return mode;
}

/** True when the app is running in the native shell's integrated (v2.0) design. */
export function isIntegratedMode(): boolean {
  try {
    return document.documentElement.dataset.appMode === "integrated";
  } catch {
    return false;
  }
}
