// Integrated pending-changes bar (brief #12 — not in Ivan's library yet, so it
// is composed from kit parts): a status pill with the count, the staged
// changes' summary, and Revert (neutral) / Apply changes (primary) Buttons.
// States: pending → applying (progress text, buttons locked) → done ("Changes
// applied", fades after a moment) or error (the failure, changes kept staged).
// The web shell keeps its own bar (PendingBar.tsx); this renders under `.mk`.
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as control from "../../device/controller";
import type { ControlSnapshot } from "../../device/types";
import { t } from "../../i18n";
import { Button, Icon, StatusPill } from "./kit";
import "./kit/tokens.css";
import "./home.css";

const DONE_MS = 2600;

export function PendingBarV2({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const { pending } = snapshot;
  const locale = snapshot.preferences.locale;
  const busy = pending.busy;
  const [done, setDone] = useState(false);
  const wasBusy = useRef(busy);
  const timer = useRef<number | null>(null);

  // busy → idle with nothing left staged and no failure = the apply landed.
  useEffect(() => {
    if (wasBusy.current && !busy && pending.count === 0 && pending.statusText === null) {
      setDone(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => { setDone(false); timer.current = null; }, DONE_MS);
    }
    wasBusy.current = busy;
  }, [busy, pending.count, pending.statusText]);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  if (pending.suppressed) return null;
  const hasChanges = pending.count > 0;
  if (!hasChanges && !busy && !done) return null;

  const failed = !busy && hasChanges && pending.statusText !== null;
  const state = busy ? "applying" : hasChanges ? (failed ? "error" : "pending") : "done";
  const countLabel = pending.count === 1 ? t(locale, "pend.one") : `${pending.count} ${t(locale, "pend.many")}`;

  let pill: ReactNode;
  let detail: string | null;
  if (state === "applying") {
    pill = <StatusPill type="neutral" label={t(locale, "pend.applying")} icon={<span className="mk-pending__spinner" />} />;
    detail = pending.statusText ?? (pending.labels.length ? pending.labels.join(" · ") : null);
  } else if (state === "done") {
    pill = <StatusPill type="active" label="Changes applied" />;
    detail = "Saved to your mouse.";
  } else if (state === "error") {
    pill = <StatusPill type="error" label="Couldn’t apply" />;
    detail = pending.statusText;
  } else {
    pill = <StatusPill type="warning" label={countLabel} />;
    detail = pending.labels.length ? pending.labels.join(" · ") : null;
  }

  return (
    <div
      id="pending-changes-bar"
      className={`mk-pending is-${state}`}
      role="region"
      aria-label={t(locale, "pend.region")}
    >
      <div className="mk-pending__status" aria-live="polite">
        {pill}
        {detail ? <span className="mk-pending__detail mk-t-body14" title={detail}>{detail}</span> : null}
      </div>
      {state === "done" ? (
        <span className="mk-pending__done-icon" aria-hidden="true"><Icon name="check" size={20} /></span>
      ) : (
        <div className="mk-pending__actions">
          <Button
            label={t(locale, "pend.revert")}
            size="medium"
            variant="neutral"
            disabled={busy}
            onClick={control.revertPendingChanges}
          />
          <Button
            label={busy ? t(locale, "pend.applying") : state === "error" ? "Try again" : t(locale, "pend.apply")}
            size="medium"
            variant="primary"
            icon="check"
            showIcon={!busy}
            disabled={busy}
            onClick={() => void control.flashPendingChanges()}
          />
        </div>
      )}
    </div>
  );
}
