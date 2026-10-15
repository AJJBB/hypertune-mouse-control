import assert from "node:assert/strict";
import test from "node:test";

import { batteryStateText, connectLabelText, t, tp } from "./i18n.ts";

test("i18n resolves English keys directly", () => {
  assert.equal(t("en", "tab.overview"), "Overview");
  assert.ok(t("en", "set.copyKey").length > 0);
  assert.equal(t("en", "panel.shareProfile"), "Share profile");
});

test("i18n maps known battery states and passes unknown ones through", () => {
  assert.equal(batteryStateText("en", "Discharging"), "Discharging");
  assert.equal(batteryStateText("en", "SomeFutureState"), "SomeFutureState");
});

test("i18n maps known connect labels and passes dynamic ones through", () => {
  assert.equal(connectLabelText("en", "Add device"), "Add device");
  assert.equal(connectLabelText("en", "Use Add device if lost"), "Use Add device if lost");
});

test("tp renders provided placeholders and blanks missing ones", () => {
  assert.equal(tp("en", "dpi.slotX", { n: 2 }), "Slot 2 X DPI");
  assert.equal(tp("en", "dpi.slotX", {}), "Slot  X DPI");
});
