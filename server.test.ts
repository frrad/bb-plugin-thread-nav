import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakePluginHost, makeHostResponse, makeThreadResponse } from "@get-bb/plugin-sdk/testing";
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
    pluginId: "thread-nav", sdk: { threads: { list: async () => [] }, providers: { models: async () => { throw new Error("offline"); } } },
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

function historyThread(id: string, providerId: string, updatedAt = 1) {
  return { ...makeThreadResponse({ id, providerId, updatedAt }),
    activity: { activeBackgroundAgentCount: 0, activeBackgroundCommandCount: 0, activeGoalCount: 0, activePlanModeCount: 0, activeWorkflowCount: 0 },
    environmentBranchName: null, environmentHostId: null, environmentIsWorktree: null, environmentName: null,
    environmentPath: null, environmentProviderId: null, environmentWorkspaceDisplayKind: "other" as const,
    hasPendingInteraction: false, pinSortKey: null, queuedWork: "none" as const,
  };
}

function selectionEvent(threadId: string, seq: number, model: string) {
  return { id: `event-${seq}`, scope: { kind: "thread" as const }, threadId, seq, createdAt: seq,
    type: "client/turn/start" as const, data: { direction: "outbound" as const, initiator: "user" as const,
      source: "tell" as const, request: { method: "turn/start" as const, params: { model } } } };
}

test("model list includes historical, archived and configured choices but excludes unused catalog entries", async () => {
  let updatedAt = 1;
  let deleted = false;
  let { bb, harness } = createFakePluginHost({ pluginId: "thread-nav", sdk: {
    threads: {
      list: async args => deleted ? [] : [historyThread(args?.archived ? "archived" : "active", "codex", updatedAt)],
      events: { list: async args => {
        const events = args.threadId === "archived"
          ? [selectionEvent("archived", 5, "old-model")]
          : [selectionEvent("active", 1, "previous-model"), selectionEvent("active", 8, "current-model"),
             ...(updatedAt > 1 ? [selectionEvent("active", 12, "new-model")] : [])];
        return events.filter(event => event.seq > Number(args.afterSeq ?? 0));
      } },
    },
    providers: { models: async () => ({ models: [
      { model: "current-model", displayName: "Current", id: "current-model", description: "", defaultReasoningEffort: "", isDefault: true,
        reasoningDiscovery: "known", supportedReasoningEfforts: [] },
      { model: "unused", displayName: "Unused", id: "unused", description: "", defaultReasoningEffort: "", isDefault: false,
        reasoningDiscovery: "known", supportedReasoningEfforts: [] },
    ], modelLoadError: null }) },
  } });
  try {
    await plugin(bb);
    const call = (method: string, input: unknown = null) => harness.behavior.callRpc(method, input);
    await call("model_emoji_set", { providerId: "offline", model: "configured", emoji: "🌙" });
    const first = await call("models_list") as { providerId: string; model: string; name: string }[];
    assert.deepEqual(first.map(choice => choice.model).sort(), ["configured", "current-model", "old-model", "previous-model"]);
    assert.equal(first.find(choice => choice.model === "current-model")?.name, "Current");
    const reads = harness.inspection.sdk.callsTo("threads.events.list").length;
    await call("models_list");
    assert.equal(harness.inspection.sdk.callsTo("threads.events.list").length, reads);
    updatedAt = 2;
    const next = await call("models_list") as { model: string }[];
    assert.ok(next.some(choice => choice.model === "new-model"));
    deleted = true;
    ({ bb, harness } = await harness.lifecycle.reload(plugin));
    const persisted = await call("models_list") as { model: string }[];
    assert.ok(persisted.some(choice => choice.model === "previous-model"));
    assert.ok(persisted.some(choice => choice.model === "old-model"));
  } finally { await harness.lifecycle.dispose(); }
});

test("used-model discovery pages both thread lists and model-event history", async () => {
  const threads = Array.from({ length: 201 }, (_, i) => historyThread(`thread-${i}`, "codex"));
  const events = Array.from({ length: 201 }, (_, i) => selectionEvent("thread-200", i + 1, i === 200 ? "last-page-model" : "first-page-model"));
  const { bb, harness } = createFakePluginHost({ pluginId: "thread-nav", sdk: {
    threads: {
      list: async args => args?.archived ? [] : threads.slice(args?.offset ?? 0, (args?.offset ?? 0) + (args?.limit ?? 200)),
      events: { list: async args => args.threadId === "thread-200"
        ? events.filter(event => event.seq > Number(args.afterSeq ?? 0)).slice(0, Number(args.limit)) : [] },
    },
    providers: { models: async () => { throw new Error("offline"); } },
  } });
  try {
    await plugin(bb);
    const models = await harness.behavior.callRpc("models_list", null) as { model: string }[];
    assert.deepEqual(models.map(choice => choice.model), ["first-page-model", "last-page-model"]);
  } finally { await harness.lifecycle.dispose(); }
});
