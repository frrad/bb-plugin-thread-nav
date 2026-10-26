import assert from "node:assert/strict";
import { test } from "node:test";
import { pickThreadAfterArchive } from "./pick.ts";
import type { Candidate } from "./pick.ts";

function thread(overrides: Partial<Candidate> & { id: string }): Candidate {
  return {
    parentThreadId: null,
    isArchived: false,
    isHidden: false,
    isUnread: false,
    status: "idle",
    updatedAt: 0,
    latestAttentionAt: 0,
    ...overrides,
  };
}

test("returns null when no other active threads exist", () => {
  const picked = pickThreadAfterArchive({
    threads: [thread({ id: "archived", isArchived: true, updatedAt: 5 })],
    archivedThreadId: "archived",
  });
  assert.equal(picked, null);
});

test("prefers the unread thread that most recently needed attention", () => {
  const picked = pickThreadAfterArchive({
    threads: [
      thread({ id: "recent-read", updatedAt: 100, latestAttentionAt: 100 }),
      thread({ id: "old-unread", isUnread: true, updatedAt: 10, latestAttentionAt: 10 }),
      thread({ id: "newer-unread", isUnread: true, updatedAt: 20, latestAttentionAt: 20 }),
    ],
    archivedThreadId: "gone",
  });
  assert.equal(picked, "newer-unread");
});

test("ignores unread threads that are still running", () => {
  const picked = pickThreadAfterArchive({
    threads: [
      thread({ id: "running-unread", isUnread: true, status: "active", updatedAt: 5, latestAttentionAt: 50 }),
      thread({ id: "read", updatedAt: 10 }),
    ],
    archivedThreadId: "gone",
  });
  assert.equal(picked, "read");
});

test("falls back to the most recently updated thread when nothing is unread", () => {
  const picked = pickThreadAfterArchive({
    threads: [
      thread({ id: "older", updatedAt: 10 }),
      thread({ id: "newest", updatedAt: 30 }),
      thread({ id: "middle", updatedAt: 20 }),
    ],
    archivedThreadId: "gone",
  });
  assert.equal(picked, "newest");
});

test("skips the archived thread, archived, hidden and child threads", () => {
  const picked = pickThreadAfterArchive({
    threads: [
      thread({ id: "just-archived", isUnread: true, updatedAt: 99, latestAttentionAt: 99 }),
      thread({ id: "already-archived", isArchived: true, updatedAt: 90 }),
      thread({ id: "hidden", isHidden: true, updatedAt: 80 }),
      thread({ id: "child", parentThreadId: "top", updatedAt: 70 }),
      thread({ id: "top", updatedAt: 1 }),
    ],
    archivedThreadId: "just-archived",
  });
  assert.equal(picked, "top");
});
