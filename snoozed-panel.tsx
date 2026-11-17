// The Snoozed page: every snoozed thread with its wake time, to open or
// unsnooze one early. It is a navigation destination; the
// same list replaces the thread list in the sidebar while the page is open.
import {
  experimental_Icon as Icon,
  experimental_useSidebarThreads,
  useBbNavigate,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import { contract } from "./contract.ts";
import { formatSnoozeDate, formatSnoozeTime } from "./snooze-times.ts";
import { useSnoozes } from "./snooze.tsx";

export const SNOOZED_PANEL_PATH = "snoozed";

interface SnoozedThread { id: string; title: string; until: number }

function useSnoozedThreads(): SnoozedThread[] {
  const snoozes = useSnoozes();
  const { threads } = experimental_useSidebarThreads();
  const titles = new Map(threads.map((thread) => [thread.id, thread.displayTitle]));
  return Object.entries(snoozes)
    .map(([id, until]) => ({ id, until, title: titles.get(id) ?? id }))
    .sort((a, b) => a.until - b.until);
}

function wakeLabel(until: number): string {
  const withinWeek = until - Date.now() < 6 * 24 * 60 * 60 * 1000;
  return withinWeek ? formatSnoozeTime(until) : formatSnoozeDate(until);
}

function SnoozedList({ compact }: { compact: boolean }) {
  const snoozed = useSnoozedThreads();
  const navigate = useBbNavigate();
  const rpc = useRpc<typeof contract>();

  async function unsnooze(threadId: string) {
    try {
      await rpc.call("snooze_clear", { threadId });
    } catch (error) {
      toast.error(`Couldn't unsnooze: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (snoozed.length === 0) {
    return <p className={`text-muted-foreground ${compact ? "px-3 py-2 text-xs" : "text-sm"}`}>
      Nothing is snoozed. Hover a thread in the sidebar and click its clock to snooze it.
    </p>;
  }
  return <ul className={compact ? "flex flex-col px-1" : "flex flex-col divide-y divide-border rounded-md border border-border"}>
    {snoozed.map((thread) => (
      <li key={thread.id} className={`group flex items-center gap-2 ${compact ? "rounded-md px-2 py-1 hover:bg-state-hover" : "px-3 py-2"}`}>
        <button type="button" className="flex min-w-0 flex-1 flex-col items-start text-left"
          onClick={() => navigate.toThread(thread.id)} title={`Open ${thread.title}`}>
          <span className={`w-full truncate ${compact ? "text-xs" : "text-sm"}`}>{thread.title}</span>
          <span className="text-xs text-muted-foreground tabular-nums">Wakes {wakeLabel(thread.until)}</span>
        </button>
        <button type="button" aria-label={`Unsnooze ${thread.title}`} title="Unsnooze"
          className={`flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-state-hover hover:text-foreground ${compact ? "opacity-0 group-hover:opacity-100 focus:opacity-100" : "border border-border"}`}
          onClick={() => { void unsnooze(thread.id); }}>
          <Icon name="ClockArrowUp" fallback="Clock" aria-hidden className="size-3.5" />
          {!compact && "Unsnooze"}
        </button>
      </li>
    ))}
  </ul>;
}

export function SnoozedPage() {
  return <div className="h-full overflow-y-auto p-4 md:p-5">
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Snoozed threads are hidden from the sidebar until their time, or until they finish, fail, or ask you something.
      </p>
      <SnoozedList compact={false} />
    </div>
  </div>;
}

export function SnoozedSidebar() {
  return <div className="py-1"><SnoozedList compact /></div>;
}
