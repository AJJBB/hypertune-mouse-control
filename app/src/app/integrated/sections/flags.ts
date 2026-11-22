// Which tab of the integrated (Figma v2) screens renders each capability card.
//
// This is the parity contract: every key of CardAvailability (the single gate
// that decides what a connected mouse can show) must be claimed by exactly one
// section, and that section MUST render it. sections-parity.test.ts fails if a
// flag is unclaimed or double-claimed, so a new driver capability can never be
// silently dropped from the integrated UI again.
//
// Placement follows Ivan's information architecture (hypertune-mouse-components.md,
// "Tab recipes"): sensor/DPI/polling on Performance, RGB on Lighting, remapping
// on Buttons, onboard + app profiles on Profiles, power/timing/brand extras on
// Advanced. Debounce lives on Advanced (as in the Advanced reference screen),
// not Buttons.
import type { CardAvailability } from "../../cards/availability.ts";

export type SectionId = "overview" | "performance" | "lighting" | "buttons" | "profiles" | "advanced" | "test";

/** Flags that are routing/meta gates rather than a card of their own. */
export const META_FLAGS: ReadonlyArray<keyof CardAvailability> = ["advancedHost"];

export const SECTION_FLAGS: Readonly<Record<SectionId, ReadonlyArray<keyof CardAvailability>>> = {
  overview: [],
  performance: [
    "dpi", "polling", "sensor", "lightforce", "processing",
    "ninjutsoSensor", "ninjutsoClick", "eggFilter", "eggPolling", "eggCpi", "powerMode",
  ],
  lighting: ["lighting", "lightingAdvanced", "teevolutionDpiLighting"],
  buttons: ["buttonMapping", "razerButtons", "mxMasterButtons", "atkButtons", "eggSpdt", "eggButtons", "superstrike"],
  profiles: ["profiles", "onboardProfiles", "keychronNapeLayers", "atkProfile", "pulsarPro"],
  advanced: ["signal", "sleep", "lowPower", "debounce", "finalmouse", "incott", "atkReceiver", "logitechDetails"],
  test: [],
};

/** Tab order is fixed by the brief: Overview, Performance, Lighting, Buttons, Profiles, Advanced, Mouse test. */
export const SECTION_ORDER: ReadonlyArray<{ id: SectionId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "performance", label: "Performance" },
  { id: "lighting", label: "Lighting" },
  { id: "buttons", label: "Buttons" },
  { id: "profiles", label: "Profiles" },
  { id: "advanced", label: "Advanced" },
  { id: "test", label: "Mouse test" },
];

/** Tab visibility from the availability flags. Overview, Performance, Profiles
    (the app-saved profile list is the fallback every mouse gets) and Mouse test
    always show; Lighting only for RGB mice; Buttons only when remapping is
    supported; Advanced only when there's something on it. `extraAdvanced` covers
    the MX Master detail cards, which are gated on reported fields, not a flag. */
export function sectionVisible(id: SectionId, has: CardAvailability, extraAdvanced = false): boolean {
  if (id === "overview" || id === "performance" || id === "profiles" || id === "test") return true;
  if (id === "advanced" && extraAdvanced) return true;
  return SECTION_FLAGS[id].some((flag) => has[flag]);
}
