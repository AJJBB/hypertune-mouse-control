// Logitech onboard keyboard-shortcut / sequence recorder — the logic of the
// recorder dialog in app/Profiles.tsx, ported unchanged (same key capture,
// modifier mask, inter-key delays, control.* calls). The macro / shortcut
// recorder isn't in the Mouse Component System yet (it's being redesigned), so
// this presents the existing flow as plainly as possible with kit Buttons on a
// modal card — awaiting Ivan's design.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as control from "../../../../device/controller";
import type { InterfaceLocale } from "../../../../interface-preferences";
import { t } from "../../../../i18n";
import { hidKeyForCode, shortcutLabel } from "../../../hid-keys";
import { Button, trapTab } from "../../kit";

export interface RecorderTarget { layer: "primary" | "g-shift"; button: number; name: string }

interface Step { key: number; modifiers: number; label: string; delayMs: number }

export function ShortcutRecorder({ target, locale, onClose }: { target: RecorderTarget; locale: InterfaceLocale; onClose: () => void }): ReactNode {
  const [steps, setSteps] = useState<Step[]>([]);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const lastAt = useRef(0);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Focus the dialog on open (it captures keys); give focus back on close.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    return () => { before?.focus?.({ preventScroll: true }); };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!recording) {
      if (event.key === "Escape") onClose();
      else if (event.key === "Tab" && panel.current) trapTab(event, panel.current);
      return;
    }
    event.preventDefault(); event.stopPropagation();
    if (event.key === "Escape" && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
      setRecording(false);
      setError("");
      return;
    }
    if (event.repeat || ["Control", "Shift", "Alt", "Meta"].includes(event.key)) return;
    const key = hidKeyForCode(event.code);
    if (key === null) {
      setError(`${event.key} cannot be stored by this mouse.`);
      return;
    }
    const modifiers = (event.ctrlKey ? 0x01 : 0) | (event.shiftKey ? 0x02 : 0)
      | (event.altKey ? 0x04 : 0) | (event.metaKey ? 0x08 : 0);
    const now = performance.now();
    const label = shortcutLabel(event);
    setSteps((prev) => [...prev, {
      key, modifiers, label,
      delayMs: prev.length === 0 ? 0 : Math.min(9999, Math.round(now - lastAt.current)),
    }]);
    lastAt.current = now;
    setError("");
  };

  const toggleRecording = (): void => {
    if (recording) {
      setRecording(false);
    } else {
      setSteps([]);
      setError("");
      lastAt.current = performance.now();
      setRecording(true);
    }
  };

  const assign = (): void => {
    const first = steps[0];
    if (!first) return;
    if (steps.length === 1) {
      control.applyLogitechKeyboardShortcut(target.layer, target.button, first.key, first.modifiers);
    } else {
      void control.applyLogitechKeyboardSequence(target.layer, target.button,
        steps.map(({ key, modifiers, delayMs }) => ({ key, modifiers, delayMs })));
    }
    onClose();
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="mk mk-pf-modal-layer" role="presentation"
      onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div ref={panel} className="mk-pf-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}
        tabIndex={0} onKeyDown={onKeyDown}>
        <div className="mk-pf-modal__head">
          <span className="mk-pf-modal__kicker mk-t-caption12m">{target.name}</span>
          <h3 id={titleId} className="mk-pf-modal__title mk-t-heading18">{t(locale, "prof.recordTitle")}</h3>
          <p className="mk-pf-modal__body mk-t-body14">{t(locale, "prof.recordBody")}</p>
        </div>
        <Button size="medium" icon={recording ? "stop" : "record"} variant={recording ? "primary" : "neutral"}
          label={recording ? t(locale, "prof.stopRec") : t(locale, "prof.record")} onClick={toggleRecording}
          className="mk-pf-modal__record" />
        <div className={`mk-pf-capture${steps.length ? " has-value" : ""}${recording ? " is-recording" : ""}`} aria-live="polite">
          {steps.length ? (
            <ol className="mk-pf-capture__steps">
              {steps.map((step, index) => (
                <li key={`${step.label}-${index}`} className="mk-pf-capture__step">
                  {index > 0 && step.delayMs > 0 ? <span className="mk-pf-capture__delay mk-t-caption12">{step.delayMs} ms</span> : null}
                  <kbd className="mk-pf-kbd mk-t-label14">{step.label}</kbd>
                </li>
              ))}
            </ol>
          ) : (
            <span className="mk-pf-capture__empty mk-t-body14">{recording ? t(locale, "prof.listening") : t(locale, "prof.nothingRec")}</span>
          )}
        </div>
        {error ? <p className="mk-pf-modal__error mk-t-caption12" role="alert">{error}</p> : null}
        {steps.length > 1 ? <p className="mk-pf-modal__note mk-t-caption12">{t(locale, "prof.macroNote")}</p> : null}
        <div className="mk-pf-modal__actions">
          <Button size="medium" label={t(locale, "common.cancel")} onClick={onClose} />
          <Button size="medium" variant="primary" disabled={recording || steps.length === 0}
            label={steps.length > 1 ? t(locale, "prof.assignSeq") : t(locale, "prof.assignShortcut")} onClick={assign} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
