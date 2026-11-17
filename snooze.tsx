// Snooze, frontend half. A thread action ("Snooze…", or "Unsnooze" while
// snoozed) can be a sidebar row's hover quick action; it opens a menu of
// preset times drawn by an app overlay, next to the button that was clicked.
// The server stores snoozes and wakes threads (see snooze-server.ts); the
// unread tracker in app.tsx hides snoozed rows.
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ComponentProps } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { toast } from "sonner";
import {
  experimental_Icon as Icon,
  experimental_useRpcQuery,
  experimental_useSidebarThreads,
  useBbContext,
  useBbNavigate,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import type { PluginRpcClient, PluginThreadActionRegistration } from "@get-bb/plugin-sdk/app";
import { contract } from "./contract.ts";
import { pickThreadAfterArchive } from "./pick.ts";
import {
  formatSnoozeDate, formatSnoozeTime, fromDateTimeLocal, snoozeOptions, toDateTimeLocal,
} from "./snooze-times.ts";
import type { SnoozeOption } from "./snooze-times.ts";

export type Snoozes = Record<string, number>;
type Rpc = PluginRpcClient<typeof contract>;

/** Snoozed threads, kept current by the snooze query; read by the unread tracker. */
export function useSnoozes(): Snoozes {
  const { data } = experimental_useRpcQuery({ contract, method: "snoozes_get", input: null });
  return data ?? {};
}

// --- Where the menu opens -------------------------------------------------

interface Anchor { left: number; top: number; bottom: number }
interface MenuState {
  threadId: string;
  anchor: Anchor;
  mode: "menu" | "pick";
  /** Preset times, fixed when the menu opens so they don't shift while it is up. */
  options: SnoozeOption[];
}

let menuState: MenuState | null = null;
const listeners = new Set<() => void>();
function setMenu(next: MenuState | null): void {
  menuState = next;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// The last button pressed, so the menu can open under the quick-action button
// (or where bb's own menu item was) that asked for it.
let lastPress: { anchor: Anchor; at: number } | null = null;
const PRESS_FRESH_MS = 2000;

function rememberPress(event: PointerEvent): void {
  const target = event.target instanceof Element ? event.target.closest("button, [role='menuitem']") : null;
  if (target === null) return;
  const rect = target.getBoundingClientRect();
  lastPress = { anchor: { left: rect.left, top: rect.top, bottom: rect.bottom }, at: Date.now() };
}

function anchorFor(threadId: string): Anchor {
  if (lastPress !== null && Date.now() - lastPress.at < PRESS_FRESH_MS) return lastPress.anchor;
  // Keyboard or command use: the thread's row, else the top of the window.
  const row = document.querySelector(`a[data-sidebar-thread-id="${CSS.escape(threadId)}"]`);
  if (row !== null) {
    const rect = row.getBoundingClientRect();
    return { left: rect.right - 32, top: rect.top, bottom: rect.bottom };
  }
  return { left: window.innerWidth / 2 - 130, top: 80, bottom: 80 };
}

export function openSnoozeMenu(threadId: string): void {
  const anchor = anchorFor(threadId);
  lastPress = null;
  // Let the menu that ran the action finish closing and returning focus first,
  // or its focus change would dismiss this one.
  setTimeout(() => setMenu({ threadId, anchor, mode: "menu", options: snoozeOptions(new Date()) }), 0);
}

// --- Actions -----------------------------------------------------------------

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function unsnooze(rpc: Rpc, threadId: string): Promise<void> {
  try {
    await rpc.call("snooze_clear", { threadId });
  } catch (error) {
    toast.error(`Couldn't unsnooze: ${errorText(error)}`);
  }
}

function describeUntil(until: number): string {
  const weekAway = until - Date.now() > 6 * 24 * 60 * 60 * 1000;
  return weekAway ? formatSnoozeDate(until) : formatSnoozeTime(until);
}

interface ActionData { snoozes: Snoozes; rpc: Rpc }

export const snoozeAction: PluginThreadActionRegistration<ActionData> = {
  id: "snooze",
  title: "Snooze",
  icon: "Clock",
  group: "2_organize",
  useData: () => ({ snoozes: useSnoozes(), rpc: useRpc<typeof contract>() }),
  item: ({ thread, data }) => {
    if (thread.archivedAt !== null) return null;
    const until = data.snoozes[thread.id];
    if (until !== undefined) {
      return {
        label: "Unsnooze",
        detail: `Snoozed until ${describeUntil(until)}`,
        icon: "Clock",
        run: () => unsnooze(data.rpc, thread.id),
      };
    }
    return { label: "Snooze…", icon: "Clock", run: () => openSnoozeMenu(thread.id) };
  },
};

// --- The menu ----------------------------------------------------------------

const CONTENT_CLASS =
  "z-50 min-w-60 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md " +
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2";
const ITEM_CLASS =
  "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-[0.3125rem] text-xs outline-none " +
  "focus:bg-state-hover focus:text-foreground data-[highlighted]:bg-state-hover [&>[data-icon-root]]:size-4 [&>[data-icon-root]]:shrink-0";
const BUTTON_CLASS = "rounded-md border border-border px-2.5 py-1 text-xs hover:bg-state-hover disabled:opacity-50";

/** An invisible box over the pressed button; Radix positions the menu against it. */
function AnchorPoint({ anchor, ...props }: { anchor: Anchor } & ComponentProps<"span">) {
  return <span {...props} aria-hidden style={{
    position: "fixed", left: anchor.left, top: anchor.top, width: 1, height: anchor.bottom - anchor.top,
    pointerEvents: "none",
  }} />;
}

function PickDateTime({ onSnooze, onCancel }: { onSnooze: (until: number) => void; onCancel: () => void }) {
  const tomorrowMorning = new Date();
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(8, 0, 0, 0);
  const [value, setValue] = useState(() => toDateTimeLocal(tomorrowMorning.getTime()));
  const until = fromDateTimeLocal(value);
  const error = until === null ? "Pick a date and time." : until <= Date.now() ? "Pick a time in the future." : null;
  return <form className="flex flex-col gap-2 p-1" onSubmit={(event) => {
    event.preventDefault();
    if (until !== null && error === null) onSnooze(until);
  }}>
    <label htmlFor="thread-nav-snooze-at" className="text-xs text-muted-foreground">Snooze until…</label>
    <input id="thread-nav-snooze-at" type="datetime-local" autoFocus value={value} min={toDateTimeLocal(Date.now())}
      onChange={(event) => setValue(event.target.value)}
      className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground" />
    {error !== null && value !== "" && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <div className="flex justify-end gap-2">
      <button type="button" className={BUTTON_CLASS} onClick={onCancel}>Cancel</button>
      <button type="submit" className={BUTTON_CLASS} disabled={error !== null}>Snooze</button>
    </div>
  </form>;
}

export function SnoozeOverlay() {
  const menu = useSyncExternalStore(subscribe, () => menuState);
  const rpc = useRpc<typeof contract>();
  const snoozes = useSnoozes();
  const { threads } = experimental_useSidebarThreads();
  const { threadId: openThreadId } = useBbContext();
  const navigate = useBbNavigate();

  useEffect(() => {
    document.addEventListener("pointerdown", rememberPress, true);
    return () => {
      document.removeEventListener("pointerdown", rememberPress, true);
      setMenu(null);
    };
  }, []);

  if (menu === null) return null;
  const close = () => setMenu(null);

  async function snooze(threadId: string, until: number) {
    close();
    try {
      await rpc.call("snooze_set", { threadId, until });
    } catch (error) {
      toast.error(`Couldn't snooze: ${errorText(error)}`);
      return;
    }
    toast(`Snoozed until ${describeUntil(until)}`, {
      action: { label: "Undo", onClick: () => { void unsnooze(rpc, threadId); } },
    });
    // Like archiving: don't leave the user on a thread that just left the list.
    if (threadId === openThreadId && !window.matchMedia("(max-width: 767px), (pointer: coarse)").matches) {
      const visible = threads.filter((thread) => snoozes[thread.id] === undefined);
      const target = pickThreadAfterArchive({ threads: visible, archivedThreadId: threadId });
      if (target !== null) navigate.toThread(target);
    }
  }

  return <>
    <DropdownMenu.Root modal={false} open={menu.mode === "menu"}
      onOpenChange={(open) => { if (!open && menuState?.mode === "menu") close(); }}>
      <DropdownMenu.Trigger asChild><AnchorPoint anchor={menu.anchor} /></DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={4} collisionPadding={8} className={CONTENT_CLASS}
          onCloseAutoFocus={(event) => event.preventDefault()}>
          <DropdownMenu.Label className="px-2 py-1.5 text-xs text-muted-foreground">Snooze until…</DropdownMenu.Label>
          {menu.options.map((option) => (
            <DropdownMenu.Item key={option.id} className={ITEM_CLASS}
              onSelect={() => { void snooze(menu.threadId, option.at); }}>
              <span className="flex-1">{option.label}</span>
              <span className="pl-6 text-muted-foreground tabular-nums">{formatSnoozeTime(option.at)}</span>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-muted" />
          <DropdownMenu.Item className={ITEM_CLASS} onSelect={() => setMenu({ ...menu, mode: "pick" })}>
            <Icon name="Calendar" aria-hidden />
            Pick date &amp; time
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    <Popover.Root open={menu.mode === "pick"} onOpenChange={(open) => { if (!open) close(); }}>
      <Popover.Anchor asChild><AnchorPoint anchor={menu.anchor} /></Popover.Anchor>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} collisionPadding={8} className={`${CONTENT_CLASS} w-64`}
          onCloseAutoFocus={(event) => event.preventDefault()}>
          <PickDateTime onSnooze={(until) => { void snooze(menu.threadId, until); }} onCancel={close} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  </>;
}
