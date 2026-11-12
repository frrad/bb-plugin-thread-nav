import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { modelSchema } from "./contract.ts";
import { modelKey } from "./emojis.ts";
import type { Model } from "./emojis.ts";

type ThreadEventRow = Awaited<ReturnType<BbPluginApi["sdk"]["threads"]["events"]["list"]>>[number];

const USED_PREFIX = "used-model:";
const CURSOR_PREFIX = "model-history:";
const PAGE_SIZE = 200;
const cursorSchema = z.object({ providerId: z.string(), updatedAt: z.number(), afterSeq: z.number() });

function eventModel(event: ThreadEventRow): unknown {
  switch (event.type) {
    case "client/turn/requested": return event.data.execution.model;
    case "client/thread/start":
    case "client/turn/start": return event.data.request.params.model;
    default: return null;
  }
}

/** Backfill only model-selection events, then scan new history on subsequent reads. */
export async function usedModels(bb: BbPluginApi): Promise<Model[]> {
  for (const archived of [false, true]) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const threads = await bb.sdk.threads.list({ archived, includeHidden: false, limit: PAGE_SIZE, offset });
      for (let i = 0; i < threads.length; i += 8) {
        await Promise.all(threads.slice(i, i + 8).map(async thread => {
          const cursorKey = CURSOR_PREFIX + thread.id;
          const parsed = cursorSchema.safeParse(await bb.storage.kv.get(cursorKey));
          const cursor = parsed.success && parsed.data.providerId === thread.providerId ? parsed.data : null;
          if (cursor?.updatedAt === thread.updatedAt) return;
          let afterSeq = cursor?.afterSeq ?? 0;
          while (true) {
            const events = await bb.sdk.threads.events.list({
              threadId: thread.id, afterSeq: String(afterSeq), order: "asc", limit: String(PAGE_SIZE),
              types: ["client/thread/start", "client/turn/requested", "client/turn/start"],
            });
            for (const event of events) {
              const choice = modelSchema.safeParse({ providerId: thread.providerId, model: eventModel(event) });
              if (choice.success) await bb.storage.kv.set(USED_PREFIX + modelKey(choice.data), choice.data);
              afterSeq = Math.max(afterSeq, event.seq);
            }
            if (events.length < PAGE_SIZE) break;
          }
          await bb.storage.kv.set(cursorKey, { providerId: thread.providerId, updatedAt: thread.updatedAt, afterSeq });
        }));
      }
      if (threads.length < PAGE_SIZE) break;
    }
  }
  const keys = await bb.storage.kv.list(USED_PREFIX);
  const choices = await Promise.all(keys.map(key => bb.storage.kv.get(key)));
  return choices.flatMap(value => {
    const parsed = modelSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
}
