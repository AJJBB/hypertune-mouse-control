// Brand extras on the Performance tab — ports of PerformanceCards' LightforceCard
// (+ bunny hop) and AdvancedCards' Ninjutso*, Egg* and PowerMode cards onto the kit.
// Each group is a Section header over Setting rows (Ivan's "brand extras" pattern);
// Endgame Gear's CPI stages use the library's DPI stage table.
import { useEffect, useState, type ReactNode } from "react";
import { BUNNY_HOP_LIMITS, clampBunnyHopMs } from "@openmouse/protocol/drivers/logitech/onboard-profiles";
import * as control from "../../../../device/controller";
import type { ControlSnapshot } from "../../../../device/types";
import {
  DpiStageRow, DpiStageTable, Dropdown, NumberField, Segmented, SettingRow, SettingValue, type SegOption,
} from "../../kit";
import { PerfHeader, ToggleRow, useRefreshKey } from "./shared";

/* ───────────────────────── Logitech LightForce + bunny hop ───────────────────────── */

type LightforceMode = "Hybrid" | "Optical";
const LIGHTFORCE_OPTIONS: SegOption<LightforceMode>[] = [
  { value: "Hybrid", label: "Hybrid" },
  { value: "Optical", label: "Optical only" },
];

export function LightforceGroup({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const pending = snapshot.settingsPending;
  return (
    <>
      <PerfHeader title="Switches" />
      <SettingRow
        title="LightForce switches"
        description="Hybrid saves battery. Optical only is steadier."
        disabled={pending}
        control={(
          <Segmented options={LIGHTFORCE_OPTIONS} value={status.lightforceSwitchMode ?? null}
            onChange={control.applyLightforceSwitchMode} ariaLabel="LightForce switch mode" disabled={pending} />
        )}
      />
      <BunnyHop snapshot={snapshot} />
    </>
  );
}

/** Bunny hop lives in the onboard profile (PerformanceCards' BunnyHop): a switch plus the window in ms. */
function BunnyHop({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const [refreshKey, refresh] = useRefreshKey();
  const entry = snapshot.profile.entry;
  if (!snapshot.profile.bunnyHopSupported || !entry) return null;
  const locked = snapshot.profileFormat?.writable !== true;
  // Support is a property of the format, not of the stored value: a profile that
  // never had bunny hop written reads 0xff and decodes to null, which means off.
  const value = snapshot.stagedBunnyHopMs ?? entry.bunnyHoppingMs ?? 0;
  const enabled = value !== 0;
  const busy = locked || snapshot.settingInProgress;
  const { minMs, maxMs, stepMs } = BUNNY_HOP_LIMITS;
  return (
    <>
      <ToggleRow
        title="Bunny hop"
        description={locked ? "Read-only on this profile format for now." : "Ignores repeat clicks from a bouncing switch."}
        value={enabled}
        disabled={busy}
        onChange={(next) => control.applyBunnyHopMs(next ? minMs : 0)}
      />
      <SettingRow
        title="Bunny hop window"
        description={enabled ? `${minMs}–${maxMs} ms, in steps of ${stepMs}. Saved in this profile.` : "Turn on bunny hop first."}
        disabled={busy || !enabled}
        control={(
          <NumberField
            key={refreshKey}
            value={enabled ? value : minMs}
            onApply={(ms) => { control.applyBunnyHopMs(clampBunnyHopMs(ms)); refresh(); }}
            ariaLabel="Bunny hop time in milliseconds"
            unit="ms"
            min={minMs}
            max={maxMs}
            step={stepMs}
            grouping={false}
            disabled={busy || !enabled}
          />
        )}
      />
    </>
  );
}

/* ───────────────────────── Ninjutso NinjaForce ───────────────────────── */

export function NinjutsoSensorGroup({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const pending = snapshot.settingsPending;
  const modes = status.ninjutsoSystemModes;
  const systemLocked = modes?.length === 2 && (status.pollingRateHz > 1000 || status.connectionType === "Wired");
  const opticalLocked = status.ninjutsoSystemMode === "Ultra";
  return (
    <>
      <PerfHeader title="Sensor performance" />
      {modes?.length ? (
        <SettingRow
          title="System mode"
          description={systemLocked ? "Locked above 1000 Hz or while wired." : "Balances speed against battery."}
          disabled={pending || systemLocked}
          control={(
            <Dropdown
              options={modes.map((mode) => ({ value: mode, label: mode }))}
              value={status.ninjutsoSystemMode ?? null}
              onChange={(mode) => control.applyNinjutsoSetting("system", mode)}
              ariaLabel="System mode"
              disabled={pending || systemLocked}
            />
          )}
        />
      ) : status.ninjutsoSystemMode ? (
        // The mouse reported its mode but not the list it can switch between.
        <SettingRow title="System mode" description="Balances speed against battery." controlWidth="hug"
          control={<SettingValue>{status.ninjutsoSystemMode}</SettingValue>} />
      ) : null}
      {status.ninjutsoOpticalEngine ? (
        <SettingRow
          title="Optical Engine"
          description={opticalLocked ? "Locked while System mode is Ultra." : "Burst reacts faster, at some battery cost."}
          disabled={pending || opticalLocked}
          control={(
            <Segmented
              options={[{ value: "Standard", label: "Standard" }, { value: "Burst", label: "Burst" }]}
              value={status.ninjutsoOpticalEngine}
              onChange={(mode) => control.applyNinjutsoSetting("optical", mode)}
              ariaLabel="Optical Engine"
              disabled={pending || opticalLocked}
            />
          )}
        />
      ) : null}
    </>
  );
}

export function NinjutsoClickGroup({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const pending = snapshot.settingsPending;
  return (
    <>
      <PerfHeader title="Clicks" />
      {status.ninjutsoHyperClick != null ? (
        <ToggleRow title="HyperClick" description="Cuts the delay before a click counts." value={status.ninjutsoHyperClick}
          disabled={pending} onChange={(next) => control.applyNinjutsoSetting("hyper", next)} />
      ) : null}
      {status.ninjutsoSlamClick ? (
        <SettingRow
          title="Slam-Click"
          description="Blocks clicks from slamming the mouse down."
          disabled={pending}
          control={(
            <Segmented
              options={[{ value: "Low", label: "Low" }, { value: "Medium", label: "Medium" }, { value: "High", label: "High" }]}
              value={status.ninjutsoSlamClick}
              onChange={(level) => control.applyNinjutsoSetting("slam", level)}
              ariaLabel="Slam-Click"
              disabled={pending}
            />
          )}
        />
      ) : null}
    </>
  );
}

/* ───────────────────────── Endgame Gear ───────────────────────── */

/** A filter the driver reported (true/false), or one it left out: the card showed
    those as an unavailable switch; here the row stays, Disabled with the reason. */
function EggFilterRow({ title, description, value, onChange }: {
  title: string;
  description: string;
  value: boolean | null | undefined;
  onChange: (next: boolean) => void;
}): ReactNode {
  if (value === null) return null; // the driver says this mouse has no such filter
  const unknown = value === undefined;
  return (
    <ToggleRow title={title} description={unknown ? "The mouse didn't report this setting." : description}
      value={value ?? null} disabled={unknown} onChange={onChange} />
  );
}

export function EggFilterGroup({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  return (
    <>
      <PerfHeader title="Filters" />
      <EggFilterRow title="Slamclick filter" description="Ignores clicks from slamming the mouse down."
        value={status.slamclickFilter} onChange={(next) => control.applyEggFilter("slamclick", next)} />
      <EggFilterRow title="Motion-jitter filter" description="Smooths out tiny cursor shakes."
        value={status.motionJitterFilter} onChange={(next) => control.applyEggFilter("motionJitter", next)} />
    </>
  );
}

/** Fallbacks only — each Endgame mouse reports its own range (the v2 / PAW3950
    mice go 10–30,000 in 10-CPI steps up to 10,000), which the driver validates. */
const EGG_CPI = { min: 50, max: 26000, step: 50, maxLevels: 4 } as const;

type CpiLimits = { min: number; max: number; step: number };

/** The device's CPI range from the driver (egg-op1-hid reports eggCpiMin/Max/StepLow
    on the status at runtime), else the dpiOptions grid, else the old constants. */
function eggCpiLimits(snapshot: ControlSnapshot): CpiLimits {
  const egg = snapshot.status as (NonNullable<ControlSnapshot["status"]> & { eggCpiMin?: number; eggCpiMax?: number; eggCpiStepLow?: number }) | null;
  const opts = snapshot.dpiOptions;
  return {
    min: egg?.eggCpiMin ?? opts[0] ?? EGG_CPI.min,
    max: egg?.eggCpiMax ?? opts[opts.length - 1] ?? EGG_CPI.max,
    step: egg?.eggCpiStepLow ?? EGG_CPI.step,
  };
}

/** One CPI stage (AdvancedCards' CpiStageRow): X / Y with a "separate X and Y" link toggle. */
function EggCpiStage({ index, stage, limits }: { index: number; stage: { x: number; y: number }; limits: CpiLimits }): ReactNode {
  const [split, setSplit] = useState(stage.x !== stage.y);
  useEffect(() => { setSplit(stage.x !== stage.y); }, [stage.x, stage.y]);
  return (
    <DpiStageRow
      stage={index + 1}
      x={stage.x}
      y={stage.y}
      linked={!split}
      onLink={(linked) => {
        setSplit(!linked);
        // Re-linking means Y = X, which the card applied with its "Apply stage" button.
        if (linked && stage.y !== stage.x) control.applyEggCpiStage(index, stage.x, stage.x);
      }}
      onX={(x) => control.applyEggCpiStage(index, x, split ? stage.y : x)}
      onY={(y) => control.applyEggCpiStage(index, stage.x, y)}
      min={limits.min}
      max={limits.max}
      step={limits.step}
    />
  );
}

export function EggCpiGroup({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const stages = status.eggCpiStages ?? [];
  const levels = status.eggCpiLevels ?? 0;
  const limits = eggCpiLimits(snapshot);
  return (
    <DpiStageTable
      title="CPI Stages"
      count={levels}
      maxCount={EGG_CPI.maxLevels}
      onCount={(count) => control.applyEggCpiLevels(count)}
      showLiftOff={false}
      showColor={false}
    >
      {stages.slice(0, levels).map((stage, index) => <EggCpiStage key={index} index={index} stage={stage} limits={limits} />)}
    </DpiStageTable>
  );
}

/** Experimental 8K polling divider (AdvancedCards' EggPollingCard; shown with experimental controls on). */
export function EggPollingGroup({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const divider = snapshot.eggPollingDivider;
  const valid = divider !== null && Number.isInteger(divider) && divider > 0 && divider <= 255;
  const result = valid ? (8000 / divider).toLocaleString("en-US", { maximumFractionDigits: 2, useGrouping: false }) : null;
  return (
    <>
      <PerfHeader title="Experimental" description="Nonstandard polling dividers may behave differently across firmware versions." />
      <SettingRow
        title="8K divider"
        description={result !== null ? `Polls at ${result} Hz.` : "Enter a divider from 1 to 255."}
        control={(
          <NumberField
            value={divider}
            onApply={(next) => {
              control.setEggPollingDivider(next);
              control.applyEggPollingDivider(next);
            }}
            ariaLabel="8K polling divider"
            min={1}
            max={255}
            step={1}
            grouping={false}
          />
        )}
      />
    </>
  );
}

/* ───────────────────────── Named power / performance modes ───────────────────────── */

export function PowerModeGroup({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  const modes = status?.powerModes;
  if (!status || !modes?.length) return null;
  const value = status.powerMode ?? modes[0]!;
  // Short names fit the 290 slot as segments; longer or more names use a Dropdown.
  const inline = modes.length >= 2 && modes.length <= 3 && modes.every((mode) => mode.length <= 8);
  return (
    <>
      <PerfHeader title="Power" />
      <SettingRow
        title="Power mode"
        description="Trades battery life for tracking speed."
        control={inline ? (
          <Segmented options={modes.map((mode) => ({ value: mode, label: mode }))} value={value}
            onChange={(mode) => control.applyPowerMode(String(mode))} ariaLabel="Performance mode" />
        ) : (
          <Dropdown options={modes.map((mode) => ({ value: mode, label: mode }))} value={value}
            onChange={(mode) => control.applyPowerMode(String(mode))} ariaLabel="Performance mode" />
        )}
      />
    </>
  );
}
