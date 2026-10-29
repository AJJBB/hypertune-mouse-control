// v2.0 integrated "Mouse Control" content pane — the device grid (list view).
// Native HyperTune draws the window, sidebar and breadcrumb; this is the content
// below it. Matches the Figma "App / Mouse WIP → Mouse - Added / Nothing
// Connected" frames 1:1, driven by the live controller snapshot.
import { useState, type ReactNode } from "react";
import { Plus, Flag } from "lucide-react";
import * as control from "../../device/controller";
import { connectionText } from "../../i18n";
import type { ControlSnapshot, SidebarDevice } from "../../device/types";
import { deviceImage } from "../../ui/device-images";

function isCharging(state: string | undefined): boolean {
  return state === "Charging" || state === "Charging slowly" || state === "Almost full";
}

/** Battery pill icon — outline with a proportional fill; amber + bolt when charging. */
function BatteryIcon({ percent, charging }: { percent: number; charging: boolean }): ReactNode {
  const w = Math.max(1, Math.round((percent / 100) * 11));
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="2" y="8" width="16" height="9" rx="2.5" stroke="#b7b7b8" strokeWidth="1.6" />
      <rect x="19" y="11" width="2" height="3" rx="1" fill="#b7b7b8" />
      <rect x="4" y="10" width={w} height="5" rx="1" fill={charging ? "#efbf04" : "#b7b7b8"} />
      {charging ? <path d="M12 7.5l-2.2 3.4h1.9l-.4 2.6 2.4-3.6h-1.9z" fill="#efbf04" /> : null}
    </svg>
  );
}

function DeviceCard({ device, snapshot }: { device: SidebarDevice; snapshot: ControlSnapshot }): ReactNode {
  const active = device.selected;
  const status = active ? snapshot.status : null;
  const locale = snapshot.preferences.locale;
  const [brandFromDetail, connFromDetail] = device.detail.split(" · ");

  const brand = (status?.brand ?? brandFromDetail ?? "").toUpperCase();
  const model = status?.name ?? device.name;
  const dpi = status && status.dpi > 0 ? status.dpi.toLocaleString() : "—";
  const polling = status?.pollingRateHz ? `${status.pollingRateHz} Hz` : "—";
  const connection = status?.connectionType
    ? status.connectionDetail
      ? `${connectionText(locale, status.connectionType)} · ${status.connectionDetail}`
      : connectionText(locale, status.connectionType)
    : connFromDetail ?? "—";
  const battery = status?.batteryPercent ?? null;
  const charging = isCharging(status?.batteryState);

  return (
    <article className="htv2-card">
      <div className="htv2-card-media">
        <img
          src={deviceImage({ vendorId: device.vendorId, productId: device.productId } as HIDDevice, device.name)}
          alt=""
          draggable={false}
          decoding="async"
          onError={(e) => { e.currentTarget.src = deviceImage(null); }}
        />
        <div className="htv2-card-badges">
          <span>
            {active ? (
              <span className="htv2-badge is-active">
                <span className="htv2-badge-dot" />
                Active
              </span>
            ) : null}
          </span>
          <span>
            {battery !== null ? (
              <span className="htv2-badge htv2-badge-battery">
                <BatteryIcon percent={battery} charging={charging} />
                {battery}%{charging ? " Charging" : ""}
              </span>
            ) : null}
          </span>
        </div>
      </div>
      <div className="htv2-card-body">
        <div className="htv2-card-info">
          <div className="htv2-card-name">
            {brand ? <span className="htv2-card-brand">{brand}</span> : null}
            <h3 className="htv2-card-model">{model}</h3>
          </div>
          <dl className="htv2-card-specs">
            <div className="htv2-spec-row"><dt>DPI</dt><dd>{dpi}</dd></div>
            <div className="htv2-spec-row"><dt>Polling rate</dt><dd>{polling}</dd></div>
            <div className="htv2-spec-row"><dt>Connection</dt><dd>{connection}</dd></div>
          </dl>
        </div>
        <button
          type="button"
          className="htv2-card-open"
          onClick={() => void control.openDeviceOverview(device.index)}
        >
          Open
        </button>
      </div>
    </article>
  );
}

function AddMouseCard({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const [busy, setBusy] = useState(false);
  const disabled = busy || snapshot.connectDisabled;
  return (
    <button
      type="button"
      className="htv2-card htv2-card-add"
      disabled={disabled}
      onClick={() => {
        if (busy) return;
        setBusy(true);
        void control.connect().finally(() => setBusy(false));
      }}
    >
      <span className="htv2-add-plus" aria-hidden="true"><Plus size={28} strokeWidth={2.4} /></span>
      <span className="htv2-add-title">Add mouse</span>
      <span className="htv2-add-sub">Plug in another mouse or its wireless receiver, then add it here. Turn wireless mice on first.</span>
    </button>
  );
}

/** Centered empty state — no devices connected. */
function EmptyState({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const [busy, setBusy] = useState(false);
  const disabled = busy || snapshot.connectDisabled;
  return (
    <div className="htv2-empty">
      <img className="htv2-empty-art" src="/v2/empty-mouse.png" alt="" draggable={false} />
      <h2 className="htv2-empty-title">No mouse connected</h2>
      <p className="htv2-empty-sub">Plug in your mouse or its wireless receiver, then add it.<br />Turn wireless mice on first so HyperTune can find them.</p>
      <button
        type="button"
        className="htv2-add-btn"
        disabled={disabled}
        onClick={() => {
          if (busy) return;
          setBusy(true);
          void control.connect().finally(() => setBusy(false));
        }}
      >
        <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
        Add mouse
      </button>
    </div>
  );
}

/** Bottom bar for the connect/grid page: a Report-a-problem prompt (so users
    can always report issues) plus the required OpenMouse / AGPL attribution. */
function GridFoot(): ReactNode {
  return (
    <footer className="htv2-grid-foot">
      <div className="htv2-grid-report">
        <span>Mouse not detecting, or having an issue?</span>
        <button type="button" className="htv2-dreport" onClick={() => control.openReportProblem()}>
          <Flag size={15} strokeWidth={1.8} />Report a problem
        </button>
      </div>
      <div className="htv2-legal">
        <span>In partnership with <a href="https://github.com/OpenMouse-Project/mouse-protocol" target="_blank" rel="noreferrer noopener">OpenMouse</a></span>
        <span><a href="https://github.com/AJJBB/hypertune-mouse-control" target="_blank" rel="noreferrer noopener">Source</a>{" · "}<a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noreferrer noopener">AGPL-3.0</a></span>
      </div>
    </footer>
  );
}

export function DeviceGrid({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const mice = snapshot.devices.filter((d) => d.kind === "mouse");
  return (
    <div className="htv2-grid-wrap">
      {mice.length === 0 ? (
        <EmptyState snapshot={snapshot} />
      ) : (
        <div className="htv2-device-grid">
          {mice.map((device) => (
            <DeviceCard key={`${device.vendorId}:${device.productId}:${device.index}`} device={device} snapshot={snapshot} />
          ))}
          <AddMouseCard snapshot={snapshot} />
        </div>
      )}
      <GridFoot />
    </div>
  );
}
