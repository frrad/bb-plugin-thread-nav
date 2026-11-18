import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";

const SETUP_KEY = "setup:snooze-row-action:v1";
const ACTION = "thread-nav/snooze";

// Only seed the preference once: later user customizations must survive reloads.
export async function installSnoozeRowAction(bb: BbPluginApi): Promise<void> {
  if (await bb.storage.kv.get(SETUP_KEY) === true) return;
  try {
    const { preferences } = await bb.sdk.plugins.callRpc({
      pluginId: "thread-list", method: "listPreferences", input: null,
      outputSchema: z.object({ preferences: z.object({ rowActions: z.array(z.string()).max(3) }) }),
    });
    const actions = preferences.rowActions;
    if (!actions.includes(ACTION) && actions.length < 3) {
      await bb.sdk.plugins.callRpc({
        pluginId: "thread-list", method: "setPreference",
        input: { key: "rowActions", value: [ACTION, ...actions] },
        outputSchema: z.object({ key: z.literal("rowActions"), value: z.array(z.string()) }),
      });
    }
    await bb.storage.kv.set(SETUP_KEY, true);
  } catch (error) {
    // Thread List may be disabled or not loaded yet. Retry on the next load.
    bb.log.warn(`Could not set up the Snooze row button; will retry on next load: ${String(error)}`);
  }
}
