// Guards the control-surface parity the integrated (?app=1) v2 UI relies on.
//
// The v2 screens render the shared `deviceCards` surface, which is driven by
// `cardAvailability` plus a few status-field gates. `deviceCards` itself is JSX
// and can't be imported into the native-type-stripping test runner, so these
// tests pin the DATA the integrated screens key off — the flags and fields that
// decide whether a tab has content — for the brand shapes that were silently
// dropped before. The regression they exist to catch is the one just fixed: a
// whole brand family (Logitech especially) landing on an Advanced / Buttons /
// Profiles tab that wrongly reads "no settings".

import assert from "node:assert/strict";
import { test } from "node:test";
import { cardAvailability } from "./cards/availability.ts";
import { traitsFor } from "../device/traits.ts";
import type { ControlSnapshot } from "../device/types.ts";
import type { MouseStatus } from "@openmouse/protocol/drivers/mouse-types";

function snapshot(status: Partial<MouseStatus>, buttons?: ControlSnapshot["buttons"]): ControlSnapshot {
  const full: MouseStatus = {
    brand: "Generic",
    name: "Test mouse",
    batteryPercent: 50,
    batteryState: "Discharging",
    dpi: 800,
    pollingRateHz: 1000,
    firmware: [],
    ...status,
  } as MouseStatus;
  return {
    status: full,
    deviceStatus: full,
    traits: traitsFor(full),
    capabilities: null,
    settingsPending: false,
    buttons: buttons ?? null,
    preferences: { showExperimental: true, locale: "en" },
  } as unknown as ControlSnapshot;
}

/** A Logitech reprogrammable control, enough for the Buttons gate. */
const MX_CONTROL = {
  controlId: 0x00c3, taskId: 0x009c, flags: 0x31, group: 2, groupMask: 3,
  name: "Gesture button", taskName: "Gesture button", reprogrammable: true,
  mappedTo: 0x00c3, diverted: false, remappableTo: [0x0052], remapFlags: 0,
} as unknown as NonNullable<ControlSnapshot["buttons"]>[number];

/** Mirrors the `showMxMaster` gate in deviceCards.tsx — the MagSpeed /
    Easy-Switch / friendly-name advanced card. Kept in sync with that file. */
function showsMxMasterAdvanced(status: Partial<MouseStatus>): boolean {
  const s = status as MouseStatus;
  return s.hapticIntensity != null || s.wheelMode != null
    || s.friendlyName != null || s.hostCount != null;
}

test("a Logitech MX Master is not an empty shell — Buttons and Advanced have content", () => {
  // The exact bug: the integrated Advanced tab read "This mouse has no advanced
  // settings" for a Logitech mouse while OpenMouse showed the full surface.
  const status: Partial<MouseStatus> = {
    brand: "Logitech",
    name: "MX Master 3S",
    ui: { family: "logitech-hidpp" },
    wheelMode: "Ratchet",
    smartShiftThreshold: 50,
    hiResScroll: true,
    friendlyName: "MX Master 3S",
    friendlyNameMaxLength: 16,
    hostCount: 3,
    currentHost: 0,
  };
  const has = cardAvailability(snapshot(status, [MX_CONTROL]));
  assert.equal(has.mxMasterButtons, true, "must expose remappable buttons");
  assert.equal(has.logitechDetails, true, "must expose the Logitech details card");
  assert.equal(showsMxMasterAdvanced(status), true, "must populate the MagSpeed / Easy-Switch advanced card");
});

test("a Logitech mouse with onboard RGB keeps its Lighting and Profiles tabs", () => {
  const has = cardAvailability(snapshot({
    brand: "Logitech",
    ui: { family: "logitech-hidpp" },
    deviceMode: "Onboard",
    lighting: { zone: "Primary", modes: ["Static"], mode: "Static", colorModes: ["Static"], dualColorModes: [], reactiveModes: [], speeds: [], color: "#fff", color2: null } as never,
  }));
  assert.equal(has.lighting, true, "must expose the lighting card");
  assert.equal(has.profiles, true, "must expose the onboard-profile editor");
});

test("each brand family's defining cards survive the integrated screens", () => {
  // Razer buttons.
  assert.equal(cardAvailability(snapshot({
    brand: "Razer", razerButtonMappings: { leftClick: "Left Click" } as never,
  })).razerButtons, true);

  // Endgame Gear performance/buttons surface.
  const egg = cardAvailability(snapshot({
    brand: "Endgame Gear", ui: { family: "egg-op1" },
    leftSpdtMode: "GX Speed", rightSpdtMode: "GX Safe", eggCpiStages: [] as never,
  }));
  assert.equal(egg.eggSpdt, true);
  assert.equal(egg.eggCpi, true);
  assert.equal(egg.eggFilter, true);

  // Generic brand-agnostic remap (Pulsar Pro / Teevolution shape).
  assert.equal(cardAvailability(snapshot({
    brand: "Pulsar", ui: { family: "pulsar" },
    buttonMappings: { Left: "Left click" } as never, buttonOptions: ["Left click", "Disabled"],
  })).buttonMapping, true);

  // Keychron NAPE layers on the Profiles tab.
  assert.equal(cardAvailability(snapshot({
    brand: "Keychron", ui: { family: "keychron-nape", showAdvancedSection: true },
    napeLayer: 1, napeLayerCount: 8, sleepTimeout: 600,
  })).keychronNapeLayers, true);

  // Finalmouse / Ninjutso advanced device cards.
  assert.equal(cardAvailability(snapshot({
    brand: "Finalmouse", ui: { family: "finalmouse-ulx" }, finalmouseDongleLedMode: 1,
  })).finalmouse, true);
  assert.equal(cardAvailability(snapshot({
    brand: "Ninjutso", ui: { family: "ninjutso", showAdvancedSection: true },
    ninjutsoSystemMode: "Competitive", ninjutsoSystemModes: ["High Speed", "Competitive", "Ultra"],
  })).ninjutsoSensor, true);
});
