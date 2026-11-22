// Mouse Component System — controls group.
// Segment · Segmented · Segmented / Icon · Toggle · Dropdown · Menu item · Arrow stepper ·
// Slider · Snapping slider · Step picker · Step button · Time stepper · Number field · Text input.
// Geometry/tokens mirror Ivan's Figma library 1:1 (see scratch-figma/specs/*.txt).
// Every control is presentational + controlled: props in, callbacks out.
// Controls fill their container's width (Figma FILL) — the Setting-row slot makes them 290 wide.
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./icons";
import "./controls.css";

const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(" ");

/** Next enabled index from `from` in direction `dir` (wrapping), or -1. */
function stepIndex(from: number, dir: 1 | -1, n: number, ok: (i: number) => boolean, wrap = true): number {
  let i = from;
  for (let k = 0; k < n; k++) {
    i += dir;
    if (i < 0 || i >= n) { if (!wrap) return -1; i = (i + n) % n; }
    if (ok(i)) return i;
  }
  return -1;
}
const firstIndex = (n: number, ok: (i: number) => boolean): number => stepIndex(-1, 1, n, ok, false);
const lastIndex = (n: number, ok: (i: number) => boolean): number => stepIndex(n, -1, n, ok, false);

/** Radiogroup arrow-key handling (roving tabindex): returns the index to select, or null. */
function radioKey(e: KeyboardEvent<HTMLElement>, i: number, n: number, ok: (i: number) => boolean): number | null {
  let next = -1;
  switch (e.key) {
    case "ArrowRight": case "ArrowDown": next = stepIndex(i, 1, n, ok); break;
    case "ArrowLeft": case "ArrowUp": next = stepIndex(i, -1, n, ok); break;
    case "Home": next = firstIndex(n, ok); break;
    case "End": next = lastIndex(n, ok); break;
    default: return null;
  }
  e.preventDefault();
  return next >= 0 ? next : null;
}

const fmtNum = (v: number, grouping: boolean): string => (grouping ? v.toLocaleString("en-US") : String(v));

/* ───────────────────────────── Segment ───────────────────────────── */

export type SegmentState = "default" | "selected" | "neutral" | "disabled";
export type SegmentType = "text" | "icon";

export interface SegmentProps {
  label: string;
  icon?: IconName;
  /** Text (label only, 36 tall in a well) or Icon (icon over label, 60 tall). */
  type?: SegmentType;
  state?: SegmentState;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}

function SegmentBody({ label, icon, type }: { label: string; icon?: IconName; type: SegmentType }): ReactNode {
  return (
    <>
      {type === "icon" && icon ? (
        <span className="mk-seg__icon" data-icon={icon}><Icon name={icon} size={18} /></span>
      ) : null}
      <span className="mk-seg__label">{label}</span>
    </>
  );
}

const segClass = (type: SegmentType, state: SegmentState): string =>
  cx("mk-seg", type === "icon" && "mk-seg--icon", state === "selected" && "is-selected",
    state === "neutral" && "is-neutral", state === "disabled" && "is-disabled");

/** One option of a Segmented / Toggle, standalone (fills the box its parent gives it). */
export function Segment({ label, icon, type = "text", state = "default", onClick, className, style }: SegmentProps): ReactNode {
  return (
    <button type="button" className={cx(segClass(type, state), "mk-seg--solo", className)} style={style}
      disabled={state === "disabled"} aria-pressed={state === "selected"} onClick={onClick}>
      <SegmentBody label={label} icon={icon} type={type} />
    </button>
  );
}

/* ───────────────────────────── Segmented ───────────────────────────── */

export type SegOption<T> = { value: T; label: string; icon?: IconName; disabled?: boolean };

export interface SegmentedProps<T extends string | number> {
  options: SegOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  ariaLabel: string;
  /** Inline = the bare well (inside a Setting row); Card = 55-tall bg/card wrapper (stands alone). */
  container?: "inline" | "card";
  /** "Segmented / Icon": icon over label, 60-tall segments (lighting effects). */
  iconSegments?: boolean;
  disabled?: boolean;
  /** Inline only: 45-tall well (the library's standalone Inline variant). Default 40 = the 290×40 control slot. */
  tall?: boolean;
  className?: string;
}

export function Segmented<T extends string | number>({
  options, value, onChange, ariaLabel, container = "inline", iconSegments = false, disabled = false, tall = false, className,
}: SegmentedProps<T>): ReactNode {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const n = options.length;
  const ok = (i: number): boolean => !disabled && !options[i]?.disabled;
  const sel = options.findIndex((o) => o.value === value);
  const tabStop = sel >= 0 && ok(sel) ? sel : firstIndex(n, ok);
  const type: SegmentType = iconSegments ? "icon" : "text";
  const card = container === "card";

  const well = (
    <div role="radiogroup" aria-label={ariaLabel} aria-disabled={disabled || undefined}
      className={cx("mk-segmented", iconSegments ? "mk-segmented--icons" : (card || tall) && "mk-segmented--tall",
        !card && disabled && "is-disabled", !card && className)}>
      {options.map((o, i) => {
        const state: SegmentState = o.disabled ? "disabled" : i === sel ? "selected" : "default";
        return (
          <button key={String(o.value)} ref={(el) => { refs.current[i] = el; }} type="button" role="radio"
            aria-checked={i === sel} tabIndex={i === tabStop ? 0 : -1} disabled={disabled || o.disabled}
            className={segClass(type, state)} title={o.label}
            onClick={() => { if (i !== sel) onChange(o.value); }}
            onKeyDown={(e) => {
              const next = radioKey(e, i, n, ok);
              if (next === null) return;
              refs.current[next]?.focus();
              if (next !== sel) onChange(options[next].value);
            }}>
            <SegmentBody label={o.label} icon={o.icon} type={type} />
          </button>
        );
      })}
    </div>
  );
  if (!card) return well;
  return <div className={cx("mk-segcard", iconSegments && "mk-segcard--icons", disabled && "is-disabled", className)}>{well}</div>;
}

/* ───────────────────────────── Toggle ───────────────────────────── */

export interface ToggleProps {
  value: boolean | null;
  onChange: (v: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
  offLabel?: string;
  onLabel?: string;
}

/** Off | On two-segment control (290×40). Off shows the Off segment Neutral; On shows On Selected. */
export function Toggle({ value, onChange, ariaLabel, disabled = false, offLabel = "Off", onLabel = "On" }: ToggleProps): ReactNode {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const items: { v: boolean; label: string; state: SegmentState }[] = [
    { v: false, label: offLabel, state: value === false ? "neutral" : "default" },
    { v: true, label: onLabel, state: value === true ? "selected" : "default" },
  ];
  const tabStop = value === true ? 1 : 0;
  return (
    <div role="radiogroup" aria-label={ariaLabel} aria-disabled={disabled || undefined}
      className={cx("mk-segmented", "mk-toggle", disabled && "is-disabled")}>
      {items.map((it, i) => (
        <button key={it.label + i} ref={(el) => { refs.current[i] = el; }} type="button" role="radio"
          aria-checked={value === it.v} tabIndex={i === tabStop ? 0 : -1} disabled={disabled}
          className={segClass("text", it.state)}
          onClick={() => { if (value !== it.v) onChange(it.v); }}
          onKeyDown={(e) => {
            const next = radioKey(e, i, 2, () => !disabled);
            if (next === null) return;
            refs.current[next]?.focus();
            if (value !== items[next].v) onChange(items[next].v);
          }}>
          <span className="mk-seg__label">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────────── Menu item ───────────────────────────── */

export interface MenuItemProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  /** Hover / keyboard-highlight look (the library's Hover state). */
  active?: boolean;
  onSelect?: () => void;
  onHover?: () => void;
  id?: string;
}

/** A row of an open Dropdown menu (role="option"; place inside a role="listbox"). */
export function MenuItem({ label, selected = false, disabled = false, active = false, onSelect, onHover, id }: MenuItemProps): ReactNode {
  return (
    <div id={id} role="option" aria-selected={selected} aria-disabled={disabled || undefined}
      className={cx("mk-menu-item", selected && "is-selected", active && !disabled && "is-active", disabled && "is-disabled")}
      onPointerMove={onHover}
      onClick={() => { if (!disabled) onSelect?.(); }}>
      <span className="mk-menu-item__label">{label}</span>
      {selected ? <Icon name="check" size={18} className="mk-menu-item__check" /> : null}
    </div>
  );
}

/* ───────────────────────────── Dropdown ───────────────────────────── */

export type DropOption<T> = { value: T; label: string; disabled?: boolean };

export interface DropdownProps<T> {
  options: DropOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  placeholder?: string;
  /** Controlled open state (optional). Omit to let the Dropdown manage it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

const MENU_ROW = 36; // 34 item + 2 gap
const MENU_PAD = 10; // 4 padding + 1 stroke, top and bottom, minus the trailing gap
const MENU_MAX_ROWS = 8;

/** Closed: value + chevron box. Open: accent outline + a menu popover of Menu items, rendered in a
    portal (position: fixed) so scroll containers never clip it. Keyboard: ↑↓ Home End Enter Esc, type-ahead. */
export function Dropdown<T>({ options, value, onChange, ariaLabel, disabled = false, placeholder, open, onOpenChange, className }: DropdownProps<T>): ReactNode {
  const [openState, setOpenState] = useState(false);
  const isOpen = !disabled && (open ?? openState);
  const [active, setActive] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ s: "", t: 0 });
  const wantFocus = useRef(false);
  const uid = useId();
  const listId = `${uid}-list`;
  const optId = (i: number): string => `${uid}-opt-${i}`;
  const n = options.length;
  const ok = (i: number): boolean => !options[i]?.disabled;
  const sel = options.findIndex((o) => o.value === value);

  const setOpen = (o: boolean, focusButton = false): void => {
    if (open === undefined) setOpenState(o);
    onOpenChange?.(o);
    if (!o && focusButton) btnRef.current?.focus();
  };
  const openMenu = (start?: number): void => {
    setActive(start ?? (sel >= 0 && ok(sel) ? sel : firstIndex(n, ok)));
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    wantFocus.current = true;
    setOpen(true);
  };
  const choose = (i: number): void => {
    if (i < 0 || !ok(i)) return;
    if (i !== sel) onChange(options[i].value);
    setOpen(false, true);
  };

  // Position the popover under (or above) the field; follow scrolling/resizing while open.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const update = (): void => { if (btnRef.current) setRect(btnRef.current.getBoundingClientRect()); };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [isOpen]);

  // When the user opens it, move focus into the listbox (aria-activedescendant pattern). Waits for the
  // first measured position: a still-hidden popover can't take focus.
  const placed = rect !== null;
  useEffect(() => {
    if (!isOpen) { wantFocus.current = false; return; }
    if (active < 0) setActive(sel >= 0 && ok(sel) ? sel : firstIndex(n, ok));
    if (placed && wantFocus.current && listRef.current) {
      wantFocus.current = false;
      listRef.current.focus({ preventScroll: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, placed]);

  // Close on a pointer press outside the field and the menu.
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: Event): void => {
      const t = e.target as Node | null;
      if (t && (btnRef.current?.contains(t) || listRef.current?.contains(t))) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, open]);

  useEffect(() => {
    if (isOpen && active >= 0) document.getElementById(optId(active))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, active]);

  const typeAhead = (key: string): void => {
    const now = Date.now();
    const s = (now - typed.current.t < 700 ? typed.current.s : "") + key.toLowerCase();
    typed.current = { s, t: now };
    const from = s.length > 1 ? Math.max(active, 0) : active + 1;
    for (let k = 0; k < n; k++) {
      const i = (from + k) % n;
      if (ok(i) && options[i].label.toLowerCase().startsWith(s)) { setActive(i); return; }
    }
  };

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) openMenu(e.key === "ArrowUp" && sel < 0 ? lastIndex(n, ok) : undefined);
    }
  };
  const onListKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    const k = e.key;
    if (k === "ArrowDown" || k === "ArrowUp") {
      e.preventDefault();
      const next = stepIndex(active < 0 ? (k === "ArrowDown" ? -1 : n) : active, k === "ArrowDown" ? 1 : -1, n, ok, false);
      if (next >= 0) setActive(next);
    } else if (k === "Home" || k === "End") {
      e.preventDefault(); setActive(k === "Home" ? firstIndex(n, ok) : lastIndex(n, ok));
    } else if (k === "Enter" || k === " ") {
      e.preventDefault(); choose(active);
    } else if (k === "Escape") {
      e.preventDefault(); e.stopPropagation(); setOpen(false, true);
    } else if (k === "Tab") {
      e.preventDefault(); setOpen(false, true);
    } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      typeAhead(k);
    }
  };

  // Popover placement: below by default, flipped above when there is clearly more room there.
  let menuStyle: CSSProperties = { visibility: "hidden" };
  if (rect) {
    const want = Math.min(n, MENU_MAX_ROWS) * MENU_ROW + MENU_PAD - 2;
    const below = window.innerHeight - rect.bottom - 4 - 8;
    const above = rect.top - 4 - 8;
    const up = below < Math.min(want, 160) && above > below;
    const maxHeight = Math.max(80, Math.min(want, up ? above : below));
    menuStyle = up
      ? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 4, maxHeight }
      : { left: rect.left, width: rect.width, top: rect.bottom + 4, maxHeight };
  }

  const current = sel >= 0 ? options[sel].label : null;
  return (
    <>
      <button ref={btnRef} type="button" disabled={disabled}
        className={cx("mk-dropdown", isOpen && "is-open", disabled && "is-disabled", className)}
        aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={isOpen} aria-controls={isOpen ? listId : undefined}
        onClick={() => (isOpen ? setOpen(false) : openMenu())} onKeyDown={onButtonKey}>
        <span className={cx("mk-dropdown__value", current === null && "is-placeholder")}>{current ?? placeholder ?? ""}</span>
        <span className="mk-dropdown__chevron"><Icon name={isOpen ? "chevron-up" : "chevron-down"} size={18} /></span>
      </button>
      {isOpen && typeof document !== "undefined"
        ? createPortal(
          <div className="mk mk-dropdown-layer">
            <div ref={listRef} id={listId} role="listbox" tabIndex={-1} aria-label={ariaLabel}
              aria-activedescendant={active >= 0 ? optId(active) : undefined}
              className="mk-menu" style={menuStyle} onKeyDown={onListKey}
              onBlur={(e) => {
                const to = e.relatedTarget as Node | null;
                if (to && !listRef.current?.contains(to) && !btnRef.current?.contains(to)) setOpen(false);
              }}>
              {options.map((o, i) => (
                <MenuItem key={optId(i)} id={optId(i)} label={o.label} selected={i === sel} disabled={o.disabled}
                  active={i === active} onHover={() => { if (i !== active && ok(i)) setActive(i); }} onSelect={() => choose(i)} />
              ))}
            </div>
          </div>,
          document.body)
        : null}
    </>
  );
}

/* ───────────────────────────── Arrow stepper ───────────────────────────── */

export interface ArrowStepperProps<T> {
  options: DropOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  ariaLabel: string;
  disabled?: boolean;
}

/** ◀ value ▶ over 2–5 ordered values. At the first/last value that arrow dims (At min / At max). */
export function ArrowStepper<T>({ options, value, onChange, ariaLabel, disabled = false }: ArrowStepperProps<T>): ReactNode {
  const n = options.length;
  const ok = (i: number): boolean => !options[i]?.disabled;
  const sel = options.findIndex((o) => o.value === value);
  const prev = sel < 0 ? -1 : stepIndex(sel, -1, n, ok, false);
  const next = sel < 0 ? firstIndex(n, ok) : stepIndex(sel, 1, n, ok, false);
  const go = (i: number): void => { if (!disabled && i >= 0) onChange(options[i].value); };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); go(prev); }
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); go(next); }
  };
  return (
    <div role="group" aria-label={ariaLabel} className={cx("mk-arrows", disabled && "is-disabled")}>
      <button type="button" className={cx("mk-arrows__btn", !disabled && prev < 0 && "is-edge")}
        aria-label={`Previous ${ariaLabel}`} disabled={disabled} aria-disabled={(!disabled && prev < 0) || undefined}
        onClick={() => go(prev)} onKeyDown={onKey}>
        <Icon name="tri-left" size={18} />
      </button>
      <div className="mk-arrows__value" aria-live="polite">{sel >= 0 ? options[sel].label : "–"}</div>
      <button type="button" className={cx("mk-arrows__btn", !disabled && next < 0 && "is-edge")}
        aria-label={`Next ${ariaLabel}`} disabled={disabled} aria-disabled={(!disabled && next < 0) || undefined}
        onClick={() => go(next)} onKeyDown={onKey}>
        <Icon name="tri-right" size={18} />
      </button>
    </div>
  );
}

/* ───────────────────────────── Slider ───────────────────────────── */

/** Ivan's hue spectrum (Slider Type=Hue) — colour data, not theme tokens. */
const HUE_STOPS: [number, string][] = [
  [0, "#ff4d4d"], [0.14, "#ffb02e"], [0.28, "#f5f233"], [0.42, "#13f287"], [0.57, "#2ed8ff"],
  [0.68, "#4c7dff"], [0.76, "#9b6bff"], [0.9, "#ff4dd8"], [1, "#ff4d4d"],
];
const HUE_GRADIENT = `linear-gradient(90deg, ${HUE_STOPS.map(([at, c]) => `${c} ${at * 100}%`).join(", ")})`;

/** Colour of Ivan's hue spectrum at fraction p (0–1) — the colour under the thumb. */
export function hueSpectrumColor(p: number): string {
  const t = Math.max(0, Math.min(1, p));
  let i = 0;
  while (i < HUE_STOPS.length - 2 && t > HUE_STOPS[i + 1][0]) i++;
  const [p0, a] = HUE_STOPS[i], [p1, b] = HUE_STOPS[i + 1];
  const f = p1 > p0 ? (t - p0) / (p1 - p0) : 0;
  const ch = (h: string, k: number): number => parseInt(h.slice(1 + k * 2, 3 + k * 2), 16);
  const mix = (k: number): string => Math.round(ch(a, k) + (ch(b, k) - ch(a, k)) * f).toString(16).padStart(2, "0");
  return `#${mix(0)}${mix(1)}${mix(2)}`;
}

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** Fires once when a drag / key press ends (use it to write to the device). */
  onCommit?: (v: number) => void;
  ariaLabel: string;
  /** Type=Hue: spectrum track, the thumb takes the colour under it. */
  hue?: boolean;
  disabled?: boolean;
  /** Library "Show stops": evenly spaced stop dots under the track (Default type only). */
  showStops?: boolean;
  /** How many stop dots (default 5 = 0/25/50/75/100). */
  stopCount?: number;
  /** Hue type: override the thumb colour (e.g. the exact colour being edited). */
  thumbColor?: string;
  /** aria-valuetext, e.g. "1000 Hz". */
  valueText?: string;
  className?: string;
}

/** Track-only slider (stretches to its container). A transparent native range input on top gives
    pointer + keyboard + screen-reader behaviour; the visible parts are drawn to the Figma geometry. */
export function Slider({
  value, min, max, step = 1, onChange, onCommit, ariaLabel, hue = false, disabled = false,
  showStops = false, stopCount = 5, thumbColor, valueText, className,
}: SliderProps): ReactNode {
  const span = max - min;
  const p = span > 0 ? Math.max(0, Math.min(1, (value - min) / span)) : 0;
  const dirty = useRef(false);
  const commit = (el: HTMLInputElement): void => {
    if (!dirty.current) return;
    dirty.current = false;
    onCommit?.(Number(el.value));
  };
  const stops = !hue && showStops && stopCount > 1 ? Array.from({ length: stopCount }, (_, i) => i / (stopCount - 1)) : [];
  return (
    <div className={cx("mk-slider", hue && "mk-slider--hue", disabled && "is-disabled", className)}
      style={{ "--p": p } as CSSProperties}>
      <div className="mk-slider__track" />
      {hue
        ? <div className="mk-slider__spectrum" style={{ background: HUE_GRADIENT }} />
        : <div className="mk-slider__fill" />}
      {stops.length ? (
        <div className="mk-slider__stops" aria-hidden="true">
          {stops.map((f) => <span key={f} className="mk-slider__stop" style={{ left: `calc(${f * 100}% - 2px)` }} />)}
        </div>
      ) : null}
      <input type="range" className="mk-slider__input" min={min} max={max} step={step} value={value}
        disabled={disabled} aria-label={ariaLabel} aria-valuetext={valueText}
        onChange={(e) => { dirty.current = true; onChange(Number((e.target as HTMLInputElement).value)); }}
        onPointerUp={(e) => commit(e.currentTarget)} onKeyUp={(e) => commit(e.currentTarget)}
        onBlur={(e) => commit(e.currentTarget)} />
      <div className="mk-slider__travel" aria-hidden="true">
        <div className="mk-slider__mover">
          <div className="mk-slider__thumb">
            <div className="mk-slider__grip" style={hue ? { background: thumbColor ?? hueSpectrumColor(p) } : undefined}>
              <span className="mk-slider__line" /><span className="mk-slider__line" /><span className="mk-slider__line" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Snapping slider ───────────────────────────── */

export interface SnappingSliderProps {
  stops: { value: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
  ariaLabel: string;
  /** Text in the value field (default: the current stop's label), e.g. "1000 Hz". */
  valueLabel?: string;
  showStopLabels?: boolean;
  disabled?: boolean;
  onCommit?: (v: number) => void;
}

/** Slider that snaps to fixed stops (evenly spaced), a 96×29 value field, and stop labels under it. */
export function SnappingSlider({ stops, value, onChange, ariaLabel, valueLabel, showStopLabels = true, disabled = false, onCommit }: SnappingSliderProps): ReactNode {
  let idx = stops.findIndex((s) => s.value === value);
  if (idx < 0 && stops.length) {
    idx = stops.reduce((best, s, i) => (Math.abs(s.value - value) < Math.abs(stops[best].value - value) ? i : best), 0);
  }
  const label = valueLabel ?? stops[idx]?.label ?? "";
  return (
    <div className={cx("mk-snap", disabled && "is-disabled")}>
      <div className="mk-snap__main">
        <Slider value={Math.max(0, idx)} min={0} max={Math.max(1, stops.length - 1)} step={1} ariaLabel={ariaLabel}
          valueText={label} showStops stopCount={stops.length} disabled={disabled}
          onChange={(i) => { const s = stops[i]; if (s && s.value !== value) onChange(s.value); }}
          onCommit={onCommit ? (i) => { const s = stops[i]; if (s) onCommit(s.value); } : undefined} />
        <div className="mk-snap__value">{label}</div>
      </div>
      {showStopLabels ? (
        <div className="mk-snap__labels" aria-hidden="true">
          {stops.map((s) => <span key={s.value} className="mk-snap__label">{s.label}</span>)}
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────────── Step picker / Step button ───────────────────────────── */

export interface StepButtonProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

/** A single 36×36 numbered step (part of Step picker). */
export function StepButton({ label, selected = false, disabled = false, onClick }: StepButtonProps): ReactNode {
  return (
    <button type="button" className={cx("mk-step", "mk-step--solo", selected && "is-selected")}
      disabled={disabled} aria-pressed={selected} onClick={onClick}>{label}</button>
  );
}

export interface StepPickerProps {
  count: number;
  value: number | null;
  onChange: (v: number) => void;
  ariaLabel: string;
  /** Value of the first step (default 1). Step i has value start + i. */
  start?: number;
  labels?: string[];
  disabled?: boolean;
}

/** Numbered steps (5 or 10) filling the width, gap 4. Single select. */
export function StepPicker({ count, value, onChange, ariaLabel, start = 1, labels, disabled = false }: StepPickerProps): ReactNode {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const sel = value === null ? -1 : value - start;
  const ok = (): boolean => !disabled;
  const tabStop = sel >= 0 && sel < count ? sel : 0;
  return (
    <div role="radiogroup" aria-label={ariaLabel} aria-disabled={disabled || undefined}
      className={cx("mk-steps", disabled && "is-disabled")}>
      {Array.from({ length: count }, (_, i) => (
        <button key={i} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={i === sel}
          tabIndex={i === tabStop ? 0 : -1} disabled={disabled} className={cx("mk-step", i === sel && "is-selected")}
          onClick={() => { if (i !== sel) onChange(start + i); }}
          onKeyDown={(e) => {
            const next = radioKey(e, i, count, ok);
            if (next === null) return;
            refs.current[next]?.focus();
            if (next !== sel) onChange(start + next);
          }}>
          {labels?.[i] ?? String(start + i)}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────────── Time stepper ───────────────────────────── */

type TimePart = "hours" | "minutes" | "seconds";

export interface TimeStepperProps {
  /** Total seconds. */
  seconds: number;
  onChange: (seconds: number) => void;
  ariaLabel: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Gallery/mockup only: draw one part in the Focused state without focusing it. */
  forceFocus?: TimePart;
}

const TIME_PARTS: { part: TimePart; unit: string; size: number; label: string; partMax: number }[] = [
  { part: "hours", unit: "h", size: 3600, label: "Hours", partMax: 99 },
  { part: "minutes", unit: "m", size: 60, label: "Minutes", partMax: 59 },
  { part: "seconds", unit: "s", size: 1, label: "Seconds", partMax: 59 },
];

/** H : M : S, each part a spinbutton (↑↓ / PageUp PageDown / type digits) with small up/down arrows. */
export function TimeStepper({ seconds, onChange, ariaLabel, min = 0, max = 99 * 3600 + 59 * 60 + 59, disabled = false, forceFocus }: TimeStepperProps): ReactNode {
  const total = Math.max(0, Math.floor(seconds));
  const parts: Record<TimePart, number> = {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
  const typed = useRef<{ part: TimePart | null; s: string; t: number }>({ part: null, s: "", t: 0 });
  const refs = useRef<Partial<Record<TimePart, HTMLDivElement | null>>>({});
  const clamp = (v: number): number => Math.max(min, Math.min(max, v));
  const set = (v: number): void => { const c = clamp(v); if (c !== total) onChange(c); };
  const bump = (size: number, dir: 1 | -1): void => { if (!disabled) set(total + dir * size); };

  const onKey = (p: (typeof TIME_PARTS)[number]) => (e: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled) return;
    const k = e.key;
    if (k === "ArrowUp" || k === "ArrowDown") { e.preventDefault(); bump(p.size, k === "ArrowUp" ? 1 : -1); }
    else if (k === "PageUp" || k === "PageDown") { e.preventDefault(); bump(p.size * 10, k === "PageUp" ? 1 : -1); }
    else if (k === "Home") { e.preventDefault(); set(total - parts[p.part] * p.size); }
    else if (k === "End") { e.preventDefault(); set(total + (p.partMax - parts[p.part]) * p.size); }
    else if (/^\d$/.test(k)) {
      e.preventDefault();
      const now = Date.now();
      const t = typed.current;
      const s = (t.part === p.part && now - t.t < 1200 && t.s.length < 2 ? t.s : "") + k;
      typed.current = { part: p.part, s, t: now };
      const v = Math.min(p.partMax, parseInt(s, 10));
      set(total + (v - parts[p.part]) * p.size);
    }
  };

  return (
    <div role="group" aria-label={ariaLabel} className={cx("mk-time", disabled && "is-disabled")}>
      {TIME_PARTS.map((p) => (
        <div key={p.part} ref={(el) => { refs.current[p.part] = el; }}
          className={cx("mk-time__part", forceFocus === p.part && "is-focused")}
          role="spinbutton" tabIndex={disabled ? -1 : 0} aria-label={p.label} aria-disabled={disabled || undefined}
          aria-valuenow={parts[p.part]} aria-valuemin={0} aria-valuemax={p.partMax}
          aria-valuetext={`${parts[p.part]} ${p.label.toLowerCase()}`} onKeyDown={onKey(p)}>
          <span className="mk-time__value">{String(parts[p.part]).padStart(2, "0")}</span>
          <span className="mk-time__unit">{p.unit}</span>
          <span className="mk-time__arrows" aria-hidden="true">
            {([1, -1] as const).map((dir) => (
              <button key={dir} type="button" tabIndex={-1} disabled={disabled} className="mk-time__arrow"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => { refs.current[p.part]?.focus(); bump(p.size, dir); }}>
                <Icon name={dir === 1 ? "chevron-up" : "chevron-down"} size={11} />
              </button>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────────── Number field ───────────────────────────── */

type NumState = "focused" | "changed" | "error";

const parseNum = (s: string): number => {
  const t = s.replace(/[,\s_]/g, "");
  return t === "" || !/^-?\d*\.?\d*$/.test(t) ? NaN : Number(t);
};
const rangeText = (min: number | undefined, max: number | undefined, grouping: boolean): string =>
  min !== undefined && max !== undefined ? `Enter ${fmtNum(min, grouping)} to ${fmtNum(max, grouping)}`
    : min !== undefined ? `Enter ${fmtNum(min, grouping)} or more`
      : max !== undefined ? `Enter up to ${fmtNum(max, grouping)}` : "Enter a number";
const inRange = (v: number, min?: number, max?: number): boolean =>
  Number.isFinite(v) && (min === undefined || v >= min) && (max === undefined || v <= max);
const snapStep = (v: number, step: number | undefined, min?: number, max?: number): number => {
  if (!step || step <= 0) return v;
  const base = min ?? 0;
  let s = base + Math.round((v - base) / step) * step;
  if (max !== undefined && s > max) s -= step;
  if (min !== undefined && s < min) s += step;
  return Number(s.toFixed(6));
};

function ApplyButton({ primary, disabled, onClick, label }: { primary: boolean; disabled: boolean; onClick: () => void; label: string }): ReactNode {
  return (
    <button type="button" className={cx("mk-numfield__apply", primary && "is-primary")} disabled={disabled}
      onPointerDown={(e) => e.preventDefault()} onClick={onClick}>{label}</button>
  );
}

export interface NumberFieldProps {
  value: number | null;
  onApply: (v: number) => void;
  ariaLabel: string;
  unit?: string;
  min?: number;
  max?: number;
  /** Step for ↑↓ keys; applied values snap to it. */
  step?: number;
  disabled?: boolean;
  /** Show the Apply button (default true). Without it the value commits on Enter and on blur. */
  showApply?: boolean;
  /** Thousands separators (default true: "1,600" — DPI). Turn off for "1000 Hz"-style values. */
  grouping?: boolean;
  /** Override the range message shown in the Error state. */
  errorText?: string;
  applyLabel?: string;
  /** Gallery/mockup only: draw a state without interaction. */
  forceState?: NumState;
}

/** Single number + unit + Apply. Focused fills the field bg/card; Changed turns Apply green;
    Error tints the field and shows the allowed range under it (Apply disabled). Enter applies, Esc reverts. */
export function NumberField({
  value, onApply, ariaLabel, unit, min, max, step, disabled = false, showApply = true, grouping = true,
  errorText, applyLabel = "Apply", forceState,
}: NumberFieldProps): ReactNode {
  const show = (v: number | null): string => (v === null ? "" : fmtNum(v, grouping));
  const [draft, setDraft] = useState(() => show(value));
  const [focused, setFocused] = useState(false);
  const errId = useId();
  useEffect(() => { setDraft(show(value)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value, grouping]);

  const parsed = parseNum(draft);
  const valid = inRange(parsed, min, max);
  const isError = forceState === "error" || (!forceState && draft.trim() !== "" && !valid);
  const isChanged = forceState === "changed" || (!forceState && valid && parsed !== value);
  const isFocused = forceState === "focused" || (!forceState && focused);

  const apply = (): void => {
    if (disabled || !valid || parsed === value) return;
    const v = snapStep(parsed, step, min, max);
    setDraft(show(v));
    onApply(v);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") { e.preventDefault(); apply(); }
    else if (e.key === "Escape") { e.preventDefault(); setDraft(show(value)); }
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const base = Number.isFinite(parsed) ? parsed : (value ?? min ?? 0);
      let v = base + (e.key === "ArrowUp" ? 1 : -1) * (step ?? 1);
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
      setDraft(show(v));
    }
  };
  return (
    <div className={cx("mk-numfield", disabled && "is-disabled")}>
      <div className="mk-numfield__main">
        <label className={cx("mk-numfield__field", isFocused && "is-focused", isError && "is-error")}>
          <input className="mk-numfield__input" type="text" inputMode="numeric" autoComplete="off" spellcheck={false}
            value={draft} disabled={disabled} aria-label={ariaLabel} aria-invalid={isError || undefined}
            aria-describedby={isError ? errId : undefined}
            onChange={(e) => setDraft((e.target as HTMLInputElement).value)} onKeyDown={onKey}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              // Without an Apply button the field commits on blur (and Enter).
              if (valid) { if (!showApply && parsed !== value) apply(); else setDraft(show(parsed)); }
            }} />
          {unit ? <span className="mk-numfield__unit">{unit}</span> : null}
        </label>
        {showApply ? (
          <ApplyButton label={applyLabel} primary={isChanged && !isError} onClick={apply}
            disabled={disabled || isError || !(isChanged || isFocused)} />
        ) : null}
      </div>
      {isError ? <div id={errId} className="mk-numfield__error" role="alert">{errorText ?? rangeText(min, max, grouping)}</div> : null}
    </div>
  );
}

export interface NumberFieldXYProps {
  x: number | null;
  y: number | null;
  onApply: (x: number, y: number) => void;
  ariaLabel: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  grouping?: boolean;
  errorText?: string;
  applyLabel?: string;
  /** When linked, editing X also sets Y. */
  linked?: boolean;
  /** Makes the link glyph a toggle button. Without it the glyph is decorative. */
  onLinkChange?: (linked: boolean) => void;
  /** Gallery/mockup only: draw a state without interaction (focused = X field). */
  forceState?: NumState;
}

/** Separate X and Y values with a link glyph between them and one Apply. */
export function NumberFieldXY({
  x, y, onApply, ariaLabel, unit, min, max, step, disabled = false, grouping = true, errorText,
  applyLabel = "Apply", linked = false, onLinkChange, forceState,
}: NumberFieldXYProps): ReactNode {
  const show = (v: number | null): string => (v === null ? "" : fmtNum(v, grouping));
  const [dx, setDx] = useState(() => show(x));
  const [dy, setDy] = useState(() => show(y));
  const [focus, setFocus] = useState<"x" | "y" | null>(null);
  const errId = useId();
  useEffect(() => { setDx(show(x)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [x, grouping]);
  useEffect(() => { setDy(show(y)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [y, grouping]);

  const px = parseNum(dx), py = parseNum(dy);
  const vx = inRange(px, min, max), vy = inRange(py, min, max);
  const errX = forceState === "error" || (!forceState && dx.trim() !== "" && !vx);
  const errY = forceState === "error" || (!forceState && dy.trim() !== "" && !vy);
  const isError = errX || errY;
  const isChanged = forceState === "changed" || (!forceState && vx && vy && (px !== x || py !== y));
  const fx = forceState === "focused" ? "x" : forceState ? null : focus;

  const apply = (): void => {
    if (disabled || !vx || !vy || (px === x && py === y)) return;
    const ax = snapStep(px, step, min, max), ay = snapStep(py, step, min, max);
    setDx(show(ax)); setDy(show(ay));
    onApply(ax, ay);
  };
  const field = (axis: "x" | "y"): ReactNode => {
    const d = axis === "x" ? dx : dy;
    const setD = (s: string): void => {
      if (axis === "x") { setDx(s); if (linked) setDy(s); } else { setDy(s); if (linked) setDx(s); }
    };
    const p = axis === "x" ? px : py, v = axis === "x" ? vx : vy, cur = axis === "x" ? x : y;
    return (
      <label className={cx("mk-numfield__field", "mk-numfield__field--axis", fx === axis && "is-focused", (axis === "x" ? errX : errY) && "is-error")}>
        <span className="mk-numfield__axis">{axis.toUpperCase()}</span>
        <input className="mk-numfield__input" type="text" inputMode="numeric" autoComplete="off" spellcheck={false}
          value={d} disabled={disabled} aria-label={`${ariaLabel} ${axis.toUpperCase()}${unit ? ` (${unit})` : ""}`}
          aria-invalid={(axis === "x" ? errX : errY) || undefined} aria-describedby={isError ? errId : undefined}
          onChange={(e) => setD((e.target as HTMLInputElement).value)}
          onFocus={() => setFocus(axis)}
          onBlur={() => { setFocus(null); if (v) setD(show(p)); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); apply(); }
            else if (e.key === "Escape") { e.preventDefault(); setDx(show(x)); setDy(show(y)); }
            else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              let nv = (Number.isFinite(p) ? p : (cur ?? min ?? 0)) + (e.key === "ArrowUp" ? 1 : -1) * (step ?? 1);
              if (min !== undefined) nv = Math.max(min, nv);
              if (max !== undefined) nv = Math.min(max, nv);
              setD(show(nv));
            }
          }} />
      </label>
    );
  };
  return (
    <div className={cx("mk-numfield", "mk-numfield--xy", disabled && "is-disabled")}>
      <div className="mk-numfield__main">
        {field("x")}
        {onLinkChange ? (
          <button type="button" className={cx("mk-numfield__link", "is-button", linked && "is-linked")} disabled={disabled}
            aria-pressed={linked} aria-label={`Link X and Y ${ariaLabel}`} onClick={() => onLinkChange(!linked)}>
            <Icon name={linked ? "link" : "unlink"} size={12} />
          </button>
        ) : (
          <span className="mk-numfield__link" aria-hidden="true"><Icon name="link" size={12} /></span>
        )}
        {field("y")}
        <ApplyButton label={applyLabel} primary={isChanged && !isError} onClick={apply}
          disabled={disabled || isError || !(isChanged || fx !== null)} />
      </div>
      {isError ? <div id={errId} className="mk-numfield__error" role="alert">{errorText ?? rangeText(min, max, grouping)}</div> : null}
    </div>
  );
}

/* ───────────────────────────── Text input ───────────────────────────── */

export interface TextInputProps {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  /** Enter or the ✓ action. */
  onConfirm?: (value: string) => void;
  /** Esc or the ✕ action. */
  onCancel?: () => void;
  placeholder?: string;
  maxLength?: number;
  /** Inline confirm / cancel icons at the right of the field. */
  showActions?: boolean;
  /** true tints the field; a string also shows it under the field. */
  error?: string | boolean;
  disabled?: boolean;
  /** Focus on mount (without scrolling) — e.g. a profile entering rename. */
  autoFocus?: boolean;
  /** Gallery/mockup only: draw the Focused fill without focusing. */
  forceState?: "focused";
}

export function TextInput({
  value, onChange, ariaLabel, onConfirm, onCancel, placeholder, maxLength, showActions = false, error,
  disabled = false, autoFocus = false, forceState,
}: TextInputProps): ReactNode {
  const ref = useRef<HTMLInputElement>(null);
  const errId = useId();
  useEffect(() => { if (autoFocus) ref.current?.focus({ preventScroll: true }); }, [autoFocus]);
  const hasError = !!error;
  return (
    <div className={cx("mk-textinput", disabled && "is-disabled")}>
      <div className={cx("mk-textinput__field", forceState === "focused" && "is-focused", hasError && "is-error")}
        onPointerDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); ref.current?.focus(); } }}>
        <input ref={ref} className={cx("mk-textinput__input", forceState === "focused" && "is-hug")} type="text" value={value} placeholder={placeholder}
          maxLength={maxLength} disabled={disabled} aria-label={ariaLabel} aria-invalid={hasError || undefined}
          aria-describedby={typeof error === "string" ? errId : undefined} spellcheck={false} autoComplete="off"
          onChange={(e) => onChange((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onConfirm) { e.preventDefault(); onConfirm(value); }
            else if (e.key === "Escape" && onCancel) { e.preventDefault(); onCancel(); }
          }} />
        {forceState === "focused" ? <><span className="mk-textinput__caret" aria-hidden="true" /><span className="mk-textinput__spacer" /></> : null}
        {showActions ? (
          <span className="mk-textinput__actions">
            <button type="button" className="mk-textinput__action is-confirm" aria-label="Confirm" disabled={disabled}
              onPointerDown={(e) => e.preventDefault()} onClick={() => onConfirm?.(value)}>
              <Icon name="check" size={18} />
            </button>
            <button type="button" className="mk-textinput__action is-cancel" aria-label="Cancel" disabled={disabled}
              onPointerDown={(e) => e.preventDefault()} onClick={() => onCancel?.()}>
              <Icon name="close" size={18} />
            </button>
          </span>
        ) : null}
      </div>
      {typeof error === "string" && error ? <div id={errId} className="mk-textinput__error" role="alert">{error}</div> : null}
    </div>
  );
}
