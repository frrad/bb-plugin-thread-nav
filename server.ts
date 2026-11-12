import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { contract, EMOJI_TAG, emojiValue, MODEL_EMOJI_TAG, modelSchema, threadModelKey } from "./contract.ts";

import { modelKey } from "./emojis.ts";

const MODEL_PREFIX = "model-emoji:";
const PREFIX = "machine-emoji:";

export default async function plugin(bb: BbPluginApi): Promise<void> {
  async function overridesFor(prefix: string) {
    const keys = await bb.storage.kv.list(prefix);
    const entries = await Promise.all(keys.map(async key => [key.slice(prefix.length), await bb.storage.kv.get(key)] as const));
    return Object.fromEntries(entries.flatMap(([key, value]) => {
      const parsed = emojiValue.safeParse(value);
      return parsed.success ? [[key, parsed.data]] : [];
    }));
  }
  bb.rpc.register(contract, {
    model_emojis_get: () => overridesFor(MODEL_PREFIX),
    model_emoji_set: async ({ providerId, model, emoji }) => {
      const key = MODEL_PREFIX + modelKey({ providerId, model });
      if (emoji === null) await bb.storage.kv.delete(key);
      else await bb.storage.kv.set(key, emoji.trim());
      bb.rpc.experimental_invalidate([MODEL_EMOJI_TAG]);
      return null;
    },
    models_list: async () => {
      const choices = new Map<string, { providerId: string; model: string; name: string }>();
      const providers = await bb.sdk.providers.list();
      const catalogs = await Promise.allSettled(providers.map(async provider => {
        const catalog = await bb.sdk.providers.models({ providerId: provider.id });
        for (const model of catalog.models) {
          const choice = { providerId: model.routeProviderId ?? provider.id, model: model.model, name: model.displayName };
          choices.set(modelKey(choice), choice);
        }
      }));
      for (const result of catalogs) if (result.status === "rejected") bb.log.warn(`Model catalog unavailable: ${String(result.reason)}`);
      // Keep configured models editable even when a provider is offline or drops an old model.
      for (const key of Object.keys(await overridesFor(MODEL_PREFIX))) {
        try {
          const [providerId, model] = JSON.parse(key);
          const choice = modelSchema.parse({ providerId, model });
          if (!choices.has(key)) choices.set(key, { ...choice, name: model });
        } catch { /* Ignore malformed stored keys. */ }
      }
      return [...choices.values()].sort((a, b) => a.providerId.localeCompare(b.providerId) || a.name.localeCompare(b.name));
    },
    thread_models: async ({ keys }) => {
      const output: Record<string, { providerId: string; model: string } | null> = {};
      // Bound concurrent reads; these are saved execution options, not provider calls.
      for (let i = 0; i < keys.length; i += 8) {
        await Promise.all(keys.slice(i, i + 8).map(async key => {
          const [threadId, , providerId] = threadModelKey.parse(key);
          try {
            const options = await bb.sdk.threads.defaultExecutionOptions({ threadId });
            output[key] = options ? { providerId, model: options.model } : null;
          } catch (error) {
            // Deleted threads may disappear between the sidebar update and this read.
            if (error instanceof Error && /404|not found/i.test(error.message)) output[key] = null;
            else throw error;
          }
        }));
      }
      return output;
    },
    emojis_get: async () => {
      const keys = await bb.storage.kv.list(PREFIX);
      const entries = await Promise.all(keys.map(async (key) => ({ key, value: await bb.storage.kv.get(key) })));
      const overrides: Record<string, string> = {};
      for (const entry of entries) {
        const parsed = emojiValue.safeParse(entry.value);
        if (parsed.success) overrides[entry.key.slice(PREFIX.length)] = parsed.data;
      }
      return overrides;
    },
    machines_list: async () => (await bb.sdk.hosts.list()).map(({ id, name }) => ({ id, name })),
    emoji_set: async ({ hostId, emoji }) => {
      // One key per machine keeps edits to different machines independent.
      if (emoji === null) await bb.storage.kv.delete(PREFIX + hostId);
      else await bb.storage.kv.set(PREFIX + hostId, emoji.trim());
      bb.rpc.experimental_invalidate([EMOJI_TAG]);
      return null;
    },
  });
  bb.log.info("loaded");
}
