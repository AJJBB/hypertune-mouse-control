// Integrated device page — Ivan's Figma v2 design (Hypertune v2.0 › App / Mouse),
// built from the Mouse Component System kit.
//
// Anatomy (content frame 1210×695, padding 10, gap 10):
//   Tab bar (5–7 tabs, fixed order) → Device header (brand, model, status pills,
//   header actions) → the active tab's section, which lays out its own content
//   row (see sections/layout.tsx).
//
// Every tab's controls come from sections/*, which map the connected mouse's
// capabilities onto kit components. sections/flags.ts is the parity contract:
// each capability flag belongs to exactly one tab (enforced by a test).
import type { ReactNode } from "react";
import * as control from "../../device/controller";
import type { ControlSnapshot, WorkspaceTab } from "../../device/types";
import { cardAvailability } from "../cards/availability";
import { BatteryIcon, DeviceHeader, HeaderActions, Icon, StatusPill, TabBar } from "./kit";
import { SECTIONS, SECTION_ORDER, sectionVisible, type SectionId } from "./sections";
import { LegalCredit } from "./LegalCredit";
import "./kit/tokens.css";
import "./DeviceDetailV2.css";

function isCharging(state: string | undefined): boolean {
  return state === "Charging" || state === "Charging slowly" || state === "Almost full";
}

/** MX Master detail cards are gated on reported fields, not a capability flag. */
function hasMxMasterDetails(snapshot: ControlSnapshot): boolean {
  const s = snapshot.status;
  return !!s && (s.hapticIntensity != null || s.wheelMode != null || s.friendlyName != null || s.hostCount != null);
}

export function visibleSections(snapshot: ControlSnapshot): Array<{ id: SectionId; label: string }> {
  const has = cardAvailability(snapshot);
  const mx = hasMxMasterDetails(snapshot);
  return SECTION_ORDER.filter((sec) => sectionVisible(sec.id, has, mx));
}

function HeaderPills({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const s = snapshot.status;
  if (!s) return null;
  return (
    <>
      <StatusPill type="active" label="Connected" />
      {s.batteryPercent !== null ? (
        <StatusPill label={`${s.batteryPercent}%`} icon={<BatteryIcon percent={s.batteryPercent} charging={isCharging(s.batteryState)} />} />
      ) : null}
      {s.dpi > 0 ? <StatusPill label={String(s.dpi)} unit="DPI" icon={<Icon name="dpi" size={18} />} /> : null}
      {s.pollingRateHz ? <StatusPill label={String(s.pollingRateHz)} unit="Hz" icon={<Icon name="pulse" size={18} />} /> : null}
    </>
  );
}

/** Header actions per tab, as on the reference screens: Overview → Report
    Problem + Share profile; Profiles → Share profile; Performance → Reset
    (the library's "Show reset" — restores 800 DPI / 1000 Hz through the
    pending bar). Other tabs show status pills only. */
function headerActions(tab: SectionId, onShareProfile?: () => void): ReactNode {
  if (tab === "overview") {
    return <HeaderActions onReport={() => control.openReportProblem()} onShare={onShareProfile} />;
  }
  if (tab === "profiles" && onShareProfile) return <HeaderActions onShare={onShareProfile} />;
  if (tab === "performance") return <HeaderActions onReset={() => { control.resetToDefaults(); }} resetLabel="Reset to default" />;
  return null;
}

export function DeviceDetail({ snapshot, onShareProfile }: { snapshot: ControlSnapshot; onShareProfile?: () => void }): ReactNode {
  const s = snapshot.status;
  const tabs = visibleSections(snapshot);
  const requested = snapshot.workspaceTab as SectionId;
  // A stale tab the current mouse doesn't have (e.g. Lighting on a non-RGB
  // mouse) falls back to Overview rather than an empty panel.
  const active: SectionId = tabs.some((t) => t.id === requested) ? requested : "overview";
  const Body = SECTIONS[active];
  return (
    <div className="mk-detail">
      <TabBar
        tabs={tabs}
        active={active}
        onSelect={(id) => control.setWorkspaceTab(id as WorkspaceTab)}
        ariaLabel="Mouse settings"
        idPrefix="mk"
      />
      <DeviceHeader
        brand={s?.brand ?? ""}
        model={s?.name ?? "Mouse"}
        pills={<HeaderPills snapshot={snapshot} />}
        actions={headerActions(active, onShareProfile)}
        onBack={() => control.showDeviceList()}
        backLabel="Back to your mice"
      />
      <div className="mk-detail__body" role="tabpanel" id={`mk-panel-${active}`} aria-labelledby={`mk-tab-${active}`}>
        {s ? <Body snapshot={snapshot} onShareProfile={onShareProfile} /> : null}
      </div>
      <footer className="mk-home-foot mk-t-caption12"><span /><LegalCredit /></footer>
    </div>
  );
}
