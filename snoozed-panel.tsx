// Snoozed threads live in the main page; keep the regular thread sidebar.
import { useEffect, useState } from "react";
import {
  experimental_Icon as Icon,
  experimental_useSidebarThreads,
  useBbNavigate,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import { contract } from "./contract.ts";
import { useSnoozes } from "./snooze.tsx";

export const SNOOZED_PANEL_PATH = "snoozed";

function remainingTime(until: number, now: number): string {
  const minutes = Math.ceil((until - now) / 60_000);
  if (minutes <= 0) return "Waking soon";
  if (minutes < 60) return `In ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `In ${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
  return `In ${Math.floor(hours / 24)}d${hours % 24 ? ` ${hours % 24}h` : ""}`;
}

export function SnoozedPage() {
  const snoozes = useSnoozes();
  const { threads, projects, status } = experimental_useSidebarThreads();
  const navigate = useBbNavigate();
  const rpc = useRpc<typeof contract>();
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(Date.now);
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const byId = new Map(threads.map((thread) => [thread.id, thread]));
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const snoozed = Object.entries(snoozes)
    .map(([id, until]) => {
      const thread = byId.get(id);
      return {
        id, until, thread,
        title: thread?.displayTitle ?? id,
        project: thread ? projectNames.get(thread.projectId) ?? "Unknown project" : "—",
        machine: thread?.host?.name ?? "—",
      };
    })
    .sort((a, b) => a.until - b.until);
  const search = query.trim().toLocaleLowerCase();
  const visible = snoozed.filter((row) =>
    [row.title, row.project, row.machine, row.thread?.environment?.branchName ?? ""]
      .some((value) => value.toLocaleLowerCase().includes(search)),
  );
  const dateFormat = new Intl.DateTimeFormat(undefined, {
    weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const timeZone = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
    .formatToParts(now).find((part) => part.type === "timeZoneName")?.value;

  async function unsnooze(threadId: string) {
    setPending((current) => new Set(current).add(threadId));
    try {
      await rpc.call("snooze_clear", { threadId });
    } catch (error) {
      toast.error(`Couldn't unsnooze: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(threadId);
        return next;
      });
    }
  }

  return <div className="h-full overflow-y-auto p-4 md:p-6">
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Snoozed <span className="text-sm font-normal text-muted-foreground">{snoozed.length}</span></h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Earliest wake time first · Times in {timeZone ?? "your local time zone"}
          </p>
        </div>
        <input type="search" aria-label="Filter snoozed threads" placeholder="Filter threads, projects, machines…"
          className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm sm:w-80"
          value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <p className="text-sm text-muted-foreground">
        Threads return to the sidebar at their wake time, or sooner if they finish, fail, or ask for input.
      </p>
      {status === "loading" && <p role="status" className="text-sm text-muted-foreground">Loading thread details…</p>}
      {status === "error" && <p role="alert" className="text-sm text-muted-foreground">Thread details are unavailable. You can still open or unsnooze a thread.</p>}
      {snoozed.length === 0 ? <p className="rounded-md border border-border p-6 text-sm text-muted-foreground">
        Nothing is snoozed. Use Snooze… in a thread’s menu to put it here.
      </p> : <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Snoozed threads ordered by wake time</caption>
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>{["Thread", "Project", "Machine", "Status", "Wakes", ""].map((heading, index) =>
              <th key={index} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{heading || <span className="sr-only">Actions</span>}</th>,
            )}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((row) => <tr key={row.id} className="hover:bg-state-hover">
              <td className="min-w-64 max-w-md px-4 py-3">
                {row.thread ? <a href={row.thread.href} className="block break-words font-medium hover:underline">{row.title}</a>
                  : <button type="button" className="text-left font-medium hover:underline" onClick={() => navigate.toThread(row.id)}>{row.title}</button>}
                {row.thread?.environment?.branchName && <div className="mt-1 break-all text-xs text-muted-foreground">{row.thread.environment.branchName}</div>}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{row.project}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.machine}</td>
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {row.thread ? row.thread.hasPendingInteraction ? "Needs input" : row.thread.runtimeStatus : "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                <time dateTime={new Date(row.until).toISOString()}>{dateFormat.format(row.until)}</time>
                <div className="mt-1 text-xs text-muted-foreground">{remainingTime(row.until, now)}</div>
              </td>
              <td className="px-4 py-3 text-right">
                <button type="button" aria-label={`Unsnooze ${row.title}`} disabled={pending.has(row.id)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-state-hover disabled:opacity-50"
                  onClick={() => { void unsnooze(row.id); }}>
                  <Icon name="ClockArrowUp" fallback="Clock" aria-hidden className="size-3.5" />
                  {pending.has(row.id) ? "Unsnoozing…" : "Unsnooze"}
                </button>
              </td>
            </tr>)}
            {visible.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No snoozed threads match your filter.</td></tr>}
          </tbody>
        </table>
      </div>}
    </div>
  </div>;
}
