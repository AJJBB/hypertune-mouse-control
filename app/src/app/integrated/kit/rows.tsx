// Mouse Component System — rows group.
// Setting row · Section header · Setting group · Color picker (Full / Compact) · Zone picker ·
// Zone swatch · Slider row · Collapsible section.
// Geometry/tokens mirror Ivan's Figma library 1:1 (see scratch-figma/specs/*.txt).
// Every component is presentational + controlled: props in, callbacks out.
import {
  useEffect, useId, useLayoutEffect, useRef, useState,
  type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./icons";
import { IconButton, StatusPill } from "./basics";
import { Slider } from "./controls";
import "./rows.css";

const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(" ");

/* ───────────────────────────── Setting row ───────────────────────────── */

export interface SettingRowProps {
  title: string;
  /** One plain line on what the setting does (Figma "Show description"). */
  description?: string;
  /** The control. "slot" (default) gives it the 290-wide control slot; pass the control's own
      `disabled` too when the row is disabled — the row fades once, the control isn't faded twice. */
  control: ReactNode;
  disabled?: boolean;
  id?: string;
  /** "slot" = 290 wide (Toggle, Segmented, Dropdown, Arrow stepper, Step picker, Time stepper,
      Number field, Text input). "hug" = the control's own width (Control=Value, Control=Button). */
  controlWidth?: "slot" | "hug";
  className?: string;
}

/** One setting per row: title + description on the left, the control on the right. 665 wide (fills). */
export function SettingRow({ title, description, control, disabled = false, id, controlWidth = "slot", className }: SettingRowProps): ReactNode {
  const uid = useId();
  const titleId = `${uid}-t`;
  const descId = `${uid}-d`;
  return (
    <div id={id} role="group" aria-labelledby={titleId} aria-describedby={description ? descId : undefined}
      aria-disabled={disabled || undefined}
      className={cx("mk-setting-row", disabled && "is-disabled", className)}>
      <div className="mk-setting-row__text">
        <span id={titleId} className="mk-setting-row__title mk-t-label14">{title}</span>
        {description ? <span id={descId} className="mk-setting-row__desc mk-t-body14">{description}</span> : null}
      </div>
      <div className={cx("mk-setting-row__control", controlWidth === "hug" && "is-hug")}>{control}</div>
    </div>
  );
}

/** Control=Value: a read-only value in a Setting row (use with controlWidth="hug"). */
export function SettingValue({ children }: { children: ReactNode }): ReactNode {
  return <span className="mk-setting-value mk-t-label14">{children}</span>;
}

/* ───────────────────────────── Section header + Setting group ───────────────────────────── */

export interface SectionHeaderProps {
  title: string;
  description?: string;
  /** Plain Status pill after the title (Figma "Show count"). */
  count?: number | string;
  /** Right-aligned action, usually a Large neutral Button (Figma "Show action"). */
  action?: ReactNode;
  /** Heading level of the title (default h3). */
  level?: 2 | 3 | 4;
  id?: string;
  className?: string;
}

/** Title above a group of rows. Padding 4/0/4/10. */
export function SectionHeader({ title, description, count, action, level = 3, id, className }: SectionHeaderProps): ReactNode {
  const H = `h${level}` as "h2" | "h3" | "h4";
  return (
    <div className={cx("mk-section-header", className)}>
      <div className="mk-section-header__text">
        <div className="mk-section-header__title-row">
          <H id={id} className="mk-section-header__title mk-t-title16">{title}</H>
          {count !== undefined && count !== null && count !== ""
            ? <StatusPill type="plain" label={String(count)} className="mk-section-header__count" />
            : null}
        </div>
        {description ? <p className="mk-section-header__desc mk-t-body14">{description}</p> : null}
      </div>
      {action ? <div className="mk-section-header__action">{action}</div> : null}
    </div>
  );
}

export interface SettingGroupProps {
  children: ReactNode;
  /** Gap 5 (remap, profiles, info rows) instead of 10 (settings). */
  dense?: boolean;
  className?: string;
  ariaLabel?: string;
}

/** Vertical stack of rows: gap 10, dense 5. */
export function SettingGroup({ children, dense = false, className, ariaLabel }: SettingGroupProps): ReactNode {
  return <div className={cx("mk-setting-group", dense && "is-dense", className)} aria-label={ariaLabel}>{children}</div>;
}

/* ───────────────────────────── Colour maths ───────────────────────────── */

type HSV = { h: number; s: number; v: number };

/** Ivan's spectrum stops (Slider Type=Hue / All zones) — colour data, not theme tokens. */
const SPECTRUM: [number, string][] = [
  [0, "#ff4d4d"], [0.14, "#ffb02e"], [0.28, "#f5f233"], [0.42, "#13f287"], [0.57, "#2ed8ff"],
  [0.68, "#4c7dff"], [0.76, "#9b6bff"], [0.9, "#ff4dd8"], [1, "#ff4d4d"],
];
const SPECTRUM_GRADIENT = `linear-gradient(90deg, ${SPECTRUM.map(([at, c]) => `${c} ${at * 100}%`).join(", ")})`;

/** The library's preset swatches (Color picker › Presets). */
export const COLOR_PRESETS: readonly string[] = ["#13f287", "#2ed8ff", "#4c7dff", "#9b6bff", "#ff4dd8", "#ff4d4d", "#ffb02e", "#f2f2f2"];

const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));

/** "#abc" / "abc" / "#aabbcc" → "#aabbcc" (lower case), or null. */
export function normalizeHex(input: string): string | null {
  const s = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(s)) return `#${s.split("").map((c) => c + c).join("")}`.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(s)) return `#${s}`.toLowerCase();
  return null;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex) ?? "#000000";
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
const rgbToHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((x) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, "0")).join("")}`;

function rgbToHsv(r: number, g: number, b: number): HSV {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}
function hsvToRgb({ h, s, v }: HSV): [number, number, number] {
  const c = v * s, hh = (((h % 360) + 360) % 360) / 60, x = c * (1 - Math.abs((hh % 2) - 1)), m = v - c;
  const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
const hsvToHex = (c: HSV): string => rgbToHex(...hsvToRgb(c));
const hexToHsv = (hex: string): HSV => rgbToHsv(...hexToRgb(hex));

/* The hue slider shows Ivan's spectrum, which is not a uniform hue wheel. Map true hue (0–360)
   to a position on it piecewise-linearly through each stop's own hue, so the thumb sits over
   the colour being edited. */
const STOP_HUES: number[] = SPECTRUM.map(([, c], i) => (i === SPECTRUM.length - 1 ? 360 : hexToHsv(c).h));
function hueToPos(h: number): number {
  const hue = clamp(h, 0, 360);
  for (let i = 0; i < SPECTRUM.length - 1; i++) {
    const h0 = STOP_HUES[i], h1 = STOP_HUES[i + 1];
    if (hue <= h1) return SPECTRUM[i][0] + (SPECTRUM[i + 1][0] - SPECTRUM[i][0]) * (h1 > h0 ? (hue - h0) / (h1 - h0) : 0);
  }
  return 1;
}
function posToHue(p: number): number {
  const t = clamp(p, 0, 1);
  for (let i = 0; i < SPECTRUM.length - 1; i++) {
    const p0 = SPECTRUM[i][0], p1 = SPECTRUM[i + 1][0];
    if (t <= p1) return STOP_HUES[i] + (STOP_HUES[i + 1] - STOP_HUES[i]) * ((t - p0) / (p1 - p0));
  }
  return 360;
}

/** Controlled HSV that follows `value` but keeps hue/saturation while they're undefined (grey/black). */
function useHsv(value: string, onChange: (hex: string) => void): [HSV, (next: HSV) => void] {
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value));
  useEffect(() => {
    const norm = normalizeHex(value);
    if (!norm || norm === hsvToHex(hsv)) return;
    const n = hexToHsv(norm);
    setHsv((cur) => ({ h: n.s === 0 || n.v === 0 ? cur.h : n.h, s: n.v === 0 ? cur.s : n.s, v: n.v }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const set = (next: HSV): void => {
    setHsv(next);
    const hex = hsvToHex(next);
    if (hex !== normalizeHex(value)) onChange(hex);
  };
  return [hsv, set];
}

/* ───────────────────────────── Color picker ───────────────────────────── */

export interface ColorPickerProps {
  /** "#rrggbb" */
  value: string;
  onChange: (hex: string) => void;
  ariaLabel: string;
  /** Full = saturation/value plane + hue + hex + presets (300 wide card, used as a popover);
      Compact = inline row (label · hue · hex, presets under it). */
  layout?: "compact" | "full";
  disabled?: boolean;
  /** Compact: the row label (default "Color"). */
  label?: string;
  /** Compact: the label icon (default palette). */
  icon?: IconName;
  presets?: readonly string[];
  className?: string;
}

/** Editable hex field: swatch dot + hex text. Commits on Enter / blur, Esc reverts. */
function HexField({ value, onCommit, ariaLabel, disabled }: { value: string; onCommit: (hex: string) => void; ariaLabel: string; disabled: boolean }): ReactNode {
  const shown = (normalizeHex(value) ?? value).toUpperCase();
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? shown;
  const bad = draft !== null && normalizeHex(draft) === null;
  const commit = (): void => {
    if (draft === null) return;
    const n = normalizeHex(draft);
    setDraft(null);
    if (n && n !== normalizeHex(value)) onCommit(n);
  };
  return (
    <label className={cx("mk-cp__hex", bad && "is-invalid")}>
      <span className="mk-cp__dot" style={{ background: normalizeHex(value) ?? undefined }} aria-hidden="true" />
      <span className="mk-cp__hex-box">
        <span className="mk-cp__hex-sizer mk-t-label14" aria-hidden="true">{text || " "}</span>
        <input className="mk-cp__hex-input mk-t-label14" value={text} disabled={disabled} spellcheck={false}
          maxLength={7} aria-label={`${ariaLabel} hex`} aria-invalid={bad || undefined}
          onChange={(e) => setDraft((e.target as HTMLInputElement).value.toUpperCase())}
          onFocus={(e) => (e.target as HTMLInputElement).select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            else if (e.key === "Escape" && draft !== null) { e.preventDefault(); e.stopPropagation(); setDraft(null); }
          }} />
      </span>
    </label>
  );
}

function Presets({ presets, value, onPick, disabled, ariaLabel }: { presets: readonly string[]; value: string; onPick: (hex: string) => void; disabled: boolean; ariaLabel: string }): ReactNode {
  const cur = normalizeHex(value);
  return (
    <div className="mk-cp__presets" role="group" aria-label={`${ariaLabel} presets`}>
      {presets.map((p) => {
        const hex = normalizeHex(p) ?? p;
        return (
          <button key={hex} type="button" className={cx("mk-cp__preset", hex === cur && "is-selected")}
            style={{ background: hex }} disabled={disabled} aria-label={hex.toUpperCase()} aria-pressed={hex === cur}
            title={hex.toUpperCase()} onClick={() => { if (hex !== cur) onPick(hex); }} />
        );
      })}
    </div>
  );
}

/** Saturation (x) / value (y) plane with a draggable handle. Arrow keys: 1%, Shift: 10%. */
function SvPlane({ hsv, onChange, ariaLabel, disabled }: { hsv: HSV; onChange: (c: HSV) => void; ariaLabel: string; disabled: boolean }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const from = (e: PointerEvent<HTMLDivElement>): void => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    onChange({ h: hsv.h, s: clamp((e.clientX - r.left) / r.width, 0, 1), v: clamp(1 - (e.clientY - r.top) / r.height, 0, 1) });
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    const d = e.shiftKey ? 0.1 : 0.01;
    let { s, v } = hsv;
    switch (e.key) {
      case "ArrowLeft": s -= d; break;
      case "ArrowRight": s += d; break;
      case "ArrowUp": v += d; break;
      case "ArrowDown": v -= d; break;
      case "Home": s = 0; break;
      case "End": s = 1; break;
      case "PageUp": v = 1; break;
      case "PageDown": v = 0; break;
      default: return;
    }
    e.preventDefault();
    onChange({ h: hsv.h, s: clamp(s, 0, 1), v: clamp(v, 0, 1) });
  };
  const pct = (x: number): number => Math.round(x * 100);
  return (
    <div ref={ref} className="mk-cp__plane" role="slider" tabIndex={disabled ? -1 : 0}
      aria-label={`${ariaLabel} saturation and brightness`} aria-disabled={disabled || undefined}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct(hsv.s)}
      aria-valuetext={`Saturation ${pct(hsv.s)}%, brightness ${pct(hsv.v)}%`}
      style={{ "--cp-hue": hsvToHex({ h: hsv.h, s: 1, v: 1 }), "--cp-x": hsv.s, "--cp-y": 1 - hsv.v } as CSSProperties}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.focus({ preventScroll: true });
        from(e);
      }}
      onPointerMove={(e) => { if (!disabled && e.currentTarget.hasPointerCapture(e.pointerId)) from(e); }}
      onKeyDown={disabled ? undefined : onKey}>
      <span className="mk-cp__handle" aria-hidden="true" />
    </div>
  );
}

/** Lighting colour (Compact inline row) and colour per DPI stage (Full, as a popover). */
export function ColorPicker({
  value, onChange, ariaLabel, layout = "compact", disabled = false, label = "Color", icon = "palette",
  presets = COLOR_PRESETS, className,
}: ColorPickerProps): ReactNode {
  const [hsv, setHsv] = useHsv(value, onChange);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(t);
  }, [copied]);

  const pos = Math.round(hueToPos(hsv.h) * 1000);
  const hue = (
    <Slider hue value={pos} min={0} max={1000} ariaLabel={`${ariaLabel} hue`} disabled={disabled}
      valueText={`Hue ${Math.round(hsv.h)}°`}
      onChange={(p) => setHsv({ ...hsv, h: posToHue(p / 1000), s: hsv.s === 0 && hsv.v > 0 ? 1 : hsv.s })} />
  );
  const pick = (hex: string): void => setHsv(hexToHsv(hex));
  const hex = <HexField value={value} onCommit={pick} ariaLabel={ariaLabel} disabled={disabled} />;
  const presetRow = <Presets presets={presets} value={value} onPick={pick} disabled={disabled} ariaLabel={ariaLabel} />;

  if (layout === "full") {
    return (
      <div role="group" aria-label={ariaLabel} aria-disabled={disabled || undefined}
        className={cx("mk-cp", "mk-cp--full", disabled && "is-disabled", className)}>
        <SvPlane hsv={hsv} onChange={setHsv} ariaLabel={ariaLabel} disabled={disabled} />
        {hue}
        <div className="mk-cp__hex-row">
          {hex}
          <IconButton icon={copied ? "check" : "copy"} label={copied ? "Copied" : `Copy ${ariaLabel} hex`}
            className="mk-cp__copy" disabled={disabled}
            onClick={() => {
              const h = (normalizeHex(value) ?? value).toUpperCase();
              void navigator.clipboard?.writeText(h).then(() => setCopied(true), () => undefined);
            }} />
        </div>
        {presetRow}
      </div>
    );
  }
  return (
    <div role="group" aria-label={ariaLabel} aria-disabled={disabled || undefined}
      className={cx("mk-cp", "mk-cp--compact", disabled && "is-disabled", className)}>
      <div className="mk-cp__main">
        <span className="mk-cp__label">
          <Icon name={icon} size={18} className="mk-cp__label-icon" />
          <span className="mk-t-label14">{label}</span>
        </span>
        {hue}
        {hex}
      </div>
      {presetRow}
    </div>
  );
}

export interface ColorPickerPopoverProps {
  open: boolean;
  /** Element the popover hangs under (e.g. the swatch that opened it). */
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  value: string;
  onChange: (hex: string) => void;
  ariaLabel: string;
  /** Horizontal alignment to the anchor (default "start"). */
  align?: "start" | "end";
}

/** The Full Color picker as a popover (portal, position: fixed, menu shadow). Closes on Esc and on a
    press outside the anchor and the popover; focus returns to the anchor on Esc. */
export function ColorPickerPopover({ open, anchorRef, onClose, value, onChange, ariaLabel, align = "start" }: ColorPickerPopoverProps): ReactNode {
  const popRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!open) { setRect(null); return; }
    const update = (): void => { if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect()); };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [open, anchorRef]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event): void => {
      const t = e.target as Node | null;
      if (t && (popRef.current?.contains(t) || anchorRef.current?.contains(t))) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, onClose, anchorRef]);
  useEffect(() => {
    if (open && rect) popRef.current?.querySelector<HTMLElement>(".mk-cp__plane")?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rect !== null]);
  if (!open || typeof document === "undefined") return null;

  const W = 300, H = 286, GAP = 6, M = 8;
  let style: CSSProperties = { visibility: "hidden" };
  if (rect) {
    const below = window.innerHeight - rect.bottom - GAP - M;
    const top = below >= H || rect.top - GAP - M < H ? rect.bottom + GAP : rect.top - GAP - H;
    const left = clamp(align === "end" ? rect.right - W : rect.left, M, Math.max(M, window.innerWidth - W - M));
    style = { top: Math.max(M, top), left };
  }
  return createPortal(
    <div className="mk mk-cp-layer">
      <div ref={popRef} className="mk-cp-pop" style={style} role="dialog" aria-label={ariaLabel}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); anchorRef.current?.focus(); }
        }}>
        <ColorPicker layout="full" value={value} onChange={onChange} ariaLabel={ariaLabel} />
      </div>
    </div>,
    document.body,
  );
}

/* ───────────────────────────── Zone swatch + Zone picker ───────────────────────────── */

export type ZoneSwatchState = "default" | "selected" | "off";

export interface ZoneSwatchProps {
  label: string;
  /** "#rrggbb" fill of the Color layer (ignored when Off or spectrum). */
  color: string;
  state?: ZoneSwatchState;
  /** Rainbow fill — the "All zones" swatch. */
  spectrum?: boolean;
  onClick?: () => void;
  className?: string;
}

function SwatchBody({ label, color, off, spectrum }: { label: string; color: string; off: boolean; spectrum: boolean }): ReactNode {
  return (
    <>
      <span className="mk-zone__ring">
        <span className={cx("mk-zone__color", off && "is-off")}
          style={off ? undefined : { background: spectrum ? SPECTRUM_GRADIENT : color }}>
          {off ? <Icon name="power" size={18} className="mk-zone__off-icon" /> : null}
        </span>
      </span>
      <span className="mk-zone__label mk-t-caption12">{label}</span>
    </>
  );
}

/** One lighting zone: 84 wide colour ring + label. Off shows a power glyph on bg/control. */
export function ZoneSwatch({ label, color, state = "default", spectrum = false, onClick, className }: ZoneSwatchProps): ReactNode {
  return (
    <button type="button" className={cx("mk-zone", state === "selected" && "is-selected", state === "off" && "is-off", className)}
      aria-pressed={state === "selected"} onClick={onClick}>
      <SwatchBody label={label} color={color} off={state === "off"} spectrum={spectrum} />
    </button>
  );
}

export type Zone = { id: string | number; label: string; color: string; off?: boolean; spectrum?: boolean };

export interface ZonePickerProps {
  zones: Zone[];
  value: string | number | null;
  onChange: (id: string | number) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

/** Lighting zones: a bg/card strip of Zone swatches (radiogroup, arrow keys move + select). */
export function ZonePicker({ zones, value, onChange, ariaLabel, disabled = false, className }: ZonePickerProps): ReactNode {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const n = zones.length;
  const sel = zones.findIndex((z) => z.id === value);
  const tabStop = sel >= 0 ? sel : 0;
  const move = (i: number): void => {
    refs.current[i]?.focus();
    if (i !== sel) onChange(zones[i].id);
  };
  return (
    <div role="radiogroup" aria-label={ariaLabel} aria-disabled={disabled || undefined}
      className={cx("mk-zone-picker", disabled && "is-disabled", className)}>
      {zones.map((z, i) => (
        <button key={String(z.id)} ref={(el) => { refs.current[i] = el; }} type="button" role="radio"
          aria-checked={i === sel} tabIndex={i === tabStop ? 0 : -1} disabled={disabled}
          aria-label={z.off ? `${z.label} (off)` : z.label}
          className={cx("mk-zone", i === sel && "is-selected", z.off && "is-off")}
          onClick={() => { if (i !== sel) onChange(z.id); }}
          onKeyDown={(e) => {
            let next = -1;
            if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % n;
            else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + n) % n;
            else if (e.key === "Home") next = 0;
            else if (e.key === "End") next = n - 1;
            if (next < 0) return;
            e.preventDefault();
            move(next);
          }}>
          <SwatchBody label={z.label} color={z.color} off={!!z.off} spectrum={!!z.spectrum} />
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────────── Slider row ───────────────────────────── */

export interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  /** Text in the value field ("70%"). Defaults to the number. */
  valueLabel?: string;
  /** Icon left of the label (Figma "Show icon"), e.g. "sun" for brightness. */
  icon?: IconName;
  disabled?: boolean;
  /** Accessible name of the slider (defaults to the label). */
  ariaLabel?: string;
  className?: string;
}

/** Lighting brightness / speed: label · slider · value field on bg/soft. */
export function SliderRow({ label, value, min, max, step = 1, onChange, onCommit, valueLabel, icon, disabled = false, ariaLabel, className }: SliderRowProps): ReactNode {
  const text = valueLabel ?? String(value);
  return (
    <div className={cx("mk-slider-row", disabled && "is-disabled", className)}>
      <span className="mk-slider-row__label">
        {icon ? <Icon name={icon} size={18} className="mk-slider-row__icon" /> : null}
        <span className="mk-t-label14">{label}</span>
      </span>
      <Slider value={value} min={min} max={max} step={step} onChange={onChange} onCommit={onCommit}
        ariaLabel={ariaLabel ?? label} valueText={text} disabled={disabled} />
      <output className="mk-slider-row__value mk-t-label14" aria-hidden="true">{text}</output>
    </div>
  );
}

/* ───────────────────────────── Collapsible section ───────────────────────────── */

export interface CollapsibleSectionProps {
  title: string;
  /** Right-aligned caption in the header ("All checks passed"). */
  summary?: string;
  /** Plain Status pill after the title. */
  count?: number | string;
  /** Uncontrolled initial state (default open — the library's first variant). */
  defaultOpen?: boolean;
  /** Controlled state. */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

/** Folds a long group: a bg/card header button (chevron · title · count · summary), then the content. */
export function CollapsibleSection({ title, summary, count, defaultOpen = true, open, onToggle, children, className }: CollapsibleSectionProps): ReactNode {
  const [openState, setOpenState] = useState(defaultOpen);
  const isOpen = open ?? openState;
  const uid = useId();
  const contentId = `${uid}-c`;
  const headId = `${uid}-h`;
  return (
    <div className={cx("mk-collapsible", isOpen ? "is-expanded" : "is-collapsed", className)}>
      <button id={headId} type="button" className="mk-collapsible__header" aria-expanded={isOpen} aria-controls={contentId}
        onClick={() => { const next = !isOpen; if (open === undefined) setOpenState(next); onToggle?.(next); }}>
        <Icon name={isOpen ? "chevron-down" : "chevron-right"} size={18} className="mk-collapsible__chevron" />
        <span className="mk-collapsible__title mk-t-title16">{title}</span>
        {count !== undefined && count !== null && count !== ""
          ? <StatusPill type="plain" label={String(count)} className="mk-collapsible__count" />
          : null}
        <span className="mk-collapsible__spacer" />
        {summary ? <span className="mk-collapsible__summary mk-t-caption12">{summary}</span> : null}
      </button>
      <div id={contentId} role="region" aria-labelledby={headId} className="mk-collapsible__content" hidden={!isOpen}>
        {children}
      </div>
    </div>
  );
}
