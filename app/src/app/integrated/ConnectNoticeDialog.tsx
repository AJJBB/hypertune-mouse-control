// Integrated connection popups — Ivan's Figma "Popup – Connecting", "Popup –
// Error" and "Popup – Close GHUB / Synapse" (Hypertune v2.0 › App / Mouse),
// built on the Mouse Component System kit. A centred 446-wide modal over a
// dimmed backdrop. Rendered only in integrated mode; the standalone build keeps
// its own notice dialog + toasts.
//
//   connecting  "Add a mouse": shown while an Add mouse request runs. Lists the
//               other mice HyperTune can already reach (Add opens/connects one),
//               or a live status row while the browser picker / device open runs.
//   error       "Couldn't Connect" + Retry.
//   conflict    "Close G HUB first" + Retry (another vendor app holds the mouse).
//   razer-web   Razer in the plain web build (no design yet — same modal, Got it).
import { useEffect, useId, useRef, type ReactNode } from "react";
import * as control from "../../device/controller";
import { deviceImage } from "../../ui/device-images";
import { useControl } from "../useControl";
import { Button, Icon } from "./kit";
import "./kit/tokens.css";
import "./home.css";

export type NoticeVariant = "connecting" | "error" | "conflict" | "razer-web";

type NoticeCopy = { title: string; body: string; art: string; retry: boolean };

function noticeCopy(variant: Exclude<NoticeVariant, "connecting">, app: string | undefined): NoticeCopy {
  if (variant === "error") {
    return {
      title: "Couldn’t Connect",
      body: "The mouse didn’t respond. Unplug it, plug it back in and try again. If it’s on a USB hub, use a port on the PC itself.",
      art: "/v2/popup-error.png",
      retry: true,
    };
  }
  if (variant === "conflict") {
    const name = app ?? "G HUB or Synapse";
    return {
      title: `Close ${app ?? "G HUB / Synapse"} first`,
      body: `HyperTune can’t read or save settings while ${name} is open. Close it from the system tray, then try again.`,
      art: "/v2/popup-conflict.png",
      retry: true,
    };
  }
  return {
    title: "Razer isn’t supported here yet",
    body: "Razer mice can’t be controlled in the web version — their control channel needs the HyperTune desktop app. Once it ships there it’ll have full functionality.",
    art: "/v2/popup-conflict.png",
    retry: false,
  };
}

/** "Add a mouse" body: the other mice HyperTune can already reach, each with
    Add (opens it, connecting first when needed), or a live status row. */
function ConnectingBody({ onClose, titleId }: { onClose: () => void; titleId: string }): ReactNode {
  const snapshot = useControl();
  const others = snapshot.devices.filter((d) => d.kind === "mouse" && !d.selected);
  // control.connect() labels the connect buttons "Connecting…" while it runs.
  const connecting = snapshot.connectDisabled && snapshot.connectLabel === "Connecting…";
  return (
    <>
      <div className="mk-modal__head">
        <h2 id={titleId} className="mk-modal__title">Add a mouse</h2>
        <p className="mk-modal__lede">Turn your mouse on or plug in its receiver. Supported mice show up below.</p>
      </div>
      <div className="mk-modal__picker">
        <div className="mk-modal__list" role="list" aria-label="Mice found">
          {others.length > 0 ? others.map((d) => {
            const [brand, conn] = d.detail.split(" · ");
            const name = brand && !d.name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${d.name}` : d.name;
            return (
              <div className="mk-modal__row" role="listitem" key={d.key}>
                <span className="mk-modal__thumb" aria-hidden="true">
                  <img
                    src={deviceImage({ vendorId: d.vendorId, productId: d.productId } as HIDDevice, d.name)}
                    alt=""
                    draggable={false}
                    onError={(e) => { e.currentTarget.src = deviceImage(null); }}
                  />
                </span>
                <span className="mk-modal__row-text">
                  <span className="mk-modal__row-name mk-t-label14">{name}</span>
                  <span className="mk-modal__row-detail mk-t-caption12">{conn ?? d.detail}</span>
                </span>
                <Button
                  label="Add"
                  size="medium"
                  className="mk-modal__row-add"
                  ariaLabel={`Add ${name}`}
                  onClick={() => { onClose(); void control.openDeviceOverview(d.index); }}
                />
              </div>
            );
          }) : (
            <div className="mk-modal__row is-status" role="listitem" aria-live="polite">
              <span className="mk-modal__thumb" aria-hidden="true">
                <span className="mk-modal__spinner" />
              </span>
              <span className="mk-modal__row-text">
                <span className="mk-modal__row-name mk-t-label14">{connecting ? "Looking for your mouse…" : "Waiting for a mouse"}</span>
                <span className="mk-modal__row-detail mk-t-caption12">{connecting && snapshot.readStatus ? snapshot.readStatus : "Plug it in and turn it on, then pick it when asked."}</span>
              </span>
            </div>
          )}
        </div>
        <button type="button" className="mk-home-link mk-t-body14" onClick={() => { onClose(); control.openReportProblem(); }}>
          Mouse not showing up?
        </button>
      </div>
    </>
  );
}

export function ConnectNoticeDialog({ open, variant, onClose, onRetry, app }: {
  open: boolean;
  variant: NoticeVariant;
  onClose: () => void;
  onRetry?: () => void;
  /** Conflict only: the other mouse app that is open ("G HUB", "Synapse"…), when known. */
  app?: string;
}): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open) {
      if (typeof el.showModal === "function") { if (!el.open) el.showModal(); }
      else el.setAttribute("open", "");
      // Land focus on the dialog itself (announced via aria-labelledby) rather
      // than ringing the first button; Tab moves into the actions.
      el.focus();
    } else if (typeof el.close === "function") {
      if (el.open) el.close();
    } else {
      el.removeAttribute("open");
    }
  }, [open]);

  const notice = variant === "connecting" ? null : noticeCopy(variant, app);
  return (
    <dialog
      ref={dialog}
      className={`mk-modal mk-modal--${variant}`}
      tabIndex={-1}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => { if (event.target === dialog.current) onClose(); }}
    >
      <div className="mk-modal__inner">
        {open && variant === "connecting" ? <ConnectingBody onClose={onClose} titleId={titleId} /> : null}
        {notice ? (
          <>
            <img className="mk-modal__art" src={notice.art} alt="" draggable={false} />
            <h2 id={titleId} className="mk-modal__title">{notice.title}</h2>
            <p className="mk-modal__body">{notice.body}</p>
            {notice.retry
              ? <Button label="Retry" icon="reset" className="mk-modal__action" onClick={onRetry} />
              : <Button label="Got it" className="mk-modal__action" onClick={onClose} />}
          </>
        ) : null}
      </div>
      <button type="button" className="mk-modal__close" onClick={onClose} aria-label="Close">
        <Icon name="close" size={22} />
      </button>
    </dialog>
  );
}
