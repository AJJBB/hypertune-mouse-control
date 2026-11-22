// Overview tab of the integrated device page (Figma v2 · "Mouse - Overview").
//
// Recipe (hypertune-mouse-components.md › Tab recipes): big mouse render on the
// left; on the right the Status panel (DPI + polling-rate Readout tiles, then
// Battery / Connection / Active profile Info rows) and the Device info list
// (Manufacturer, firmware, onboard memory). Read-only — every row is hidden when
// the mouse doesn't report it, so the panels still look finished with rows
// missing.
//
// Logic ported from the previous integrated OverviewBody (DeviceDetail.tsx):
// active-profile resolution incl. the software-profile fallback, the single /
// dual firmware split and the battery states.
import type { ReactNode } from "react";
import * as control from "../../../device/controller";
import type { ControlSnapshot } from "../../../device/types";
import { activeSoftwareProfile } from "../../../software-profiles";
import { cardAvailability, hasNativeProfileManagement } from "../../cards/availability";
import { BatteryIcon, DeviceInfoList, InfoRow, ReadoutTile, StatusPanel } from "../kit";
import { MouseRender, SplitLayout } from "./layout";
import "./overview.css";

function isCharging(state: string | undefined): boolean {
  return state === "Charging" || state === "Charging slowly" || state === "Almost full";
}

/** The profile the Overview reports as active.
 *  A device can report activeProfile without any switchable profile feature
 *  behind it (base Pulsar just reads which onboard slot is active) — showing
 *  "Profile 1" there is misleading. Only show the native profile when it's
 *  really managed; otherwise fall back to the software profile the user picked. */
function activeProfileLabel(snapshot: ControlSnapshot): string | null {
  const s = snapshot.status;
  if (!s) return null;
  const device = control.getActiveDevice();
  const hasNativeProfiles = hasNativeProfileManagement(cardAvailability(snapshot));
  const activeSoftware = !hasNativeProfiles && device
    ? activeSoftwareProfile(control.deviceStorageKey(device))
    : null;
  return hasNativeProfiles && s.activeProfile !== null
    ? (s.onboardProfileFormat?.name
      ? `Profile ${s.activeProfile} (${s.onboardProfileFormat.name})`
      : `Profile ${s.activeProfile}`)
    : activeSoftware?.name ?? null;
}

export function OverviewSection({ snapshot }: { snapshot: ControlSnapshot; onShareProfile?: () => void }): ReactNode {
  const s = snapshot.status;
  if (!s) return null;
  const charging = isCharging(s.batteryState);
  const fw = s.firmware;
  const activeProfile = activeProfileLabel(snapshot);
  const batteryState = s.batteryState && s.batteryState !== "Unknown" ? String(s.batteryState) : undefined;

  const tiles = (
    <>
      {s.dpi > 0 ? <ReadoutTile label="DPI" icon="dpi" value={s.dpi.toLocaleString("en-US")} unit="DPI" /> : null}
      {s.pollingRateHz ? <ReadoutTile label="Polling rate" icon="pulse" value={String(s.pollingRateHz)} unit="Hz" /> : null}
    </>
  );

  const right = (
    <div className="mk-ov">
      <StatusPanel tiles={tiles}>
        {s.batteryPercent !== null ? (
          <InfoRow
            label="Battery"
            icon={<BatteryIcon percent={s.batteryPercent} charging={charging} />}
            value={`${s.batteryPercent}%`}
            secondary={batteryState}
          />
        ) : null}
        {s.connectionType ? (
          <InfoRow label="Connection" value={s.connectionType} secondary={s.connectionDetail ?? undefined} />
        ) : null}
        {activeProfile ? <InfoRow label="Active profile" value={activeProfile} /> : null}
      </StatusPanel>
      <DeviceInfoList>
        {s.brand ? <InfoRow label="Manufacturer" value={s.brand} /> : null}
        {fw.length === 1 ? <InfoRow label="Firmware" value={fw[0]!} /> : null}
        {fw.length >= 2 ? <InfoRow label="Mouse firmware" value={fw[0]!} /> : null}
        {fw.length >= 2 ? <InfoRow label="Dongle firmware" value={fw[1]!} /> : null}
        {s.profileCount ? (
          <InfoRow label="Onboard memory" value={`${s.profileCount} ${s.profileCount === 1 ? "profile" : "profiles"}`} />
        ) : null}
      </DeviceInfoList>
    </div>
  );

  return <SplitLayout variant="overview" left={<MouseRender snapshot={snapshot} dots={false} />} right={right} />;
}
