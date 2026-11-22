// Buttons tab of the integrated device page (Figma v2 · "Mouse - Buttons - Less fun", the list
// layout): the product render on the left; on the right the Button Remapping list (Section
// header with count + Reset to default, one Remap row per button), then any brand extras.
//
// Flags owned here (sections/flags.ts) and where each renders:
//   buttonMapping   → GenericRemap      razerButtons → RazerRemap     mxMasterButtons → MxRemap
//   atkButtons      → AtkAssignments    eggButtons   → EggRemap + EggMulticlick
//   eggSpdt         → EggGxMode         superstrike  → HitsTuning
// Order matches across mice: the remap list first, then per-button extras, then tuning.
import type { ReactNode } from "react";
import type { ControlSnapshot } from "../../../device/types";
import { cardAvailability } from "../../cards/availability";
import { EmptyNote, MouseRender, SplitLayout } from "./layout";
import { AtkAssignments, EggRemap, GenericRemap, MxRemap, RazerRemap } from "./buttons/remap";
import { EggGxMode, EggMulticlick } from "./buttons/endgame";
import { HitsTuning } from "./buttons/hits";
import "./buttons.css";

export function ButtonsSection({ snapshot }: { snapshot: ControlSnapshot; onShareProfile?: () => void }): ReactNode {
  const has = cardAvailability(snapshot);
  const groups = [
    // Teevolution: v1 shows this list inside its onboard-profile card; here it lives on Buttons so the
    // remaps survive whatever the Profiles tab shows (same control calls, same staged keys).
    has.buttonMapping ? <GenericRemap key="button-mapping" snapshot={snapshot} /> : null,
    has.razerButtons ? <RazerRemap key="razer-buttons" snapshot={snapshot} /> : null,
    has.mxMasterButtons ? <MxRemap key="mx-buttons" snapshot={snapshot} /> : null,
    has.atkButtons ? <AtkAssignments key="atk-buttons" snapshot={snapshot} /> : null,
    has.eggButtons ? <EggRemap key="egg-mapping" snapshot={snapshot} /> : null,
    has.eggSpdt ? <EggGxMode key="egg-gx" snapshot={snapshot} /> : null,
    has.eggButtons ? <EggMulticlick key="egg-multiclick" snapshot={snapshot} /> : null,
    has.superstrike ? <HitsTuning key="hits" snapshot={snapshot} /> : null,
  ].filter((node) => node !== null);
  return (
    <SplitLayout
      left={<MouseRender snapshot={snapshot} />}
      right={groups.length > 0 ? groups : <EmptyNote>This mouse doesn’t report remappable buttons.</EmptyNote>}
    />
  );
}
