// Small shared pieces for the Performance tab (sections/PerformanceSection.tsx).
// Presentation only — every write goes through device/controller, which stages
// it in the pending bar exactly as the web-shell cards do.
import { useState, type ReactNode } from "react";
import type { ControlSnapshot } from "../../../../device/types";
import { SectionHeader, SettingRow, Toggle, type SectionHeaderProps } from "../../kit";

/**
 * The kit Section header as it sits on Ivan's screens: every reference screen
 * frames its section headers with 10 px above and below (665×61 with a
 * description, 665×39 title-only), where the library component itself pads 4.
 * The extra 6 px is added around the kit component, not inside it.
 */
export function PerfHeader(props: SectionHeaderProps): ReactNode {
  return (
    <div className="mk-perf-head">
      <SectionHeader {...props} />
    </div>
  );
}

/** DPI with a thousands separator ("1,600"), as the copy rules ask. */
export const fmtDpi = (value: number): string => value.toLocaleString("en-US");

/** Hz / ms values carry no separator ("1000 Hz", "100 ms"). */
export const fmtPlain = (value: number): string => String(value);

/**
 * A key bumped after every Apply so a Number field re-reads the device value:
 * the controller may snap a typed value to the mouse's grid, refuse one it can't
 * hold, or find it already set — the field must then show what's actually
 * staged, not the stale draft.
 */
export function useRefreshKey(): [number, () => void] {
  const [key, setKey] = useState(0);
  return [key, () => setKey((current) => current + 1)];
}

/** Every integer from min to max, as Snapping-slider stops labelled by `label`. */
export function integerStops(min: number, max: number, label: (value: number) => string = fmtPlain): { value: number; label: string }[] {
  const stops: { value: number; label: string }[] = [];
  for (let value = Math.ceil(min); value <= max; value += 1) stops.push({ value, label: label(value) });
  return stops;
}

/**
 * True when this connected mouse edits DPI as Logitech per-profile slots
 * (DpiCard's `slotsAvailable`): the slot table replaces presets, the custom
 * value and the separate-axes form.
 */
export function usesDpiSlots(snapshot: ControlSnapshot): boolean {
  return snapshot.profile.slotsAvailable;
}

/** CompX / Keychron / Incott / Teevolution style stage editor (DpiCard's `stagesAvailable`). */
export function usesDpiStages(snapshot: ControlSnapshot): boolean {
  const status = snapshot.status;
  return Boolean(status?.ui?.dpiStageEditor)
    && Array.isArray(status?.dpiStages)
    && (status?.dpiStages?.length ?? 0) > 0
    && !snapshot.profile.slotsAvailable;
}

/** Logitech host-mode X / Y axes (DpiCard's `showSeparateDpiAxes`). */
export function usesSeparateAxes(snapshot: ControlSnapshot): boolean {
  return snapshot.traits.logitech
    && snapshot.status?.supportsSeparateDpiAxes === true
    && !snapshot.profile.slotsAvailable;
}

export interface ToggleRowProps {
  title: string;
  description?: string;
  value: boolean | null | undefined;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

/** Setting row with an Off | On Toggle (the library's Control=Toggle variant). */
export function ToggleRow({ title, description, value, onChange, disabled = false, ariaLabel }: ToggleRowProps): ReactNode {
  return (
    <SettingRow title={title} description={description} disabled={disabled}
      control={<Toggle value={value ?? null} onChange={onChange} ariaLabel={ariaLabel ?? title} disabled={disabled} />} />
  );
}
