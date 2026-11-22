// "Processing" group of the Performance tab — a port of AdvancedCards' ProcessingCard
// onto Setting rows. Row order follows Ivan's Performance screens (Motion sync,
// Angle snapping, Ripple control, Sensor mode), then the brand toggles in the
// card's order. Toggles a mouse doesn't report (null) are hidden rather than
// shown as an "N/A" switch — the library has no such state, and the brief says to
// hide what a mouse doesn't have.
import { Fragment, type ReactNode } from "react";
import { teevolutionSensorModeUi } from "@openmouse/protocol/teevolution";
import * as control from "../../../../device/controller";
import { sleepLabel } from "../../../../device/options";
import { isPulsarProProtocol } from "../../../../device/traits";
import type { ControlSnapshot } from "../../../../device/types";
import { ArrowStepper, Dropdown, SettingRow, SettingValue, type DropOption } from "../../kit";
import { PerfHeader, ToggleRow } from "./shared";

type SensorMode = "Eco" | "High" | "Ultra";
const SENSOR_MODES: readonly SensorMode[] = ["Eco", "High", "Ultra"];

/** Angle tune runs −30° … 30° in 1° steps (the card's select). */
const ANGLE_OPTIONS: DropOption<number>[] = Array.from({ length: 61 }, (_, index) => index - 30)
  .map((angle) => ({ value: angle, label: `${angle}°` }));

export function ProcessingGroup({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const ui = status.ui;
  const locale = snapshot.preferences.locale;
  const { traits, capabilities } = snapshot;
  const teevolutionProfile = capabilities?.teevolutionProfile;

  const sensorUi = traits.teevolution && teevolutionProfile && status.connectionType
    ? teevolutionSensorModeUi({
      storedMode: status.sensorModeStored ?? 0,
      pollingRateHz: status.pollingRateHz,
      connection: status.connectionType,
    })
    : null;

  const angleSnappingLabel = ui?.family === "atk" ? "Straight-line correction" : "Angle snapping";
  // WLMouse calls the same sensor setting High-speed mode in its own tool.
  const hyperLabel = status.brand === "WLMouse" ? "High-speed mode" : "Hyper mode";
  // Pulsar Pro shows the angle with the rest of its Pro-only settings (Profiles tab).
  const angleTuning = isPulsarProProtocol(status) ? null : status.angleTuning;
  const performanceLabel = status.brand === "CRDRAKO"
    ? "Competitive mode"
    : status.brand === "Teevolution" ? "Highest performance" : "Performance mode";

  const rows: ReactNode[] = [];
  const push = (key: string, node: ReactNode): void => { rows.push(<Fragment key={key}>{node}</Fragment>); };

  if (status.motionSync != null && ui?.hideMotionSync !== true) {
    push("motion-sync", (
      <ToggleRow title="Motion sync" description="Syncs sensor reports with polling" value={status.motionSync}
        onChange={(next) => control.applyPulsarToggle("motionSync", next)} />
    ));
  }
  if (status.angleSnapping != null && ui?.hideAngleSnapping !== true && !traits.finalmouse) {
    push("angle-snapping", (
      <ToggleRow title={angleSnappingLabel} description="Straightens small wobbles" value={status.angleSnapping}
        onChange={(next) => control.applyPulsarToggle("angleSnapping", next)} />
    ));
  }
  if (status.rippleControl != null && ui?.hideRippleControl !== true && !traits.finalmouse) {
    push("ripple-control", (
      <ToggleRow title="Ripple control" description="Smooths jitter at very high DPI." value={status.rippleControl}
        onChange={(next) => control.applyPulsarToggle("rippleControl", next)} />
    ));
  }

  if (sensorUi && teevolutionProfile) {
    const options = SENSOR_MODES
      .filter((mode) => mode === "Ultra" || teevolutionProfile.sensorModes.includes(mode))
      .map((mode) => ({ value: mode, label: mode }));
    push("teevolution-sensor-mode", (
      <SettingRow
        title="Sensor mode"
        description={sensorUi.editable
          ? "Eco saves battery at up to 1000 Hz wireless."
          : `Locked to ${sensorUi.mode} at ${status.pollingRateHz} Hz ${status.connectionType?.toLowerCase() ?? ""}.`.replace(/ \.$/, ".")}
        disabled={!sensorUi.editable}
        control={(
          <ArrowStepper options={options} value={sensorUi.mode} ariaLabel="Sensor mode" disabled={!sensorUi.editable}
            onChange={(mode) => control.applyTeevolutionSensorMode(mode)} />
        )}
      />
    ));
  }
  if (status.sensorMode != null && !traits.teevolution) {
    const locked = status.sensorModeEditable === false;
    push("sensor-mode", (
      <SettingRow
        title="Sensor mode"
        description={locked ? "The mouse has this locked right now." : "Trades some battery for speed."}
        disabled={locked}
        control={(
          <ArrowStepper options={SENSOR_MODES.map((mode) => ({ value: mode, label: mode }))} value={status.sensorMode}
            ariaLabel="Sensor mode" disabled={locked} onChange={(mode) => control.applySensorMode(mode)} />
        )}
      />
    ));
  }

  if (status.performanceMode != null && !traits.eggFamily && !traits.finalmouse) {
    push("performance-mode", (
      <ToggleRow title={performanceLabel} description="Keeps the sensor at full speed." value={status.performanceMode}
        onChange={(next) => control.applyPulsarToggle("performanceMode", next)} />
    ));
  }
  if (status.hyperMode != null) {
    push("hyper-mode", (
      <ToggleRow title={hyperLabel} description="Runs the sensor faster for lower delay." value={status.hyperMode}
        onChange={(next) => control.applyPulsarToggle("hyperMode", next)} />
    ));
  }
  if (status.turboMode != null) {
    const blocked = status.hyperMode === false;
    push("turbo-mode", (
      <ToggleRow title="Turbo mode"
        description={blocked ? `Turn on ${hyperLabel} first.` : "Locks the sensor at its top frame rate."}
        value={status.turboMode} disabled={blocked}
        onChange={(next) => control.applyPulsarToggle("turboMode", next)} />
    ));
  }
  if (status.buttonCombination != null) {
    push("button-combination", (
      <ToggleRow title="Button combinations" description="Lets button combos change settings."
        value={status.buttonCombination} onChange={(next) => control.applyPulsarToggle("buttonCombination", next)} />
    ));
  }
  if (status.longRangeMode != null) {
    push("long-range", (
      <ToggleRow title="Ultra long range" description="Stronger wireless link. Uses more battery."
        value={status.longRangeMode} onChange={(next) => control.applyPulsarToggle("longRangeMode", next)} />
    ));
  }
  if (angleTuning != null) {
    push("angle-tune", (
      capabilities?.angleTuningWritable ? (
        <SettingRow title="Angle tune" description="Rotates the sensor to match your grip."
          control={(
            <Dropdown options={ANGLE_OPTIONS} value={angleTuning} ariaLabel="Angle tune"
              onChange={(angle) => control.applyAngleTuning(angle)} />
          )} />
      ) : (
        <SettingRow title="Angle tune" description="Rotates the sensor to match your grip." controlWidth="hug"
          control={<SettingValue>{`${angleTuning}°`}</SettingValue>} />
      )
    ));
  }
  if (traits.teevolution && teevolutionProfile) {
    const off = status.performanceMode !== true;
    const options = teevolutionProfile.performanceTimeOptions
      .map((value) => ({ value, label: sleepLabel(value * 10, locale) }));
    push("teevolution-duration", (
      <SettingRow
        title="Performance duration"
        description={off ? `Turn on ${performanceLabel} first.` : `How long ${performanceLabel.toLowerCase()} stays on.`}
        disabled={off}
        control={(
          <Dropdown options={options} value={status.performanceDuration ?? null} ariaLabel="Performance duration"
            disabled={off} placeholder="Choose" onChange={(value) => control.applyTeevolutionPerformanceDuration(value)} />
        )}
      />
    ));
  }

  if (rows.length === 0) return null;
  return (
    <>
      <PerfHeader title="Processing" />
      {rows}
    </>
  );
}
