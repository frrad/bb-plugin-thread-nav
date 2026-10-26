---
name: thread-nav
description: Explain or rebind the Thread Nav plugin's next/previous unread thread shortcuts, its bold unread sidebar rows, and where it goes after archiving the open thread.
---

# Thread Nav

Frontend-only plugin; it has no CLI commands or settings.

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

## After archiving

When the thread you're viewing is archived (Mod+Shift+A, the row action, or
anything else), bb navigates to the new-thread screen. This plugin then opens:

1. the unread thread that most recently needed attention, else
2. the most recently updated thread.

Only top-level, visible, non-archived threads count. If none are left, you stay
on the new-thread screen. Going to the new-thread screen any other way is left
alone: the redirect only fires when the thread you left drops out of the active
list within 3 seconds.

## Source

`~/Projects/bb-plugin-thread-nav` (path install; github.com/frrad/bb-plugin-thread-nav).
Tests: `npm test`. Rebuild with `bb plugin build`, then `bb plugin reload thread-nav`.
