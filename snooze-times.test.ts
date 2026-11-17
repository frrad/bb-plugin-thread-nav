import assert from "node:assert/strict";
import { test } from "node:test";
import { fromDateTimeLocal, snoozeOptions, toDateTimeLocal } from "./snooze-times.ts";

// Month is 0-based: 10 = November. 2026-11-17 is a Tuesday.
const local = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute);
const summary = (now: Date) => snoozeOptions(now).map((option) => [option.id, new Date(option.at).toString().slice(0, 21)]);

test("Tuesday morning offers every option", () => {
  assert.deepEqual(snoozeOptions(local(17, 9, 56)).map((option) => [option.id, option.at]), [
    ["later-today", local(17, 18).getTime()],
    ["tomorrow", local(18, 8).getTime()],
    ["later-this-week", local(19, 8).getTime()],
    ["this-weekend", local(21, 8).getTime()],
    ["next-week", local(23, 8).getTime()],
  ]);
});

test("evenings drop Later today", () => {
  assert.deepEqual(snoozeOptions(local(17, 17, 30)).map((option) => option.id),
    ["tomorrow", "later-this-week", "this-weekend", "next-week"]);
});

test("Thursday skips Later this week, which would be Saturday", () => {
  assert.deepEqual(snoozeOptions(local(19, 10)).map((option) => option.id),
    ["later-today", "tomorrow", "this-weekend", "next-week"]);
});

test("Friday's weekend is tomorrow, so it is listed once", () => {
  assert.deepEqual(summary(local(20, 10)), [
    ["later-today", "Fri Nov 20 2026 18:00"],
    ["tomorrow", "Sat Nov 21 2026 08:00"],
    ["next-week", "Mon Nov 23 2026 08:00"],
  ]);
});

test("Sunday's next week is tomorrow, so it is listed once", () => {
  assert.deepEqual(summary(local(22, 20)), [["tomorrow", "Mon Nov 23 2026 08:00"]]);
});

test("Monday's next week is a week away", () => {
  assert.equal(snoozeOptions(local(23, 10)).at(-1)?.at, local(30, 8).getTime());
});

test("datetime-local values round-trip in local time", () => {
  const at = local(18, 8, 5).getTime();
  assert.equal(toDateTimeLocal(at), "2026-11-18T08:05");
  assert.equal(fromDateTimeLocal("2026-11-18T08:05"), at);
  assert.equal(fromDateTimeLocal(""), null);
  assert.equal(fromDateTimeLocal("tomorrow"), null);
});
