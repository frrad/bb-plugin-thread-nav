---
name: thread-nav
description: Explain or rebind the Thread Nav plugin's next/previous unread thread shortcuts, its bold unread sidebar rows and machine and model emojis, thread snoozing and the Snoozed page, and where it goes after archiving the open thread.
---

# Thread Nav

The plugin has a settings page at **Settings → Thread Nav**, and no CLI commands.

## Unread navigation

- `plugin:thread-nav/next-unread-thread` (default Mod+U) opens the next unread
  thread in sidebar order after the current one, wrapping around.
- `plugin:thread-nav/previous-unread-thread` (default Mod+Shift+U) goes upward.
- Unread sidebar rows are bold via an injected `<style id="bb-plugin-thread-nav-style">`.

"Unread" matches bb's own unread glyph: a top-level, non-hidden, non-archived
thread whose status is idle or error and whose `isUnread` is true. Unread
threads the sidebar doesn't list (collapsed or hidden groups) are visited after
the listed ones, newest attention first.

Rebind: `bb settings keyboard set plugin:thread-nav/next-unread-thread Mod+J`.
Reset: `bb settings keyboard reset plugin:thread-nav/next-unread-thread`.

## Machine emojis

Configure each enrolled machine in **Settings → Thread Nav → Machine emojis**.
Enter a marker and click Save. Save a blank field to hide it; Use default removes
its override and restores the automatic choice. Choices are stored per machine ID in plugin KV storage, survive plugin
reloads, and update open clients immediately. Renaming a machine preserves its
custom choice. Offline machines are included. Inputs allow up to 32 characters
without control characters (multi-codepoint emojis are supported).

Sidebar titles have a visual prefix from the thread's current host: 🐒 lemur,
🦏 rhino, 💻 MacBook (case-insensitive names). Other machines get a stable
animal marker from their host ID; these fallback markers may repeat. Unknown
hosts have no prefix. Stored thread titles are unchanged. Like bold styling,
this depends on the built-in list's `.bb-thread-title` class.

## Model emojis

Configure exact provider/model pairs in **Settings → Thread Nav → Model emojis**.
There is no automatic model marker. Save a blank field or Clear to remove one.
Reasoning levels share the model's marker. The list includes models used in
visible active or archived threads (including older choices within a thread),
plus any model with a saved emoji setting. Catalogs only supply display names;
unused catalog entries stay hidden. Discovery is cached incrementally, and
Refresh models scans for new usage. Once discovered, used models stay listed
even if their threads are later deleted. Configured models remain editable
when their provider is unavailable. Settings rows use compact spacing.

Titles reserve two positions: machine first, model second. A missing marker is
a muted `·`; when both are missing, no prefix appears. Markers have fixed-width
positions, so titles align. Use a single emoji (including joined/flag emoji);
longer text is clipped to its position.

Model markers use the thread's saved execution selection, not an unsent composer
change. Reads are shared and batched, refresh when the sidebar's thread version
changes, and only run when a model marker is configured. Settings sync across
clients and survive reloads. Stored titles are unchanged.

## After archiving

When the thread you're viewing is archived (Mod+Shift+A, the row action, or
anything else), bb navigates to the new-thread screen. This plugin then opens:

1. the unread thread that most recently needed attention, else
2. the most recently updated thread.

Only top-level, visible, non-archived threads count. If none are left, you stay
on the new-thread screen. Going to the new-thread screen any other way is left
alone: the redirect only fires when the thread you left drops out of the active
list within 3 seconds.

On phones (bb's compact viewport: under 768px wide or a coarse pointer) the
redirect is skipped, so archiving leaves you on bb's main page.

## Source

`github.com/frrad/bb-plugin-thread-nav` (Git install tracking `main`).
Tests: `npm test`. Build with `bb plugin build`; after merging, install with `bb plugin update thread-nav --yes`.

## Snooze

The `thread-nav/snooze` thread action ("Snooze…") opens a menu of preset times
(Later today 6 PM, Tomorrow / Later this week / This weekend / Next week at
8 AM, local time) or a date-and-time picker. On first load after install or upgrade, the plugin
adds the row button automatically if fewer than three actions are configured,
preserving existing buttons. Setup runs once, so later removal is respected.
If all slots are full, choose the buttons manually with
`bb thread-list prefs set rowActions '["thread-nav/snooze","bb--core/archive"]'`;
it is also in every thread menu. While snoozed, the action reads "Unsnooze".

Snoozes are stored server-side (plugin KV, one key per thread). A thread wakes
at its time (and is marked unread), or early when it finishes a turn, fails, or
asks for input; archiving or deleting it drops the snooze. Snoozed rows and
their nested children are hidden from the built-in list and skipped by the
unread shortcuts. The **Snoozed** navigation page lists snoozed
threads in a filterable table ordered by wake time, with project, machine, status,
branch, exact local wake time, remaining time, and Unsnooze. Thread titles open
the thread. The regular sidebar stays visible on this page. RPC: `snoozes_get`,
`snooze_set {threadId, until}`, `snooze_clear {threadId}`, e.g.
`bb plugin rpc call thread-nav snoozes_get`.
