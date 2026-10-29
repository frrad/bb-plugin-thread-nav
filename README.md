# bb-plugin-thread-nav

A [bb](https://getbb.app) plugin for moving between threads quickly.

- **Cmd+U** opens the next unread thread below the current one in the
  sidebar, wrapping to the top. **Cmd+Shift+U** goes upward. Both are in the
  command palette and can be rebound in Settings → Keyboard.
- **Bold titles** for unread threads in the sidebar.
- **Stay in a thread after archiving.** Archiving the thread you're viewing
  normally drops you on the new-thread screen. With this plugin bb opens the
  most recent unread thread instead, else the most recently updated one. With
  no threads left, you stay on the new-thread screen. On phones (bb's compact
  viewport) this is skipped and bb's default, the main page, stays.

"Unread" matches bb's own unread dot: a finished (idle or errored) top-level
thread you haven't opened since its last update.

The bold styling targets the built-in thread list's `.bb-thread-title` class,
which isn't a public API, so a bb update can break it. The shortcuts only use
documented sidebar attributes.

## Install

```sh
git clone git@github.com:frrad/bb-plugin-thread-nav.git
cd bb-plugin-thread-nav
npm install
bb plugin install .
```

## Develop

```sh
npm test           # node --test order.test.ts pick.test.ts
npm run typecheck
bb plugin build . && bb plugin reload thread-nav
```
