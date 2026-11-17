// Server half of snoozing: one KV key per snoozed thread holding the epoch ms
// it wakes at. A thread wakes when its time comes (and is marked unread so it
// stands out), or early when it has news: it finishes a turn, fails, or asks
// the user something. Archiving or deleting a thread drops its snooze.
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { SNOOZE_TAG } from "./contract.ts";

const PREFIX = "snooze:";
/** The furthest ahead a snooze may be set. */
const MAX_SNOOZE_MS = 400 * 24 * 60 * 60 * 1000;

export function snoozeHandlers(bb: BbPluginApi, now: () => number = Date.now) {
  async function readAll(): Promise<Record<string, number>> {
    const keys = await bb.storage.kv.list(PREFIX);
    const entries = await Promise.all(keys.map(async (key) => [key.slice(PREFIX.length), await bb.storage.kv.get(key)] as const));
    return Object.fromEntries(entries.filter((entry): entry is readonly [string, number] =>
      typeof entry[1] === "number" && Number.isFinite(entry[1])));
  }

  async function clear(threadId: string): Promise<boolean> {
    if ((await bb.storage.kv.get(PREFIX + threadId)) === undefined) return false;
    await bb.storage.kv.delete(PREFIX + threadId);
    bb.rpc.experimental_invalidate([SNOOZE_TAG]);
    return true;
  }

  async function wakeDue(): Promise<void> {
    const due = Object.entries(await readAll()).filter(([, until]) => until <= now());
    for (const [threadId] of due) {
      if (!(await clear(threadId))) continue;
      try {
        await bb.sdk.threads.markUnread({ threadId });
      } catch (error) {
        // A thread deleted while snoozed has nothing left to mark.
        bb.log.warn(`Woke ${threadId} but could not mark it unread: ${String(error)}`);
      }
    }
  }

  const wakeOnNews = async ({ thread }: { thread: { id: string } }) => { await clear(thread.id); };
  bb.events.on("thread.idle", wakeOnNews);
  bb.events.on("thread.failed", wakeOnNews);
  bb.events.on("interaction.pending", wakeOnNews);
  bb.events.on("thread.archived", wakeOnNews);
  bb.events.on("thread.deleted", wakeOnNews);
  bb.background.schedule("wake-snoozed", "* * * * *", wakeDue);

  return {
    wakeDue,
    handlers: {
      snoozes_get: async () => {
        const current = now();
        return Object.fromEntries(Object.entries(await readAll()).filter(([, until]) => until > current));
      },
      snooze_set: async ({ threadId, until }: { threadId: string; until: number }) => {
        const current = now();
        if (until <= current) throw new Error("Pick a time in the future.");
        if (until > current + MAX_SNOOZE_MS) throw new Error("Pick a time within the next 400 days.");
        await bb.storage.kv.set(PREFIX + threadId, until);
        bb.rpc.experimental_invalidate([SNOOZE_TAG]);
        return null;
      },
      snooze_clear: async ({ threadId }: { threadId: string }) => {
        await clear(threadId);
        return null;
      },
    },
  };
}
