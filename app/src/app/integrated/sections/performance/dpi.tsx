// DPI on the Performance tab — a port of cards/DpiCard.tsx onto the kit.
//
// Left column (docked under the product render, as in Ivan's two Performance screens):
//   presets mice  → Readout tile; its arrows step through the common DPI values
//   stage mice    → DPI stage table (CompX / Keychron / Incott / Teevolution: count,
//                   current stage, value per stage, optional colour per stage)
//   Logitech slots→ DPI stage table of the edited onboard profile (count, default
//                   slot, X / link / Y, lift-off per slot; read-only while locked)
// Right column ("DPI" group, every mouse that isn't on slots):
//   presets (Segmented card), Custom DPI (Number field), Logitech X and Y (Number field X/Y).
import { useEffect, useState, type ReactNode } from "react";
import { capabilitiesForFormat, stageLodLevel } from "@openmouse/protocol/drivers/logitech/onboard-profiles";
import * as control from "../../../../device/controller";
import type { ControlSnapshot, LiftOffLevel } from "../../../../device/types";
import { dpiPresetValues } from "../../../../dpi-presets";
import {
  DpiStageRow, DpiStageTable, NumberField, NumberFieldXY, ReadoutTile, Segmented, SettingRow,
  type SegOption,
} from "../../kit";
import { fmtDpi, PerfHeader, useRefreshKey, usesDpiSlots, usesDpiStages, usesSeparateAxes } from "./shared";

/** Colour data, not a theme value: the device's unset stage colour, which is also
    what the controller pads new stages with (applyDpiStageCount). */
const UNSET_STAGE_COLOR = "#000000";

const LOD_ORDER: readonly LiftOffLevel[] = ["Low", "Medium", "High"];
/** The library's per-stage lift-off segments read L / M / H (120-wide slot). */
const LOD_SHORT: Record<LiftOffLevel, string> = { Low: "L", Medium: "M", High: "H" };

/* ───────────────────────── Left column dock ───────────────────────── */

/** The DPI control docked at the bottom of the product render. */
export function DpiDock({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  if (usesDpiSlots(snapshot)) return <DpiSlotTable snapshot={snapshot} />;
  if (usesDpiStages(snapshot)) return <DpiStageEditor snapshot={snapshot} />;
  return <DpiReadout snapshot={snapshot} />;
}

/** Readout tile: the current DPI, with prev / next stepping through the presets DpiCard offers. */
function DpiReadout({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const presets = dpiPresetValues(snapshot.dpiOptions);
  const dpi = status.dpi;
  const prev = presets.filter((value) => value < dpi).at(-1) ?? null;
  const next = presets.find((value) => value > dpi) ?? null;
  const pending = snapshot.settingsPending;
  const y = status.dpiY ?? dpi;
  const split = usesSeparateAxes(snapshot) && y !== dpi;
  return (
    <ReadoutTile
      label={split ? `X DPI · Y ${fmtDpi(y)}` : "DPI"}
      value={pending ? "–" : fmtDpi(dpi)}
      unit="DPI"
      icon="dpi"
      onPrev={() => { if (prev !== null) control.applyDpiValue(prev); }}
      onNext={() => { if (next !== null) control.applyDpiValue(next); }}
      prevDisabled={pending || prev === null}
      nextDisabled={pending || next === null}
      prevLabel={prev !== null ? `Lower DPI to ${fmtDpi(prev)}` : "Lower DPI"}
      nextLabel={next !== null ? `Raise DPI to ${fmtDpi(next)}` : "Raise DPI"}
    />
  );
}

/** Shared CompX / Keychron / Incott / Teevolution stages: one DPI per stage + the current stage. */
function DpiStageEditor({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  const editor = status?.ui?.dpiStageEditor;
  const stages = status?.dpiStages;
  if (!status || !editor || !stages || stages.length === 0) return null;

  const countEditable = editor.countEditable === true;
  const active = Math.min(status.activeDpiStage ?? 0, stages.length - 1);
  const disabled = snapshot.settingsPending;
  const colors = status.dpiStageColors;

  return (
    <DpiStageTable
      count={stages.length}
      maxCount={editor.maxStages}
      onCount={countEditable ? (count) => control.applyDpiStageCount(count) : undefined}
      locked={disabled}
      showLiftOff={false}
      showColor={Boolean(colors)}
    >
      {stages.map((dpi, index) => (
        <DpiStageRow
          key={index}
          stage={index + 1}
          active={index === active}
          // Single-axis stages: Y follows X, so the row shows it linked (greyed, read-only).
          x={dpi}
          y={dpi}
          linked
          onX={(value) => { if (Number.isInteger(value) && value !== dpi) control.applyDpiStageValue(index, value); }}
          onY={() => undefined}
          onActivate={() => control.applyActiveDpiStage(index)}
          min={editor.minDpi}
          max={editor.maxDpi}
          step={editor.stepDpi}
          color={colors ? colors[index] ?? UNSET_STAGE_COLOR : undefined}
          onColor={colors ? (hex) => control.applyDpiStageColor(index, hex) : undefined}
          locked={disabled}
        />
      ))}
    </DpiStageTable>
  );
}

/** Logitech onboard-profile DPI slots (DpiCard's DpiSlots). */
function DpiSlotTable({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const limits = snapshot.profile.slotLimits;
  const plan = snapshot.dpiSlotPlan;
  if (!limits || !plan) return null;
  const locked = snapshot.profile.slotsLocked;
  const levels = snapshot.profileFormat ? capabilitiesForFormat(snapshot.profileFormat.id).supportedLods : [];
  const hasLod = levels.length > 0;
  const lodOptions: SegOption<LiftOffLevel>[] = LOD_ORDER
    .filter((level) => levels.includes(level))
    .map((level) => ({ value: level, label: LOD_SHORT[level] }));

  return (
    <div className="mk-perf-dock">
      <DpiStageTable
        count={plan.stages.length}
        maxCount={limits.maxStages}
        onCount={(count) => control.setDpiSlotCount(count)}
        locked={locked}
        showLiftOff={hasLod}
        showColor={false}
      >
        {plan.stages.map((stage, index) => {
          const linked = snapshot.dpiAxisLocks[index] ?? true;
          return (
            <DpiStageRow
              key={index}
              stage={index + 1}
              // The highlighted slot is the one the mouse starts on.
              active={index === plan.defaultIndex}
              currentLabel="Default"
              x={stage.x}
              y={stage.y}
              linked={linked}
              onLink={(next) => control.setDpiAxisLock(index, next)}
              onX={(value) => control.setDpiSlotAxis(index, "x", value)}
              onY={(value) => control.setDpiSlotAxis(index, "y", value)}
              onActivate={() => control.setDpiSlotDefault(index)}
              min={limits.minDpi}
              max={limits.maxDpi}
              step={limits.stepDpi}
              liftOff={hasLod ? (
                <Segmented
                  options={lodOptions}
                  value={stageLodLevel(stage.lod)}
                  onChange={(level) => control.setDpiSlotLod(index, level)}
                  ariaLabel={`Stage ${index + 1} lift-off`}
                  disabled={locked}
                />
              ) : undefined}
              locked={locked}
            />
          );
        })}
      </DpiStageTable>
      {locked ? (
        <p className="mk-perf-note mk-t-caption12">
          Read-only for now: saving DPI stages to this profile isn't enabled on this mouse yet.
        </p>
      ) : null}
    </div>
  );
}

/* ───────────────────────── Right column group ───────────────────────── */

/** Presets, a custom value and (Logitech) separate X / Y — DpiCard's controls for every
    mouse that isn't editing onboard slots. */
export function DpiGroup({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  if (!status || usesDpiSlots(snapshot)) return null;
  const stages = usesDpiStages(snapshot);
  const pending = snapshot.settingsPending;
  const options = snapshot.dpiOptions;

  const common = dpiPresetValues(options);
  // Stage-editor mice list every stage with the current one highlighted, so the
  // presets stay stable there (DpiCard): the current DPI isn't injected as a chip.
  const values = stages || common.includes(status.dpi) ? common : [...common, status.dpi].sort((a, b) => a - b);
  const min = options.length ? Math.min(...options) : null;
  const max = options.length ? Math.max(...options) : null;

  return (
    <>
      <PerfHeader
        title="DPI"
        description={stages ? "Presets and custom values change the current stage." : "Pick a common value or type your own."}
      />
      {values.length > 0 ? (
        <Segmented
          container="card"
          ariaLabel="Common DPI values"
          options={values.map((dpi) => ({ value: dpi, label: fmtDpi(dpi) }))}
          value={status.dpi}
          disabled={pending}
          onChange={(dpi) => control.applyDpiValue(dpi)}
        />
      ) : null}
      {min !== null && max !== null ? <CustomDpiRow dpi={status.dpi} min={min} max={max} disabled={pending} /> : null}
      {usesSeparateAxes(snapshot) ? <AxisRow snapshot={snapshot} /> : null}
    </>
  );
}

/** Any DPI, snapped to the mouse's grid by the controller (DpiCard's CustomDpiEntry). */
function CustomDpiRow({ dpi, min, max, disabled }: { dpi: number; min: number; max: number; disabled: boolean }): ReactNode {
  const [refreshKey, refresh] = useRefreshKey();
  return (
    <SettingRow
      title="Custom DPI"
      description={`${fmtDpi(min)}–${fmtDpi(max)} DPI. Snaps to the nearest step.`}
      disabled={disabled}
      control={(
        <NumberField
          key={refreshKey}
          value={dpi}
          onApply={(value) => { control.applyCustomDpi(value); refresh(); }}
          ariaLabel="Custom DPI"
          unit="DPI"
          min={min}
          max={max}
          step={1}
          disabled={disabled}
        />
      )}
    />
  );
}

/** Logitech host-mode X / Y DPI (DpiCard's AxisControls). */
function AxisRow({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  const x = status?.dpi ?? 0;
  const y = status?.dpiY ?? x;
  const [linked, setLinked] = useState(x === y);
  const [refreshKey, refresh] = useRefreshKey();
  // A device-side split (X ≠ Y) can't be shown linked.
  useEffect(() => { if (x !== y) setLinked(false); }, [x, y]);
  if (!status) return null;
  const options = snapshot.dpiOptions;
  const min = options.length ? Math.min(...options) : 100;
  const max = options.length ? Math.max(...options) : undefined;
  return (
    <SettingRow
      title="X and Y DPI"
      description="Different speeds side to side and up-down."
      control={(
        <NumberFieldXY
          key={refreshKey}
          x={x}
          y={y}
          onApply={(nextX, nextY) => { control.applyLogitechAxisDpi(nextX, nextY); refresh(); }}
          ariaLabel="DPI"
          min={min}
          max={max}
          step={50}
          linked={linked}
          onLinkChange={setLinked}
        />
      )}
    />
  );
}
