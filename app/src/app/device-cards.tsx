// Single source of truth for which configurable cards a connected device shows,
// grouped by section. BOTH UIs render from this:
//   - the standalone web shell (OverviewPage) merges Buttons into Advanced and
//     lays them out in its own grid;
//   - the integrated v2 shell (DeviceDetail) renders each group in its own tab.
//
// Keeping one builder is what guarantees the two designs expose the SAME control
// surface for every mouse. The v2 screens used to hand-reimplement a subset in
// their own styling and silently dropped every brand-specific card (Logitech
// wheel/SmartShift/Easy-Switch, Razer toggles, ATK, Endgame, Ninjutso,
// Finalmouse, Incott, DPI slots/stages, per-profile polling, native profiles,
// …) — this module ends that drift.

import type { ReactNode } from "react";
import type { ControlSnapshot } from "../device/types";
import { LogitechDetails } from "./Diagnostics";
import { KeychronNapeLayers } from "./KeychronNapeLayers";
import { Profiles } from "./Profiles";
import { SoftwareProfiles } from "./SoftwareProfiles";
import { Superstrike } from "./Superstrike";
import { DpiCard } from "./cards/DpiCard";
import { LightforceCard, PollingCard, SensorCard } from "./cards/PerformanceCards";
import { LightingCard } from "./cards/LightingCard";
import { MxMasterButtonsCard, MxMasterCards } from "./cards/MxMasterCards";
import { AtkButtonCard, AtkProfileCard, AtkReceiverCard } from "./cards/AtkCards";
import {
  DebounceCard,
  EggButtonCard,
  EggCpiCard,
  EggFilterCard,
  EggPollingCard,
  EggSpdtCard,
  FinalmouseCard,
  IncottCard,
  LowPowerCard,
  NinjutsoClickCard,
  NinjutsoSensorCard,
  ProcessingCard,
  RazerButtonCard,
  ButtonMappingCard,
  PowerModeCard,
  OnboardProfileCard,
  PulsarProCard,
  SignalCard,
  SleepCard,
  DpiLightingCard,
} from "./cards/AdvancedCards";
import { cardAvailability, hasNativeProfileManagement } from "./cards/availability";
import { TeevolutionProfileCard } from "./cards/teevolution/ProfileCard";

/**
 * The configurable cards for a device, split by section. `buttons` and
 * `advanced` are kept SEPARATE here (the web shell does its own Buttons→Advanced
 * merge for its single-tab layout; the integrated shell keeps them as distinct
 * tabs). Mouse Test is UI-only and not part of this set.
 */
export interface DeviceCardSets {
  performance: ReactNode[];
  lighting: ReactNode[];
  buttons: ReactNode[];
  profiles: ReactNode[];
  advanced: ReactNode[];
}

/** Build every configurable card for the connected device, grouped by section. */
export function deviceCards(snapshot: ControlSnapshot): DeviceCardSets {
  const status = snapshot.status;
  if (!status) return { performance: [], lighting: [], buttons: [], profiles: [], advanced: [] };
  const has = cardAvailability(snapshot);
  const powerOverview = status.ui?.powerOverview === true;

  const performance = [
    has.dpi ? <DpiCard key="dpi" snapshot={snapshot} /> : null,
    has.polling ? <PollingCard key="polling" snapshot={snapshot} /> : null,
    has.sensor ? <SensorCard key="sensor" snapshot={snapshot} /> : null,
    has.lightforce ? <LightforceCard key="lightforce" snapshot={snapshot} /> : null,
    has.ninjutsoSensor ? <NinjutsoSensorCard key="ninjutso-sensor" snapshot={snapshot} /> : null,
    has.ninjutsoClick ? <NinjutsoClickCard key="ninjutso-click" snapshot={snapshot} /> : null,
    has.processing ? <ProcessingCard key="processing" snapshot={snapshot} /> : null,
    has.eggFilter ? <EggFilterCard key="eggfilter" snapshot={snapshot} /> : null,
    has.eggPolling ? <EggPollingCard key="eggpolling" snapshot={snapshot} /> : null,
    has.eggCpi ? <EggCpiCard key="eggcpi" snapshot={snapshot} /> : null,
    has.powerMode ? <PowerModeCard key="power-mode" snapshot={snapshot} /> : null,
  ].filter((node) => node !== null);

  const lightingZones = status.lightingZones?.length ? status.lightingZones : status.lighting ? [status.lighting] : [];
  const lighting = [
    has.lighting ? <LightingCard key="lighting-main" snapshot={snapshot} variant="tab" zones={lightingZones} /> : null,
    !powerOverview && has.teevolutionDpiLighting ? <DpiLightingCard key="dpi-indicator" snapshot={snapshot} /> : null,
    has.lightingAdvanced ? <LightingCard key="lighting-advanced" snapshot={snapshot} variant="advanced" /> : null,
  ].filter((node) => node !== null);

  const buttons = [
    has.debounce ? <DebounceCard key="debounce" snapshot={snapshot} /> : null,
    has.eggSpdt ? <EggSpdtCard key="eggspdt" snapshot={snapshot} /> : null,
    has.eggButtons ? <EggButtonCard key="eggbuttons" snapshot={snapshot} /> : null,
    has.razerButtons ? <RazerButtonCard key="razerbuttons" snapshot={snapshot} /> : null,
    has.mxMasterButtons ? <MxMasterButtonsCard key="mxmaster-buttons" snapshot={snapshot} /> : null,
    has.atkButtons ? <AtkButtonCard key="atk-buttons" snapshot={snapshot} /> : null,
    has.buttonMapping && !snapshot.traits.teevolution
      ? <ButtonMappingCard key="button-mapping" snapshot={snapshot} /> : null,
    has.superstrike ? <Superstrike key="superstrike" snapshot={snapshot} /> : null,
  ].filter((node) => node !== null);

  const profiles: ReactNode[] = [
    has.profiles ? <Profiles key="profiles" snapshot={snapshot} /> : null,
    snapshot.traits.teevolution && has.onboardProfiles
      ? <TeevolutionProfileCard key="teevolution-profiles" snapshot={snapshot} /> : null,
    has.keychronNapeLayers ? <KeychronNapeLayers key="nape-layers" snapshot={snapshot} /> : null,
    has.atkProfile ? <AtkProfileCard key="atk-profile" snapshot={snapshot} /> : null,
    has.onboardProfiles && !snapshot.traits.teevolution
      ? <OnboardProfileCard key="onboard-profile" snapshot={snapshot} /> : null,
    has.pulsarPro ? <PulsarProCard key="pulsarpro" snapshot={snapshot} /> : null,
    // Fallback for devices with no real onboard-profile feature (base Pulsar
    // included): named presets the app remembers and re-applies, rather than
    // leaving the Profiles tab empty for these mice.
    !hasNativeProfileManagement(has) ? <SoftwareProfiles key="software-profiles" snapshot={snapshot} /> : null,
  ].filter((node) => node !== null);

  const showMxMaster = status.hapticIntensity != null || status.wheelMode != null
    || status.friendlyName != null || status.hostCount != null;

  const advanced = [
    has.signal ? <SignalCard key="signal" snapshot={snapshot} /> : null,
    !powerOverview && has.sleep ? <SleepCard key="sleep" snapshot={snapshot} /> : null,
    has.lowPower ? <LowPowerCard key="lowpower" snapshot={snapshot} /> : null,
    has.finalmouse ? <FinalmouseCard key="finalmouse" snapshot={snapshot} /> : null,
    has.incott ? <IncottCard key="incott" snapshot={snapshot} /> : null,
    has.atkReceiver ? <AtkReceiverCard key="atk-receiver" snapshot={snapshot} /> : null,
    has.logitechDetails ? <LogitechDetails key="logitech-details" snapshot={snapshot} /> : null,
    showMxMaster ? <MxMasterCards key="mxmaster-details" snapshot={snapshot} /> : null,
  ].filter((node) => node !== null);

  return { performance, lighting, buttons, profiles, advanced };
}
