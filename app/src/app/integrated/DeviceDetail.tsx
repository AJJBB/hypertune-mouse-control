// v2.0 integrated device-detail view — the screen after "Open" on a device card.
// Header (back + section switcher + device name + status pills) over a per-section
// body. Matches Figma "App / Mouse WIP → Mouse - *", driven by the live controller.
import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronDown, ChevronRight, Crosshair, Activity, Battery, BatteryCharging, Minus, Waves, CircleDot, Palette, Power, Sparkles, Sun, Zap, Plus, Share2, Trash2, Pencil } from "lucide-react";
import {
  EGG_BUTTON_MAPPINGS,
  EGG_BUTTON_NAMES,
  type EggButtonIndex,
  type EggButtonMapping,
} from "@openmouse/protocol/drivers/endgame/egg-op1-hid";
import {
  RAZER_BUTTON_CONTROLS,
  RAZER_BUTTON_CONTROL_LABEL,
  RAZER_BUTTON_MAPPINGS,
  RAZER_LOCKED_BUTTON_CONTROL,
  type RazerButtonControl,
  type RazerButtonMapping,
} from "@openmouse/protocol/razer";
import * as control from "../../device/controller";
import { RATE_STEPS_HZ, PULSAR_SLEEP_OPTIONS } from "../../device/controller";
import { sleepLabel } from "../../device/options";
import {
  activeSoftwareProfileId,
  deleteSoftwareProfile,
  listSoftwareProfiles,
  markSoftwareProfileActive,
  renameSoftwareProfile,
  saveSoftwareProfile,
  type SoftwareProfile,
  type SoftwareProfileSettings,
} from "../../software-profiles";
import type { ControlSnapshot, LiftOffLevel, WorkspaceTab, PulsarToggleSetting } from "../../device/types";
import { deviceImage } from "../../ui/device-images";
import { computeResults, formatHz, rollingLiveHz, stabilityClass, type TestResults } from "../../ui/polling-stats";
import { MouseTestMouse } from "../MouseTestMouse";

function nearest(arr: readonly number[], v: number): number {
  return arr.reduce((best, n) => (Math.abs(n - v) < Math.abs(best - v) ? n : best), arr[0] ?? v);
}
function hslToHex(h: number): string {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = 0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
function hexToHue(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return 140;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 140;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round(((h * 60) + 360) % 360);
}

function isCharging(state: string | undefined): boolean {
  return state === "Charging" || state === "Charging slowly" || state === "Almost full";
}

/** Segmented selector — Figma: outer r9 #131516 (p5) › track r8 #0e1011 › options;
    selected r5 #1a4233 + #13f287 text. */
function Segmented({ options, value, onChange, equal = true }: {
  options: Array<{ value: string | number; label: string }>;
  value: string | number | null;
  onChange: (value: string | number) => void;
  equal?: boolean;
}): ReactNode {
  return (
    <div className="htv2-seg">
      <div className="htv2-seg-track">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            className={`htv2-seg-opt${o.value === value ? " is-on" : ""}${equal ? "" : " htv2-seg-grow"}`}
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }): ReactNode {
  return (
    <div className="htv2-toggle">
      <button type="button" className={`htv2-toggle-opt${!value ? " is-on" : ""}`} onClick={() => onChange(false)}>Off</button>
      <button type="button" className={`htv2-toggle-opt${value ? " is-on" : ""}`} onClick={() => onChange(true)}>On</button>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }): ReactNode {
  return (
    <section className="htv2-sec">
      <div className="htv2-sec-head">
        <h3 className="htv2-sec-title">{title}</h3>
        {desc ? <p className="htv2-sec-desc">{desc}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Processing toggle row — label/desc left, Off/On right (Figma "optimize" row). */
function ToggleRow({ title, desc, value, onChange }: { title: string; desc: string; value: boolean; onChange: (v: boolean) => void }): ReactNode {
  return (
    <div className="htv2-trow">
      <div className="htv2-trow-text">
        <span className="htv2-trow-title">{title}</span>
        <span className="htv2-trow-desc">{desc}</span>
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

function StatusPills({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const s = snapshot.status;
  if (!s) return null;
  const charging = isCharging(s.batteryState);
  return (
    <div className="htv2-pills">
      <span className="htv2-pill htv2-pill-connected"><span className="htv2-pill-dot" />Connected</span>
      {s.batteryPercent !== null ? (
        <span className="htv2-pill">
          {charging ? <BatteryCharging size={16} strokeWidth={1.8} /> : <Battery size={16} strokeWidth={1.8} />}
          {s.batteryPercent}%
        </span>
      ) : null}
      {s.dpi > 0 ? <span className="htv2-pill"><Crosshair size={14} strokeWidth={1.8} />{s.dpi.toLocaleString()} DPI</span> : null}
      {s.pollingRateHz ? <span className="htv2-pill"><Activity size={14} strokeWidth={1.8} />{s.pollingRateHz} Hz</span> : null}
    </div>
  );
}

const DPI_PRESETS = [400, 800, 1600, 3200, 6400, 12800];

/** Left column: mouse render + DPI stepper + quick presets (Figma DPI screen). */
function DpiPanel({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const s = snapshot.status!;
  const opts = snapshot.dpiOptions;
  const device = control.getActiveDevice();
  const sorted = [...opts].sort((a, b) => a - b);
  const presets = DPI_PRESETS.filter((p) => sorted.length === 0 || (p >= sorted[0]! && p <= sorted[sorted.length - 1]!));
  // The arrows jump between the round presets; the field below accepts any value
  // (snapped to the sensor's real grid by applyCustomDpi).
  const stepVals = presets.length > 0 ? presets : sorted;
  // `draft` holds the in-progress custom value while the DPI field is focused.
  const [draft, setDraft] = useState<string | null>(null);

  const stepTo = (dir: -1 | 1): void => {
    const next = dir === 1 ? stepVals.find((o) => o > s.dpi) : [...stepVals].reverse().find((o) => o < s.dpi);
    if (next != null) control.applyCustomDpi(next);
  };
  const commit = (): void => {
    if (draft === null) return;
    const n = Number(draft.replace(/[^0-9]/g, ""));
    if (n > 0) control.applyCustomDpi(n);
    setDraft(null);
  };
  const canDown = stepVals.some((o) => o < s.dpi);
  const canUp = stepVals.some((o) => o > s.dpi);
  const dpiText = draft !== null ? draft : (s.dpi > 0 ? s.dpi.toLocaleString() : "");
  return (
    <div className="htv2-dcol-left">
      <div className="htv2-mouse">
        <div className="htv2-mouse-glow" aria-hidden="true" />
        <img
          className="htv2-mouse-img"
          src={deviceImage(device, s.name)}
          alt=""
          draggable={false}
          onError={(e) => { e.currentTarget.src = "/v2/empty-mouse.png"; }}
        />
      </div>
      <div className="htv2-dpi">
        <button type="button" className="htv2-dpi-step" onClick={() => stepTo(-1)} disabled={!canDown} aria-label="Lower DPI">
          <ChevronLeft size={20} strokeWidth={2.4} />
        </button>
        <div className="htv2-dpi-mid">
          <span className="htv2-dpi-eyebrow"><Crosshair size={13} strokeWidth={1.8} /> DPI</span>
          <span className="htv2-dpi-value">
            <input
              className="htv2-dpi-input"
              type="text"
              inputMode="numeric"
              value={dpiText}
              style={{ width: `${Math.max(2, dpiText.length) + 0.6}ch` }}
              onFocus={(e) => { const el = e.currentTarget; setDraft(String(s.dpi)); requestAnimationFrame(() => el.select()); }}
              onChange={(e) => setDraft(e.currentTarget.value.replace(/[^0-9]/g, "").slice(0, 6))}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") { setDraft(null); e.currentTarget.blur(); }
              }}
              aria-label="Custom DPI"
            />
            <i>DPI</i>
          </span>
        </div>
        <button type="button" className="htv2-dpi-step" onClick={() => stepTo(1)} disabled={!canUp} aria-label="Raise DPI">
          <ChevronRight size={20} strokeWidth={2.4} />
        </button>
      </div>
      {presets.length > 0 ? (
        <div className="htv2-dpi-presets">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              className={`htv2-dpi-preset${s.dpi === p ? " is-on" : ""}`}
              onClick={() => control.applyCustomDpi(p)}
            >
              {p.toLocaleString()}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Performance section body (Figma "Mouse - DPI"). */
function PerformanceBody({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const s = snapshot.status!;
  const rates = (s.supportedPollingRates ?? RATE_STEPS_HZ).slice().sort((a, b) => a - b);
  const lods = s.supportedLiftOffDistances ?? [];
  const toggles = ([
    ["motionSync", "Motion sync", "Syncs sensor reports with polling", s.motionSync],
    ["angleSnapping", "Angle snapping", "Straightens small wobbles", s.angleSnapping],
    ["rippleControl", "Ripple control", "Smooths jitter at very high DPI", s.rippleControl],
  ] as const).filter(([, , , v]) => v !== undefined);
  return (
    <div className="htv2-dbody">
      <DpiPanel snapshot={snapshot} />
      <div className="htv2-dcol-right">
        <Section title="Polling rate" desc="Higher rates update the cursor more often but use more battery.">
          <Segmented options={rates.map((r) => ({ value: r, label: String(r) }))} value={s.pollingRateHz ?? null} onChange={(v) => control.applyPollingRate(Number(v))} />
        </Section>
        {lods.length > 0 ? (
          <Section title="Lift-off distance" desc="How high you can lift it before it stops tracking.">
            <Segmented options={lods.map((l) => ({ value: l, label: l }))} value={s.liftOffDistance ?? null} onChange={(v) => control.applyLiftOffDistance(v as LiftOffLevel)} equal={false} />
          </Section>
        ) : null}
        {toggles.length > 0 ? (
          <Section title="Processing">
            <div className="htv2-trows">
              {toggles.map(([key, title, desc, v]) => (
                <ToggleRow key={key} title={title} desc={desc} value={Boolean(v)} onChange={(nv) => control.applyPulsarToggle(key, nv)} />
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </div>
  );
}

function Slider({ min, max, value, onChange }: { min: number; max: number; value: number; onChange: (v: number) => void }): ReactNode {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range" min={min} max={max} value={value}
      className="htv2-slider"
      style={{ "--pct": `${pct}%` } as CSSProperties}
      onChange={(e) => onChange(Number(e.currentTarget.value))}
    />
  );
}

/** Mouse render panel (shared by Lighting / other sections). */
function MousePanel({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const s = snapshot.status!;
  const device = control.getActiveDevice();
  return (
    <div className="htv2-mouse htv2-mouse-tall">
      <div className="htv2-mouse-glow" aria-hidden="true" />
      <img className="htv2-mouse-img" src={deviceImage(device, s.name)} alt="" draggable={false}
        onError={(e) => { e.currentTarget.src = "/v2/empty-mouse.png"; }} />
    </div>
  );
}

function effectIcon(mode: string): typeof Minus {
  const m = mode.toLowerCase();
  if (m.includes("off")) return Power;
  if (m.includes("wave")) return Waves;
  if (m.includes("breath")) return CircleDot;
  if (m.includes("cycle") || m.includes("spectrum") || m.includes("rainbow")) return Palette;
  if (m.includes("static") || m.includes("solid") || m.includes("constant")) return Minus;
  return Sparkles;
}

const LIGHT_SWATCHES = ["#13f287", "#36c5f0", "#4f7cff", "#a855f7", "#f21382", "#ff5a4e", "#f5a524", "#ffffff"];

/** Lighting section (Figma "Mouse - Lighting"). */
function LightingBody({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const s = snapshot.status!;
  const zones = s.lightingZones?.length ? s.lightingZones : s.lighting ? [s.lighting] : [];
  const [zoneIdx, setZoneIdx] = useState(0);
  if (zones.length === 0) return <div className="htv2-section-ph">This device has no RGB lighting.</div>;
  const zi = Math.min(zoneIdx, zones.length - 1);
  const z = zones[zi];
  const mode = z.mode;
  const usesColor = mode != null && z.colorModes.includes(mode);
  const usesSpeed = mode != null && z.reactiveModes.includes(mode);
  const levels = z.brightnessLevels ?? [];
  const speeds = z.speeds ?? [];
  const apply = (patch: Parameters<typeof control.applyLighting>[0]) => control.applyLighting(patch, zi);
  const color = z.color ?? "#13f287";
  return (
    <div className="htv2-dbody">
      <div className="htv2-dcol-left"><MousePanel snapshot={snapshot} /></div>
      <div className="htv2-dcol-right">
        {zones.length > 1 ? (
          <Segmented options={zones.map((zn, i) => ({ value: i, label: zn.group ? `${zn.group} · ${zn.zone}` : zn.zone }))} value={zi} onChange={(v) => setZoneIdx(Number(v))} />
        ) : null}
        <Section title="Effects">
          <div className="htv2-fx">
            {z.modes.map((m) => {
              const Icon = effectIcon(m);
              return (
                <button key={m} type="button" className={`htv2-fx-btn${m === mode ? " is-on" : ""}`} onClick={() => apply({ mode: m })}>
                  <Icon size={20} strokeWidth={1.8} />
                  <span>{m}</span>
                </button>
              );
            })}
          </div>
        </Section>
        {(levels.length > 0 || (usesSpeed && speeds.length > 0) || usesColor) ? (
          <Section title="Color">
            {levels.length > 0 ? (
              <div className="htv2-lrow">
                <span className="htv2-lrow-label"><Sun size={16} strokeWidth={1.8} /> Brightness</span>
                <Slider min={levels[0]} max={levels[levels.length - 1]} value={z.brightness ?? levels[0]} onChange={(v) => apply({ brightness: nearest(levels, v) })} />
                <span className="htv2-lrow-val">{z.brightness ?? "—"}%</span>
              </div>
            ) : null}
            {usesSpeed && speeds.length > 0 ? (
              <div className="htv2-lrow">
                <span className="htv2-lrow-label"><Zap size={16} strokeWidth={1.8} /> Speed</span>
                <Slider min={speeds[0]} max={speeds[speeds.length - 1]} value={z.speed ?? speeds[0]} onChange={(v) => apply({ speed: nearest(speeds, v) })} />
                <span className="htv2-lrow-val">{z.speed ?? "—"}</span>
              </div>
            ) : null}
            {usesColor ? (
              <>
                <div className="htv2-lrow">
                  <span className="htv2-lrow-label"><Palette size={16} strokeWidth={1.8} /> Color</span>
                  <input type="range" min={0} max={360} value={hexToHue(color)} className="htv2-slider htv2-hue" onChange={(e) => apply({ color: hslToHex(Number(e.currentTarget.value)) })} />
                  <span className="htv2-lrow-val htv2-color-val"><i style={{ background: color }} />{color.toUpperCase()}</span>
                </div>
                <div className="htv2-swatches">
                  {LIGHT_SWATCHES.map((c) => (
                    <button key={c} type="button" className={`htv2-swatch${color.toLowerCase() === c ? " is-on" : ""}`} style={{ background: c }} onClick={() => apply({ color: c })} aria-label={c} />
                  ))}
                </div>
              </>
            ) : null}
          </Section>
        ) : null}
      </div>
    </div>
  );
}

// ── Buttons section (Figma "Mouse - Buttons") ─────────────────────────────
// A mouse render with callout cards joined by connector lines to each physical
// button, driven by the brand-agnostic remap model (status.buttonMappings +
// buttonOptions, applied with control.applyDeviceButtonMapping).
type BtnRow = { key: string; name: string; action: string; fixed: boolean; options: readonly string[]; apply: (v: string) => void };

function buttonRows(s: NonNullable<ControlSnapshot["status"]>): BtnRow[] {
  // Modern brand-agnostic model (what the Figma screen is drawn against).
  if (s.buttonMappings && s.buttonOptions?.length) {
    const fixed = new Set(s.fixedButtons ?? []);
    const options = s.buttonOptions;
    return Object.entries(s.buttonMappings).map(([name, action]) => ({
      key: `btn-${name}`,
      name,
      action,
      fixed: fixed.has(name),
      options,
      apply: (v: string) => control.applyDeviceButtonMapping(name, v),
    }));
  }
  // Endgame Gear — a mapping per physical button, indexed by EGG_BUTTON_NAMES.
  if (s.eggButtonMappings) {
    const maps = s.eggButtonMappings;
    return EGG_BUTTON_NAMES.map((name, i) => ({
      key: `egg-${i}`,
      name,
      action: maps[i] ?? "—",
      fixed: false,
      options: EGG_BUTTON_MAPPINGS,
      apply: (v: string) => control.applyEggButtonMapping(i as EggButtonIndex, v as EggButtonMapping),
    }));
  }
  // Razer — a control → mapping map; Left Click is fixed on the Standard layer.
  if (s.razerButtonMappings) {
    const maps = s.razerButtonMappings;
    return RAZER_BUTTON_CONTROLS.filter((con) => maps[con] != null).map((con) => ({
      key: `razer-${con}`,
      name: RAZER_BUTTON_CONTROL_LABEL[con],
      action: maps[con]!,
      fixed: con === RAZER_LOCKED_BUTTON_CONTROL,
      options: RAZER_BUTTON_MAPPINGS,
      apply: (v: string) => control.applyRazerButtonMapping(con as RazerButtonControl, v as RazerButtonMapping),
    }));
  }
  return [];
}

// Five callout slots around the mouse. x/y are the card's top-left and ax/ay the
// connector anchor on the mouse — all in the 1190×620 body panel's own
// coordinates, taken 1:1 from the Figma frame.
type BtnSlot = { side: "left" | "right"; x: number; y: number; ax: number; ay: number };
const BTN_SLOTS: BtnSlot[] = [
  { side: "left", x: 90, y: 67, ax: 520, ay: 198 },
  { side: "left", x: 90, y: 126, ax: 470, ay: 292 },
  { side: "left", x: 90, y: 187, ax: 497, ay: 360 },
  { side: "right", x: 931, y: 67, ax: 636, ay: 198 },
  { side: "right", x: 931, y: 247, ax: 576, ay: 330 },
];
const BTN_CARD_W = 160;
const BTN_CARD_H = 46;
const BTN_STAGE_W = 1190;
const BTN_STAGE_H = 620;

/** One remap callout — name over current action, with a pop-over action menu. */
function CalloutCard({ row, side, active, onToggle, onPick, style }: {
  row: BtnRow;
  side: "left" | "right";
  active: boolean;
  onToggle: () => void;
  onPick: (v: string) => void;
  style?: CSSProperties;
}): ReactNode {
  return (
    <div className={`htv2-btn-callout htv2-btn-${side}${active ? " is-active" : ""}`} style={style}>
      <button type="button" className="htv2-btn-card" disabled={row.fixed} onClick={onToggle}>
        <span className="htv2-btn-name">{row.name}</span>
        <span className="htv2-btn-action">{row.action}</span>
      </button>
      {active && !row.fixed ? (
        <>
          <div className="htv2-btn-scrim" onClick={onToggle} />
          <ul className={`htv2-btn-menu htv2-btn-menu-${side}`}>
            {row.options.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  className={`htv2-btn-opt${opt === row.action ? " is-on" : ""}`}
                  onClick={() => onPick(opt)}
                >
                  {opt}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function ButtonsBody({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const s = snapshot.status!;
  const rows = buttonRows(s);
  const [active, setActive] = useState<string | null>(null);
  if (rows.length === 0) {
    return <div className="htv2-section-ph">This mouse doesn’t report remappable buttons.</div>;
  }
  const placed = rows.slice(0, BTN_SLOTS.length).map((row, i) => ({ row, slot: BTN_SLOTS[i]! }));
  const overflow = rows.slice(BTN_SLOTS.length);
  const px = (v: number) => `${(v / BTN_STAGE_W) * 100}%`;
  const py = (v: number) => `${(v / BTN_STAGE_H) * 100}%`;
  const device = control.getActiveDevice();
  return (
    <div className="htv2-btns">
      <div className="htv2-btns-stage">
        <img
          className="htv2-btns-mouse"
          src={deviceImage(device, s.name)}
          alt=""
          draggable={false}
          style={{ left: px(430), top: py(62), width: px(277), height: py(467) }}
          onError={(e) => { e.currentTarget.src = "/v2/empty-mouse.png"; }}
        />
        <svg className="htv2-btns-lines" viewBox={`0 0 ${BTN_STAGE_W} ${BTN_STAGE_H}`} preserveAspectRatio="none" aria-hidden="true">
          {placed.map(({ row, slot }) => {
            const sx = slot.side === "left" ? slot.x + BTN_CARD_W : slot.x;
            const sy = slot.y + BTN_CARD_H / 2;
            const midx = slot.side === "left" ? sx + 55 : sx - 55;
            const on = active === row.key;
            return (
              <g key={row.key} className={`htv2-conn${on ? " is-on" : ""}`}>
                <polyline points={`${sx},${sy} ${midx},${sy} ${slot.ax},${slot.ay}`} vectorEffect="non-scaling-stroke" />
                <rect x={slot.ax - 3} y={slot.ay - 3} width="6" height="6" vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </svg>
        {placed.map(({ row, slot }) => (
          <CalloutCard
            key={row.key}
            row={row}
            side={slot.side}
            active={active === row.key}
            onToggle={() => setActive(active === row.key ? null : row.key)}
            onPick={(v) => { row.apply(v); setActive(null); }}
            style={{ left: px(slot.x), top: py(slot.y), width: px(BTN_CARD_W) }}
          />
        ))}
        {overflow.length > 0 ? (
          <div className="htv2-btn-extra">
            {overflow.map((row) => (
              <CalloutCard
                key={row.key}
                row={row}
                side="left"
                active={active === row.key}
                onToggle={() => setActive(active === row.key ? null : row.key)}
                onPick={(v) => { row.apply(v); setActive(null); }}
              />
            ))}
          </div>
        ) : null}
        {active ? (
          <div className="htv2-btns-recording"><span className="htv2-btns-rec-dot" />Recording</div>
        ) : null}
      </div>
    </div>
  );
}

// ── Advanced section (Figma "Mouse - Advanced") ───────────────────────────
// Left mouse render; right: a wireless-signal panel over a list of the device's
// power / timing / mode settings, each a toggle or a stepper. Rows appear only
// for settings the connected device actually reports.
const ADV_TOGGLES: Array<{ key: PulsarToggleSetting; title: string; desc: string }> = [
  { key: "performanceMode", title: "Performance mode", desc: "Holds the sensor at full power for the lowest latency." },
  { key: "hyperMode", title: "Hyper mode", desc: "Unlocks the device’s highest polling rates." },
  { key: "turboMode", title: "Turbo mode", desc: "Pushes sensor sampling to its fastest." },
  { key: "longRangeMode", title: "Long-range mode", desc: "Strengthens the wireless link at a distance." },
  { key: "buttonCombination", title: "Button combinations", desc: "Lets button combos trigger extra actions." },
];

const SIGNAL_WORDS = ["No signal", "Weak", "Fair", "Good", "Strong"];

function SignalBars({ level }: { level: number }): ReactNode {
  return (
    <span className="htv2-sig-bars" aria-hidden="true">
      {[1, 2, 3, 4].map((n) => (
        <i key={n} className={n <= level ? "is-on" : ""} style={{ height: `${n * 25}%` }} />
      ))}
    </span>
  );
}

/** Wireless-signal panel — current level + a rolling trace of recent readings.
    The device reports a 0–4 strength; steady signal reads as a flat line. */
function SignalPanel({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const raw = snapshot.status?.signalStrength;
  const level = Math.max(0, Math.min(4, Math.round(raw ?? 0)));
  const buf = useRef<number[]>([]);
  useEffect(() => {
    buf.current = [...buf.current, level].slice(-48);
  }, [level, snapshot.readStatus]);
  const word = SIGNAL_WORDS[level] ?? "—";
  const pts = buf.current.length >= 2 ? buf.current : [level, level];
  const W = 100, H = 100;
  const step = pts.length > 1 ? W / (pts.length - 1) : W;
  const line = pts.map((v, i) => `${(i * step).toFixed(2)},${(H - (v / 4) * (H - 10) - 5).toFixed(2)}`).join(" ");
  return (
    <div className="htv2-signal">
      <div className="htv2-signal-head">
        <div className="htv2-signal-meta">
          <span className="htv2-signal-eyebrow">Signal strength</span>
          <span className="htv2-signal-word">{word}</span>
        </div>
        <span className="htv2-signal-pill"><SignalBars level={level} />{word}</span>
      </div>
      <svg className="htv2-signal-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="htv2SigFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--v2-accent)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--v2-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${H} ${line} ${W},${H}`} fill="url(#htv2SigFill)" />
        <polyline points={line} fill="none" stroke="var(--v2-accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="htv2-signal-axis"><span>Earlier</span><span>Now</span></div>
    </div>
  );
}

function AdvStepperRow({ title, desc, label, onPrev, onNext, canPrev, canNext }: {
  title: string; desc: string; label: string;
  onPrev: () => void; onNext: () => void; canPrev: boolean; canNext: boolean;
}): ReactNode {
  return (
    <div className="htv2-trow">
      <div className="htv2-trow-text">
        <span className="htv2-trow-title">{title}</span>
        <span className="htv2-trow-desc">{desc}</span>
      </div>
      <div className="htv2-advstep">
        <button type="button" onClick={onPrev} disabled={!canPrev} aria-label={`Lower ${title}`}><ChevronLeft size={18} strokeWidth={2.2} /></button>
        <span className="htv2-advstep-val">{label}</span>
        <button type="button" onClick={onNext} disabled={!canNext} aria-label={`Raise ${title}`}><ChevronRight size={18} strokeWidth={2.2} /></button>
      </div>
    </div>
  );
}

function AdvancedBody({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const s = snapshot.status!;
  const { capabilities, traits } = snapshot;

  const sleepOpts: ReadonlyArray<readonly [number, string]> = (traits.directMode || capabilities?.sleepOptions)
    ? (capabilities?.sleepOptions ?? [10, 30, 60, 300, 600, 1800]).map((v) => [v, sleepLabel(v)] as const)
    : PULSAR_SLEEP_OPTIONS;
  const sleepIdx = s.sleepTimeout == null ? -1 : sleepOpts.findIndex(([v]) => v === s.sleepTimeout);

  const dbMax = capabilities?.debounceMaxMs ?? 20;
  const dbOpts = capabilities?.debounceOptions ?? Array.from({ length: dbMax + 1 }, (_, ms) => ms);
  const dbIdx = s.debounceMs == null ? -1 : dbOpts.indexOf(s.debounceMs);

  const toggles = ADV_TOGGLES.filter((row) => s[row.key] != null);
  const showWheelAccel = s.wheelAcceleration != null;
  const hasProcessing = sleepIdx >= 0 || dbIdx >= 0 || toggles.length > 0 || showWheelAccel;
  const hasAny = s.signalStrength != null || hasProcessing;

  return (
    <div className="htv2-dbody">
      <div className="htv2-dcol-left"><MousePanel snapshot={snapshot} /></div>
      <div className="htv2-dcol-right">
        {s.signalStrength != null ? <SignalPanel snapshot={snapshot} /> : null}
        {hasProcessing ? (
          <Section title="Processing">
            <div className="htv2-trows">
              {sleepIdx >= 0 ? (
                <AdvStepperRow
                  title="Auto sleep"
                  desc="Turns the mouse off when you stop using it."
                  label={sleepOpts[sleepIdx]![1]}
                  onPrev={() => { const n = sleepOpts[sleepIdx - 1]; if (n) control.applyPulsarValue("sleep", n[0]); }}
                  onNext={() => { const n = sleepOpts[sleepIdx + 1]; if (n) control.applyPulsarValue("sleep", n[0]); }}
                  canPrev={sleepIdx > 0}
                  canNext={sleepIdx < sleepOpts.length - 1}
                />
              ) : null}
              {dbIdx >= 0 ? (
                <AdvStepperRow
                  title="Debounce time"
                  desc="How long a click waits before it counts."
                  label={`${dbOpts[dbIdx]} ms`}
                  onPrev={() => { const n = dbOpts[dbIdx - 1]; if (n != null) control.applyPulsarValue("debounce", n); }}
                  onNext={() => { const n = dbOpts[dbIdx + 1]; if (n != null) control.applyPulsarValue("debounce", n); }}
                  canPrev={dbIdx > 0}
                  canNext={dbIdx < dbOpts.length - 1}
                />
              ) : null}
              {toggles.map((row) => (
                <ToggleRow
                  key={row.key}
                  title={row.title}
                  desc={row.desc}
                  value={Boolean(s[row.key])}
                  onChange={(v) => control.applyPulsarToggle(row.key, v)}
                />
              ))}
              {showWheelAccel ? (
                <ToggleRow
                  title="Wheel acceleration"
                  desc="Scrolls faster the quicker you spin the wheel."
                  value={Boolean(s.wheelAcceleration)}
                  onChange={(v) => control.applyProSetting("wheelAcceleration", v)}
                />
              ) : null}
            </div>
          </Section>
        ) : null}
        {!hasAny ? <div className="htv2-section-ph">This mouse has no advanced settings.</div> : null}
      </div>
    </div>
  );
}

// ── Profiles section (Figma "Mouse - Profiles") ───────────────────────────
// App-remembered presets (SoftwareProfiles): each card captures the current
// tuning and re-applies it when opened. This is the profile model that can
// actually populate per-card specs (onboard slots expose only the active one).
function captureSettings(s: NonNullable<ControlSnapshot["status"]>): SoftwareProfileSettings {
  const out: SoftwareProfileSettings = {};
  if (s.dpi > 0) out.dpi = s.dpi;
  if (s.pollingRateHz) out.pollingRateHz = s.pollingRateHz;
  if (s.liftOffDistance) out.liftOffDistance = s.liftOffDistance;
  if (s.brand === "Pulsar") {
    if (s.debounceMs != null) out.debounceMs = s.debounceMs;
    if (s.sleepTimeout != null) out.sleepTimeout = s.sleepTimeout;
    if (s.motionSync != null) out.motionSync = s.motionSync;
    if (s.angleSnapping != null) out.angleSnapping = s.angleSnapping;
    if (s.rippleControl != null) out.rippleControl = s.rippleControl;
    if (s.performanceMode != null) out.performanceMode = s.performanceMode;
  }
  return out;
}

function openProfile(settings: SoftwareProfileSettings, isPulsar: boolean): void {
  if (settings.dpi !== undefined) control.applyDpiValue(settings.dpi);
  if (settings.pollingRateHz !== undefined) control.applyPollingRate(settings.pollingRateHz);
  if (settings.liftOffDistance !== undefined) control.applyLiftOffDistance(settings.liftOffDistance);
  if (!isPulsar) return;
  if (settings.debounceMs !== undefined) control.applyPulsarValue("debounce", settings.debounceMs);
  if (settings.sleepTimeout !== undefined) control.applyPulsarValue("sleep", settings.sleepTimeout);
  if (settings.motionSync !== undefined) control.applyPulsarToggle("motionSync", settings.motionSync);
  if (settings.angleSnapping !== undefined) control.applyPulsarToggle("angleSnapping", settings.angleSnapping);
  if (settings.rippleControl !== undefined) control.applyPulsarToggle("rippleControl", settings.rippleControl);
  if (settings.performanceMode !== undefined) control.applyPulsarToggle("performanceMode", settings.performanceMode);
}

function ProfileCard({ profile, index, active, connection, isPulsar, onOpen, onRename, onDelete }: {
  profile: SoftwareProfile;
  index: number;
  active: boolean;
  connection: string;
  isPulsar: boolean;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}): ReactNode {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile.name);
  const se = profile.settings;
  const rows: Array<[string, string]> = [
    ["DPI", se.dpi != null ? se.dpi.toLocaleString() : "—"],
    ["Polling rate", se.pollingRateHz != null ? `${se.pollingRateHz} Hz` : "—"],
    ["Connection", connection || "—"],
  ];
  if (se.liftOffDistance != null) rows.push(["Lift-off", se.liftOffDistance]);
  if (isPulsar && se.motionSync != null) rows.push(["Motion sync", se.motionSync ? "On" : "Off"]);
  return (
    <article className={`htv2-prof-card${active ? " is-active" : ""}`}>
      <div className="htv2-prof-top">
        <span className="htv2-prof-num">#{index + 1}</span>
        {active ? <span className="htv2-prof-active"><span className="htv2-prof-active-dot" />Active</span> : null}
        <div className="htv2-prof-tools">
          <button type="button" aria-label="Rename profile" onClick={() => { setDraft(profile.name); setEditing(true); }}><Pencil size={14} strokeWidth={1.8} /></button>
          <button type="button" aria-label="Delete profile" onClick={onDelete}><Trash2 size={14} strokeWidth={1.8} /></button>
        </div>
      </div>
      {editing ? (
        <input
          className="htv2-prof-name-input"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={() => { const n = draft.trim(); if (n) onRename(n); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditing(false); }}
        />
      ) : (
        <h3 className="htv2-prof-name" onDblClick={() => { setDraft(profile.name); setEditing(true); }}>{profile.name}</h3>
      )}
      <dl className="htv2-prof-specs">
        {rows.map(([k, v]) => (
          <div key={k} className="htv2-prof-spec"><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      <button type="button" className="htv2-prof-open" onClick={onOpen} disabled={active}>{active ? "Current" : "Open"}</button>
    </article>
  );
}

function ProfilesBody({ snapshot, onShareProfile }: { snapshot: ControlSnapshot; onShareProfile?: () => void }): ReactNode {
  const s = snapshot.status!;
  const device = control.getActiveDevice();
  const [, bump] = useState(0);
  const refresh = () => bump((v) => v + 1);
  // onShareProfile is rendered in the shared header; referenced here so the prop
  // isn't flagged unused when a caller omits it.
  void onShareProfile;
  // A real connection has a device object; the dev fixture preview does not, so
  // fall back to a status-derived key there.
  const key = device ? control.deviceStorageKey(device) : `preview:${s.name}`;
  const profiles = listSoftwareProfiles(key);
  const activeId = activeSoftwareProfileId(key);
  const isPulsar = s.brand === "Pulsar";
  const connection = s.connectionType
    ? (s.connectionDetail ? `${s.connectionType} · ${s.connectionDetail}` : s.connectionType)
    : "";
  const addProfile = (): void => {
    saveSoftwareProfile(key, `Profile ${profiles.length + 1}`, captureSettings(s));
    refresh();
  };
  return (
    <div className="htv2-prof">
      <div className="htv2-prof-grid">
        {profiles.map((p, i) => (
          <ProfileCard
            key={p.id}
            profile={p}
            index={i}
            active={p.id === activeId}
            connection={connection}
            isPulsar={isPulsar}
            onOpen={() => { openProfile(p.settings, isPulsar); markSoftwareProfileActive(key, p.id); refresh(); }}
            onRename={(name) => { renameSoftwareProfile(key, p.id, name); refresh(); }}
            onDelete={() => { deleteSoftwareProfile(key, p.id); refresh(); }}
          />
        ))}
        <button type="button" className="htv2-prof-add" onClick={addProfile}>
          <span className="htv2-prof-add-plus" aria-hidden="true"><Plus size={26} strokeWidth={2.2} /></span>
          <span className="htv2-prof-add-title">Save current settings</span>
          <span className="htv2-prof-add-sub">Capture this mouse’s current DPI, polling and tuning as a profile you can switch back to.</span>
        </button>
      </div>
    </div>
  );
}

// ── Mouse Test section (Figma "Mouse - Mouse Test") ───────────────────────
// A live tester driven by browser input: polling-rate reading + waveform on top,
// per-button click counts + scroll + a mouse glyph that lights the pressed
// button below. Self-contained — it measures what the browser receives, so it
// needs no device client and works in the fixture preview too.
type TestCounts = { left: number; right: number; middle: number; back: number; forward: number };
const ZERO_COUNTS: TestCounts = { left: 0, right: 0, middle: 0, back: 0, forward: 0 };

function testButtonName(b: number): keyof TestCounts | null {
  return b === 0 ? "left" : b === 1 ? "middle" : b === 2 ? "right" : b === 3 ? "back" : b === 4 ? "forward" : null;
}

function TestStat({ label, value, feature = false }: { label: string; value: string; feature?: boolean }): ReactNode {
  return (
    <div className={`htv2-test-stat${feature ? " is-feature" : ""}`}>
      <span className="htv2-test-stat-label">{label}</span>
      <span className="htv2-test-stat-value">{value}</span>
    </div>
  );
}

type TestPhase = "idle" | "sampling" | "done";

function MouseTestBody(): ReactNode {
  const [phase, setPhase] = useState<TestPhase>("idle");
  const [duration, setDuration] = useState<5 | 8 | 10>(8);
  const [elapsed, setElapsed] = useState(0);
  const [liveHz, setLiveHz] = useState(0);
  const [results, setResults] = useState<TestResults | null>(null);
  const [chart, setChart] = useState<number[]>([]);
  const [counts, setCounts] = useState<TestCounts>(ZERO_COUNTS);
  const [scroll, setScroll] = useState<{ up: number; down: number }>({ up: 0, down: 0 });
  const [pressed, setPressed] = useState<keyof TestCounts | null>(null);
  const [wheelDir, setWheelDir] = useState<"up" | "down" | null>(null);

  const intervalsRef = useRef<number[]>([]);
  const lastTimeRef = useRef(0);
  const phaseRef = useRef<TestPhase>("idle");
  const startedRef = useRef(0);
  const timerRef = useRef(0);
  const wheelTimerRef = useRef(0);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Live input: button/wheel check (always on) + the polling sampler feeds the
  // interval buffer only while a timed run is sampling.
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      const n = testButtonName(e.button);
      if (!n) return;
      setCounts((c) => { const next = { ...c }; next[n] = c[n] + 1; return next; });
      setPressed(n);
    };
    const onUp = (): void => setPressed(null);
    const onWheel = (e: WheelEvent): void => {
      setScroll((s) => (e.deltaY < 0 ? { ...s, up: s.up + 1 } : { ...s, down: s.down + 1 }));
      setWheelDir(e.deltaY < 0 ? "up" : "down");
      window.clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = window.setTimeout(() => setWheelDir(null), 180);
    };
    const onMove = (e: PointerEvent): void => {
      if (phaseRef.current !== "sampling") return;
      const subs = typeof e.getCoalescedEvents === "function" && e.getCoalescedEvents().length > 0 ? e.getCoalescedEvents() : [e];
      for (const ev of subs) {
        const ts = ev.timeStamp;
        if (lastTimeRef.current > 0) {
          const d = ts - lastTimeRef.current;
          if (d >= 0.05 && d <= 1000) intervalsRef.current.push(d);
        }
        lastTimeRef.current = ts;
      }
      if (intervalsRef.current.length > 0) {
        setLiveHz(rollingLiveHz(intervalsRef.current));
        setChart(intervalsRef.current.slice(-180));
      }
    };
    const onCtx = (e: Event): void => e.preventDefault();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("contextmenu", onCtx);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("contextmenu", onCtx);
      window.clearTimeout(wheelTimerRef.current);
      window.clearInterval(timerRef.current);
    };
  }, []);

  const startTest = (): void => {
    intervalsRef.current = [];
    lastTimeRef.current = 0;
    setLiveHz(0);
    setResults(null);
    setChart([]);
    setElapsed(0);
    setPhase("sampling");
    startedRef.current = performance.now();
    timerRef.current = window.setInterval(() => {
      const el = performance.now() - startedRef.current;
      setElapsed(el / 1000);
      if (el >= duration * 1000) {
        window.clearInterval(timerRef.current);
        setResults(computeResults(intervalsRef.current, el));
        setPhase("done");
      }
    }, 50);
  };

  const reset = (): void => {
    window.clearInterval(timerRef.current);
    intervalsRef.current = [];
    lastTimeRef.current = 0;
    setPhase("idle");
    setLiveHz(0);
    setResults(null);
    setChart([]);
    setElapsed(0);
  };

  const W = 600, H = 160;
  const chartHz = chart.map((ms) => (ms > 0 ? 1000 / ms : 0));
  const chartMax = Math.max(1200, ...chartHz) * 1.08;
  const cstep = chartHz.length > 1 ? W / (chartHz.length - 1) : W;
  const cline = chartHz.map((h, i) => `${(i * cstep).toFixed(1)},${(H - Math.min(h / chartMax, 1) * (H - 26) - 13).toFixed(1)}`).join(" ");
  const ambient = Array.from({ length: 61 }, (_, i) => {
    const env = Math.sin((i / 60) * Math.PI);
    return `${i * 10},${(H / 2 - Math.sin(i * 0.5) * 20 * env).toFixed(1)}`;
  }).join(" ");
  const hasTrace = chartHz.length > 1;
  const resCards: Array<[string, string, string, string?]> = results ? [
    ["Average", formatHz(results.avgHz), "Hz"],
    ["Peak", formatHz(results.peakHz), "Hz"],
    ["Low 5%", formatHz(results.low5Hz), "Hz"],
    ["Stability", `${results.stability.toFixed(1)}%`, "", stabilityClass(results.stability)],
    ["Jitter", `${results.jitter.toFixed(1)}%`, ""],
    ["Dropouts", String(results.dropouts), ""],
    ["Events", results.events.toLocaleString(), ""],
    ["Avg interval", results.avgInterval.toFixed(2), "ms"],
  ] : [];

  return (
    <div className="htv2-test">
      <div className="htv2-test-rig">
        <span className="htv2-test-cable htv2-test-cable-l" aria-hidden="true"><i className="htv2-test-plug" /></span>
        <div className="htv2-test-wave">
          <span className="htv2-test-title">Mouse Polling Test</span>
          {phase === "sampling" ? (
            <span className="htv2-test-samples">{elapsed.toFixed(1)}s / {duration}s</span>
          ) : phase === "done" && results ? (
            <span className="htv2-test-samples">{results.events.toLocaleString()} samples</span>
          ) : null}
          <svg className="htv2-test-amb" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="htv2TestFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--v2-accent)" stopOpacity="0.26" />
                <stop offset="100%" stopColor="var(--v2-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {hasTrace ? (
              <>
                <polygon points={`0,${H} ${cline} ${W},${H}`} fill="url(#htv2TestFill)" />
                <polyline points={cline} fill="none" stroke="var(--v2-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </>
            ) : (
              <polyline points={ambient} fill="none" stroke="var(--v2-accent)" strokeWidth="2" strokeOpacity="0.45" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {phase === "idle" ? (
            <button type="button" className="htv2-test-start" onClick={startTest}>Start</button>
          ) : phase === "sampling" ? (
            <div className="htv2-test-reading"><b>{formatHz(liveHz)}</b><span>Hz</span></div>
          ) : results ? (
            <div className="htv2-test-reading htv2-test-avg"><b>{formatHz(results.avgHz)}</b><span>Average</span></div>
          ) : null}
          <span className="htv2-test-note">
            {phase === "sampling"
              ? "Keep the motion smooth and continuous while it samples."
              : phase === "done"
                ? "Move your mouse and run again to re-measure."
                : "Pick a duration, press “Start”, then move your mouse inside this box."}
          </span>
        </div>
        <span className="htv2-test-cable htv2-test-cable-r" aria-hidden="true"><i className="htv2-test-plug" /></span>
      </div>

      <div className="htv2-test-controls">
        {phase === "idle" ? (
          <div className="htv2-test-durs" role="group" aria-label="Test duration">
            {([5, 8, 10] as const).map((d) => (
              <button key={d} type="button" className={`htv2-test-dur${duration === d ? " is-on" : ""}`} onClick={() => setDuration(d)}>{d}s</button>
            ))}
          </div>
        ) : phase === "sampling" ? (
          <button type="button" className="htv2-test-run htv2-test-run-ghost" onClick={reset}>Cancel</button>
        ) : (
          <button type="button" className="htv2-test-run" onClick={reset}>Run again</button>
        )}
      </div>

      {results && results.events > 0 ? (
        <div className="htv2-test-results">
          {resCards.map(([label, value, unit, cls]) => (
            <div key={label} className="htv2-test-rescard">
              <span className="htv2-test-reslabel">{label}</span>
              <span className={`htv2-test-resvalue${cls ? ` ${cls}` : ""}`}>{value}{unit ? <i>{unit}</i> : null}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="htv2-test-row">
        <div className="htv2-test-group">
          <TestStat label="Left click" value={counts.left.toLocaleString()} feature />
          <div className="htv2-test-subs">
            <TestStat label="Right click" value={counts.right.toLocaleString()} />
            <TestStat label="Wheel click" value={counts.middle.toLocaleString()} />
          </div>
        </div>
        <div className="htv2-test-mouse-wrap">
          <MouseTestMouse
            buttons={{ left: pressed === "left", right: pressed === "right", middle: pressed === "middle", back: pressed === "back", forward: pressed === "forward" }}
            wheel={wheelDir}
          />
        </div>
        <div className="htv2-test-group">
          <TestStat label="Scroll" value={`↑ ${scroll.up}   ↓ ${scroll.down}`} feature />
          <div className="htv2-test-subs">
            <TestStat label="Back" value={counts.back.toLocaleString()} />
            <TestStat label="Forward" value={counts.forward.toLocaleString()} />
          </div>
        </div>
      </div>
      <p className="htv2-test-hint">Press any button or spin the wheel — it lights up on the diagram.</p>
    </div>
  );
}

const SECTIONS: Array<{ tab: WorkspaceTab; label: string }> = [
  { tab: "performance", label: "Performance" },
  { tab: "lighting", label: "Lighting" },
  { tab: "buttons", label: "Buttons" },
  { tab: "profiles", label: "Profiles" },
  { tab: "advanced", label: "Advanced" },
  { tab: "test", label: "Mouse Test" },
];

function SectionSwitcher({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const [open, setOpen] = useState(false);
  const active = snapshot.workspaceTab === "overview" ? "performance" : snapshot.workspaceTab;
  const current = SECTIONS.find((x) => x.tab === active) ?? SECTIONS[0];
  return (
    <div className="htv2-dsection-wrap">
      <button type="button" className="htv2-dsection" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{current.label}</span>
        <ChevronDown size={16} strokeWidth={2} />
      </button>
      {open ? (
        <>
          <div className="htv2-dsection-scrim" onClick={() => setOpen(false)} />
          <ul className="htv2-dsection-menu">
            {SECTIONS.map((sec) => (
              <li key={sec.tab}>
                <button
                  type="button"
                  className={`htv2-dsection-item${sec.tab === active ? " is-on" : ""}`}
                  onClick={() => { control.setWorkspaceTab(sec.tab); setOpen(false); }}
                >
                  {sec.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export function DeviceDetail({ snapshot, onShareProfile }: { snapshot: ControlSnapshot; onShareProfile?: () => void }): ReactNode {
  const s = snapshot.status;
  const brand = (s?.brand ?? "").toUpperCase();
  const model = s?.name ?? "Device";
  const section = snapshot.workspaceTab === "overview" ? "performance" : snapshot.workspaceTab;
  return (
    <div className="htv2-detail2">
      <header className="htv2-dhead">
        <div className="htv2-dhead-left">
          <button type="button" className="htv2-dback-btn" onClick={() => control.showDeviceList()} aria-label="Back to mice">
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          <SectionSwitcher snapshot={snapshot} />
          <div className="htv2-dname">
            {brand ? <span className="htv2-card-brand">{brand}</span> : null}
            <span className="htv2-dname-model">{model}</span>
          </div>
        </div>
        <div className="htv2-dhead-right">
          <StatusPills snapshot={snapshot} />
          {section === "profiles" && onShareProfile ? (
            <button type="button" className="htv2-dshare" onClick={onShareProfile}>
              <Share2 size={16} strokeWidth={1.8} />Share profile
            </button>
          ) : null}
        </div>
      </header>
      {!s ? null : section === "performance" ? (
        <PerformanceBody snapshot={snapshot} />
      ) : section === "lighting" ? (
        <LightingBody snapshot={snapshot} />
      ) : section === "buttons" ? (
        <ButtonsBody snapshot={snapshot} />
      ) : section === "advanced" ? (
        <AdvancedBody snapshot={snapshot} />
      ) : section === "profiles" ? (
        <ProfilesBody snapshot={snapshot} onShareProfile={onShareProfile} />
      ) : section === "test" ? (
        <MouseTestBody />
      ) : (
        <div className="htv2-section-ph">{SECTIONS.find((x) => x.tab === section)?.label} — coming next</div>
      )}
    </div>
  );
}
