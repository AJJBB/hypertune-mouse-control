// Guards the integrated (Figma v2) screens against silently dropping a mouse
// setting: every capability flag must belong to exactly one tab.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SECTION_FLAGS, META_FLAGS, sectionVisible } from "./flags.ts";
import { cardAvailability } from "../../cards/availability.ts";

test("every capability flag is rendered by exactly one integrated tab", () => {
  // cardAvailability on a null status returns the full key set (all false).
  const keys = Object.keys(cardAvailability({ status: null } as never)).sort();
  const claimed = Object.values(SECTION_FLAGS).flat();
  const counts = new Map<string, number>();
  for (const flag of claimed) counts.set(flag, (counts.get(flag) ?? 0) + 1);
  const missing = keys.filter((k) => !counts.has(k) && !META_FLAGS.includes(k as never));
  const doubled = [...counts].filter(([, n]) => n > 1).map(([k]) => k);
  const unknown = claimed.filter((k) => !keys.includes(k));
  assert.deepEqual(missing, [], `unclaimed capability flags: ${missing.join(", ")}`);
  assert.deepEqual(doubled, [], `flags claimed by more than one tab: ${doubled.join(", ")}`);
  assert.deepEqual(unknown, [], `claimed flags that don't exist: ${unknown.join(", ")}`);
});

test("tabs with nothing to show stay hidden; the always-on tabs always show", () => {
  const none = cardAvailability({ status: null } as never);
  assert.equal(sectionVisible("lighting", none), false);
  assert.equal(sectionVisible("buttons", none), false);
  assert.equal(sectionVisible("advanced", none), false);
  assert.equal(sectionVisible("advanced", none, true), true);
  for (const id of ["overview", "performance", "profiles", "test"] as const) assert.equal(sectionVisible(id, none), true);
  assert.equal(sectionVisible("lighting", { ...none, lighting: true }), true);
  assert.equal(sectionVisible("buttons", { ...none, debounce: true }), false, "debounce alone must not open a Buttons tab");
});
