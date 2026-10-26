// Pure "where to go after archiving" logic, kept free of DOM and React so it
// can be unit-tested with `node --test`.

export interface Candidate {
  id: string;
  parentThreadId: string | null;
  isArchived: boolean;
  isHidden: boolean;
  isUnread: boolean;
  status: string;
  updatedAt: number;
  latestAttentionAt: number;
}

export interface PickThreadAfterArchiveInput {
  threads: readonly Candidate[];
  /** The thread that was just archived; its list entry may not have caught up yet. */
  archivedThreadId: string;
}

/** Mirrors bb's unread dot: a finished thread you haven't opened since its last update. */
function showsUnread(thread: Candidate): boolean {
  return thread.isUnread && (thread.status === "idle" || thread.status === "error");
}

/**
 * The thread to open after the open one was archived: the unread thread that
 * most recently needed attention, else the most recently updated thread.
 * Only top-level, visible, non-archived threads count. Null when none is left.
 */
export function pickThreadAfterArchive({
  threads,
  archivedThreadId,
}: PickThreadAfterArchiveInput): string | null {
  const candidates = threads.filter(
    (thread) =>
      thread.id !== archivedThreadId &&
      !thread.isArchived &&
      !thread.isHidden &&
      thread.parentThreadId === null,
  );
  const unread = candidates
    .filter(showsUnread)
    .sort((a, b) => b.latestAttentionAt - a.latestAttentionAt);
  if (unread.length > 0) return unread[0].id;
  const recent = [...candidates].sort((a, b) => b.updatedAt - a.updatedAt);
  return recent[0]?.id ?? null;
}
