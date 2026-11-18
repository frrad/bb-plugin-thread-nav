import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { installSnoozeRowAction } from "./snooze-row-action.ts";

for (const initial of [["bb--core/archive"], [], ["thread-nav/snooze", "bb--core/archive"], ["one", "two", "three"]]) {
  test(`Snooze setup preserves actions and respects later edits: ${JSON.stringify(initial)}`, async () => {
    let actions = [...initial];
    let writes = 0;
    const { bb, harness } = createFakePluginHost({ pluginId: "thread-nav", sdk: { plugins: {
      callRpc: async ({ method, input }) => {
        if (method === "listPreferences") return { preferences: { rowActions: actions } };
        actions = (input as { value: string[] }).value;
        writes++;
        return { key: "rowActions", value: actions };
      },
    } } });
    try {
      await installSnoozeRowAction(bb);
      const shouldAdd = initial.length < 3 && !initial.includes("thread-nav/snooze");
      assert.deepEqual(actions, shouldAdd ? ["thread-nav/snooze", ...initial] : initial);
      assert.equal(writes, shouldAdd ? 1 : 0);
      actions = ["bb--core/archive"];
      await installSnoozeRowAction(bb);
      assert.deepEqual(actions, ["bb--core/archive"]);
      assert.equal(writes, shouldAdd ? 1 : 0);
    } finally { await harness.lifecycle.dispose(); }
  });
}

test("unavailable Thread List does not fail setup and retries next time", async () => {
  let available = false;
  let writes = 0;
  const { bb, harness } = createFakePluginHost({ pluginId: "thread-nav", sdk: { plugins: {
    callRpc: async ({ method }) => {
      if (!available) throw new Error("disabled");
      if (method === "listPreferences") return { preferences: { rowActions: ["bb--core/archive"] } };
      writes++;
      return { key: "rowActions", value: ["thread-nav/snooze", "bb--core/archive"] };
    },
  } } });
  try {
    await installSnoozeRowAction(bb);
    available = true;
    await installSnoozeRowAction(bb);
    assert.equal(writes, 1);
  } finally { await harness.lifecycle.dispose(); }
});
