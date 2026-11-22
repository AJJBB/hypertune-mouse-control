// Performance tab of the integrated device page (Figma v2 · Mouse Component System),
// after Ivan's "Performance / DPI" and "Performance / DPI stages" screens.
//
//   Left (500):  the product render with the DPI control docked at its foot —
//                a Readout tile stepping through DPI presets, or the DPI stage
//                table (stage mice / Logitech per-profile slots).
//   Right (665): Polling rate · Lift-off distance · Processing, then DPI
//                (presets, custom value, X / Y) and the brand extras.
//
// Parity contract (sections/flags.ts): dpi, polling, sensor, lightforce,
// processing, ninjutsoSensor, ninjutsoClick, eggFilter, eggPolling, eggCpi and
// powerMode each render their full control set here whenever they're true. The
// behaviour is ported from the web-shell cards (DpiCard, PerformanceCards,
// AdvancedCards): same control.* calls, gating and disabled/locked states, and
// every change still queues in the pending bar.
import type { ReactNode } from "react";
import type { ControlSnapshot } from "../../../device/types";
import { cardAvailability } from "../../cards/availability";
import { EmptyNote, MouseRender, SplitLayout } from "./layout";
import { DpiDock, DpiGroup } from "./performance/dpi";
import {
  EggCpiGroup, EggFilterGroup, EggPollingGroup, LightforceGroup, NinjutsoClickGroup, NinjutsoSensorGroup, PowerModeGroup,
} from "./performance/extras";
import { ProcessingGroup } from "./performance/processing";
import { LiftOffGroup, PollingGroup } from "./performance/sensor";
import "./performance.css";

export function PerformanceSection({ snapshot }: { snapshot: ControlSnapshot; onShareProfile?: () => void }): ReactNode {
  if (!snapshot.status) return null;
  const has = cardAvailability(snapshot);

  const left = (
    <div className="mk-perf-left">
      <MouseRender snapshot={snapshot} footer={has.dpi ? <DpiDock snapshot={snapshot} /> : undefined} />
    </div>
  );

  // Nothing for the right column yet (e.g. while the mouse's settings are still
  // being read, every ready-gated flag is false): say so quietly instead of a blank pane.
  const anyRight = has.polling || has.sensor || has.processing || (has.dpi && !snapshot.profile.slotsAvailable)
    || has.lightforce || has.ninjutsoSensor || has.ninjutsoClick || has.eggFilter || has.eggCpi
    || has.eggPolling || has.powerMode;

  // Order follows the reference screens (Polling rate, Lift-off distance,
  // Processing) and stays the same across mice where settings overlap. The
  // wrapper keeps every row at full height while the column scrolls (a bare
  // flex child of the scroll area would shrink, squashing the Segmented cards).
  const right = (
    <div className="mk-perf-right">
      {anyRight ? null : <EmptyNote>{snapshot.settingsPending ? "Reading this mouse's settings…" : "This mouse has no performance settings."}</EmptyNote>}
      {has.polling ? <PollingGroup snapshot={snapshot} /> : null}
      {has.sensor ? <LiftOffGroup snapshot={snapshot} /> : null}
      {has.processing ? <ProcessingGroup snapshot={snapshot} /> : null}
      {has.dpi ? <DpiGroup snapshot={snapshot} /> : null}
      {has.lightforce ? <LightforceGroup snapshot={snapshot} /> : null}
      {has.ninjutsoSensor ? <NinjutsoSensorGroup snapshot={snapshot} /> : null}
      {has.ninjutsoClick ? <NinjutsoClickGroup snapshot={snapshot} /> : null}
      {has.eggFilter ? <EggFilterGroup snapshot={snapshot} /> : null}
      {has.eggCpi ? <EggCpiGroup snapshot={snapshot} /> : null}
      {has.eggPolling ? <EggPollingGroup snapshot={snapshot} /> : null}
      {has.powerMode ? <PowerModeGroup snapshot={snapshot} /> : null}
    </div>
  );

  return <SplitLayout left={left} right={right} />;
}
