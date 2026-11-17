// Pure snooze-time logic, kept free of DOM and React so it can be unit-tested
// with `node --test`. Times are in the viewer's local time zone.

export interface SnoozeOption {
  id: "later-today" | "tomorrow" | "later-this-week" | "this-weekend" | "next-week";
  label: string;
  /** Epoch ms when the thread wakes. */
  at: number;
}

/** Hour the morning options wake at, and the "Later today" hour. */
const MORNING_HOUR = 8;
const EVENING_HOUR = 18;
/** "Later today" is offered until this hour, so it is always at least an hour away. */
const LATER_TODAY_CUTOFF_HOUR = 17;

const SATURDAY = 6;
const MONDAY = 1;

function atHour(day: Date, offsetDays: number, hour: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + offsetDays, hour, 0, 0, 0);
}

/** Days from `day` until the next `weekday` (0 = Sunday), always 1–7. */
function daysUntil(day: Date, weekday: number): number {
  return ((weekday - day.getDay() + 6) % 7) + 1;
}

/**
 * The preset snooze times for `now`, in menu order. Options that are not
 * meaningful today are left out ("Later today" in the evening, "This weekend"
 * on a weekend, "Later this week" once two days out is the weekend), and an
 * option landing on the same moment as an earlier one is dropped (on a Friday,
 * "This weekend" is already "Tomorrow").
 */
export function snoozeOptions(now: Date): SnoozeOption[] {
  const options: SnoozeOption[] = [];
  const add = (id: SnoozeOption["id"], label: string, when: Date) => {
    const at = when.getTime();
    if (at <= now.getTime() || options.some((option) => option.at === at)) return;
    options.push({ id, label, at });
  };
  const weekday = now.getDay();
  const isWeekend = weekday === 0 || weekday === SATURDAY;

  if (now.getHours() < LATER_TODAY_CUTOFF_HOUR) add("later-today", "Later today", atHour(now, 0, EVENING_HOUR));
  add("tomorrow", "Tomorrow", atHour(now, 1, MORNING_HOUR));
  const twoDaysOut = atHour(now, 2, MORNING_HOUR);
  if (!isWeekend && twoDaysOut.getDay() >= 3 && twoDaysOut.getDay() <= 5) {
    add("later-this-week", "Later this week", twoDaysOut);
  }
  if (!isWeekend) add("this-weekend", "This weekend", atHour(now, daysUntil(now, SATURDAY), MORNING_HOUR));
  add("next-week", "Next week", atHour(now, daysUntil(now, MONDAY), MORNING_HOUR));
  return options;
}

/** "Tue, 6:00 PM" in the viewer's locale. */
export function formatSnoozeTime(at: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(at);
}

/** "Tue, Nov 18, 6:00 PM": unambiguous for times more than a week away. */
export function formatSnoozeDate(at: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(at);
}

/** Value for an `<input type="datetime-local">`, in local time. */
export function toDateTimeLocal(at: number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parses an `<input type="datetime-local">` value as local time; null when invalid. */
export function fromDateTimeLocal(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}
