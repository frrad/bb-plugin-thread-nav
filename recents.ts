// The "Recent" list on bb's phone home screen (the new-thread page) is a
// separate component from the sidebar, so the sidebar's hiding rules don't
// reach it. Each row is an <li> holding a link to the thread's page
// (`/threads/<id>` or `/projects/<project>/threads/<id>`), and child threads
// get their own rows, so descendants are hidden explicitly.
import { cssString } from "./emojis.ts";

interface ThreadLink { id: string; parentThreadId: string | null }

/** The snoozed ids plus every thread nested under one of them. */
export function withDescendants(threads: readonly ThreadLink[], snoozedIds: readonly string[]): Set<string> {
  const hidden = new Set(snoozedIds);
  const children = new Map<string, string[]>();
  for (const thread of threads) {
    if (thread.parentThreadId === null) continue;
    const siblings = children.get(thread.parentThreadId) ?? [];
    siblings.push(thread.id);
    children.set(thread.parentThreadId, siblings);
  }
  const queue = [...hidden];
  while (queue.length > 0) {
    for (const child of children.get(queue.pop()!) ?? []) {
      if (hidden.has(child)) continue;
      hidden.add(child);
      queue.push(child);
    }
  }
  return hidden;
}

export function recentsRowSelector(id: string): string {
  return `[data-root-compose-mobile-recents] li:has(a[href$=${cssString(`/threads/${id}`)}])`;
}
