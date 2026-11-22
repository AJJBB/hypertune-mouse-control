// Profiles tab of the integrated device page (Figma v2 · Mouse Component System).
//
// Two screens, as in Ivan's references:
//  - mice with onboard memory → "Profiles (onboard cards)": Profile cards across
//    the full 1190 width (up to 4 per row), the opened profile's editor below;
//  - mice without → "Profiles (in app)": product render | Current Settings with
//    Save Current, then the Saved Profiles list (app-saved, re-applied on pick).
//
// Flags rendered here (sections/flags.ts): profiles (Logitech onboard / host
// editor), onboardProfiles (generic numbered profiles; Teevolution banks + their
// button map), keychronNapeLayers, atkProfile, pulsarPro — plus the app-saved
// fallback whenever none of them applies (hasNativeProfileManagement).
// Same order as device-cards.tsx when a mouse has more than one.
import type { ReactNode } from "react";
import type { ControlSnapshot } from "../../../device/types";
import { cardAvailability, hasNativeProfileManagement } from "../../cards/availability";
import { FullLayout } from "./layout";
import { AppProfiles } from "./profiles/AppProfiles";
import { AtkBanks, OnboardBanks } from "./profiles/BankProfiles";
import { LogitechProfiles } from "./profiles/LogitechProfiles";
import { NapeLayers } from "./profiles/NapeLayers";
import { PulsarPro } from "./profiles/PulsarPro";
import "./profiles.css";

export function ProfilesSection({ snapshot }: { snapshot: ControlSnapshot; onShareProfile?: () => void }): ReactNode {
  const has = cardAvailability(snapshot);
  if (!hasNativeProfileManagement(has)) return <AppProfiles snapshot={snapshot} />;
  const teevolution = snapshot.traits.teevolution;
  return (
    <FullLayout>
      <div className="mk-pf-onboard">
        {has.profiles ? <LogitechProfiles snapshot={snapshot} /> : null}
        {has.onboardProfiles && teevolution ? <OnboardBanks snapshot={snapshot} buttons /> : null}
        {has.keychronNapeLayers ? <NapeLayers snapshot={snapshot} /> : null}
        {has.atkProfile ? <AtkBanks snapshot={snapshot} /> : null}
        {has.onboardProfiles && !teevolution ? <OnboardBanks snapshot={snapshot} buttons={false} /> : null}
        {has.pulsarPro ? <PulsarPro snapshot={snapshot} /> : null}
      </div>
    </FullLayout>
  );
}
