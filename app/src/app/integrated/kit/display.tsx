// Mouse Component System — display group: Readout tile, Status panel, Info row,
// Device info list, Signal strength, Signal chart, Diagnostics + Diagnostic row,
// Stat tile, Button tester. Geometry and tokens mirror Ivan's Figma components
// 1:1 (scratch-figma/specs/*.txt). Read-only, presentational, controlled.
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { Button } from "./basics";
import "./display.css";

const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(" ");

/* ───────────────────────── Readout tile ───────────────────────── */

/* The tile's green glow is two copies of one blob vector (Figma "Vector",
   264×325, rotated), layer-blurred 136 (CSS ≈ 68) at 17 % accent — drawn in
   display.css (.mk-readout__glow). */

/* Tick ruler: 11 groups across 372 (viewBox), 8 minor ticks (5 high) per group
   and a major tick (11 high) closing each group; the last group has no major. */
const RULER_TICKS: { x: number; major: boolean }[] = (() => {
  const out: { x: number; major: boolean }[] = [];
  const gw = 372 / 11, step = gw / 8;
  for (let g = 0; g < 11; g++) {
    for (let k = 0; k <= 8; k++) out.push({ x: g * gw + k * step, major: k === 8 && g < 10 });
  }
  return out;
})();

function ReadoutRuler(): ReactNode {
  return (
    <div className="mk-readout__ruler" aria-hidden="true">
      <svg className="mk-readout__ticks" viewBox="0 0 372 11" preserveAspectRatio="none">
        {RULER_TICKS.map((t, i) => (
          <line key={i} x1={t.x} x2={t.x} y1={t.major ? 0 : 6} y2={11} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <span className="mk-readout__baseline" />
    </div>
  );
}

export interface ReadoutTileProps {
  label: string;
  /** Pre-formatted value ("1,600", "2000"). */
  value: string;
  unit?: string;
  icon?: IconName;
  /** Show the green tick ruler along the bottom (default true). */
  ticks?: boolean;
  /** Prev / next arrow buttons (Performance DPI tile: step through stages). */
  onPrev?: () => void;
  onNext?: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  /** Accessible names for the arrow buttons. */
  prevLabel?: string;
  nextLabel?: string;
  className?: string;
}

export function ReadoutTile({
  label, value, unit, icon, ticks = true, onPrev, onNext, prevDisabled, nextDisabled,
  prevLabel = `Previous ${label}`, nextLabel = `Next ${label}`, className,
}: ReadoutTileProps): ReactNode {
  return (
    <div className={cx("mk-readout", className)}>
      <span className="mk-readout__glow mk-readout__glow--left" aria-hidden="true"><span /></span>
      <span className="mk-readout__glow mk-readout__glow--right" aria-hidden="true"><span /></span>
      {ticks ? <ReadoutRuler /> : null}
      {onPrev ? (
        <button type="button" className="mk-readout__arrow mk-readout__arrow--prev" onClick={onPrev}
          disabled={prevDisabled} aria-label={prevLabel} title={prevLabel}>
          <Icon name="tri-left" size={26} />
        </button>
      ) : null}
      {onNext ? (
        <button type="button" className="mk-readout__arrow mk-readout__arrow--next" onClick={onNext}
          disabled={nextDisabled} aria-label={nextLabel} title={nextLabel}>
          <Icon name="tri-right" size={26} />
        </button>
      ) : null}
      <div className="mk-readout__body" role="group" aria-label={`${label}: ${value}${unit ? ` ${unit}` : ""}`}>
        <div className="mk-readout__label-row" aria-hidden="true">
          {icon ? <Icon name={icon} size={18} className="mk-readout__icon" /> : null}
          <span className="mk-t-body14 mk-c-secondary">{label}</span>
        </div>
        <div className="mk-readout__value-row" aria-hidden="true">
          <span className="mk-readout__value mk-t-display42">{value}</span>
          {unit ? <span className="mk-readout__unit mk-t-heading18">{unit}</span> : null}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Panel header ───────────────────────── */

/* The Section header instance inside Status panel / Device info list
   (title only: padding 4/0/4/10, Title 16). */
function PanelHeader({ title, id }: { title: string; id?: string }): ReactNode {
  return (
    <div className="mk-display-header">
      <h3 className="mk-display-header__title mk-t-title16" id={id}>{title}</h3>
    </div>
  );
}

/* ───────────────────────── Status panel ───────────────────────── */

export interface StatusPanelProps {
  /** Two ReadoutTiles (DPI, polling rate). */
  tiles: ReactNode;
  /** InfoRows (battery, connection, active profile). */
  children?: ReactNode;
  /** Section header title (Figma: "Status"). */
  title?: string;
  className?: string;
}

export function StatusPanel({ tiles, children, title = "Status", className }: StatusPanelProps): ReactNode {
  return (
    <section className={cx("mk-status-panel", className)} aria-label={title}>
      <PanelHeader title={title} />
      <div className="mk-status-panel__tiles">{tiles}</div>
      {children}
    </section>
  );
}

/* ───────────────────────── Info row ───────────────────────── */

export interface InfoRowProps {
  label: string;
  value: ReactNode;
  /** Second, muted value ("8K dongle", "Discharging") — Type=Two values / Icon. */
  secondary?: string;
  /** Leading icon before the value (Type=Icon), e.g. <BatteryIcon/>. */
  icon?: ReactNode;
  className?: string;
}

export function InfoRow({ label, value, secondary, icon, className }: InfoRowProps): ReactNode {
  return (
    <div className={cx("mk-info-row", className)}>
      <span className="mk-info-row__label mk-t-body14">{label}</span>
      <span className="mk-info-row__value-wrap">
        {icon ? <span className="mk-info-row__icon">{icon}</span> : null}
        <span className="mk-info-row__value mk-t-body14">{value}</span>
        {secondary ? <span className="mk-info-row__secondary mk-t-body14">{secondary}</span> : null}
      </span>
    </div>
  );
}

/* ───────────────────────── Device info list ───────────────────────── */

export interface DeviceInfoListProps {
  children?: ReactNode;
  /** Section header title (Figma: "Device Info"). */
  title?: string;
  className?: string;
}

export function DeviceInfoList({ children, title = "Device Info", className }: DeviceInfoListProps): ReactNode {
  return (
    <section className={cx("mk-device-info", className)} aria-label={title}>
      <PanelHeader title={title} />
      {children}
    </section>
  );
}

/* ───────────────────────── Signal strength ───────────────────────── */

export type SignalLevel = 0 | 1 | 2 | 3 | 4;
const SIGNAL_WORDS = ["No signal", "Weak", "Fair", "Good", "Strong"] as const;
const SIGNAL_TONE = ["none", "error", "warning", "ok", "ok"] as const;

export interface SignalStrengthProps {
  level: SignalLevel | null;
  /** Show the word after x/4 (Figma "Show word", default true). */
  showWord?: boolean;
  className?: string;
}

export function SignalStrength({ level, showWord = true, className }: SignalStrengthProps): ReactNode {
  const lv = level ?? 0;
  const word = level == null ? "Unknown" : SIGNAL_WORDS[lv];
  const levelText = level == null ? "–/4" : `${lv}/4`;
  return (
    <span className={cx("mk-signal", `mk-signal--${level == null ? "none" : SIGNAL_TONE[lv]}`, className)}
      role="img" aria-label={`Signal strength ${level == null ? "unknown" : `${lv} of 4, ${word}`}`}>
      <span className="mk-signal__bars" aria-hidden="true">
        {[1, 2, 3, 4].map((b) => (
          <span key={b} className={cx("mk-signal__bar", b <= lv && "is-on")} style={{ height: 3 + b * 2 }} />
        ))}
      </span>
      <span className="mk-signal__level mk-t-caption12" aria-hidden="true">{levelText}</span>
      {showWord ? <span className="mk-signal__word mk-t-caption12" aria-hidden="true">{word}</span> : null}
    </span>
  );
}

/* ───────────────────────── Signal chart ───────────────────────── */

export interface SignalChartProps {
  title: string;
  /** Current reading, pre-formatted ("52 dBm"). */
  value: string;
  /** Oldest → newest. */
  samples: number[];
  /** Signal strength pill on the right of the header. */
  level?: SignalLevel | null;
  /** Fixed y-domain [min, max]; by default the line auto-fits the samples. */
  domain?: [number, number];
  axisStart?: string;
  axisEnd?: string;
  className?: string;
}

const CHART_W = 635, CHART_H = 96;
/* In Figma the line spans y 20.3–57.9 of the 96-high plot and the fill runs
   from the line down to the bottom edge. */
const BAND_TOP = 20.3, BAND_BOTTOM = 57.9;

function chartPoints(samples: number[], domain?: [number, number]): [number, number][] {
  if (samples.length === 0) return [];
  const lo = domain ? domain[0] : Math.min(...samples);
  const hi = domain ? domain[1] : Math.max(...samples);
  const top = domain ? 4 : BAND_TOP, bottom = domain ? CHART_H - 4 : BAND_BOTTOM;
  const n = samples.length;
  return samples.map((v, i) => {
    const t = hi === lo ? 0.5 : (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo);
    const x = n === 1 ? CHART_W : (i / (n - 1)) * CHART_W;
    return [x, bottom - t * (bottom - top)];
  });
}

export function SignalChart({
  title, value, samples, level, domain, axisStart = "30 s ago", axisEnd = "Now", className,
}: SignalChartProps): ReactNode {
  const pts = chartPoints(samples, domain);
  const line = pts.length > 1
    ? pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ")
    : pts.length === 1 ? `M0 ${pts[0][1].toFixed(2)} L${CHART_W} ${pts[0][1].toFixed(2)}` : "";
  const area = line ? `${line} L${CHART_W} ${CHART_H} L0 ${CHART_H} Z` : "";
  return (
    <section className={cx("mk-signal-chart", className)} aria-label={title}>
      <div className="mk-signal-chart__header">
        <div className="mk-signal-chart__heading">
          <h3 className="mk-signal-chart__title mk-t-title16">{title}</h3>
          <span className="mk-signal-chart__value mk-t-heading18" aria-live="polite">{value}</span>
        </div>
        {level !== undefined ? <SignalStrength level={level} /> : null}
      </div>
      <div className="mk-signal-chart__plot">
        <svg className="mk-signal-chart__chart" viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none"
          role="img" aria-label={`${title} over time`}>
          <defs>
            <linearGradient id="mk-signal-fill" x1="0" y1="0" x2="0" y2={CHART_H} gradientUnits="userSpaceOnUse">
              <stop offset="0" className="mk-signal-chart__stop-top" />
              <stop offset="1" className="mk-signal-chart__stop-bottom" />
            </linearGradient>
          </defs>
          {area ? <path d={area} className="mk-signal-chart__area" fill="url(#mk-signal-fill)" /> : null}
          {line ? <path d={line} className="mk-signal-chart__line" vectorEffect="non-scaling-stroke" /> : null}
        </svg>
        <div className="mk-signal-chart__axis mk-t-micro11" aria-hidden="true">
          <span>{axisStart}</span>
          <span>{axisEnd}</span>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Diagnostics ───────────────────────── */

export type DiagnosticStatus = "neutral" | "ok" | "warning" | "error";

export interface DiagnosticRowProps {
  label: string;
  value: ReactNode;
  status?: DiagnosticStatus;
  className?: string;
}

export function DiagnosticRow({ label, value, status = "neutral", className }: DiagnosticRowProps): ReactNode {
  return (
    <div className={cx("mk-diag-row", `mk-diag-row--${status}`, className)}>
      <span className="mk-diag-row__label mk-t-body14">{label}</span>
      <span className="mk-diag-row__value-wrap">
        {status !== "neutral" ? <span className="mk-diag-row__dot" aria-hidden="true" /> : null}
        <span className="mk-diag-row__value mk-t-body14">
          {value}
          {status === "warning" || status === "error"
            ? <span className="mk-sr-only"> ({status === "warning" ? "warning" : "error"})</span> : null}
        </span>
      </span>
    </div>
  );
}

export interface DiagnosticsProps {
  title?: string;
  /** Shows the "Copy log" button. */
  onCopy?: () => void;
  copyLabel?: string;
  /** DiagnosticRows. */
  children?: ReactNode;
  className?: string;
}

export function Diagnostics({ title = "Diagnostics", onCopy, copyLabel = "Copy log", children, className }: DiagnosticsProps): ReactNode {
  return (
    <section className={cx("mk-diagnostics", className)} aria-label={title}>
      <div className="mk-diagnostics__header">
        <h3 className="mk-diagnostics__title mk-t-title16">{title}</h3>
        {onCopy ? <Button label={copyLabel} icon="copy" size="medium" variant="neutral" onClick={onCopy} /> : null}
      </div>
      <div className="mk-diagnostics__rows">{children}</div>
    </section>
  );
}

/* ───────────────────────── Stat tile ───────────────────────── */

export type StatTileState = "idle" | "counted" | "active";

export interface StatTileProps {
  label: string;
  /** null → "–" (Idle). */
  value: string | null;
  /** Defaults to idle when value is null, counted otherwise. */
  state?: StatTileState;
  className?: string;
}

export function StatTile({ label, value, state, className }: StatTileProps): ReactNode {
  const st: StatTileState = state ?? (value == null ? "idle" : "counted");
  return (
    <div className={cx("mk-stat", `mk-stat--${st}`, className)}>
      <span className="mk-stat__label mk-t-caption12">{label}</span>
      <span className="mk-stat__value mk-t-heading22 mk-tnum">{value ?? "–"}</span>
    </div>
  );
}

/* ───────────────────────── Button tester ───────────────────────── */

export type TesterButton = "left" | "right" | "middle" | "back" | "forward";

export interface ButtonTesterProps {
  counts: Record<TesterButton, number>;
  scroll: { up: number; down: number };
  /** The button held right now (its tile shows Active). */
  pressed: TesterButton | string | null;
  /** The wheel direction moving right now. */
  wheel: "up" | "down" | null;
  /** Replaces the centre mouse glyph (e.g. the device render). */
  art?: ReactNode;
  className?: string;
}

const TESTER_LABELS: Record<TesterButton, string> = {
  left: "Left click", right: "Right click", middle: "Wheel click", back: "Back", forward: "Forward",
};

export function ButtonTester({ counts, scroll, pressed, wheel, art, className }: ButtonTesterProps): ReactNode {
  const tile = (b: TesterButton): ReactNode => (
    <StatTile label={TESTER_LABELS[b]} value={counts[b] > 0 ? String(counts[b]) : null}
      state={pressed === b ? "active" : counts[b] > 0 ? "counted" : "idle"} />
  );
  const dir = (d: "up" | "down"): ReactNode => {
    const n = scroll[d];
    return (
      <span className={cx("mk-tester__dir", n > 0 && "is-counted", wheel === d && "is-active")}>
        <Icon name={d === "up" ? "arrow-up" : "arrow-down"} size={14} className="mk-tester__dir-icon" />
        <span className="mk-t-heading22 mk-tnum">{n > 0 ? n : "–"}</span>
        <span className="mk-sr-only">{d === "up" ? "scrolled up" : "scrolled down"}</span>
      </span>
    );
  };
  return (
    <div className={cx("mk-tester", className)} role="group" aria-label="Button test">
      <div className="mk-tester__col">
        {tile("left")}
        <div className="mk-tester__pair">{tile("right")}{tile("middle")}</div>
      </div>
      <div className="mk-tester__mouse" aria-hidden="true">
        {art ?? <Icon name="mouse" size={72} className="mk-tester__art" />}
      </div>
      <div className="mk-tester__col">
        <div className={cx("mk-stat", "mk-tester__scroll", wheel ? "mk-stat--active" : "mk-stat--counted")}>
          <span className="mk-stat__label mk-t-caption12">Scroll</span>
          <span className="mk-tester__dirs">{dir("up")}{dir("down")}</span>
        </div>
        <div className="mk-tester__pair">{tile("back")}{tile("forward")}</div>
      </div>
      <span className="mk-sr-only" aria-live="polite">{pressed ? `${TESTER_LABELS[pressed as TesterButton] ?? pressed} pressed` : ""}</span>
    </div>
  );
}
