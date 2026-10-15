import { useEffect, useRef, type ReactNode } from "react";

/**
 * Shown when someone picks a Razer mouse in the hosted web beta. WebHID can't
 * drive Razer's control channel and only the desktop shell's native bridge can,
 * so instead of a dead-end connection error we explain that Razer works once the
 * feature ships inside Hypertune. See controller.ts (requestSupportedClient /
 * selectAuthorizedDevice) for where this is triggered.
 */
export function RazerWebNoticeDialog({ open, onClose }: {
  open: boolean;
  onClose: () => void;
}): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);

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

  return (
    <dialog
      ref={dialog}
      className="support-dialog feedback-dialog razer-web-dialog"
      aria-labelledby="razer-web-title"
      onClose={onClose}
      onClick={(event) => { if (event.target === dialog.current) onClose(); }}
    >
      <div className="support-dialog-inner feedback-dialog-inner">
        <header>
          <div>
            <p className="overline">Hypertune · Web beta</p>
            <h2 id="razer-web-title">Razer isn't supported here yet</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>

        <p className="razer-web-body">
          Unfortunately, during this web version beta test, Razer products do not work.
        </p>
        <p className="razer-web-body">
          Don't worry — once it's in Hypertune it will have full functionality.
          Thank you for your support.
        </p>

        <div className="feedback-actions">
          <button type="button" className="is-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </dialog>
  );
}
