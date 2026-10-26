import assert from "node:assert/strict";
import { test } from "node:test";
import { pickUnreadThread } from "./order.ts";

test("picks the next unread thread below the current one", () => {
  const picked = pickUnreadThread({
    sidebarOrder: ["a", "b", "c", "d"],
    offscreenUnread: [],
    unread: new Set(["a", "c", "d"]),
    currentThreadId: "b",
    direction: 1,
  });
  assert.equal(picked, "c");
});

test("wraps to the top after the last unread thread", () => {
  const picked = pickUnreadThread({
    sidebarOrder: ["a", "b", "c", "d"],
    offscreenUnread: [],
    unread: new Set(["a", "b"]),
    currentThreadId: "c",
    direction: 1,
  });
  assert.equal(picked, "a");
});

test("goes upward and wraps to the bottom for the previous direction", () => {
  const picked = pickUnreadThread({
    sidebarOrder: ["a", "b", "c", "d"],
    offscreenUnread: [],
    unread: new Set(["c", "d"]),
    currentThreadId: "b",
    direction: -1,
  });
  assert.equal(picked, "d");
});

test("never picks the current thread even when it is still unread", () => {
  const picked = pickUnreadThread({
    sidebarOrder: ["a", "b"],
    offscreenUnread: [],
    unread: new Set(["b"]),
    currentThreadId: "b",
    direction: 1,
  });
  assert.equal(picked, null);
});

test("starts from the top when no thread is open", () => {
  const picked = pickUnreadThread({
    sidebarOrder: ["a", "b", "c"],
    offscreenUnread: [],
    unread: new Set(["b", "c"]),
    currentThreadId: null,
    direction: 1,
  });
  assert.equal(picked, "b");
});

test("starts from the bottom when no thread is open and going upward", () => {
  const picked = pickUnreadThread({
    sidebarOrder: ["a", "b", "c"],
    offscreenUnread: [],
    unread: new Set(["a", "b"]),
    currentThreadId: null,
    direction: -1,
  });
  assert.equal(picked, "b");
});

test("unread threads missing from the sidebar come after the listed ones", () => {
  const picked = pickUnreadThread({
    sidebarOrder: ["a", "b"],
    offscreenUnread: ["z"],
    unread: new Set(["a", "z"]),
    currentThreadId: "b",
    direction: 1,
  });
  assert.equal(picked, "z");
});

test("ignores read threads and duplicate sidebar entries", () => {
  const picked = pickUnreadThread({
    sidebarOrder: ["a", "b", "a", "c"],
    offscreenUnread: [],
    unread: new Set(["c"]),
    currentThreadId: "a",
    direction: 1,
  });
  assert.equal(picked, "c");
});

test("returns null when nothing is unread", () => {
  const picked = pickUnreadThread({
    sidebarOrder: ["a", "b"],
    offscreenUnread: [],
    unread: new Set(),
    currentThreadId: "a",
    direction: 1,
  });
  assert.equal(picked, null);
});
