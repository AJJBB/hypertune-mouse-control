// Mouse Component System — basics group: Button, Icon button, Status pill,
// Tab bar + Tab, Device header, Header actions. Geometry and tokens mirror
// Ivan's Figma components 1:1 (scratch-figma/specs/*.txt).
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import "./basics.css";

const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(" ");

/* ─────────────────────────── Button ─────────────────────────── */

export type ButtonSize = "large" | "medium";
export type ButtonVariant = "neutral" | "primary" | "danger";

export interface ButtonProps {
  label: string;
  /** Library icon shown left of the label (Figma default: reset). */
  icon?: IconName;
  /** Figma "Show icon". Defaults to true when an icon is given. */
  showIcon?: boolean;
  /** Large = 45 high (header / full-width actions); Medium = 35 high (inside rows). */
  size?: ButtonSize;
  variant?: ButtonVariant;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  type?: "button" | "submit";
  className?: string;
  /** Optional accessible name when the visible label is not enough. */
  ariaLabel?: string;
}

export function Button({
  label, icon, showIcon = true, size = "large", variant = "neutral",
  disabled, onClick, title, type = "button", className, ariaLabel,
}: ButtonProps): ReactNode {
  return (
    <button
      type={type}
      className={cx("mk-button", `mk-button--${size}`, `mk-button--${variant}`, disabled && "is-disabled", className)}
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
    >
      {icon && showIcon ? <Icon name={icon} size={20} className="mk-button__icon" /> : null}
      <span className="mk-button__label">{label}</span>
    </button>
  );
}

/* ───────────────────────── Icon button ───────────────────────── */

export interface IconButtonProps {
  icon: IconName;
  /** Accessible name (the button has no visible text). */
  label: string;
  /** Destructive action (delete…): at rest it looks Default; hover / keyboard
      focus show the library's Danger state (control-hover fill, red icon). */
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** Tooltip; defaults to the label. */
  title?: string;
  className?: string;
  /** Icon size in px (library: 16). */
  iconSize?: number;
}

export function IconButton({ icon, label, danger, disabled, onClick, title, className, iconSize = 16 }: IconButtonProps): ReactNode {
  return (
    <button
      type="button"
      className={cx("mk-icon-button", danger && "is-danger", disabled && "is-disabled", className)}
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
}

/* ───────────────────────── Status pill ───────────────────────── */

export type StatusPillType = "active" | "neutral" | "warning" | "error" | "plain";

export interface StatusPillProps {
  /** Active / Warning / Error show a coloured dot; Neutral shows `icon`; Plain is text only. */
  type?: StatusPillType;
  label: string;
  /** Neutral pills: an 18px icon (e.g. <BatteryIcon/>, <Icon name="dpi"/>). Overrides the dot on other types. */
  icon?: ReactNode;
  /** Optional unit after the label in tertiary text ("1600" + "DPI"), as on the reference screens. */
  unit?: string;
  title?: string;
  className?: string;
}

export function StatusPill({ type = "neutral", label, icon, unit, title, className }: StatusPillProps): ReactNode {
  const dotted = type === "active" || type === "warning" || type === "error";
  const lead = icon != null ? <span className="mk-pill__icon" aria-hidden="true">{icon}</span>
    : dotted ? <span className="mk-pill__dot" aria-hidden="true" /> : null;
  return (
    <span
      className={cx("mk-pill", `mk-pill--${type}`, lead == null && "mk-pill--bare", icon != null && "has-icon", className)}
      title={title}
    >
      {lead}
      <span className="mk-pill__label">
        {label}
        {unit ? <span className="mk-pill__unit"> {unit}</span> : null}
      </span>
    </span>
  );
}

/* ───────────────────────── Tab bar + Tab ───────────────────────── */

export interface TabItem { id: string; label: string; disabled?: boolean }

export interface TabProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  className?: string;
  id?: string;
  controls?: string;
  tabIndex?: number;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}

/** One tab. Normally rendered by TabBar; exported for standalone use. */
export function Tab({ label, selected, disabled, onSelect, className, id, controls, tabIndex, onKeyDown, buttonRef }: TabProps): ReactNode {
  return (
    <button
      ref={buttonRef}
      type="button"
      role="tab"
      id={id}
      aria-selected={!!selected}
      aria-controls={controls}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      tabIndex={tabIndex ?? (selected ? 0 : -1)}
      className={cx("mk-tab", selected && "is-selected", disabled && "is-disabled", className)}
      onClick={() => { if (!disabled && !selected) onSelect?.(); }}
      onKeyDown={onKeyDown}
    >
      <span className="mk-tab__label">{label}</span>
    </button>
  );
}

export interface TabBarProps {
  tabs: TabItem[];
  active: string;
  onSelect: (id: string) => void;
  ariaLabel?: string;
  /** Optional id prefix: tab i gets id `${idPrefix}-tab-${id}` and aria-controls `${idPrefix}-panel-${id}`. */
  idPrefix?: string;
  className?: string;
}

/** Device page navigation: tabs fill the bar equally (1190 wide in the screen). */
export function TabBar({ tabs, active, onSelect, ariaLabel = "Device sections", idPrefix, className }: TabBarProps): ReactNode {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const enabled = tabs.filter((t) => !t.disabled);
  const focusable = tabs.some((t) => t.id === active && !t.disabled) ? active : enabled[0]?.id;

  const move = (from: string, dir: 1 | -1 | "first" | "last") => {
    if (!enabled.length) return;
    let next: TabItem;
    if (dir === "first") next = enabled[0];
    else if (dir === "last") next = enabled[enabled.length - 1];
    else {
      const i = enabled.findIndex((t) => t.id === from);
      next = enabled[(i + dir + enabled.length) % enabled.length];
    }
    refs.current[next.id]?.focus();
    if (next.id !== active) onSelect(next.id);
  };

  const onKey = (id: string) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const k = e.key;
    if (k === "ArrowRight") move(id, 1);
    else if (k === "ArrowLeft") move(id, -1);
    else if (k === "Home") move(id, "first");
    else if (k === "End") move(id, "last");
    else return;
    e.preventDefault();
  };

  return (
    <div role="tablist" aria-label={ariaLabel} aria-orientation="horizontal" className={cx("mk-tabbar", className)}>
      {tabs.map((t) => (
        <Tab
          key={t.id}
          label={t.label}
          selected={t.id === active}
          disabled={t.disabled}
          id={idPrefix ? `${idPrefix}-tab-${t.id}` : undefined}
          controls={idPrefix ? `${idPrefix}-panel-${t.id}` : undefined}
          tabIndex={t.id === focusable ? 0 : -1}
          onSelect={() => onSelect(t.id)}
          onKeyDown={onKey(t.id)}
          buttonRef={(el) => { refs.current[t.id] = el; }}
        />
      ))}
    </div>
  );
}

/* ───────────────────────── Header actions ───────────────────────── */

export interface HeaderActionsProps {
  onReset?: () => void;
  onReport?: () => void;
  onShare?: () => void;
  /** Optional label overrides (library copy: Reset · Report Problem · Share profile). */
  resetLabel?: string;
  reportLabel?: string;
  shareLabel?: string;
}

/** Large neutral buttons, order Reset · Report · Share; only the handlers given render. */
export function HeaderActions({
  onReset, onReport, onShare,
  resetLabel = "Reset", reportLabel = "Report Problem", shareLabel = "Share profile",
}: HeaderActionsProps): ReactNode {
  if (!onReset && !onReport && !onShare) return null;
  return (
    <div className="mk-header-actions">
      {onReset ? <Button label={resetLabel} icon="reset" onClick={onReset} /> : null}
      {onReport ? <Button label={reportLabel} icon="flag" onClick={onReport} /> : null}
      {onShare ? <Button label={shareLabel} icon="share" onClick={onShare} /> : null}
    </div>
  );
}

/* ───────────────────────── Device header ───────────────────────── */

export interface DeviceHeaderProps {
  brand: string;
  model: string;
  /** Status pills (Connected, battery, DPI, Hz…), gap 10. */
  pills: ReactNode;
  /** Usually <HeaderActions …/>. */
  actions?: ReactNode;
  /** Shows a compact back chevron before the name (not in the library component; the brief asks for one). */
  onBack?: () => void;
  backLabel?: string;
  className?: string;
}

export function DeviceHeader({ brand, model, pills, actions, onBack, backLabel = "Back to devices", className }: DeviceHeaderProps): ReactNode {
  return (
    <header className={cx("mk-device-header", onBack && "has-back", className)}>
      <div className="mk-device-header__lead">
        {onBack ? (
          <button type="button" className="mk-device-header__back" aria-label={backLabel} title={backLabel} onClick={onBack}>
            <Icon name="chevron-right" size={18} />
          </button>
        ) : null}
        <div className="mk-device-header__name">
          <span className="mk-device-header__brand">{brand}</span>
          <h2 className="mk-device-header__model">{model}</h2>
        </div>
      </div>
      <div className="mk-device-header__spacer" />
      <div className="mk-device-header__status">{pills}</div>
      {actions ? <div className="mk-device-header__actions">{actions}</div> : null}
    </header>
  );
}
