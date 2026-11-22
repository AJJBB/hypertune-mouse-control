// Lighting tab of the integrated device page (Figma v2 · "Mouse - Lighting").
//
// Recipe (hypertune-mouse-components.md): zone picker → Effects (Segmented / Icon) →
// Color group (Slider rows for brightness / speed, Color picker Compact). Each
// capability flag this tab owns (sections/flags.ts) renders its full control set:
//   lighting                → the RGB zones (port of cards/LightingCard.tsx, variant "tab")
//   teevolutionDpiLighting  → DPI indicator group (port of AdvancedCards.tsx DpiLightingCard)
//   lightingAdvanced        → receiver / zone-0 group (port of LightingCard variant "advanced")
// Same control.* calls, gating and option lists as those cards; every change
// stages into the pending bar (sliders and colour drags stage once on release).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { MouseLighting, MouseLightingMode } from "@openmouse/protocol/drivers/mouse-types";
import * as control from "../../../device/controller";
import { sleepLabel } from "../../../device/options";
import type { ControlSnapshot } from "../../../device/types";
import { cardAvailability } from "../../cards/availability";
import {
  CollapsibleSection, ColorPicker, Dropdown, SectionHeader, Segmented, SettingGroup, SettingRow, SliderRow,
  ZonePicker, normalizeHex, type IconName, type SegOption,
} from "../kit";
import { MouseRender, SplitLayout } from "./layout";
import "./lighting.css";

/* Device colour defaults when a zone hasn't reported one (data, not theme colours —
   the same fallbacks the web cards use). */
const DEFAULT_COLOR = "#00ff00";
const DEFAULT_COLOR2 = "#ff0000";

/** Effects above this many switch from Segmented / Icon to a Dropdown (the brief: >7 → Dropdown). */
const MAX_EFFECT_SEGMENTS = 7;

const MODE_ICON: Record<MouseLightingMode, IconName> = {
  Off: "power",
  Static: "static",
  Cycling: "cycle",
  Wave: "wave",
  Spectrum: "cycle",
  Reactive: "bolt",
  "Breathing random": "breathing",
  "Breathing single": "breathing",
  "Breathing dual": "breathing",
  Neon: "palette",
  "Cycling Flash": "cycle",
  "YOYO Ball": "pulse",
  "Single Flash": "bolt",
  "Breathing Loop": "breathing",
};

/** Sentence-case display names (the value written to the mouse stays the driver's mode).
    A zone with a single breathing variant shows it as plain "Breathing", as the reference does. */
function modeLabel(mode: MouseLightingMode, modes: readonly MouseLightingMode[]): string {
  if (mode === "Cycling") return "Color cycle";
  if (mode === "YOYO Ball") return "Yo-yo ball";
  if (mode.startsWith("Breathing") && modes.filter((m) => m.startsWith("Breathing")).length === 1) return "Breathing";
  return mode.charAt(0) + mode.slice(1).toLowerCase();
}

/** A zone name inside a sentence: "Logo" → "logo"; names with digits or capitals inside ("LED 1") stay. */
function zoneName(zone: string): string {
  return /^[A-Z][a-z]*( [a-z]+)*$/.test(zone) ? zone.toLowerCase() : zone;
}

/* ───────────────────────────── staged inputs ───────────────────────────── */

/** Slider row that follows the drag locally and stages once when the drag / key press
    ends (the kit Slider's onCommit), so a drag queues one pending change, not dozens —
    and an instant-apply user doesn't flash the mouse on every pixel. */
function StagedSliderRow({
  label, icon, min, max, position, known, text, textAt, onStage, disabled,
}: {
  label: string;
  icon: IconName;
  min: number;
  max: number;
  /** Slider position of the device's current value. */
  position: number;
  /** False when the device hasn't reported a value (committing the shown position still stages). */
  known: boolean;
  /** Value field text for the device's current value. */
  text: string;
  /** Value field text for a position while dragging. */
  textAt: (position: number) => string;
  onStage: (position: number) => void;
  disabled: boolean;
}): ReactNode {
  const [draft, setDraft] = useState<number | null>(null);
  useEffect(() => { setDraft(null); }, [position]);
  return (
    <SliderRow label={label} icon={icon} min={min} max={max} step={1}
      value={draft ?? position} valueLabel={draft === null ? text : textAt(draft)} disabled={disabled}
      onChange={setDraft}
      onCommit={(next) => {
        setDraft(null);
        if (next !== position || !known) onStage(next);
      }} />
  );
}

/** A Slider row over the driver's own list of values (brightness levels, speed levels):
    one stop per listed value, so the option list is exactly the card's. */
function ListSliderRow({
  label, icon, values, value, format, onStage, disabled,
}: {
  label: string;
  icon: IconName;
  values: readonly number[];
  value: number | null | undefined;
  format: (v: number) => string;
  onStage: (v: number) => void;
  disabled: boolean;
}): ReactNode {
  // A value off the driver's list (e.g. a Razer at 37% set from Synapse) shows on
  // the nearest stop, but is NOT "known" there — so committing that stop still
  // stages it (the old Segmented let one click pick any level).
  const exact = value == null ? -1 : values.indexOf(value);
  let index = exact;
  if (index < 0 && value != null && values.length) {
    index = values.reduce((best, v, i) => (Math.abs(v - value) < Math.abs(values[best] - value) ? i : best), 0);
  }
  return (
    <StagedSliderRow label={label} icon={icon} min={0} max={Math.max(0, values.length - 1)}
      position={Math.max(0, index)} known={exact >= 0} text={value == null ? "–" : format(value)}
      textAt={(i) => format(values[i] ?? 0)} disabled={disabled}
      onStage={(i) => { const v = values[i]; if (v !== undefined) onStage(v); }} />
  );
}

/** Color picker (Compact) that previews a hue drag locally and stages the colour once
    on release — the web ColorPicker's commit-on-pointer-up. Presets, the hex field and
    keyboard steps stage straight away. */
function StagedColorPicker({
  value, onStage, label, ariaLabel, disabled,
}: {
  value: string;
  onStage: (hex: string) => void;
  label: string;
  ariaLabel: string;
  disabled: boolean;
}): ReactNode {
  const [draft, setDraft] = useState<string | null>(null);
  const held = useRef(false);
  const latest = useRef<string | null>(null);
  const releaseImpl = useRef<() => void>(() => undefined);
  // Stable window listener (so add / remove pair up across renders) that runs the latest closure.
  const [onRelease] = useState(() => () => releaseImpl.current());
  releaseImpl.current = (): void => {
    held.current = false;
    window.removeEventListener("pointerup", onRelease);
    window.removeEventListener("pointercancel", onRelease);
    const hex = latest.current;
    latest.current = null;
    setDraft(null);
    if (hex && hex !== normalizeHex(value)) onStage(hex);
  };
  useEffect(() => () => {
    window.removeEventListener("pointerup", onRelease);
    window.removeEventListener("pointercancel", onRelease);
  }, [onRelease]);
  useEffect(() => { if (!held.current) setDraft(null); }, [value]);

  return (
    <div className="mk-lighting__color"
      onPointerDownCapture={(e) => {
        if (disabled || e.button !== 0 || held.current) return;
        held.current = true;
        window.addEventListener("pointerup", onRelease);
        window.addEventListener("pointercancel", onRelease);
      }}>
      <ColorPicker layout="compact" label={label} icon="palette" ariaLabel={ariaLabel} disabled={disabled}
        value={draft ?? value}
        onChange={(hex) => {
          if (held.current) { latest.current = hex; setDraft(hex); return; }
          if (hex !== normalizeHex(value)) onStage(hex);
        }} />
    </div>
  );
}

/* ───────────────────────────── one lighting zone ───────────────────────────── */

/** The effect picker for a zone: Segmented / Icon (≤ 7 effects), else a Dropdown row. */
function EffectPicker({ lighting, zoneIndex, disabled, ariaLabel }: {
  lighting: MouseLighting; zoneIndex: number; disabled: boolean; ariaLabel: string;
}): ReactNode {
  const onChange = (mode: MouseLightingMode): void => control.applyLighting({ mode }, zoneIndex);
  if (lighting.modes.length > MAX_EFFECT_SEGMENTS) {
    return (
      <SettingRow title="Effect" description="How the light moves." disabled={disabled}
        control={<Dropdown ariaLabel={ariaLabel} disabled={disabled} value={lighting.mode} onChange={onChange}
          options={lighting.modes.map((mode) => ({ value: mode, label: modeLabel(mode, lighting.modes) }))} />} />
    );
  }
  const options: SegOption<MouseLightingMode>[] = lighting.modes.map((mode) => ({
    value: mode, label: modeLabel(mode, lighting.modes), icon: MODE_ICON[mode] ?? "palette",
  }));
  return (
    <Segmented container="card" iconSegments ariaLabel={ariaLabel} options={options} value={lighting.mode}
      disabled={disabled} onChange={onChange}
      className={`mk-lighting__effects${options.length >= 6 ? " is-many" : ""}`} />
  );
}

/** Brightness, speed and colour(s) for a zone, in the reference screen's order. Gating is
    LightingCard's: brightness whenever the zone lists levels; colour / second colour / speed
    only for effects that use them. */
function zoneRows(lighting: MouseLighting, zoneIndex: number, disabled: boolean): ReactNode[] {
  const mode = lighting.mode;
  const usesColor = mode !== null && lighting.colorModes.includes(mode);
  const usesColor2 = mode !== null && lighting.dualColorModes.includes(mode);
  const usesSpeed = mode !== null && lighting.reactiveModes.includes(mode);
  const brightnessLevels = lighting.brightnessLevels ?? [];
  const speeds = lighting.speeds;
  const sliderSpeeds = speeds.length > 8;
  const rows: ReactNode[] = [];

  if (brightnessLevels.length > 0) {
    rows.push(
      <ListSliderRow key="brightness" label="Brightness" icon="sun" values={brightnessLevels} value={lighting.brightness}
        format={(v) => `${v}%`} disabled={disabled}
        onStage={(brightness) => control.applyLighting({ brightness }, zoneIndex)} />,
    );
  }
  if (usesSpeed && speeds.length > 0) {
    if (sliderSpeeds) {
      // Long speed lists: a continuous min–max range, as the card's range input.
      const min = Math.min(...speeds);
      const max = Math.max(...speeds);
      const current = lighting.speed ?? speeds[0] ?? 0;
      rows.push(
        <StagedSliderRow key="speed" label="Speed" icon="bolt" min={min} max={max} position={current}
          known={lighting.speed !== null} text={String(current)} textAt={(v) => String(v)} disabled={disabled}
          onStage={(speed) => control.applyLighting({ speed }, zoneIndex)} />,
      );
    } else {
      rows.push(
        <ListSliderRow key="speed" label="Speed" icon="bolt" values={speeds} value={lighting.speed}
          format={(v) => String(v)} disabled={disabled}
          onStage={(speed) => control.applyLighting({ speed }, zoneIndex)} />,
      );
    }
  }
  if (usesColor) {
    rows.push(
      <StagedColorPicker key="color" label="Color" ariaLabel="Lighting color" disabled={disabled}
        value={lighting.color ?? DEFAULT_COLOR}
        onStage={(color) => control.applyLighting({ color }, zoneIndex)} />,
    );
    if (usesColor2) {
      rows.push(
        <StagedColorPicker key="color2" label="Color 2" ariaLabel="Second lighting color" disabled={disabled}
          value={lighting.color2 ?? DEFAULT_COLOR2}
          onStage={(color2) => control.applyLighting({ color2 }, zoneIndex)} />,
      );
    }
  }
  return rows;
}

function WriteOnlyNote(): ReactNode {
  return (
    <p className="mk-lighting__note mk-t-caption12">
      This mouse can't report its lighting, so these show the last settings written.
    </p>
  );
}

/* ───────────────────────────── zones ───────────────────────────── */

type ZoneGroup = { key: string; label: string; indices: number[] };

/** Zones grouped by physical surface: directly painted LED cells share a `group`
    ("Lightstrip"), every other zone stands alone. */
function zoneGroups(zones: readonly MouseLighting[]): ZoneGroup[] {
  const groups: ZoneGroup[] = [];
  const byKey = new Map<string, ZoneGroup>();
  zones.forEach((zone, index) => {
    const key = zone.group ? `group:${zone.group}` : `zone:${index}`;
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: zone.group ?? zone.zone, indices: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.indices.push(index);
  });
  return groups;
}

/** Zone picker: Segmented (Card) by zone name; a surface made of individually painted
    LEDs adds a Zone picker of colour swatches, one per LED. */
function ZoneChooser({ zones, active, onSelect }: {
  zones: readonly MouseLighting[]; active: number; onSelect: (index: number) => void;
}): ReactNode {
  const groups = zoneGroups(zones);
  const lastInGroup = useRef(new Map<string, number>());
  const current = groups.find((g) => g.indices.includes(active)) ?? groups[0];
  if (current) lastInGroup.current.set(current.key, active);
  const hasLightstrip = zones.some((zone) => zone.hardwareZoneId != null);
  return (
    <>
      {groups.length > 1 ? (
        <Segmented container="card" ariaLabel={hasLightstrip ? "Lighting part" : "Lighting zone"}
          className="mk-lighting__zones"
          options={groups.map((g) => ({ value: g.key, label: g.label }))}
          value={current?.key ?? null}
          onChange={(key) => {
            const group = groups.find((g) => g.key === key);
            if (group) onSelect(lastInGroup.current.get(group.key) ?? group.indices[0]);
          }} />
      ) : null}
      {current && current.indices.length > 1 ? (
        <ZonePicker className="mk-lighting__cells"
          ariaLabel={hasLightstrip ? "Lightstrip LEDs" : "Lighting zones"}
          value={active}
          onChange={(id) => onSelect(Number(id))}
          zones={current.indices.map((index) => {
            const zone = zones[index];
            return {
              id: index,
              label: zone.zone,
              color: zone.color ?? "var(--mk-bg-control)",
              off: zone.mode === "Off",
            };
          })} />
      ) : null}
    </>
  );
}

/** `lighting` flag — the RGB zones (LightingCard, variant "tab"). */
function ZoneLighting({ snapshot, zones, active, onSelect }: {
  snapshot: ControlSnapshot; zones: readonly MouseLighting[]; active: number; onSelect: (index: number) => void;
}): ReactNode {
  const lighting = zones[active] ?? snapshot.status?.lighting;
  if (!lighting) return null;
  const disabled = snapshot.settingsPending;
  const rows = zoneRows(lighting, active, disabled);
  const usesColor = lighting.mode !== null && lighting.colorModes.includes(lighting.mode);
  return (
    <>
      {zones.length > 1 ? <ZoneChooser zones={zones} active={active} onSelect={onSelect} /> : null}
      {/* With one zone there's no picker to say which light this is (the card's title did). */}
      <SectionHeader title="Effects" description={zones.length > 1 ? undefined : `Picks the ${zoneName(lighting.zone)} light effect.`} />
      <EffectPicker lighting={lighting} zoneIndex={active} disabled={disabled}
        ariaLabel={`${lighting.group ? `${lighting.group} ${lighting.zone}` : lighting.zone} lighting effect`} />
      {rows.length > 0 ? (
        <>
          <SectionHeader title={usesColor ? "Color" : "Effect settings"} />
          <SettingGroup>{rows}</SettingGroup>
        </>
      ) : null}
      {lighting.writeOnly ? <WriteOnlyNote /> : null}
    </>
  );
}

/** `lightingAdvanced` flag — LightingCard's "advanced" variant: the zone-0 light (the
    receiver LED where the driver reports one) as its own group. It edits the same zone the
    first zone of the main picker does, so it starts folded with its current effect as
    the summary rather than repeating the controls above. */
function ReceiverLighting({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const lighting = snapshot.status?.lighting;
  if (!lighting) return null;
  const disabled = snapshot.settingsPending;
  const receiver = lighting.zone === "Receiver";
  const title = receiver ? "Receiver lighting" : `${lighting.zone} lighting`;
  return (
    <CollapsibleSection title={title} defaultOpen={false}
      summary={control.describeLighting(lighting, snapshot.preferences.locale)}
      className="mk-lighting__receiver">
      <EffectPicker lighting={lighting} zoneIndex={0} disabled={disabled} ariaLabel={`${title} effect`} />
      {zoneRows(lighting, 0, disabled)}
      {lighting.writeOnly ? <WriteOnlyNote /> : null}
    </CollapsibleSection>
  );
}

/* ───────────────────────────── DPI indicator ───────────────────────────── */

const DPI_LIGHT_MODES: { value: 0 | 1 | 2; label: string; icon: IconName }[] = [
  { value: 0, label: "Off", icon: "power" },
  { value: 1, label: "Steady", icon: "static" },
  { value: 2, label: "Breathing", icon: "breathing" },
];

/** `teevolutionDpiLighting` flag — the DPI indicator LED (DpiLightingCard): effect,
    brightness (not while Off), speed (Breathing only) and, where the mouse has one,
    its own sleep timer. */
function DpiIndicatorLighting({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  const profile = snapshot.capabilities?.teevolutionProfile;
  const hint = status?.ui?.dpiLighting;
  if (!status || (!hint && !profile)) return null;
  const modes = hint?.modes ?? profile!.dpiLighting.modes;
  const brightnessMin = hint?.brightness.at(0) ?? profile!.dpiLighting.brightness.min;
  const brightnessMax = hint?.brightness.at(-1) ?? profile!.dpiLighting.brightness.max;
  const speedMin = hint?.speed.at(0) ?? profile!.dpiLighting.speed.min;
  const speedMax = hint?.speed.at(-1) ?? profile!.dpiLighting.speed.max;
  const locale = snapshot.preferences.locale;
  const lightMode = status.dpiLedMode ?? 0;
  const brightness = status.dpiLedBrightness;
  const speed = status.dpiLedSpeed;
  const sleepTimeouts = hint?.sleepTimeouts;
  return (
    <>
      <SectionHeader title="DPI indicator" description="Lights up in the color of the active DPI stage." />
      <Segmented container="card" iconSegments ariaLabel="DPI indicator effect" className="mk-lighting__effects"
        options={DPI_LIGHT_MODES.filter((m) => (modes as readonly number[]).includes(m.value))}
        value={lightMode as 0 | 1 | 2}
        onChange={(mode) => control.applyTeevolutionDpiLighting("mode", mode)} />
      <SettingGroup>
        <StagedSliderRow label="Brightness" icon="sun" min={brightnessMin} max={brightnessMax}
          position={brightness ?? brightnessMin} known={brightness != null}
          text={brightness == null ? "—" : String(brightness)} textAt={(v) => String(v)}
          disabled={lightMode === 0 || brightness == null}
          onStage={(v) => control.applyTeevolutionDpiLighting("brightness", v)} />
        <StagedSliderRow label="Speed" icon="bolt" min={speedMin} max={speedMax}
          position={speed ?? speedMin} known={speed != null}
          text={speed == null ? "—" : String(speed)} textAt={(v) => String(v)}
          disabled={lightMode !== 2 || speed == null}
          onStage={(v) => control.applyTeevolutionDpiLighting("speed", v)} />
        {sleepTimeouts?.length && status.dpiLedSleepTimeout != null ? (
          <SettingRow title="Auto sleep" description="How long the DPI light stays on when idle."
            control={
              <Dropdown ariaLabel="DPI indicator auto sleep" value={status.dpiLedSleepTimeout}
                options={sleepTimeouts.map((seconds) => ({ value: seconds, label: sleepLabel(seconds, locale) }))}
                onChange={(seconds) => control.applyDpiLightingSleepTimeout(seconds)} />
            } />
        ) : null}
      </SettingGroup>
      {lightMode === 1 && speed != null && (modes as readonly number[]).includes(2) ? <p className="mk-lighting__note mk-t-caption12">Speed applies to Breathing.</p> : null}
    </>
  );
}

/* ───────────────────────────── tab ───────────────────────────── */

export function LightingSection({ snapshot }: { snapshot: ControlSnapshot; onShareProfile?: () => void }): ReactNode {
  const status = snapshot.status;
  const has = cardAvailability(snapshot);
  const zones: readonly MouseLighting[] = status?.lightingZones?.length
    ? status.lightingZones
    : status?.lighting ? [status.lighting] : [];
  // LightingCard's initial pick: a lightstrip opens on its first LED, otherwise zone 0.
  const hasLightstrip = zones.some((zone) => zone.hardwareZoneId != null);
  const [selected, setSelected] = useState(hasLightstrip && zones.length > 1 ? 1 : 0);
  const active = Math.min(selected, Math.max(0, zones.length - 1));

  // The render glows in the colour of the zone being edited (the reference's lit mouse),
  // when its effect uses that colour.
  const shown = has.lighting ? zones[active] ?? status?.lighting : undefined;
  const glow = shown?.mode != null && shown.colorModes.includes(shown.mode) ? normalizeHex(shown.color ?? "") : null;

  return (
    <SplitLayout
      left={
        <div className={`mk-lighting__render${glow ? " has-glow" : ""}`}
          style={glow ? ({ "--mk-light-glow": glow } as CSSProperties) : undefined}>
          <MouseRender snapshot={snapshot} dots={false} />
        </div>
      }
      right={
        <div className="mk-lighting">
          {has.lighting ? <ZoneLighting snapshot={snapshot} zones={zones} active={active} onSelect={setSelected} /> : null}
          {has.teevolutionDpiLighting ? <DpiIndicatorLighting snapshot={snapshot} /> : null}
          {has.lightingAdvanced ? <ReceiverLighting snapshot={snapshot} /> : null}
        </div>
      }
    />
  );
}
