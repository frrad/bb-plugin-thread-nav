import { test } from "node:test";
import assert from "node:assert/strict";
import { machineEmoji, defaultMachineEmoji, cssString, markerPair, modelKey, modelEmoji } from "./emojis.ts";

test("overrides follow machine IDs across renames and blank overrides hide markers", () => {
  const machine = { id: "host-one", name: "lemur" };
  assert.equal(machineEmoji(machine, {}), "🐒");
  assert.equal(machineEmoji(machine, { "host-one": "🦋" }), "🦋");
  assert.equal(machineEmoji({ ...machine, name: "renamed" }, { "host-one": "🦋" }), "🦋");
  assert.equal(machineEmoji(machine, { "host-one": "" }), null);
  assert.equal(machineEmoji(null, { "host-one": "🦋" }), null);
  assert.equal(defaultMachineEmoji({ id: "host-two", name: "RHINO" }), "🦏");
  assert.equal(defaultMachineEmoji({ id: "host-three", name: "My MacBook Air" }), "💻");
});

test("custom marker text is safely encoded for CSS content", () => {
  assert.equal(cssString('"; } body { display:none } /*'), '"\\22 \\3b \\20 \\7d \\20 \\62 \\6f \\64 \\79 \\20 \\7b \\20 \\64 \\69 \\73 \\70 \\6c \\61 \\79 \\3a \\6e \\6f \\6e \\65 \\20 \\7d \\20 \\2f \\2a "');
  assert.equal(cssString("🐒\n"), '"\\1f412 \\a "');
});

test("marker positions are unambiguous in all four combinations", () => {
  assert.deepEqual(markerPair("🐒", "☀️"), ["🐒", "☀️"]);
  assert.deepEqual(markerPair("🐒", null), ["🐒", "·"]);
  assert.deepEqual(markerPair(null, "☀️"), ["·", "☀️"]);
  assert.equal(markerPair(null, null), null);
});

test("model markers match exact provider and model without family collisions", () => {
  const overrides = { [modelKey({ providerId: "codex", model: "sol" })]: "☀️" };
  assert.equal(modelEmoji({ providerId: "codex", model: "sol" }, overrides), "☀️");
  assert.equal(modelEmoji({ providerId: "other", model: "sol" }, overrides), null);
  assert.equal(modelEmoji({ providerId: "codex", model: "sol-next" }, overrides), null);
  assert.equal(modelEmoji(undefined, overrides), null);
});
