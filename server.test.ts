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

test("model settings persist independently, reject invalid input, and survive missing catalogs", async () => {
  let { bb, harness } = createFakePluginHost({
    pluginId: "thread-nav", sdk: { providers: { list: async () => [] } },
  });
  try {
    await plugin(bb);
    const call = (method: string, input: unknown = null) => harness.behavior.callRpc(method, input);
    await call("model_emoji_set", { providerId: "codex", model: "sol", emoji: " ☀️ " });
    await call("model_emoji_set", { providerId: "other", model: "sol", emoji: "🌙" });
    await call("emoji_set", { hostId: "one", emoji: "🐒" });
    ({ bb, harness } = await harness.lifecycle.reload(plugin));
    assert.deepEqual(await call("model_emojis_get"), { '["codex","sol"]': "☀️", '["other","sol"]': "🌙" });
    assert.deepEqual(await call("models_list"), [
      { providerId: "codex", model: "sol", name: "sol" }, { providerId: "other", model: "sol", name: "sol" },
    ]);
    await call("model_emoji_set", { providerId: "codex", model: "sol", emoji: null });
    assert.deepEqual(await call("model_emojis_get"), { '["other","sol"]': "🌙" });
    assert.deepEqual(await call("emojis_get"), { one: "🐒" });
    await assert.rejects(call("model_emoji_set", { providerId: "codex", model: "sol", emoji: "a\nb" }));
    await assert.rejects(call("model_emoji_set", { providerId: "", model: "sol", emoji: "x" }));
  } finally { await harness.lifecycle.dispose(); }
});

test("thread model reads follow saved selections and tolerate deleted threads", async () => {
  let model = "sol";
  const { bb, harness } = createFakePluginHost({ pluginId: "thread-nav", sdk: { threads: {
    defaultExecutionOptions: async ({ threadId }) => {
      if (threadId === "gone") throw new Error("HTTP 404: not found");
      return { model, permissionMode: "full", reasoningLevel: "high", serviceTier: "default", source: "client/turn/start" };
    },
  } } });
  try {
    await plugin(bb);
    const key = JSON.stringify(["one", 1, "codex"]);
    const read = (keys: string[]) => harness.behavior.callRpc("thread_models", { keys });
    assert.deepEqual(await read([key]), { [key]: { providerId: "codex", model: "sol" } });
    model = "luna";
    const nextKey = JSON.stringify(["one", 2, "codex"]);
    assert.deepEqual(await read([nextKey]), { [nextKey]: { providerId: "codex", model: "luna" } });
    const gone = JSON.stringify(["gone", 1, "codex"]);
    assert.deepEqual(await read([gone]), { [gone]: null });
    await assert.rejects(read(["malformed"]));
  } finally { await harness.lifecycle.dispose(); }
});
