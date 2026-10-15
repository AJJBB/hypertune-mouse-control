import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Clock,
  Flag,
  Gauge,
  ImageUp,
  Layers,
  Lightbulb,
  MousePointerClick,
  Plus,
  Settings2,
  Share2,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as control from "../device/controller";
import type { ControlSnapshot, WorkspaceTab } from "../device/types";
import { t, tp, connectionText, type I18nKey } from "../i18n";
import { MouseTestPage } from "./MouseTestPage";
import { LogitechDetails } from "./Diagnostics";
import { KeychronNapeLayers } from "./KeychronNapeLayers";
import { Profiles } from "./Profiles";
import { SoftwareProfiles } from "./SoftwareProfiles";
import { Superstrike } from "./Superstrike";
import { DpiCard } from "./cards/DpiCard";
import { LightforceCard, PollingCard, SensorCard } from "./cards/PerformanceCards";
import { LightingCard } from "./cards/LightingCard";
import { MxMasterButtonsCard, MxMasterCards } from "./cards/MxMasterCards";
import { AtkButtonCard, AtkProfileCard, AtkReceiverCard } from "./cards/AtkCards";
import {
  DebounceCard,
  EggButtonCard,
  EggCpiCard,
  EggFilterCard,
  EggPollingCard,
  EggSpdtCard,
  FinalmouseCard,
  IncottCard,
  LowPowerCard,
  NinjutsoClickCard,
  NinjutsoSensorCard,
  ProcessingCard,
  RazerButtonCard,
  ButtonMappingCard,
  PowerModeCard,
  OnboardProfileCard,
  PulsarProCard,
  SignalCard,
  SleepCard,
  DpiLightingCard,
} from "./cards/AdvancedCards";
import { cardAvailability, hasNativeProfileManagement } from "./cards/availability";
import { activeSoftwareProfile } from "../software-profiles";
import { TeevolutionProfileCard } from "./cards/teevolution/ProfileCard";
import { deviceImage, isUnknownDevice, showcaseDeviceImageUrls } from "../ui/device-images";
import { BatteryIcon } from "./ui";

function DeviceShowcase({ snapshot, onRequestArtwork }: {
  snapshot: ControlSnapshot;
  onRequestArtwork: () => void;
}): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const locale = snapshot.preferences.locale;
  const image = snapshot.deviceArtwork;
  const [imageFailed, setImageFailed] = useState(false);

  const activeDevice = control.getActiveDevice();
  const needsArtwork = activeDevice && (
    imageFailed || isUnknownDevice(
      { vendorId: activeDevice.vendorId, productId: activeDevice.productId } as HIDDevice,
      status.name,
    )
  );

  return (
    <div className="device-showcase">
      <h1 className="device-showcase-name">{status.name}</h1>
      <p className="device-showcase-brand">{status.brand}</p>
      <div className="device-showcase-visual">
        {image ? (
          <img
            className="device-showcase-image"
            src={image}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = deviceImage(null);
              setImageFailed(true);
            }}
            alt={status.name}
          />
        ) : null}
      </div>
      <div className="device-showcase-status">
        <span className="device-showcase-dot" aria-hidden="true" />
        {t(locale, "side.connected")}
        {status.connectionType ? (
          <span className="device-showcase-status-detail">
            {" · "}{connectionText(locale, status.connectionType)}
          </span>
        ) : null}
        {status.batteryPercent !== null ? (
          <span className="device-showcase-status-detail">
            {" · "}
            <BatteryIcon percent={status.batteryPercent} state={status.batteryState} />
            {status.batteryPercent}%
          </span>
        ) : null}
      </div>
      {needsArtwork ? (
        <button
          type="button"
          className="artwork-upload-trigger"
          onClick={onRequestArtwork}
        >
          <ImageUp size={14} strokeWidth={2.2} aria-hidden="true" />
          {t(locale, "artreq.request" as I18nKey)}
        </button>
      ) : null}
    </div>
  );
}

function DeviceInfoGrid({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const locale = snapshot.preferences.locale;
  const has = cardAvailability(snapshot);
  // A device can report `status.activeProfile` without any real profile
  // feature behind it (base Pulsar reads which onboard slot is active but
  // exposes no switch/write command) — that used to show "Profile 1" with no
  // way to see or switch profiles anywhere. Fall back to the software
  // profile the user picked in the Profiles tab instead, if any.
  const hasNativeProfiles = hasNativeProfileManagement(has);
  const device = control.getActiveDevice();
  const activeSoftware = !hasNativeProfiles && device
    ? activeSoftwareProfile(control.deviceStorageKey(device))
    : null;

  const currentRows: Array<{ label: string; value: string; sub?: string }> = [
    {
      label: "DPI",
      value: status.dpi > 0 ? status.dpi.toLocaleString() : "—",
    },
    {
      label: "Polling rate",
      value: status.pollingRateHz ? `${status.pollingRateHz} Hz` : "—",
    },
  ];
  if (hasNativeProfiles && status.activeProfile !== null && status.activeProfile !== undefined) {
    currentRows.push({
      label: "Profile",
      value: status.onboardProfileFormat?.name
        ? `Profile ${status.activeProfile} (${status.onboardProfileFormat.name})`
        : status.activeProfile !== null
          ? `Profile ${status.activeProfile}`
          : "Default",
    });
  } else if (activeSoftware) {
    currentRows.push({ label: "Profile", value: activeSoftware.name });
  }
  if (status.batteryPercent !== null) {
    currentRows.push({
      label: "Battery",
      value: `${status.batteryPercent}%`,
      sub: status.batteryState !== "Unknown" ? String(status.batteryState) : undefined,
    });
  }
  if (status.connectionType) {
    currentRows.push({
      label: "Connection",
      value: status.connectionDetail
        ? `${connectionText(locale, status.connectionType)} (${status.connectionDetail})`
        : connectionText(locale, status.connectionType),
    });
  }

  const infoRows: Array<{ label: string; value: string; mono?: boolean }> = [];
  infoRows.push({ label: "Manufacturer", value: status.brand });
  if (status.firmware.length > 0) {
    infoRows.push({ label: "Firmware", value: status.firmware.join(" · "), mono: status.firmware.length === 1 });
  }
  if (status.modelId) infoRows.push({ label: "Model ID", value: status.modelId, mono: true });
  if (status.unitId) infoRows.push({ label: "Unit ID", value: status.unitId, mono: true });
  if (status.friendlyName) infoRows.push({ label: "Friendly name", value: status.friendlyName });

  if (currentRows.length === 0 && infoRows.length === 0) return null;

  return (
    <div className="device-info-grid">
      {currentRows.length > 0 ? (
        <div className="info-section">
          <span className="info-section-title">Current Status</span>
          <div className="info-grid">
            {currentRows.map((row) => (
              <div className="info-row" key={row.label}>
                <span className="info-label">{row.label}</span>
                <span className="info-value">
                  {row.value}
                  {row.sub ? <span className="info-value-sub"> · {row.sub}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {infoRows.length > 0 ? (
        <div className="info-section">
          <span className="info-section-title">Device Information</span>
          <div className="info-grid">
            {infoRows.map((row) => (
              <div className="info-row" key={row.label}>
                <span className="info-label">{row.label}</span>
                <span className={`info-value${row.mono ? " info-value-mono" : ""}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const SHOWCASE_IMAGES = showcaseDeviceImageUrls();
const SHOWCASE_INTERVAL_MS = 3800;

function MouseArtworkShowcase({ reducedMotion }: { reducedMotion: boolean }): ReactNode {
  const [index, setIndex] = useState(0);
  // Load showcase frames lazily. Rendering all 12 <img src> up front pulls
  // ~2.9 MB of product PNGs onto the connect screen — wasteful when most people
  // connect a mouse within seconds. Only the current frame and the next one
  // (preloaded for a seamless cross-fade) get a src; the rest stay unrequested.
  const [shown, setShown] = useState<Set<number>>(() => new Set([0]));

  useEffect(() => {
    setShown((prev) => {
      const next = (index + 1) % SHOWCASE_IMAGES.length;
      if (prev.has(index) && prev.has(next)) return prev;
      return new Set(prev).add(index).add(next);
    });
  }, [index]);

  useEffect(() => {
    if (reducedMotion || SHOWCASE_IMAGES.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % SHOWCASE_IMAGES.length);
    }, SHOWCASE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  return (
    <div className="add-device-mouse-showcase">
      {SHOWCASE_IMAGES.map((src, i) => (
        <img
          key={src}
          src={shown.has(i) ? src : undefined}
          alt=""
          draggable={false}
          decoding="async"
          className={`add-device-mouse-showcase-frame${i === index ? " is-active" : ""}`}
        />
      ))}
    </div>
  );
}

function AddDeviceCard({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const locale = snapshot.preferences.locale;
  const [busy, setBusy] = useState(false);
  const label = busy ? t(locale, "conn.connecting") : t(locale, "conn.addMouse");
  const disabled = busy || snapshot.connectDisabled;
  return (
    <div className={`device-tile add-device-tile${busy ? " is-busy" : ""}`} aria-label={label}>
      <span className="device-tile-name">{label}</span>
      <div className="device-tile-visual" aria-hidden="true">
        <MouseArtworkShowcase reducedMotion={snapshot.preferences.reducedMotion} />
      </div>
      <button
        type="button"
        className="add-device-button"
        disabled={disabled}
        onClick={() => {
          if (busy) return;
          setBusy(true);
          void control.connect().finally(() => setBusy(false));
        }}
      >
        <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
        {label}
      </button>
    </div>
  );
}

function OverviewEmpty({ snapshot, compact = false }: { snapshot: ControlSnapshot; compact?: boolean }): ReactNode {
  const locale = snapshot.preferences.locale;
  return (
    <div className={`welcome-screen${compact ? " is-compact" : ""}`}>
      <div className="welcome-aurora" aria-hidden="true">
        <i /><i /><i />
      </div>
      <div className="welcome-hero">
        <h2 className="welcome-title">{t(locale, "empty.title")}</h2>
        <p className="welcome-body">{t(locale, "empty.body")}</p>
        {!compact ? (
          <div className="add-device-grid">
            <AddDeviceCard snapshot={snapshot} />
          </div>
        ) : null}
        {!compact ? (
          <div className="ht-empty-actions">
            <p className="ht-empty-help">Mouse not detecting or have an issue?</p>
            <button type="button" className="ht-report-btn ht-report-btn-lg" onClick={() => control.openReportProblem()}>
              Report a problem
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OverviewContent({ snapshot, onRequestArtwork }: {
  snapshot: ControlSnapshot;
  onRequestArtwork: () => void;
}): ReactNode {
  const status = snapshot.status;
  if (!status) return <OverviewEmpty snapshot={snapshot} />;
  const has = cardAvailability(snapshot);
  const powerOverview = status.ui?.powerOverview === true;
  return (
    <>
      <DeviceShowcase snapshot={snapshot} onRequestArtwork={onRequestArtwork} />
      <DeviceInfoGrid snapshot={snapshot} />
      {powerOverview && (has.teevolutionDpiLighting || has.sleep) ? (
        <section id="power-overview-settings" className="settings-grid device-data" aria-label="Power settings">
          {has.teevolutionDpiLighting ? <DpiLightingCard snapshot={snapshot} /> : null}
          {has.sleep ? <SleepCard snapshot={snapshot} /> : null}
        </section>
      ) : null}
    </>
  );
}

interface DashboardSections {
  performance: ReactNode[];
  lighting: ReactNode[];
  buttons: ReactNode[];
  profiles: ReactNode[];
  advanced: ReactNode[];
}

/** Every configurable card for the connected device, grouped into the same
    five categories the tab bar switches between. Computed once and shared
    by the tab bar (to know which tabs have anything in them) and the
    workspace (to render the active one). */
function computeDashboardSections(snapshot: ControlSnapshot): DashboardSections {
  const status = snapshot.status!;
  const has = cardAvailability(snapshot);
  const powerOverview = status.ui?.powerOverview === true;

  const performance = [
    has.dpi ? <DpiCard key="dpi" snapshot={snapshot} /> : null,
    has.polling ? <PollingCard key="polling" snapshot={snapshot} /> : null,
    has.sensor ? <SensorCard key="sensor" snapshot={snapshot} /> : null,
    has.lightforce ? <LightforceCard key="lightforce" snapshot={snapshot} /> : null,
    has.ninjutsoSensor ? <NinjutsoSensorCard key="ninjutso-sensor" snapshot={snapshot} /> : null,
    has.ninjutsoClick ? <NinjutsoClickCard key="ninjutso-click" snapshot={snapshot} /> : null,
    has.processing ? <ProcessingCard key="processing" snapshot={snapshot} /> : null,
    has.eggFilter ? <EggFilterCard key="eggfilter" snapshot={snapshot} /> : null,
    has.eggPolling ? <EggPollingCard key="eggpolling" snapshot={snapshot} /> : null,
    has.eggCpi ? <EggCpiCard key="eggcpi" snapshot={snapshot} /> : null,
    has.powerMode ? <PowerModeCard key="power-mode" snapshot={snapshot} /> : null,
  ].filter((node) => node !== null);

  const lightingZones = status.lightingZones?.length ? status.lightingZones : status.lighting ? [status.lighting] : [];
  const lighting = [
    has.lighting ? <LightingCard key="lighting-main" snapshot={snapshot} variant="tab" zones={lightingZones} /> : null,
    !powerOverview && has.teevolutionDpiLighting ? <DpiLightingCard key="dpi-indicator" snapshot={snapshot} /> : null,
    has.lightingAdvanced ? <LightingCard key="lighting-advanced" snapshot={snapshot} variant="advanced" /> : null,
  ].filter((node) => node !== null);

  const buttons = [
    has.debounce ? <DebounceCard key="debounce" snapshot={snapshot} /> : null,
    has.eggSpdt ? <EggSpdtCard key="eggspdt" snapshot={snapshot} /> : null,
    has.eggButtons ? <EggButtonCard key="eggbuttons" snapshot={snapshot} /> : null,
    has.razerButtons ? <RazerButtonCard key="razerbuttons" snapshot={snapshot} /> : null,
    has.mxMasterButtons ? <MxMasterButtonsCard key="mxmaster-buttons" snapshot={snapshot} /> : null,
    has.atkButtons ? <AtkButtonCard key="atk-buttons" snapshot={snapshot} /> : null,
    has.buttonMapping && !snapshot.traits.teevolution
      ? <ButtonMappingCard key="button-mapping" snapshot={snapshot} /> : null,
    has.superstrike ? <Superstrike key="superstrike" snapshot={snapshot} /> : null,
  ].filter((node) => node !== null);

  const profiles: ReactNode[] = [
    has.profiles ? <Profiles key="profiles" snapshot={snapshot} /> : null,
    snapshot.traits.teevolution && has.onboardProfiles
      ? <TeevolutionProfileCard key="teevolution-profiles" snapshot={snapshot} /> : null,
    has.keychronNapeLayers ? <KeychronNapeLayers key="nape-layers" snapshot={snapshot} /> : null,
    has.atkProfile ? <AtkProfileCard key="atk-profile" snapshot={snapshot} /> : null,
    has.onboardProfiles && !snapshot.traits.teevolution
      ? <OnboardProfileCard key="onboard-profile" snapshot={snapshot} /> : null,
    has.pulsarPro ? <PulsarProCard key="pulsarpro" snapshot={snapshot} /> : null,
    // Fallback for devices with no real onboard-profile feature (base
    // Pulsar included): named presets the app remembers and re-applies,
    // rather than leaving the Profiles tab empty for these mice.
    !hasNativeProfileManagement(has) ? <SoftwareProfiles key="software-profiles" snapshot={snapshot} /> : null,
  ].filter((node) => node !== null);

  const showMxMaster = status.hapticIntensity != null || status.wheelMode != null
    || status.friendlyName != null || status.hostCount != null;

  const advancedCards = [
    has.signal ? <SignalCard key="signal" snapshot={snapshot} /> : null,
    !powerOverview && has.sleep ? <SleepCard key="sleep" snapshot={snapshot} /> : null,
    has.lowPower ? <LowPowerCard key="lowpower" snapshot={snapshot} /> : null,
    has.finalmouse ? <FinalmouseCard key="finalmouse" snapshot={snapshot} /> : null,
    has.incott ? <IncottCard key="incott" snapshot={snapshot} /> : null,
    has.atkReceiver ? <AtkReceiverCard key="atk-receiver" snapshot={snapshot} /> : null,
    has.logitechDetails ? <LogitechDetails key="logitech-details" snapshot={snapshot} /> : null,
    showMxMaster ? <MxMasterCards key="mxmaster-details" snapshot={snapshot} /> : null,
  ].filter((node) => node !== null);

  // Button controls (debounce, remaps, etc.) live under Advanced rather than
  // their own tab — most mice expose only one or two, so a dedicated tab read
  // as near-empty. A full-width group label separates them when Advanced also
  // has its own cards; on a button-only device they simply lead the tab.
  const advanced = advancedCards.length > 0 && buttons.length > 0
    ? [
        <h3 key="advanced-buttons-group" className="ht-section-group">Buttons</h3>,
        ...buttons,
        <h3 key="advanced-device-group" className="ht-section-group">Wireless &amp; power</h3>,
        ...advancedCards,
      ]
    : [...buttons, ...advancedCards];

  return { performance, lighting, buttons: [], profiles, advanced };
}

/** Which tabs have anything to show, in display order. "overview" always
    shows (device showcase + info); every other tab only shows once it has
    at least one card. */
function availableTabs(sections: DashboardSections): WorkspaceTab[] {
  const tabs: WorkspaceTab[] = ["overview"];
  if (sections.performance.length > 0) tabs.push("performance");
  if (sections.lighting.length > 0) tabs.push("lighting");
  if (sections.buttons.length > 0) tabs.push("buttons");
  if (sections.profiles.length > 0) tabs.push("profiles");
  if (sections.advanced.length > 0) tabs.push("advanced");
  return tabs;
}

/** The active tab's cards, laid out in a plain responsive grid — one
    category at a time, switched by the tab bar in OverviewPage below. */
export function Workspace({
  snapshot,
  sections,
  onRequestArtwork,
}: {
  snapshot: ControlSnapshot;
  sections: DashboardSections;
  onRequestArtwork: () => void;
}): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const tab = snapshot.workspaceTab;
  const locale = snapshot.preferences.locale;

  const slotsAvailable = snapshot.profile.slotsAvailable;
  const stagesAvailable = Boolean(status.ui?.dpiStageEditor)
    && Array.isArray(status.dpiStages)
    && status.dpiStages.length > 0
    && !slotsAvailable;
  const showSeparateDpiAxes = snapshot.traits.logitech
    && status.supportsSeparateDpiAxes === true
    && !slotsAvailable;

  const gridClass = [
    "settings-grid",
    "device-data",
    showSeparateDpiAxes ? "has-logitech-axis-controls" : "",
    slotsAvailable || stagesAvailable ? "has-dpi-slots" : "",
    // Profiles are wide list/editor cards — let each one fill the column instead
    // of sitting as a lonely half-card in the two-column grid.
    tab === "profiles" ? "is-profiles" : "",
  ].filter(Boolean).join(" ");

  if (tab === "overview") {
    return <OverviewContent snapshot={snapshot} onRequestArtwork={onRequestArtwork} />;
  }
  const cards = sections[tab];
  if (cards.length === 0) {
    return (
      <section className="workspace-tab-empty device-data" role="tabpanel">
        <p>{tp(locale, "tab.unavailable", { tab: t(locale, `tab.${tab}` as I18nKey) })}</p>
        <small>{t(locale, "tab.chooseAnother")}</small>
      </section>
    );
  }
  return <section className={gridClass} role="tabpanel">{cards}</section>;
}

const VENDOR_SOFTWARE: Record<string, string> = {
  Logitech: "Logitech G HUB",
  Razer: "Razer Synapse",
  SteelSeries: "SteelSeries GG",
  Corsair: "Corsair iCUE",
  Glorious: "Glorious CORE",
  Pulsar: "Pulsar Fusion",
  Wooting: "Wootility",
};

/** Dismissible warning: vendor software (G HUB, Synapse, …) claims the mouse and
    is the most common reason changes "don't apply." Shown once a device is seen;
    names the specific app when we recognize the brand. */
function VendorSoftwareBanner({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const STORAGE_KEY = "hypertune-vendor-warning-dismissed-v1";
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });
  const hasDevice = snapshot.devices.length > 0 || snapshot.status !== null;
  if (dismissed || !hasDevice) return null;
  const named = VENDOR_SOFTWARE[snapshot.status?.brand ?? ""];
  return (
    <div className="ht-vendor-warn" role="note">
      <AlertTriangle size={17} strokeWidth={2} aria-hidden="true" />
      <span>
        {named ? (
          <>Close <strong>{named}</strong> before changing settings — it takes over the mouse and can stop Hypertune's changes from applying.</>
        ) : (
          <>Close other mouse software (like <strong>Logitech G HUB</strong> or <strong>Razer Synapse</strong>) before changing settings — it can take over the mouse and block Hypertune.</>
        )}
      </span>
      <button
        type="button"
        className="ht-vendor-warn-x"
        aria-label="Dismiss"
        onClick={() => {
          setDismissed(true);
          try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
        }}
      >
        ×
      </button>
    </div>
  );
}

function DeviceListView({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const devices = snapshot.devices;
  const locale = snapshot.preferences.locale;

  if (devices.length === 0) {
    return <OverviewEmpty snapshot={snapshot} />;
  }

  return (
    <div className="welcome-with-devices">
      <section className="detected-devices" aria-label={t(locale, "side.connectedDevices")}>
        <ul className="device-grid">
            {(() => {
              const ordered = devices.slice();
              const connectedIndex = ordered.findIndex((device) => device.selected);
              if (connectedIndex !== -1 && ordered.length > 1) {
                const [connected] = ordered.splice(connectedIndex, 1);
                ordered.splice(Math.floor(ordered.length / 2), 0, connected);
              }
              return ordered.map((device) => {
              const connected = device.selected && snapshot.deviceStatus !== null;
              const liveStatus = connected ? snapshot.deviceStatus : null;
              const pollText = liveStatus?.pollingRateHz ? `${liveStatus.pollingRateHz} Hz` : "–";
              const batteryText = liveStatus?.batteryPercent != null ? `${liveStatus.batteryPercent}%` : "–%";
              return (
                <li
                className={`device-tile${connected ? " is-connected" : ""}${device.kind === "keyboard" ? " is-keyboard" : ""}`}
                key={device.index}
                role="button"
                tabIndex={0}
                title={`Open ${device.name}`}
                onClick={() => void control.openDeviceOverview(device.index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void control.openDeviceOverview(device.index);
                  }
                }}
              >
                  <span className="device-tile-name">{device.name}</span>
                  <div className="device-tile-stats" aria-label="Device status">
                    <span className="device-tile-stat">
                      <Wifi className="device-tile-stat-icon" strokeWidth={2} aria-hidden="true" />
                    </span>
                    <span className="device-tile-stat">
                      <Clock className="device-tile-stat-icon" strokeWidth={1.8} aria-hidden="true" />
                      <span className="device-tile-stat-text">{pollText}</span>
                    </span>
                    <span className="device-tile-stat">
                      <BatteryIcon
                        percent={liveStatus?.batteryPercent != null ? liveStatus.batteryPercent : null}
                        state={liveStatus?.batteryState ?? "Unknown"}
                      />
                      <span className="device-tile-stat-text">{batteryText}</span>
                    </span>
                  </div>
                  <div className="device-tile-visual">
                    <img
                      className="device-tile-image"
                      src={deviceImage({ vendorId: device.vendorId, productId: device.productId } as HIDDevice, device.name)}
                      alt={device.name}
                      loading="lazy"
                      draggable={false}
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = deviceImage(null);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="device-tile-gear"
                    aria-label="Open device settings"
                    title="Open device settings"
                    onClick={(event) => {
                      event.stopPropagation();
                      void control.openDeviceOverview(device.index);
                    }}
                  >
                    <Settings2 size={16} strokeWidth={1.7} aria-hidden="true" />
                  </button>
                </li>
              );
            });
            })()}
            <li key="add-mouse">
              <AddDeviceCard snapshot={snapshot} />
            </li>
          </ul>
          <div className="ht-devices-foot">
            <span className="ht-devices-foot-text">Mouse not detecting, or having an issue?</span>
            <button type="button" className="ht-report-btn ht-report-btn-lg" onClick={() => control.openReportProblem()}>
              Report a problem
            </button>
          </div>
        </section>
    </div>
  );
}

const TAB_ICON: Record<WorkspaceTab, LucideIcon> = {
  overview: Gauge,
  performance: BarChart3,
  lighting: Lightbulb,
  buttons: MousePointerClick,
  profiles: Layers,
  advanced: Settings2,
};

/** Compact device summary pinned to the sidebar foot — name, live dot, battery. */
function SidebarDeviceChip({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const locale = snapshot.preferences.locale;
  const live = snapshot.deviceStatus !== null;
  const parts: string[] = [];
  if (status.connectionType) parts.push(connectionText(locale, status.connectionType));
  if (status.batteryPercent !== null) parts.push(`${status.batteryPercent}%`);
  return (
    <div className={`ht-devicechip${live ? " is-live" : ""}`}>
      <span className="ht-devicechip-dot" aria-hidden="true" />
      <span className="ht-devicechip-copy">
        <strong>{status.name}</strong>
        <small>{parts.length ? parts.join(" · ") : status.brand}</small>
      </span>
    </div>
  );
}

/** Hypertune left rail: wordmark, vertical section nav, and device foot. */
function HypertuneSidebar({
  snapshot,
  tabs,
  activeTab,
  showingTest,
  deviceOpen,
  onTab,
  onTest,
  onBack,
  onShare,
}: {
  snapshot: ControlSnapshot;
  tabs: WorkspaceTab[];
  activeTab: WorkspaceTab;
  showingTest: boolean;
  deviceOpen: boolean;
  onTab: (tab: WorkspaceTab) => void;
  onTest: () => void;
  onBack: () => void;
  onShare: () => void;
}): ReactNode {
  const locale = snapshot.preferences.locale;
  return (
    <aside className="ht-sidebar">
      <div className="ht-brand">
        <span className="ht-wordmark">HYPERTUNE</span>
        <span className="ht-beta-tag">BETA</span>
      </div>

      {deviceOpen ? (
        <>
          <nav className="ht-nav" aria-label={t(locale, "panel.deviceSections")}>
            {tabs.map((tab) => {
              const Icon = TAB_ICON[tab];
              const selected = !showingTest && activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  className={`ht-nav-item${selected ? " is-active" : ""}`}
                  aria-current={selected}
                  onClick={() => onTab(tab)}
                >
                  <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
                  <span>{t(locale, `tab.${tab}` as I18nKey)}</span>
                </button>
              );
            })}
            <button
              type="button"
              className={`ht-nav-item${showingTest ? " is-active" : ""}`}
              aria-current={showingTest}
              onClick={onTest}
            >
              <Activity size={17} strokeWidth={1.9} aria-hidden="true" />
              <span>Mouse test</span>
            </button>
          </nav>

          <div className="ht-sidebar-foot">
            <SidebarDeviceChip snapshot={snapshot} />
            <button type="button" className="ht-side-action ht-side-share" onClick={onShare}>
              <Share2 size={15} strokeWidth={1.9} aria-hidden="true" />
              <span>{t(locale, "panel.shareProfile")}</span>
            </button>
            <button type="button" className="ht-side-action" onClick={() => control.openReportProblem()}>
              <Flag size={15} strokeWidth={1.9} aria-hidden="true" />
              <span>Report a problem</span>
            </button>
            <button type="button" className="ht-side-action" onClick={onBack}>
              <ArrowLeft size={15} strokeWidth={1.9} aria-hidden="true" />
              <span>{t(locale, "common.back")}</span>
            </button>
          </div>
        </>
      ) : (
        <nav className="ht-nav" aria-label={t(locale, "side.connectedDevices")}>
          <span className="ht-nav-item is-active" aria-current="true">
            <Gauge size={17} strokeWidth={1.9} aria-hidden="true" />
            <span>Devices</span>
          </span>
        </nav>
      )}

      <div className={`ht-legal${deviceOpen ? "" : " ht-legal--anchor"}`}>
        <span>
          In partnership with{" "}
          <a href="https://github.com/OpenMouse-Project/mouse-protocol" target="_blank" rel="noreferrer noopener">OpenMouse</a>
        </span>
        <span>
          <a href="https://github.com/AJJBB/hypertune-mouse-control" target="_blank" rel="noreferrer noopener">Source</a>
          {" · "}
          <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noreferrer noopener">AGPL-3.0</a>
        </span>
      </div>
    </aside>
  );
}

/** Top bar of the main column: current section title plus live device stats. */
function HypertuneHeader({ title, snapshot }: { title: string; snapshot: ControlSnapshot }): ReactNode {
  const live = snapshot.deviceStatus;
  return (
    <header className="ht-header">
      <h1 className="ht-header-title">{title}</h1>
      {live ? (
        <div className="ht-header-stats">
          {live.dpi > 0 ? (
            <span className="ht-stat"><b>{live.dpi.toLocaleString()}</b> DPI</span>
          ) : null}
          {live.pollingRateHz ? (
            <span className="ht-stat"><b>{live.pollingRateHz.toLocaleString()}</b> Hz</span>
          ) : null}
          {live.batteryPercent !== null ? (
            <span className="ht-stat ht-stat-batt">
              <BatteryIcon percent={live.batteryPercent} state={live.batteryState} />
              {live.batteryPercent}%
            </span>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

export function OverviewPage({
  snapshot,
  onShareProfile,
  onRequestArtwork,
}: {
  snapshot: ControlSnapshot;
  onShareProfile: () => void;
  onRequestArtwork: () => void;
}): ReactNode {
  const status = snapshot.status;
  const scroll = useRef<HTMLDivElement>(null);
  const { preferences } = snapshot;
  const locale = preferences.locale;
  const [showingTest, setShowingTest] = useState(false);

  const showingDeviceDashboard = status !== null
    && (snapshot.deviceView === "device" || snapshot.previewMode !== null);

  const sections = status ? computeDashboardSections(snapshot) : null;
  const tabs = sections ? availableTabs(sections) : [];
  const activeTab = sections && tabs.includes(snapshot.workspaceTab) ? snapshot.workspaceTab : "overview";
  const deviceOpen = showingDeviceDashboard && sections !== null;

  useEffect(() => {
    scroll.current?.scrollTo({ top: 0, behavior: preferences.reducedMotion ? "auto" : "smooth" });
  }, [activeTab, showingTest, snapshot.deviceView, preferences.reducedMotion]);

  const title = deviceOpen
    ? (showingTest ? "Mouse test" : t(locale, `tab.${activeTab}` as I18nKey))
    : "Devices";

  return (
    <>
      <HypertuneSidebar
        snapshot={snapshot}
        tabs={tabs}
        activeTab={activeTab}
        showingTest={showingTest}
        deviceOpen={deviceOpen}
        onTab={(tab) => {
          setShowingTest(false);
          control.setWorkspaceTab(tab);
        }}
        onTest={() => setShowingTest(true)}
        onBack={() => control.showDeviceList()}
        onShare={onShareProfile}
      />
      <main className="ht-main">
        <HypertuneHeader title={title} snapshot={snapshot} />
        <div className="ht-scroll" ref={scroll}>
          <VendorSoftwareBanner snapshot={snapshot} />
          <section className="page page-overview">
            {deviceOpen && sections ? (
              showingTest ? (
                <MouseTestPage snapshot={snapshot} />
              ) : (
                <Workspace snapshot={snapshot} sections={sections} onRequestArtwork={onRequestArtwork} />
              )
            ) : (
              <DeviceListView snapshot={snapshot} />
            )}
          </section>
        </div>
      </main>
    </>
  );
}
