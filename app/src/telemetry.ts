// Thin wrapper over the native HyperTune shell's injected telemetry hook.
//
// The shell injects `window.ht_reportEvent(action, props?)` into the page (see
// the shell team's integration note). In the plain web build the hook is
// absent, so every call here is a silent no-op — the optional chaining and the
// try/catch guarantee telemetry can never throw into or break the app.
//
// Report only on real USER ACTIONS (a click, a value change the user made), not
// on renders or background polling. Reuse prop names across events where you can
// so they map onto stable columns upstream; a primitive prop is auto-wrapped as
// `{ value: ... }` by the shell.

type EventProps = Record<string, unknown> | string | number | boolean;

interface ShellWindow {
  ht_reportEvent?: (action: string, props?: EventProps) => void;
}

/** Fire a telemetry event to the native shell, if it is present. Never throws. */
export function reportEvent(action: string, props?: EventProps): void {
  try {
    (window as unknown as ShellWindow).ht_reportEvent?.(action, props);
  } catch {
    /* telemetry must never affect the app */
  }
}
