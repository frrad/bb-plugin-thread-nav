import assert from "node:assert/strict";
import { test } from "node:test";
import { recentsRowSelector, withDescendants } from "./recents.ts";
import { cssString } from "./emojis.ts";

test("includes children and grandchildren of snoozed threads", () => {
  const hidden = withDescendants(
    [
      { id: "root", parentThreadId: null },
      { id: "child", parentThreadId: "root" },
      { id: "grandchild", parentThreadId: "child" },
      { id: "other", parentThreadId: null },
      { id: "other-child", parentThreadId: "other" },
    ],
    ["root"],
  );
  assert.deepEqual([...hidden].sort(), ["child", "grandchild", "root"]);
});

test("keeps snoozed ids that are not in the thread list", () => {
  const hidden = withDescendants([{ id: "a", parentThreadId: null }], ["missing"]);
  assert.deepEqual([...hidden], ["missing"]);
});

test("returns nothing when nothing is snoozed", () => {
  const hidden = withDescendants([{ id: "a", parentThreadId: null }], []);
  assert.deepEqual([...hidden], []);
});

test("matches a recents row by its thread link, with or without a project prefix", () => {
  assert.equal(
    recentsRowSelector("thr_abc"),
    `[data-root-compose-mobile-recents] li:has(a[href$=${cssString("/threads/thr_abc")}])`,
  );
});
