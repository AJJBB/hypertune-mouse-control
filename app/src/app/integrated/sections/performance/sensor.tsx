// Polling rate and lift-off on the Performance tab — a port of
// cards/PerformanceCards.tsx (PollingCard, SensorCard) onto the kit.
//   Polling: Section header + Segmented (Card), as on Ivan's screens. Logitech
//   onboard profiles get one card per link (or one shared card), staged into the
//   profile; mice with more than seven rates get a Snapping slider instead.
//   Lift-off: Segmented (Card) of the levels the mouse supports, or the
//   asymmetric lift-off / landing pair, or a continuous scale (Snapping slider);
//   plus the Logitech gaming-surface setting.
import { useEffect, useState, type ReactNode } from "react";
import { capabilitiesForFormat, reportRatesFor } from "@openmouse/protocol/drivers/logitech/onboard-profiles";
import * as control from "../../../../device/controller";
import { RATE_STEPS_HZ } from "../../../../device/controller";
import type { ControlSnapshot, LiftOffLevel } from "../../../../device/types";
import { Segmented, SettingRow, SnappingSlider, type SegOption } from "../../kit";
import { fmtPlain, integerStops, PerfHeader } from "./shared";

/** Segmented holds 2–7 options (the library's Count variants); more becomes a Snapping slider. */
const MAX_SEGMENTS = 7;

/* ───────────────────────── Polling rate ───────────────────────── */

function RateControl({ rates, value, onChange, disabled, ariaLabel }: {
  rates: number[];
  value: number | null;
  onChange: (hz: number) => void;
  disabled: boolean;
  ariaLabel: string;
}): ReactNode {
  if (rates.length === 0) return null;
  if (rates.length <= MAX_SEGMENTS) {
    return (
      <Segmented
        container="card"
        ariaLabel={ariaLabel}
        options={rates.map((hz) => ({ value: hz, label: fmtPlain(hz) }))}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }
  return <RateSlider rates={rates} value={value} onChange={onChange} disabled={disabled} ariaLabel={ariaLabel} />;
}

/** Many rates: a Snapping slider in a card that only stages on release (like RateSlider). */
function RateSlider({ rates, value, onChange, disabled, ariaLabel }: {
  rates: number[];
  value: number | null;
  onChange: (hz: number) => void;
  disabled: boolean;
  ariaLabel: string;
}): ReactNode {
  const settled = value ?? rates[0] ?? 0;
  const [dragging, setDragging] = useState<number | null>(null);
  useEffect(() => setDragging(null), [settled]);
  const shown = dragging ?? settled;
  return (
    <div className="mk-perf-slider-card">
      <SnappingSlider
        stops={rates.map((hz) => ({ value: hz, label: fmtPlain(hz) }))}
        value={shown}
        valueLabel={`${fmtPlain(shown)} Hz`}
        onChange={setDragging}
        onCommit={(hz) => { setDragging(null); if (hz !== settled) onChange(hz); }}
        ariaLabel={ariaLabel}
        disabled={disabled}
      />
    </div>
  );
}

export function PollingGroup({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const entry = snapshot.profile.entry;
  const rates = snapshot.profileFormat ? capabilitiesForFormat(snapshot.profileFormat.id).reportRates : null;
  const perProfile = entry !== null && rates !== null;
  const locked = snapshot.profileFormat?.writable !== true;
  const shared = (snapshot.profileFormat?.id ?? 6) < 6;

  // A receiver-attached mouse's live rate write never touches profile content,
  // so a locked (unverified) format only falls back to the live control when the
  // mouse is NOT direct-connect — exactly PollingCard's rule.
  const useProfileRateUi = perProfile && !(locked && status.hidppDirectConnect === false);

  if (useProfileRateUi && entry && rates) {
    const disabled = locked || snapshot.settingInProgress;
    const lockedNote = locked ? " Read-only on this profile format for now." : "";
    if (shared) {
      const max = snapshot.profile.rateOptions.wired.at(-1);
      return (
        <>
          <PerfHeader
            title="Polling rate"
            description={`Saved in this profile for every connection${max ? `, up to ${fmtPlain(max)} Hz` : ""}.${lockedNote}`}
          />
          <RateControl
            rates={snapshot.profile.rateOptions.wired}
            value={snapshot.stagedProfileRates.wired ?? entry.reportRateWired}
            onChange={(hz) => control.setProfileReportRate("wired", hz)}
            disabled={disabled}
            ariaLabel="Polling rate, all connections"
          />
        </>
      );
    }
    const top = (link: "wireless" | "wired"): string => {
      const hz = reportRatesFor(rates, link).at(-1);
      return hz ? fmtPlain(hz) : "—";
    };
    return (
      <>
        <PerfHeader
          title="Wireless polling rate"
          description={`Saved in this profile. Up to ${top("wireless")} Hz on the receiver.${lockedNote}`}
        />
        <RateControl
          rates={snapshot.profile.rateOptions.wireless}
          value={snapshot.stagedProfileRates.wireless ?? entry.reportRateWireless}
          onChange={(hz) => control.setProfileReportRate("wireless", hz)}
          disabled={disabled}
          ariaLabel="Wireless polling rate"
        />
        <PerfHeader
          title="Wired polling rate"
          description={`Saved in this profile. Up to ${top("wired")} Hz over the cable.${lockedNote}`}
        />
        <RateControl
          rates={snapshot.profile.rateOptions.wired}
          value={snapshot.stagedProfileRates.wired ?? entry.reportRateWired}
          onChange={(hz) => control.setProfileReportRate("wired", hz)}
          disabled={disabled}
          ariaLabel="Wired polling rate"
        />
      </>
    );
  }

  const advertised = (status.supportedPollingRates ?? RATE_STEPS_HZ)
    .filter((rate) => !(snapshot.traits.eggControls && rate < 1000))
    .slice()
    .sort((a, b) => a - b);
  const note = status.ui?.pollingNote
    ?? (snapshot.traits.eggControls
      ? "Higher rates update the cursor more often but use more CPU."
      : "Higher rates update the cursor more often but use more battery.");
  return (
    <>
      <PerfHeader title="Polling rate"
        description={snapshot.editedProfile !== null ? `${note} Live (host) only, not saved to the open profile.` : note} />
      <RateControl
        rates={advertised}
        value={status.pollingRateHz}
        onChange={control.applyPollingRate}
        disabled={snapshot.settingsPending || status.ui?.pollingReadOnly === true}
        ariaLabel="Polling rate"
      />
    </>
  );
}

/* ───────────────────────── Lift-off + surface ───────────────────────── */

const LOD_LEVELS: readonly LiftOffLevel[] = ["Low", "Medium", "High"];
type SurfaceMode = "On" | "Off" | "Auto";
const SURFACE_OPTIONS: SegOption<SurfaceMode>[] = [
  { value: "On", label: "On" },
  { value: "Off", label: "Off" },
  { value: "Auto", label: "Auto" },
];

export function LiftOffGroup({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const ui = status.ui;
  const pending = snapshot.settingsPending;
  const pair = status.asymmetricLiftOff;
  const showPair = pair?.enabled === true;
  const lodNeedsSurface = ui?.lodRequiresSurface === true && status.gamingSurfaceMode === "Off";
  const supportedLods = status.supportedLiftOffDistances;

  const surface = status.gamingSurfaceMode ? (
    <SettingRow
      title="Gaming surface"
      description="Tunes the sensor for gaming mouse pads."
      disabled={pending}
      control={(
        <Segmented
          options={SURFACE_OPTIONS}
          value={status.gamingSurfaceMode}
          onChange={control.applyGamingSurfaceMode}
          ariaLabel="Gaming surface"
          disabled={pending}
        />
      )}
    />
  ) : null;

  // Logitech per-profile slots carry lift-off per stage (the table on the left),
  // so the host lift-off control steps aside, as SensorCard does.
  if (snapshot.profile.slotsAvailable) {
    if (!surface) return null;
    return (
      <>
        <PerfHeader title="Lift-off distance" description="Set for each DPI stage, in the table on the left." />
        {surface}
      </>
    );
  }

  const levels: SegOption<LiftOffLevel>[] = LOD_LEVELS
    .filter((level) => {
      const hideLow = level === "Low" && (snapshot.traits.eggFamily || ui?.hideLodLow === true);
      const unsupported = Array.isArray(supportedLods) && !supportedLods.includes(level);
      return !hideLow && !unsupported;
    })
    .map((level) => ({
      value: level,
      label: level,
      // Legacy Logitech sensors without a reported list never confirmed Low.
      disabled: snapshot.traits.logitech && !Array.isArray(supportedLods) && level === "Low",
    }));
  const hasLiftOff = Boolean(pair) || Boolean(status.liftOffScale) || levels.length > 0;
  if (!hasLiftOff) {
    if (!surface) return null;
    return (
      <>
        <PerfHeader title="Surface" />
        {surface}
      </>
    );
  }

  let lod: ReactNode = null;
  if (pair && showPair) lod = <AsymmetricLiftOff snapshot={snapshot} />;
  else if (status.liftOffScale) lod = <LiftOffScale snapshot={snapshot} />;
  else if (levels.length > 0) {
    lod = (
      <Segmented
        container="card"
        ariaLabel="Lift-off distance"
        options={levels}
        value={status.liftOffDistance}
        disabled={pending || lodNeedsSurface}
        onChange={control.applyLiftOffDistance}
      />
    );
  }

  return (
    <>
      <PerfHeader
        title="Lift-off distance"
        description={lodNeedsSurface
          ? "Turn the gaming surface on or set it to Auto to change this."
          : "How high you can lift it before it stops tracking."}
      />
      {pair ? (
        <SettingRow
          title="Lift-off mode"
          description="Separate heights for lifting and landing."
          disabled={pending}
          control={(
            <Segmented
              options={[{ value: "single", label: "Single" }, { value: "asymmetric", label: "Asymmetric" }]}
              value={pair.enabled === null ? null : showPair ? "asymmetric" : "single"}
              onChange={control.applyLiftOffMode}
              ariaLabel="Lift-off mode"
              disabled={pending}
            />
          )}
        />
      ) : null}
      {lod}
      {surface}
    </>
  );
}

/**
 * Separate lift-off and landing heights (SensorCard's AsymmetricLiftOff).
 * Landing is bounded by lift-off on the device; the value is clamped, never
 * the range, so the thumb doesn't slide when lift-off moves. Each slider stages
 * once, on release.
 */
function AsymmetricLiftOff({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const pair = snapshot.status?.asymmetricLiftOff;
  const [liftOff, setLiftOff] = useState(pair?.liftOff ?? 0);
  const [landing, setLanding] = useState(pair?.landing ?? 0);
  useEffect(() => {
    if (!pair) return;
    setLiftOff(pair.liftOff);
    setLanding(pair.landing);
  }, [pair?.liftOff, pair?.landing]);
  if (!pair) return null;

  const pending = snapshot.settingsPending;
  const ceilingFor = (lift: number): number => Math.max(pair.landingRange.min, lift - 1);
  const cappedLanding = Math.min(landing, ceilingFor(liftOff));

  return (
    <>
      <SettingRow
        title="Lift-off"
        description="Height where tracking stops."
        disabled={pending}
        control={(
          <SnappingSlider
            stops={integerStops(pair.liftOffRange.min, pair.liftOffRange.max)}
            value={liftOff}
            onChange={setLiftOff}
            onCommit={(lift) => control.applyAsymmetricLiftOff(lift, Math.min(landing, ceilingFor(lift)))}
            ariaLabel="Lift-off height"
            showStopLabels={false}
            disabled={pending}
          />
        )}
      />
      <SettingRow
        title="Landing"
        description="Height where tracking starts again."
        disabled={pending}
        control={(
          <SnappingSlider
            stops={integerStops(pair.landingRange.min, pair.landingRange.max)}
            value={cappedLanding}
            onChange={setLanding}
            onCommit={(land) => control.applyAsymmetricLiftOff(liftOff, Math.min(land, ceilingFor(liftOff)))}
            ariaLabel="Landing height"
            showStopLabels={false}
            disabled={pending}
          />
        )}
      />
    </>
  );
}

/**
 * Continuous lift-off (SensorCard's LiftOffScale): raw device codes, labelled in
 * the millimetres the driver supplies, interpolated the same way the controller
 * labels the staged change.
 */
function LiftOffScale({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const scale = snapshot.status?.liftOffScale;
  const [code, setCode] = useState(scale?.value ?? 0);
  useEffect(() => {
    if (scale) setCode(scale.value);
  }, [scale?.value]);
  if (!scale) return null;

  const span = Math.max(1, scale.max - scale.min);
  const mm = (value: number): number =>
    scale.minMillimetres + ((value - scale.min) * (scale.maxMillimetres - scale.minMillimetres)) / span;
  const stops = integerStops(scale.min, scale.max, (value) => mm(value).toFixed(1));

  return (
    <div className="mk-perf-slider-card">
      <SnappingSlider
        stops={stops}
        value={code}
        valueLabel={`${mm(code).toFixed(1)} mm`}
        onChange={setCode}
        onCommit={(value) => control.applyLiftOffScale(value)}
        ariaLabel="Lift-off distance"
        showStopLabels={stops.length <= 12}
        disabled={snapshot.settingsPending}
      />
    </div>
  );
}
