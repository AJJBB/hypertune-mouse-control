import type { MouseStatus } from "@openmouse/protocol/drivers/mouse-types";

export interface DriverTraits {
  advancedSection: boolean;
  signal: boolean;
  sleep: boolean;
  debounce: boolean;
  eggControls: boolean;
  eggFamily: boolean;
  directMode: boolean;
  ninjutso: boolean;
  teevolution: boolean;
  finalmouse: boolean;
  logitech: boolean;
}

const NONE: DriverTraits = {
  advancedSection: false,
  signal: false,
  sleep: false,
  debounce: false,
  eggControls: false,
  eggFamily: false,
  directMode: false,
  ninjutso: false,
  teevolution: false,
  finalmouse: false,
  logitech: false,
};

const SHARED_ADVANCED = { advancedSection: true, signal: true, sleep: true, debounce: true } as const;
const DIRECT_MODE = { advancedSection: true, sleep: true, debounce: true, directMode: true } as const;

const BY_FAMILY: Readonly<Record<string, Partial<DriverTraits>>> = {
  "logitech-hidpp": { logitech: true },
  "egg-op1": { advancedSection: true, eggControls: true, eggFamily: true },
  "egg-we": { eggFamily: true },
  "finalmouse-ulx": { advancedSection: true, finalmouse: true },
  pulsar: SHARED_ADVANCED,
  teevolution: { ...SHARED_ADVANCED, teevolution: true },
  vgn: SHARED_ADVANCED,
  // The only VGN driver reports ui.family "vgn-f2", which takes precedence over
  // the BY_BRAND "vgn" fallback, so it needs its own entry or the F2 Master+
  // shows no advanced section at all.
  "vgn-f2": SHARED_ADVANCED,
  wlmouse: DIRECT_MODE,
  // Beast X 4K reports ui.family "wlmouse-4k" (not the base "wlmouse") and backs
  // the same direct-mode debounce/sleep/motion-sync setters.
  "wlmouse-4k": DIRECT_MODE,
  lamzu: DIRECT_MODE,
  // The Atlantis driver reports its own family and reads/writes debounce + sleep
  // over its vendor protocol (not the CompX direct-mode transport).
  "lamzu-atlantis": { advancedSection: true, sleep: true, debounce: true },
  // Vendor-protocol drivers that set ui.showAdvancedSection but were missing
  // from BY_FAMILY, so their Debounce/Sleep cards never rendered despite working
  // setters. Each carries only the flags it actually backs.
  motospeed: { advancedSection: true, sleep: true, debounce: true },
  "glorious-core2": { advancedSection: true, debounce: true },
  "cooler master": { advancedSection: true, debounce: true },
  asus: { advancedSection: true, debounce: true },
  hitscan: { advancedSection: true, debounce: true },
  ajazz: { advancedSection: true, sleep: true },
  "ajazz-ak820": { advancedSection: true, sleep: true },
  ksnake: { advancedSection: true, sleep: true },
  "steelseries-aerox3-wireless": { advancedSection: true, sleep: true },
  "attack-shark": DIRECT_MODE,
  crdrako: DIRECT_MODE,
  // Orbital reports brand "Orbital" with no ui.family and no showAdvancedSection,
  // but its driver reads/writes motion-sync, debounce and sleep. Without this
  // entry familyOf() resolves to "orbital", traits=NONE, host stays false, and
  // its Processing / Debounce / Sleep cards never render on EITHER shell.
  orbital: { advancedSection: true, sleep: true, debounce: true },
  atk: DIRECT_MODE,
  "atk-bitmouse": DIRECT_MODE,
  ninjutso: { ...DIRECT_MODE, ninjutso: true },
  "keychron-nape": { advancedSection: true, sleep: true, directMode: true },
  // Keychron M-series drivers emit these families (never "keychron-m6", which no
  // driver ever reported). The 8k / 8k-nordic read debounce AND sleep from their
  // status report; the 4k / 1k report debounce only. Each publishes its own
  // option lists, so plain flags rather than DIRECT_MODE.
  "keychron-8k": { advancedSection: true, sleep: true, debounce: true },
  "keychron-8k-nordic": { advancedSection: true, sleep: true, debounce: true },
  "keychron-4k": { advancedSection: true, debounce: true },
  "keychron-1k": { advancedSection: true, debounce: true },
  fantech: { advancedSection: true, sleep: true, directMode: true },
  // GearHub-V5 (Attack Shark R2, Lingbao M5 Pro): reads debounce, standby time
  // and the two "move correction" toggles out of its OPTIONPARAM0 block. Not a
  // CompX direct-mode driver — it publishes its own debounce/sleep option
  // lists, so it takes the plain flags.
  gearhub: { advancedSection: true, sleep: true, debounce: true },
  // MCHOSE reads debounce and sleep from its config blob and writes both, but
  // it is not a direct-mode (CompX) driver, so it takes the plain flags.
  mchose: { advancedSection: true, sleep: true, debounce: true },
  "mchose-a5-gen1": { advancedSection: true, sleep: true, debounce: true },
  // MCHOSE v3 has grown verified setSleepTimeout/setDebounceTime, so it now takes
  // the same flags as `mchose`.
  "mchose-v3": { advancedSection: true, sleep: true, debounce: true },
  dareu: { advancedSection: true, sleep: true },
  // Incott supports a 0-30 ms debounce and a 1-900 s sleep timer over its own
  // vendor protocol, not the CompX direct-mode transport, so it takes the
  // plain flags rather than DIRECT_MODE (its advancedSection already comes
  // from ui.showAdvancedSection, but sleep/debounce still need the flags
  // here or the cards never render regardless of applyPulsarValue's list).
  incott: { advancedSection: true, sleep: true, debounce: true },
  // HyperX publishes DPI, polling rate and lift-off in the settings grid only;
  // no signal, sleep or debounce card exists, and the processing card is
  // deliberately hidden, so no advanced-section flags are needed.
  hyperx: {},
};

const BY_BRAND: Readonly<Record<string, string>> = {
  Teevolution: "teevolution",
  Orbital: "orbital",
  Pulsar: "pulsar",
  VGN: "vgn",
  Logitech: "logitech-hidpp",
  "Attack Shark": "attack-shark",
};

export function familyOf(status: MouseStatus): string {
  return status.ui?.family ?? BY_BRAND[status.brand] ?? status.brand.toLowerCase();
}

export function traitsFor(status: MouseStatus | null): DriverTraits {
  if (!status) return NONE;
  const family = familyOf(status);
  const ui = status.ui;
  const traits = { ...NONE, ...BY_FAMILY[family] };
  return {
    ...traits,
    advancedSection: traits.advancedSection || ui?.showAdvancedSection === true,
    signal: traits.signal && ui?.hideSignalCard !== true,
    sleep: traits.sleep && ui?.hideSleepCard !== true,
    eggControls: traits.eggControls
      || (status.brand === "Endgame Gear" && Array.isArray(status.eggCpiStages)),
  };
}

export function isPulsarProProtocol(status: MouseStatus): boolean {
  return status.connectionDetail?.includes("Pulsar Pro protocol") === true;
}
