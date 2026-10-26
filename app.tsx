// bb-plugin-thread-nav — frontend entry.
//
// Two invisible app overlays. The unread tracker watches the sidebar's threads, keeps the unread set
// in module state for the keyboard commands, and writes a <style> element that
// bolds those rows. The built-in thread list stays in charge of rendering; this
// plugin relies on the row attributes bb documents for its own keyboard
// navigation (`data-sidebar-thread-id`, `data-sidebar-windowed-nav`) plus the
// built-in list's `bb-thread-title` class for styling.
//
// The archive redirect handles archiving the open thread. bb sends you to the
// new-thread screen then. The overlay notices that move (the route loses its
// thread and that thread drops out of the active list) and opens another thread
// instead. With no active threads left it does nothing, so the new-thread
// screen stays.
import { useEffect, useRef } from "react";
import {
  definePluginApp,
  experimental_useSidebarThreads,
  useBbContext,
  useBbNavigate,
} from "@get-bb/plugin-sdk/app";
import type { PluginCommandContext } from "@get-bb/plugin-sdk/app";
import { pickUnreadThread } from "./order.ts";
import { pickThreadAfterArchive } from "./pick.ts";
import type { Direction } from "./order.ts";

type SidebarThread = ReturnType<typeof experimental_useSidebarThreads>["threads"][number];
type OpenThread = (threadId: string) => void;

const ROW_SELECTOR = "a[data-sidebar-thread-shortcut-target][data-sidebar-thread-id]";
const WINDOWED_ATTRIBUTE = "data-sidebar-windowed-nav";
const STYLE_ELEMENT_ID = "bb-plugin-thread-nav-style";
// How long after leaving a thread its archive may still show up in the list.
const ARCHIVE_SETTLE_MS = 3000;

// Written by the overlay on every render, read by the commands.
let unreadThreads: readonly SidebarThread[] = [];
let openThread: OpenThread | null = null;

/** Mirrors bb's own rule for showing a row as unread: a finished top-level thread. */
function isUnreadThread(thread: SidebarThread): boolean {
  return (
    thread.isUnread &&
    !thread.isHidden &&
    !thread.isArchived &&
    thread.parentThreadId === null &&
    (thread.status === "idle" || thread.status === "error")
  );
}

/**
 * Thread ids in sidebar order, the same way bb's `thread.next` reads them:
 * mounted row anchors plus the ids that windowed (scrolled-away) placeholders
 * carry as space-separated `threadId:projectId` pairs.
 */
function readSidebarOrder(): string[] {
  const root = document.querySelector('[data-sidebar="sidebar"]') ?? document;
  const ids: string[] = [];
  for (const element of root.querySelectorAll(`${ROW_SELECTOR}, [${WINDOWED_ATTRIBUTE}]`)) {
    if (element.closest("[data-sidebar-overflow='true']")) continue;
    if (!element.checkVisibility({ visibilityProperty: true })) continue;
    if (element instanceof HTMLAnchorElement) {
      const id = element.dataset.sidebarThreadId;
      if (id) ids.push(id);
      continue;
    }
    for (const pair of element.getAttribute(WINDOWED_ATTRIBUTE)?.split(" ") ?? []) {
      const separator = pair.indexOf(":");
      if (separator > 0) ids.push(pair.slice(0, separator));
    }
  }
  return ids;
}

function jumpToUnread(context: PluginCommandContext, direction: Direction): void {
  const sidebarOrder = readSidebarOrder();
  const listed = new Set(sidebarOrder);
  const offscreenUnread = unreadThreads
    .filter((thread) => !listed.has(thread.id))
    .sort((a, b) => (b.latestAttentionAt ?? 0) - (a.latestAttentionAt ?? 0))
    .map((thread) => thread.id);
  const target = pickUnreadThread({
    sidebarOrder,
    offscreenUnread,
    unread: new Set(unreadThreads.map((thread) => thread.id)),
    currentThreadId: context.threadId,
    direction,
  });
  if (target === null) return;
  // Clicking the row keeps bb's own routing (split panes, compact drawer).
  const row = document.querySelector<HTMLAnchorElement>(
    `${ROW_SELECTOR}[data-sidebar-thread-id="${CSS.escape(target)}"]`,
  );
  if (row) row.click();
  else openThread?.(target);
}

function buildStylesheet(threadIds: readonly string[]): string {
  if (threadIds.length === 0) return "";
  // The row anchor is an empty click target laid over the row; the title is a
  // later sibling (or inside one) carrying bb's `bb-thread-title` class.
  const titles = threadIds.map((id) => {
    const anchor = `a[data-sidebar-thread-id="${CSS.escape(id)}"]`;
    return `${anchor} ~ .bb-thread-title, ${anchor} ~ * .bb-thread-title`;
  });
  return `${titles.join(",\n")} {\n  font-weight: 650;\n}\n`;
}

function UnreadTracker() {
  const { threads } = experimental_useSidebarThreads();
  const navigate = useBbNavigate();
  const unread = threads.filter(isUnreadThread);
  unreadThreads = unread;
  openThread = (threadId) => navigate.toThread(threadId);

  const stylesheet = buildStylesheet(unread.map((thread) => thread.id));
  useEffect(() => {
    let style = document.getElementById(STYLE_ELEMENT_ID);
    if (style === null) {
      style = document.createElement("style");
      style.id = STYLE_ELEMENT_ID;
      document.head.append(style);
    }
    style.textContent = stylesheet;
  }, [stylesheet]);
  useEffect(
    () => () => {
      document.getElementById(STYLE_ELEMENT_ID)?.remove();
      unreadThreads = [];
      openThread = null;
    },
    [],
  );
  return null;
}

interface Departure {
  threadId: string;
  at: number;
}

function ArchiveRedirect() {
  const { threadId } = useBbContext();
  const { threads, status } = experimental_useSidebarThreads();
  const navigate = useBbNavigate();
  const previousThreadId = useRef<string | null>(threadId);
  const departure = useRef<Departure | null>(null);

  useEffect(() => {
    const left = previousThreadId.current;
    previousThreadId.current = threadId;
    departure.current =
      threadId === null && left !== null ? { threadId: left, at: Date.now() } : null;
  }, [threadId]);

  useEffect(() => {
    const left = departure.current;
    if (left === null || threadId !== null || status !== "ready") return;
    if (Date.now() - left.at > ARCHIVE_SETTLE_MS) {
      departure.current = null;
      return;
    }
    const entry = threads.find((thread) => thread.id === left.threadId);
    // Still active: either you went to the new-thread screen on purpose, or
    // the archive hasn't reached the list yet. Wait for the next update.
    if (entry !== undefined && !entry.isArchived) return;
    departure.current = null;
    const target = pickThreadAfterArchive({ threads, archivedThreadId: left.threadId });
    if (target !== null) navigate.toThread(target);
  }, [threadId, threads, status, navigate]);

  return null;
}

export default definePluginApp((app) => {
  app.slots.experimental_appOverlay({ id: "unread-tracker", component: UnreadTracker });
  app.slots.experimental_appOverlay({ id: "archive-redirect", component: ArchiveRedirect });
  app.commands.register({
    id: "next-unread-thread",
    title: "Thread Nav: go to next unread thread",
    defaultShortcut: { key: "u", mod: true },
    run: (context) => jumpToUnread(context, 1),
  });
  app.commands.register({
    id: "previous-unread-thread",
    title: "Thread Nav: go to previous unread thread",
    defaultShortcut: { key: "u", mod: true, shift: true },
    run: (context) => jumpToUnread(context, -1),
  });
});
