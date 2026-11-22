// Mouse Component System — lists group.
// Button remap grid · Remap row · Callout label · Profile card · Profile list · Profile row ·
// DPI stage table · DPI stage row. Geometry/tokens mirror Ivan's Figma library 1:1
// (scratch-figma/specs/*.txt). Presentational + controlled: props in, callbacks out.
import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button, IconButton, StatusPill } from "./basics";
import { Segmented, StepPicker, TextInput } from "./controls";
import "./lists.css";

const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(" ");

/* ─────────────── List header (the library's Section header, as these lists use it) ─────────────── */

interface ListHeaderProps {
  title: string;
  count?: number | string;
  action?: ReactNode;
  id?: string;
}

/** Title (+ count pill) on the left, one action on the right. 665 wide, pad 4/0/4/10. */
function ListHeader({ title, count, action, id }: ListHeaderProps): ReactNode {
  return (
    <div className="mk-list-header">
      <div className="mk-list-header__text">
        <div className="mk-list-header__title-row">
          <h3 id={id} className="mk-list-header__title">{title}</h3>
          {count !== undefined && count !== null && count !== "" ? <StatusPill type="plain" label={String(count)} /> : null}
        </div>
      </div>
      {action ? <div className="mk-list-header__action">{action}</div> : null}
    </div>
  );
}


/* ───────────────────────────── Remap row ───────────────────────────── */

export type RemapRowState = "default" | "changed" | "recording" | "disabled";

export interface RemapRowProps {
  /** Button name ("Gesture button"). */
  button: string;
  /** The action control — normally a <Dropdown> of actions. Fills the 220-wide slot. */
  control: ReactNode;
  /** Default · Changed (differs from default: dot + note + reset) · Recording (capture field) · Disabled (locked). */
  state?: RemapRowState;
  /** Changed: the reset icon button. */
  onReset?: () => void;
  /** Changed: the factory action, shown as "Default: …". */
  defaultAction?: string;
  /** Recording: the capture hint (library copy "Press a key or button…"). */
  recordingHint?: string;
  /** Recording: Esc / click on the capture field cancels. */
  onCancelRecording?: () => void;
  resetLabel?: string;
  className?: string;
}

/** One button → action row (665×58): name on the left, a 220-wide action control on the right. */
export function RemapRow({
  button, control, state = "default", onReset, defaultAction, recordingHint = "Press a key or button…",
  onCancelRecording, resetLabel, className,
}: RemapRowProps): ReactNode {
  const disabled = state === "disabled";
  const changed = state === "changed";
  const recording = state === "recording";
  return (
    <div className={cx("mk-remap-row", `is-${state}`, className)} aria-disabled={disabled || undefined}>
      <div className="mk-remap-row__name">
        <span className="mk-remap-row__button">{button}</span>
        {disabled ? <Icon name="lock" size={18} className="mk-remap-row__lock" title="Can't be remapped" /> : null}
        {changed ? <span className="mk-remap-row__dot" aria-hidden="true" /> : null}
        {changed && defaultAction ? <span className="mk-remap-row__note">Default: {defaultAction}</span> : null}
      </div>
      {changed && onReset ? (
        <IconButton icon="reset" label={resetLabel ?? `Reset ${button} to default`} onClick={onReset} />
      ) : null}
      {recording ? (
        <div className="mk-remap-row__capture" role="status" aria-live="polite" tabIndex={onCancelRecording ? 0 : -1}
          aria-label={`${button}: ${recordingHint}`}
          onClick={onCancelRecording}
          onKeyDown={(e) => { if (e.key === "Escape" && onCancelRecording) { e.preventDefault(); onCancelRecording(); } }}>
          <span className="mk-remap-row__hint">{recordingHint}</span>
        </div>
      ) : (
        <div className="mk-remap-row__control">{control}</div>
      )}
    </div>
  );
}

/* ───────────────────────────── Button remap grid ───────────────────────────── */

export interface RemapLayer { id: string; label: string }

export interface ButtonRemapGridProps {
  title?: string;
  /** Count pill next to the title (number of buttons). */
  count?: number | string;
  /** Normal / G-Shift tabs. Hidden when absent or fewer than 2 layers. */
  layers?: RemapLayer[];
  activeLayer?: string;
  onLayer?: (id: string) => void;
  /** Header action "Reset to default" (only rendered when given). */
  onReset?: () => void;
  resetLabel?: string;
  /** Remap rows. */
  children: ReactNode;
  className?: string;
}

/** List version of Buttons: header, layer tabs, then one Remap row per button (gap 5). */
export function ButtonRemapGrid({
  title = "Button Remapping", count, layers, activeLayer, onLayer, onReset, resetLabel = "Reset to default", children, className,
}: ButtonRemapGridProps): ReactNode {
  const headId = useId();
  const showLayers = !!layers && layers.length > 1;
  return (
    <section className={cx("mk-remap-grid", className)} aria-labelledby={headId}>
      <ListHeader id={headId} title={title} count={count}
        action={onReset ? <Button label={resetLabel} icon="reset" onClick={onReset} /> : null} />
      {showLayers ? (
        <Segmented container="card" ariaLabel={`${title} layer`}
          options={layers.map((l) => ({ value: l.id, label: l.label }))}
          value={activeLayer ?? layers[0].id} onChange={(v) => onLayer?.(v)} />
      ) : null}
      {children}
    </section>
  );
}

/* ───────────────────────────── Callout label ───────────────────────────── */

export interface CalloutLabelProps {
  /** Button name ("Side button, rear"). */
  button: string;
  /** Current action ("Space"). */
  action: string;
  /** Active = the button picked on the diagram (accent gradient, accent action). */
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

/** A 160-wide label on the mouse diagram. Clickable when onClick is given (aria-pressed = active). */
export function CalloutLabel({ button, action, active = false, onClick, className }: CalloutLabelProps): ReactNode {
  const body = (
    <>
      <span className="mk-callout__button">{button}</span>
      <span className="mk-callout__action">{action}</span>
    </>
  );
  const cls = cx("mk-callout", active && "is-active", onClick && "is-interactive", className);
  return onClick ? (
    <button type="button" className={cls} aria-pressed={active} onClick={onClick}>{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ───────────────────────────── Profile card ───────────────────────────── */

export type ProfileCardState = "default" | "active" | "factory";

export interface ProfileCardProps {
  name: string;
  /** "#1". */
  slot: string;
  /** Default · Active (gradient header + Active pill) · Factory ("Factory Settings" note). */
  state?: ProfileCardState;
  /** Switches the mouse to this onboard profile: adds an "Activate" button beside Open (not shown when active). */
  onActivate?: () => void;
  /** The pencil next to the name. */
  onRename?: () => void;
  /** Restore this slot to factory settings: adds a reset icon button to the footer. */
  onReset?: () => void;
  /** The full-width footer button (library: "Open"). */
  onOpen?: () => void;
  openLabel?: string;
  activateLabel?: string;
  activeLabel?: string;
  factoryLabel?: string;
  /** Summary rows — <ProfileStat/>s (DPI, Polling rate, Connection, Motion Sync, Buttons). */
  children?: ReactNode;
  className?: string;
}

/** One summary line of a Profile card: secondary label left, value right. */
export function ProfileStat({ label, value }: { label: string; value: ReactNode }): ReactNode {
  return (
    <div className="mk-profile-stat">
      <dt className="mk-profile-stat__label">{label}</dt>
      <dd className="mk-profile-stat__value">{value}</dd>
    </div>
  );
}

/** Onboard profile card (290 wide; up to 4 across the 1190 content width). */
export function ProfileCard({
  name, slot, state = "default", onActivate, onRename, onReset, onOpen,
  openLabel = "Open", activateLabel = "Activate", activeLabel = "Active", factoryLabel = "Factory Settings",
  children, className,
}: ProfileCardProps): ReactNode {
  const headId = useId();
  const showActivate = !!onActivate && state !== "active";
  return (
    <article className={cx("mk-profile-card", `is-${state}`, className)} aria-labelledby={headId}>
      <header className="mk-profile-card__header">
        <span className="mk-profile-card__slot">{slot}</span>
        {state === "active" ? <StatusPill type="active" label={activeLabel} /> : null}
        {state === "factory" ? <span className="mk-profile-card__factory">{factoryLabel}</span> : null}
      </header>
      <div className="mk-profile-card__body">
        <div className="mk-profile-card__name-row">
          <h3 id={headId} className="mk-profile-card__name">{name}</h3>
          {onRename ? (
            <button type="button" className="mk-profile-card__rename" aria-label={`Rename ${name}`} title="Rename" onClick={onRename}>
              <Icon name="edit" size={16} />
            </button>
          ) : (
            <span className="mk-profile-card__rename is-static" aria-hidden="true"><Icon name="edit" size={16} /></span>
          )}
        </div>
        {children ? <dl className="mk-profile-card__summary">{children}</dl> : null}
        {onOpen || showActivate || onReset ? (
          <div className="mk-profile-card__footer">
            {showActivate ? <Button size="medium" label={activateLabel} onClick={onActivate} className="mk-profile-card__action" /> : null}
            {onOpen ? <Button size="medium" label={openLabel} onClick={onOpen} className="mk-profile-card__action" /> : null}
            {onReset ? <IconButton icon="reset" label={`Reset ${name} to factory settings`} onClick={onReset} className="mk-profile-card__reset" /> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/* ───────────────────────────── Profile row ───────────────────────────── */

export type ProfileRowState = "default" | "active" | "renaming" | "empty";

export interface ProfileRowProps {
  name: string;
  /** "1,600 DPI · 1000 Hz". */
  summary?: string;
  /** Figma "Show slot": a numbered onboard slot ("#1") before the text. */
  slot?: string;
  state?: ProfileRowState;
  /** The "Activate" button (hidden on the active profile, which shows the Active tag instead). */
  onApply?: () => void;
  onOpen?: () => void;
  onRename?: () => void;
  /** Delete — disabled on the active profile. */
  onDelete?: () => void;
  /** Renaming: the field value + handlers (Enter / ✓ confirm, Esc / ✕ cancel). */
  renameValue?: string;
  onRenameChange?: (v: string) => void;
  onRenameConfirm?: (v: string) => void;
  onRenameCancel?: () => void;
  /** Empty: "Save here". */
  onSave?: () => void;
  applyLabel?: string;
  openLabel?: string;
  activeLabel?: string;
  saveLabel?: string;
  emptyTitle?: string;
  emptyNote?: string;
  renamePlaceholder?: string;
  className?: string;
}

/** One app-saved profile (665×59): name + summary, then Activate · Open · rename · delete. */
export function ProfileRow({
  name, summary, slot, state = "default", onApply, onOpen, onRename, onDelete,
  renameValue, onRenameChange, onRenameConfirm, onRenameCancel, onSave,
  applyLabel = "Activate", openLabel = "Open", activeLabel = "Active", saveLabel = "Save here",
  emptyTitle = "Empty slot", emptyNote = "Save the current settings here.", renamePlaceholder = "Profile name",
  className,
}: ProfileRowProps): ReactNode {
  const active = state === "active";
  const slotEl = slot ? <span className="mk-profile-row__slot">{slot}</span> : null;

  if (state === "renaming") {
    return (
      <div className={cx("mk-profile-row", "is-renaming", className)}>
        {slotEl}
        <div className="mk-profile-row__rename">
          <TextInput value={renameValue ?? name} onChange={(v) => onRenameChange?.(v)} ariaLabel={`Rename ${name}`}
            placeholder={renamePlaceholder} showActions autoFocus maxLength={32}
            onConfirm={(v) => onRenameConfirm?.(v)} onCancel={() => onRenameCancel?.()} />
        </div>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className={cx("mk-profile-row", "is-empty", className)}>
        {slotEl}
        <div className="mk-profile-row__text">
          <span className="mk-profile-row__name is-empty">{emptyTitle}</span>
          <span className="mk-profile-row__summary">{emptyNote}</span>
        </div>
        {onSave ? (
          <div className="mk-profile-row__actions">
            <Button size="medium" icon="save" label={saveLabel} onClick={onSave} ariaLabel={slot ? `${saveLabel} (${slot})` : undefined} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cx("mk-profile-row", active && "is-active", className)}>
      {slotEl}
      <div className="mk-profile-row__text">
        <span className="mk-profile-row__name">{name}</span>
        {summary ? <span className="mk-profile-row__summary">{summary}</span> : null}
      </div>
      <div className="mk-profile-row__actions">
        {active ? <StatusPill type="active" label={activeLabel} />
          : onApply ? <Button size="medium" label={applyLabel} onClick={onApply} ariaLabel={`${applyLabel} ${name}`} /> : null}
        {onOpen ? <Button size="medium" label={openLabel} onClick={onOpen} ariaLabel={`${openLabel} ${name}`} /> : null}
        {onRename ? <IconButton icon="edit" label={`Rename ${name}`} onClick={onRename} /> : null}
        {onDelete ? (
          <IconButton icon="trash" danger label={active ? `Can't delete the active profile` : `Delete ${name}`}
            disabled={active} onClick={onDelete} />
        ) : null}
      </div>
    </div>
  );
}

/* ───────────────────────────── Profile list ───────────────────────────── */

export interface ProfileListProps {
  title?: string;
  /** Header action "Save current" (only rendered when given). */
  onSaveCurrent?: () => void;
  saveLabel?: string;
  /** Profile rows. */
  children: ReactNode;
  className?: string;
}

/** App-saved profiles: header with Save current, then Profile rows (gap 5). */
export function ProfileList({ title = "Saved Profiles", onSaveCurrent, saveLabel = "Save current", children, className }: ProfileListProps): ReactNode {
  const headId = useId();
  return (
    <section className={cx("mk-profile-list", className)} aria-labelledby={headId}>
      <ListHeader id={headId} title={title}
        action={onSaveCurrent ? <Button label={saveLabel} icon="save" onClick={onSaveCurrent} /> : null} />
      {children}
    </section>
  );
}

/* ───────────────────────────── DPI stage row ───────────────────────────── */

const fmtDpi = (v: number): string => v.toLocaleString("en-US");
const parseDpi = (s: string): number => {
  const t = s.replace(/[,\s_]/g, "");
  return t === "" || !/^\d+$/.test(t) ? NaN : Number(t);
};

interface StageValueProps {
  value: number;
  onCommit: (v: number) => void;
  ariaLabel: string;
  min?: number;
  max?: number;
  step?: number;
  /** Linked Y: shown in tertiary text and not editable. */
  muted?: boolean;
  readOnly?: boolean;
}

/** An 80×29 inline DPI value: type, Enter / blur commits (clamped + snapped), Esc reverts, ↑↓ step. */
function StageValue({ value, onCommit, ariaLabel, min, max, step = 1, muted = false, readOnly = false }: StageValueProps): ReactNode {
  const [draft, setDraft] = useState(() => fmtDpi(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setDraft(fmtDpi(value)); }, [value, focused]);
  const clampSnap = (v: number): number => {
    const base = min ?? 0;
    let s = step > 0 ? base + Math.round((v - base) / step) * step : v;
    if (min !== undefined) s = Math.max(min, s);
    if (max !== undefined) s = Math.min(max, s);
    return s;
  };
  const commit = (): void => {
    const p = parseDpi(draft);
    if (!Number.isFinite(p)) { setDraft(fmtDpi(value)); return; }
    const v = clampSnap(p);
    setDraft(fmtDpi(v));
    if (v !== value) onCommit(v);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (readOnly) return;
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") { e.preventDefault(); setDraft(fmtDpi(value)); }
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const p = parseDpi(draft);
      const v = clampSnap((Number.isFinite(p) ? p : value) + (e.key === "ArrowUp" ? step : -step));
      setDraft(fmtDpi(v));
      if (v !== value) onCommit(v);
    }
  };
  return (
    <input className={cx("mk-dpi-row__value", muted && "is-muted")} type="text" inputMode="numeric" autoComplete="off"
      spellcheck={false} value={draft} readOnly={readOnly} tabIndex={readOnly ? -1 : 0} aria-label={ariaLabel}
      aria-readonly={readOnly || undefined}
      onChange={(e) => setDraft((e.target as HTMLInputElement).value)} onKeyDown={onKey}
      onFocus={(e) => { setFocused(true); if (!readOnly) (e.currentTarget as HTMLInputElement).select(); }}
      onBlur={() => { setFocused(false); if (!readOnly) commit(); }} />
  );
}

export interface DpiStageRowProps {
  /** 1-based stage number. */
  stage: number;
  /** Active = the stage the mouse is on (tinted row, accent index, "Current" pill). */
  active?: boolean;
  x: number;
  y: number;
  /** Linked: Y follows X (greyed, not editable). The consumer sets Y when X changes. */
  linked: boolean;
  onLink?: (linked: boolean) => void;
  onX: (v: number) => void;
  onY: (v: number) => void;
  /** Clicking the stage index makes it the current stage. */
  onActivate?: () => void;
  min?: number;
  max?: number;
  step?: number;
  /** Lift-off control for this stage — normally <Segmented> L / M / H (fills the 120×29 slot). */
  liftOff?: ReactNode;
  /** Stage colour (#rrggbb). Omit to hide the colour column. */
  color?: string;
  onColor?: (hex: string) => void;
  /** Read-only: values, link and colour can't be edited. */
  locked?: boolean;
  /** The ✕ at the end of the row (only rendered when given). */
  onRemove?: () => void;
  currentLabel?: string;
  className?: string;
}

/** One DPI stage (645×41): index · X · link · Y · lift-off · colour · (Current) · ✕. */
export function DpiStageRow({
  stage, active = false, x, y, linked, onLink, onX, onY, onActivate, min = 100, max, step = 50,
  liftOff, color, onColor, locked = false, onRemove, currentLabel = "Current", className,
}: DpiStageRowProps): ReactNode {
  const label = `Stage ${stage}`;
  return (
    <div className={cx("mk-dpi-row", active && "is-active", linked ? "is-linked" : "is-unlinked", locked && "is-locked", className)}
      role="group" aria-label={label} aria-current={active ? "true" : undefined}>
      {onActivate && !locked ? (
        <button type="button" className="mk-dpi-row__index" aria-pressed={active}
          aria-label={active ? `${label} (current)` : `Make ${label.toLowerCase()} current`} onClick={() => { if (!active) onActivate(); }}>
          {stage}
        </button>
      ) : (
        <span className="mk-dpi-row__index">{stage}</span>
      )}
      <StageValue value={x} onCommit={onX} ariaLabel={`${label} X DPI`} min={min} max={max} step={step} readOnly={locked} />
      {onLink && !locked ? (
        <button type="button" className={cx("mk-dpi-row__link", linked && "is-linked")} aria-pressed={linked}
          aria-label={`Link X and Y for ${label.toLowerCase()}`} title={linked ? "Linked — Y follows X" : "Unlinked"}
          onClick={() => onLink(!linked)}>
          <Icon name={linked ? "link" : "unlink"} size={linked ? 12 : 18} />
        </button>
      ) : (
        <span className={cx("mk-dpi-row__link", linked && "is-linked")} aria-hidden="true">
          <Icon name={linked ? "link" : "unlink"} size={linked ? 12 : 18} />
        </span>
      )}
      <StageValue value={linked ? x : y} onCommit={onY} ariaLabel={`${label} Y DPI`} min={min} max={max} step={step}
        muted={linked} readOnly={locked || linked} />
      {liftOff !== undefined ? <div className="mk-dpi-row__lift">{liftOff}</div> : null}
      {color !== undefined ? (
        onColor && !locked ? (
          <label className="mk-dpi-row__color" title={`${label} colour`}>
            <span className="mk-dpi-row__swatch" style={{ background: color }} />
            <input className="mk-sr-only" type="color" value={color} aria-label={`${label} colour`}
              onChange={(e) => onColor((e.target as HTMLInputElement).value)} />
          </label>
        ) : (
          <span className="mk-dpi-row__color" aria-label={`${label} colour ${color}`} role="img">
            <span className="mk-dpi-row__swatch" style={{ background: color }} />
          </span>
        )
      ) : null}
      <span className="mk-dpi-row__spacer" />
      {active ? <StatusPill type="active" label={currentLabel} /> : null}
      {onRemove ? (
        <button type="button" className="mk-dpi-row__remove" aria-label={`Remove ${label.toLowerCase()}`} title="Remove stage"
          disabled={locked} onClick={onRemove}>
          <Icon name="close" size={18} />
        </button>
      ) : null}
    </div>
  );
}

/* ───────────────────────────── DPI stage table ───────────────────────────── */

export interface DpiStageTableProps {
  /** Number of stages in use. */
  count: number;
  /** Most stages the mouse supports (the Stages picker shows 1…maxCount). */
  maxCount: number;
  onCount?: (n: number) => void;
  /** "Reset to default" under the rows (only rendered when given). */
  onReset?: () => void;
  /** Read-only table: stage count and reset disabled. */
  locked?: boolean;
  /** Show the Lift-off column header (rows show their own liftOff). Default true. */
  showLiftOff?: boolean;
  /** Show the Color column header. Default true. */
  showColor?: boolean;
  title?: string;
  stagesLabel?: string;
  resetLabel?: string;
  /** DPI stage rows. */
  children: ReactNode;
  className?: string;
}

/** DPI as stages (665 wide card): title + stage count, column heads, one row per stage, reset. */
export function DpiStageTable({
  count, maxCount, onCount, onReset, locked = false, showLiftOff = true, showColor = true,
  title = "DPI Stages", stagesLabel = "Stages", resetLabel = "Reset to default", children, className,
}: DpiStageTableProps): ReactNode {
  const headId = useId();
  return (
    <section className={cx("mk-dpi-table", locked && "is-locked", className)} aria-labelledby={headId}>
      <div className="mk-dpi-table__header">
        <h3 id={headId} className="mk-dpi-table__title">{title}</h3>
        {onCount ? (
          <div className="mk-dpi-table__count">
            <span className="mk-dpi-table__count-label" aria-hidden="true">{stagesLabel}</span>
            <div className="mk-dpi-table__steps" style={{ width: maxCount * 35 + (maxCount - 1) * 4 }}>
              <StepPicker count={maxCount} value={count} onChange={onCount} ariaLabel={`${title}: ${stagesLabel.toLowerCase()}`}
                disabled={locked} />
            </div>
          </div>
        ) : null}
      </div>
      <div className="mk-dpi-table__columns" aria-hidden="true">
        <span className="mk-dpi-table__col is-index">#</span>
        <span className="mk-dpi-table__col is-value">X DPI</span>
        <span className="mk-dpi-table__col is-link" />
        <span className="mk-dpi-table__col is-value">Y DPI</span>
        {showLiftOff ? <span className="mk-dpi-table__col is-lift">Lift-off</span> : null}
        {showColor ? <span className="mk-dpi-table__col is-color">Color</span> : null}
      </div>
      <div className="mk-dpi-table__rows">{children}</div>
      {onReset ? (
        <Button size="medium" icon="reset" label={resetLabel} onClick={onReset} disabled={locked} className="mk-dpi-table__reset" />
      ) : null}
    </section>
  );
}
