---
name: unread-nav
description: Explain or rebind the Unread Nav plugin's next/previous unread thread shortcuts and its bold unread sidebar rows.
---

# Unread Nav

Frontend-only plugin; it has no CLI commands or settings.

- `plugin:unread-nav/next-unread-thread` (default Mod+U) opens the next unread
  thread in sidebar order after the current one, wrapping around.
- `plugin:unread-nav/previous-unread-thread` (default Mod+Shift+U) goes upward.
- Unread sidebar rows are bold via an injected `<style id="bb-plugin-unread-nav-style">`.

"Unread" matches bb's own unread glyph: a top-level, non-hidden, non-archived
thread whose status is idle or error and whose `isUnread` is true. Unread
threads the sidebar doesn't list (collapsed or hidden groups) are visited after
the listed ones, newest attention first.

Rebind: `bb settings keyboard set plugin:unread-nav/next-unread-thread Mod+J`.
Reset: `bb settings keyboard reset plugin:unread-nav/next-unread-thread`.

Source: `~/Projects/bb-plugin-unread-nav` (path install; github.com/frrad/bb-plugin-unread-nav). Tests:
`node --test order.test.ts`. Rebuild with `bb plugin build`, then
`bb plugin reload unread-nav`.
