import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { contract, EMOJI_TAG, emojiValue } from "./contract.ts";

const PREFIX = "machine-emoji:";

export default async function plugin(bb: BbPluginApi): Promise<void> {
  bb.rpc.register(contract, {
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
