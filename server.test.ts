import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakePluginHost, makeHostResponse } from "@get-bb/plugin-sdk/testing";
import plugin from "./server.ts";

test("machine settings persist across reloads, preserve other machines and reset", async () => {
  let { bb, harness } = createFakePluginHost({
    pluginId: "thread-nav",
    sdk: { hosts: { list: async () => [makeHostResponse({ id: "host-one", name: "Offline machine", status: "disconnected" })] } },
  });
  try {
    await plugin(bb);
    const call = (method: string, input: unknown = null) => harness.behavior.callRpc(method, input);
    assert.deepEqual(await call("emojis_get"), {});
    assert.deepEqual(await call("machines_list"), [{ id: "host-one", name: "Offline machine" }]);
    await call("emoji_set", { hostId: "host-one", emoji: " 🦋 " });
    await call("emoji_set", { hostId: "host-two", emoji: "" });
    assert.deepEqual(await call("emojis_get"), { "host-one": "🦋", "host-two": "" });
    ({ bb, harness } = await harness.lifecycle.reload(plugin));
    assert.deepEqual(await call("emojis_get"), { "host-one": "🦋", "host-two": "" });
    await call("emoji_set", { hostId: "host-one", emoji: null });
    assert.deepEqual(await call("emojis_get"), { "host-two": "" });
    await assert.rejects(call("emoji_set", { hostId: "host-one", emoji: "x".repeat(33) }));
    await assert.rejects(call("emoji_set", { hostId: "host-one", emoji: "line\nbreak" }));
    assert.deepEqual(await call("emojis_get"), { "host-two": "" });
  } finally { await harness.lifecycle.dispose(); }
});
