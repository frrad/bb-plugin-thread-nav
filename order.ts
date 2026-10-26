// Pure ordering logic for "next unread thread", kept free of DOM and React so
// it can be unit-tested with `node --test`.

export type Direction = 1 | -1;

export interface PickUnreadThreadInput {
  /** Thread ids in the order the sidebar shows them, top to bottom. */
  sidebarOrder: readonly string[];
  /** Unread thread ids the sidebar does not list (collapsed or hidden groups), in the order to visit them. */
  offscreenUnread: readonly string[];
  unread: ReadonlySet<string>;
  currentThreadId: string | null;
  direction: Direction;
}

/**
 * The unread thread to open next: the first unread thread after the current
 * one in `direction`, wrapping around. With no current thread (or one not in
 * the list) it starts at the top going down, or the bottom going up.
 */
export function pickUnreadThread({
  sidebarOrder,
  offscreenUnread,
  unread,
  currentThreadId,
  direction,
}: PickUnreadThreadInput): string | null {
  const order = [...new Set([...sidebarOrder, ...offscreenUnread])];
  if (order.length === 0) return null;
  const currentIndex = currentThreadId === null ? -1 : order.indexOf(currentThreadId);
  const start = currentIndex === -1 ? (direction === 1 ? -1 : order.length) : currentIndex;
  for (let step = 1; step <= order.length; step += 1) {
    const index = (((start + step * direction) % order.length) + order.length) % order.length;
    const id = order[index];
    if (id !== currentThreadId && unread.has(id)) return id;
  }
  return null;
}
