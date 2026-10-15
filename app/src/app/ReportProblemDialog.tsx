import { useEffect, useRef, useState, type ReactNode } from "react";
import * as control from "../device/controller";

// Read a Vite build-time env var without depending on Vite's ImportMeta typing
// (this package doesn't pull in vite/client's ambient types everywhere).
function buildEnv(name: string): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.[name] ?? "";
}

// Where problem reports are sent. Points at the Hypertune report relay — a small
// Cloudflare Worker that files a GitHub issue (see report-worker/). Override at
// build time with VITE_REPORT_ENDPOINT so the endpoint can move (e.g. to a
// same-origin /api/report once the app is hosted) with no code change.
const REPORT_ENDPOINT = buildEnv("VITE_REPORT_ENDPOINT")
  || "https://hypertune-report.ajb-5a7.workers.dev";
// Optional shared key, matched against the Worker's APP_SECRET (basic anti-spam).
const REPORT_KEY = buildEnv("VITE_REPORT_KEY");

const MAX_DESCRIPTION = 1500;
const DUMP_PLACEHOLDER = "Collecting device info…";

const ISSUE_OPTIONS = [
  "Mouse not detected",
  "Polling rate wrong or stuck",
  "DPI not changing or incorrect",
  "Buttons or scroll not working",
  "RGB / lighting issue",
  "Battery or wireless issue",
  "App crashed or froze",
  "Something else",
] as const;

// Vendor software (Logitech G HUB, Razer Synapse, …) running in the background
// is the single most common cause of "DPI won't change" / "not detected" — it
// claims the device and overrides us. Asking up front turns a confusing report
// into an obvious one.
const SOFTWARE_OPTIONS = [
  "Not sure",
  "No — nothing else was open",
  "Yes — Logitech G HUB was open",
  "Yes — Razer Synapse was open",
  "Yes — other mouse software was open (iCUE, SteelSeries GG, …)",
] as const;

/**
 * "Report a problem" dialog. Collects an issue category, a required description,
 * whether other mouse software was running, an optional reply email, and a fresh
 * device dump, then POSTs them to the report relay. Kept entirely in the web
 * layer (a plain fetch, no Electron/IPC) so it carries over unchanged when the
 * app is served as a hosted webview.
 */
export function ReportProblemDialog({ open, onClose, deviceName = "" }: {
  open: boolean;
  onClose: () => void;
  deviceName?: string;
}): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  const [category, setCategory] = useState<string>(ISSUE_OPTIONS[0]);
  const [description, setDescription] = useState("");
  const [otherSoftware, setOtherSoftware] = useState<string>(SOFTWARE_OPTIONS[0]);
  const [discordId, setDiscordId] = useState("");
  const [contact, setContact] = useState("");
  const [dump, setDump] = useState("");
  const [showDump, setShowDump] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open) {
      if (typeof element.showModal === "function") element.showModal();
      else element.setAttribute("open", "");
    } else if (typeof element.close === "function") {
      if (element.open) element.close();
    } else {
      element.removeAttribute("open");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setCategory(ISSUE_OPTIONS[0]);
    setDescription("");
    setOtherSoftware(SOFTWARE_OPTIONS[0]);
    setDiscordId("");
    setContact("");
    setShowDump(false);
    setCopied(false);
    setError(null);
    setBusy(false);
    // Snapshot the dump when the dialog opens so the user can preview it; the one
    // actually sent is re-grabbed on submit (see send) so it's never half-loaded.
    setDump(DUMP_PLACEHOLDER);
    void control.buildDeviceDiagnostics()
      .then(setDump)
      .catch(() => setDump("(device info unavailable)"));
  }, [open]);

  async function copyDump(): Promise<void> {
    try {
      await control.writeClipboardText(dump);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the report itself still carries the dump */
    }
  }

  async function send(): Promise<void> {
    if (busy) return;
    const trimmed = description.trim();
    if (trimmed.length < 3) {
      setError("Please add a short description of what's happening first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Always re-grab a complete dump at submit time. The copy loaded when the
      // dialog opened can still be mid-load ("Collecting device info…") — which is
      // exactly how earlier reports arrived with no device data.
      const fresh = await control.buildDeviceDiagnostics().catch(() => "");
      const deviceDump = fresh
        || (dump && dump !== DUMP_PLACEHOLDER ? dump : "(device info unavailable)");
      const payload = {
        category,
        description: trimmed.slice(0, MAX_DESCRIPTION),
        otherSoftware,
        discordId: discordId.trim().slice(0, 80),
        contact: contact.trim().slice(0, 200),
        deviceName: deviceName || "(none connected)",
        appVersion: control.BUILD_LABEL,
        platform: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        deviceDump,
      };
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (REPORT_KEY) headers["x-hypertune-key"] = REPORT_KEY;
      const response = await fetch(REPORT_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      control.pushToast("success", "Report sent", "Thanks — the Hypertune team will take a look.");
      onClose();
    } catch (err) {
      setError("Could not send the report. Check your connection and try again.");
      control.pushToast("error", "Report failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="support-dialog feedback-dialog report-dialog"
      aria-labelledby="report-dialog-title"
      onClose={onClose}
      onClick={(event) => { if (event.target === dialog.current) onClose(); }}
    >
      <form
        className="support-dialog-inner feedback-dialog-inner"
        onSubmit={(event) => { event.preventDefault(); void send(); }}
      >
        <header>
          <div>
            <p className="overline">Hypertune</p>
            <h2 id="report-dialog-title">Report a problem</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>

        <p className="feedback-description">
          Tell us what's not working — your device info is attached automatically to help us track it down.
        </p>

        <label className="feedback-handle" htmlFor="report-category">
          <span>What's the issue?</span>
          <select
            id="report-category"
            className="report-select"
            value={category}
            onChange={(event) => setCategory(event.currentTarget.value)}
          >
            {ISSUE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="feedback-handle" htmlFor="report-description">
          <span>Describe what's happening <small>(required)</small></span>
          <textarea
            id="report-description"
            className="feedback-textarea"
            rows={3}
            maxLength={MAX_DESCRIPTION}
            placeholder="What did you do, what did you expect, and what actually happened? e.g. 'Set DPI to 800 in the app, clicked apply, but the mouse stayed at 1600.'"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </label>

        <label className="feedback-handle" htmlFor="report-software">
          <span>Was other mouse software open at the time?</span>
          <select
            id="report-software"
            className="report-select"
            value={otherSoftware}
            onChange={(event) => setOtherSoftware(event.currentTarget.value)}
          >
            {SOFTWARE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <p className="report-hint">
          Apps like Logitech G HUB or Razer Synapse take over the mouse and can block changes —
          close them for full control.
        </p>

        <label className="feedback-handle" htmlFor="report-discord">
          <span>Discord ID <small>(optional — so we can reach you on Discord)</small></span>
          <input
            id="report-discord"
            type="text"
            autoComplete="off"
            placeholder="username or 123456789012345678"
            value={discordId}
            onChange={(event) => setDiscordId(event.currentTarget.value)}
          />
        </label>

        <label className="feedback-handle" htmlFor="report-contact">
          <span>Email <small>(optional — only if you want a reply)</small></span>
          <input
            id="report-contact"
            type="email"
            placeholder="you@example.com"
            value={contact}
            onChange={(event) => setContact(event.currentTarget.value)}
          />
        </label>

        <div className="report-included">
          <div className="report-included-row">
            <button
              type="button"
              className="report-included-toggle"
              aria-expanded={showDump}
              onClick={() => setShowDump((value) => !value)}
            >
              This report includes your device info {showDump ? "▲" : "▼"}
            </button>
            <button type="button" className="report-copy" onClick={() => void copyDump()}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          {showDump ? <pre className="report-dump">{dump || DUMP_PLACEHOLDER}</pre> : null}
        </div>

        {error ? <p className="feedback-error" role="alert">{error}</p> : null}

        <div className="feedback-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="is-primary" disabled={busy}>
            {busy ? "Sending…" : "Send report"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
