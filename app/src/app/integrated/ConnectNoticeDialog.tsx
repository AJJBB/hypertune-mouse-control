// v2.0 integrated connection-notice popups (Figma "Popup - Error" and
// "Popup - Close GHUB / Synapse"). A centered modal over a dimmed backdrop:
// an icon tile, a title, a short message and a Retry action. Rendered only in
// integrated mode; the standalone build keeps its own notice dialog + toasts.
import { useEffect, useRef, type ReactNode } from "react";
import { X, RotateCw, Mouse, AlertTriangle } from "lucide-react";

type NoticeVariant = "error" | "conflict" | "razer-web";

// `tone` drives the existing icon-tile styling (htv2-popup-icon-error /
// -conflict); `retry` chooses the action (Retry vs a plain dismiss for cases
// retrying can't fix, e.g. Razer in the web build).
const NOTICE: Record<NoticeVariant, { title: string; body: string; tone: "error" | "conflict"; retry: boolean }> = {
  error: {
    title: "Couldn’t connect",
    body: "The mouse didn’t respond. Unplug it, plug it back in and try again. If it’s on a USB hub, use a port on the PC itself.",
    tone: "error",
    retry: true,
  },
  conflict: {
    title: "Close G HUB / Synapse first",
    body: "Hypertune can’t read or save settings while another mouse app like G HUB or Synapse is open. Close it from the system tray, then try again.",
    tone: "conflict",
    retry: true,
  },
  "razer-web": {
    title: "Razer isn’t supported here yet",
    body: "Razer mice can’t be controlled in the web version — their control channel needs the Hypertune desktop app. Once it ships there it’ll have full functionality.",
    tone: "conflict",
    retry: false,
  },
};

export function ConnectNoticeDialog({ open, variant, onClose, onRetry }: {
  open: boolean;
  variant: NoticeVariant;
  onClose: () => void;
  onRetry?: () => void;
}): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open) {
      if (typeof el.showModal === "function") { if (!el.open) el.showModal(); }
      else el.setAttribute("open", "");
    } else if (typeof el.close === "function") {
      if (el.open) el.close();
    } else {
      el.removeAttribute("open");
    }
  }, [open]);

  const notice = NOTICE[variant];
  return (
    <dialog
      ref={dialog}
      className="htv2-popup"
      aria-labelledby="htv2-popup-title"
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => { if (event.target === dialog.current) onClose(); }}
    >
      <div className="htv2-popup-card">
        <button type="button" className="htv2-popup-x" onClick={onClose} aria-label="Close">
          <X size={18} strokeWidth={2} />
        </button>
        <div className={`htv2-popup-icon htv2-popup-icon-${notice.tone}`}>
          {variant === "conflict"
            ? <AlertTriangle size={26} strokeWidth={1.8} />
            : <Mouse size={26} strokeWidth={1.8} />}
        </div>
        <h2 id="htv2-popup-title" className="htv2-popup-title">{notice.title}</h2>
        <p className="htv2-popup-body">{notice.body}</p>
        {notice.retry
          ? (
            <button type="button" className="htv2-popup-retry" onClick={onRetry}>
              <RotateCw size={16} strokeWidth={2} />Retry
            </button>
          )
          : (
            <button type="button" className="htv2-popup-retry" onClick={onClose}>Got it</button>
          )}
      </div>
    </dialog>
  );
}
