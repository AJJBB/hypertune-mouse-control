// Integrated "Mouse Control" Home — Ivan's Figma "Mouse – Added (device list)"
// and "Mouse – Nothing Connected" screens (Hypertune v2.0 › App / Mouse),
// rebuilt on the Mouse Component System kit. Native HyperTune draws the window,
// sidebar and breadcrumb; this is the 1210×695 content frame below them.
//
// One card per mouse (the active one highlighted) plus a dashed "Add mouse"
// card; the grid scrolls inside the frame so any number of mice lays out with
// cards at their full 390×447 size. Beyond the design (kept on purpose): the
// Remove-mouse trash button + its inline confirm, a quiet Report-a-problem
// entry, and the OpenMouse / AGPL-3.0 attribution the licence requires.
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as control from "../../device/controller";
import { connectionText } from "../../i18n";
import type { ControlSnapshot, SidebarDevice } from "../../device/types";
import { deviceImage } from "../../ui/device-images";
import { BatteryIcon, Button, Icon, IconButton, InfoRow, StatusPill } from "./kit";
import { ConnectNoticeDialog } from "./ConnectNoticeDialog";
import { LegalCredit } from "./LegalCredit";
import "./home.css";

function isCharging(state: string | undefined): boolean {
  return state === "Charging" || state === "Charging slowly" || state === "Almost full";
}

/** "Pulsar X2 V2" under a "PULSAR" brand line reads as "X2 V2" (as on the reference). */
function modelName(name: string, brand: string): string {
  const b = brand.trim();
  if (b && name.toLowerCase().startsWith(`${b.toLowerCase()} `)) {
    const rest = name.slice(b.length + 1).trim();
    if (rest) return rest;
  }
  return name;
}

/** Starts control.connect() and tracks it, so the Add buttons disable and the
    "Add a mouse" (connecting) popup can show while it runs. */
function useAddMouse(snapshot: ControlSnapshot): { adding: boolean; disabled: boolean; add: () => void; dismiss: () => void } {
  const [adding, setAdding] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  return {
    adding: adding && popupOpen,
    disabled: adding || snapshot.connectDisabled,
    add: () => {
      if (adding) return;
      setAdding(true);
      setPopupOpen(true);
      void control.connect().finally(() => { setAdding(false); setPopupOpen(false); });
    },
    dismiss: () => setPopupOpen(false),
  };
}

function DeviceCard({ device, snapshot }: { device: SidebarDevice; snapshot: ControlSnapshot }): ReactNode {
  const active = device.selected;
  const status = active ? snapshot.status : null;
  const locale = snapshot.preferences.locale;
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);
  const [brandFromDetail, connFromDetail] = device.detail.split(" · ");

  const brandRaw = status?.brand ?? brandFromDetail ?? "";
  const model = modelName(status?.name ?? device.name, brandRaw);
  const fullName = status?.name ?? device.name;
  const dpi = status && status.dpi > 0 ? status.dpi.toLocaleString("en-US") : "—";
  const polling = status?.pollingRateHz ? `${status.pollingRateHz} Hz` : "—";
  const connection = status?.connectionType
    ? status.connectionDetail
      ? `${connectionText(locale, status.connectionType)} · ${status.connectionDetail}`
      : connectionText(locale, status.connectionType)
    : connFromDetail ?? "—";
  const battery = status?.batteryPercent ?? null;
  const charging = isCharging(status?.batteryState);

  // Keyboard users land on Cancel when the confirm opens; Esc backs out.
  useEffect(() => {
    if (!confirming) return;
    confirmRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [confirming]);

  const remove = (): void => {
    if (removing) return;
    setRemoving(true);
    void control.removeDevice(device.index).finally(() => {
      setRemoving(false);
      setConfirming(false);
    });
  };

  return (
    <article className={`mk-home-card${active ? " is-active" : ""}`} aria-label={fullName}>
      <div className="mk-home-card__render">
        <img
          className="mk-home-card__img"
          src={deviceImage({ vendorId: device.vendorId, productId: device.productId } as HIDDevice, device.name)}
          alt=""
          draggable={false}
          decoding="async"
          onError={(e) => { e.currentTarget.src = deviceImage(null); }}
        />
        <div className="mk-home-card__pills">
          {active ? <StatusPill type="active" label="Active" /> : <span />}
          {battery !== null ? (
            <StatusPill
              label={`${battery}%${charging ? " Charging" : ""}`}
              icon={<BatteryIcon percent={battery} charging={charging} />}
            />
          ) : null}
        </div>
      </div>
      <div className="mk-home-card__body">
        <div className="mk-home-card__info">
          <div className="mk-home-card__name">
            {brandRaw ? <span className="mk-home-card__brand mk-t-caption12m">{brandRaw}</span> : null}
            <h3 className="mk-home-card__model mk-t-heading22">{model}</h3>
          </div>
          <div className="mk-home-card__specs">
            <InfoRow label="DPI" value={dpi} />
            <InfoRow label="Polling rate" value={polling} />
            <InfoRow label="Connection" value={connection} />
          </div>
        </div>
        <div className="mk-home-card__actions">
          <Button
            label="Open"
            className="mk-home-card__open"
            ariaLabel={`Open ${fullName}`}
            onClick={() => void control.openDeviceOverview(device.index)}
          />
          <IconButton
            icon="trash"
            danger
            iconSize={18}
            className="mk-home-card__remove"
            label={`Remove ${fullName}`}
            title="Remove this mouse"
            onClick={() => setConfirming(true)}
          />
        </div>
      </div>
      {confirming ? (
        <div
          ref={confirmRef}
          className="mk-home-card__confirm"
          role="alertdialog"
          aria-label="Remove mouse"
          aria-modal="true"
          onKeyDown={(e) => { if (e.key === "Escape" && !removing) setConfirming(false); }}
        >
          <p className="mk-home-card__confirm-title mk-t-title16">Remove this mouse?</p>
          <p className="mk-home-card__confirm-sub mk-t-body14">{fullName} will be removed from HyperTune. You can add it again anytime.</p>
          <div className="mk-home-card__confirm-actions">
            <Button label="Cancel" size="medium" disabled={removing} onClick={() => setConfirming(false)} />
            <Button label={removing ? "Removing…" : "Remove"} size="medium" variant="danger" icon="trash" showIcon={!removing} disabled={removing} onClick={remove} />
          </div>
        </div>
      ) : null}
    </article>
  );
}

function AddMouseCard({ disabled, onAdd }: { disabled: boolean; onAdd: () => void }): ReactNode {
  return (
    <button type="button" className="mk-home-add" disabled={disabled} onClick={onAdd}>
      <img className="mk-home-add__art" src="/v2/empty-mouse.png" alt="" draggable={false} />
      <span className="mk-home-plus" aria-hidden="true">
        <span className="mk-home-plus__core"><Icon name="plus" size={29} /></span>
      </span>
      <span className="mk-home-add__text">
        <span className="mk-home-add__title">Add mouse</span>
        <span className="mk-home-add__sub">Plug in another mouse or its wireless receiver, then add it here. Turn wireless mice on first.</span>
      </span>
    </button>
  );
}

/** Nothing connected: art, title, copy, the glowing Add mouse call to action
    and a "Having an issue?" link (opens Report a problem). */
function EmptyState({ disabled, onAdd }: { disabled: boolean; onAdd: () => void }): ReactNode {
  return (
    <div className="mk-home-empty">
      <div className="mk-home-empty__art" aria-hidden="true">
        <img src="/v2/empty-mouse.png" alt="" draggable={false} />
      </div>
      <div className="mk-home-empty__text">
        <h2 className="mk-home-empty__title">No mouse connected</h2>
        <p className="mk-home-empty__sub">Plug in your mouse or its wireless receiver, then add it.<br />Turn wireless mice on first so HyperTune can find them.</p>
        <div className="mk-home-cta-well">
          <Button label="Add mouse" icon="plus" variant="primary" className="mk-home-cta" disabled={disabled} onClick={onAdd} />
        </div>
        <button type="button" className="mk-home-link mk-t-body14" onClick={() => control.openReportProblem()}>
          Having an issue?
        </button>
      </div>
    </div>
  );
}

/** Quiet bottom line: Report a problem (grid only — the empty state has its own
    link) and the OpenMouse / AGPL-3.0 attribution (licence requirement). */
function HomeFoot({ report }: { report: boolean }): ReactNode {
  return (
    <footer className="mk-home-foot mk-t-caption12">
      {report ? (
        <span className="mk-home-foot__report">
          Mouse not detecting, or having an issue?{" "}
          <button type="button" className="mk-home-foot__link" onClick={() => control.openReportProblem()}>
            <Icon name="flag" size={12} />Report a problem
          </button>
        </span>
      ) : <span />}
      <LegalCredit />
    </footer>
  );
}

export function DeviceGrid({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const mice = snapshot.devices.filter((d) => d.kind === "mouse");
  const add = useAddMouse(snapshot);
  return (
    <div className="mk-home">
      {mice.length === 0 ? (
        <EmptyState disabled={add.disabled} onAdd={add.add} />
      ) : (
        <div className="mk-home-grid" role="list" aria-label="Your mice">
          {mice.map((device) => (
            <div role="listitem" key={`${device.vendorId}:${device.productId}:${device.index}`} className="mk-home-grid__cell">
              <DeviceCard device={device} snapshot={snapshot} />
            </div>
          ))}
          <div role="listitem" className="mk-home-grid__cell">
            <AddMouseCard disabled={add.disabled} onAdd={add.add} />
          </div>
        </div>
      )}
      <HomeFoot report={mice.length > 0} />
      <ConnectNoticeDialog variant="connecting" open={add.adding} onClose={add.dismiss} />
    </div>
  );
}
