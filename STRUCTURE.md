# Dō — file structure

Split out of the original single-file `todo-app.html`. Plain classic scripts
(no ES modules), so all inline `onclick="..."` handlers keep working and every
file shares one global scope. **Load order matters** — it's fixed in
`index.html` and mirrors the original top-to-bottom order.

| File | What's in it |
|------|--------------|
| `index.html` | HTML shell only. Links `styles.css` + the scripts in order. |
| `styles.css` | All CSS (was the `<style>` block). |
| `do-time.js` | **Time layer** — timezone-safe day keys, DST-safe date maths. All dates go through this. Loaded first. |
| `do-store.js` | **Storage layer** — swappable adapters, schema versioning, backup export/import. |
| `do-core.js` | **Mutation layer** — `Store.update()` (mutate → persist → re-render) plus shared UI helpers (`renderSelectGrid`/`getSelectedId`, `renderSwatches`). |
| `app.config.js` | Constants + mutable state (`tasks`, `projects`, …). |
| `app.helpers.js` | Utilities, `save`/`load`, FAB + calendar-dropdown toggles. |
| `app.render.js` | **View layer** — every `render*` fn, `buildCard`, and `renderAll`. |
| `app.panels.js` | Calendar-entry panel + task panel. |
| `app.projects.js` | Project panel, planner, schedule algorithm + preview. |
| `app.ai.js` | AI planner chat + plan parsing. |
| `app.wiring.js` | Overlay, panel-specific renderers, recurring schedule, month nav. |
| `app.fitbit.js` | Fitbit OAuth, data fetch, readiness scoring. |
| `app.init.js` | Service worker + boot. **Must stay last.** |
| `sw.js` | Offline cache. **Bump `CACHE_VERSION` whenever any shell file changes**, or browsers keep serving the old copy. |
| `manifest.json` | PWA metadata (name, icons, theme). |
| `tests/run-tests.js` | Test suite — time + storage units, plus end-to-end app tests driven through the DOM. |
| `tests/harness.js` | Boots the real app in jsdom for those end-to-end tests. |
| `package.json` | Dev-only. Provides `npm test`; the app itself still has no build step. |

## History
The split itself was behaviour-preserving: the JS files started as exact
byte-for-byte slices of the original single-file script, the only edits being one
comment header per file and `renderAll` moved into `app.render.js` (a pure
function, so load order was unaffected).

That guarantee no longer describes the current code, and deliberately so. Three
later passes changed behaviour on purpose:
1. **`do-time.js`** — dates moved off `toISOString()` (UTC) onto local-time day
   keys, fixing the one-day-early shift.
2. **`do-store.js`** — persistence moved behind a swappable adapter.
3. **`do-core.js`** — every mutation now goes through `Store.update()`, and grid
   selections are read by `data-id` rather than by DOM position.

What holds the line now is `tests/run-tests.js`, not a diff against the original.

## Notes
- `sw.js` caches the shell **cache-first**. If you change a file and don't bump
  `CACHE_VERSION`, returning visitors keep running the old code and your change
  appears to do nothing. Its `SHELL` list must also stay in sync with the
  `<script>` tags in `index.html`.
- `app.fitbit.js` still calls `localStorage` directly for its token, expiry and
  cached readiness score — the one remaining bypass of `do-store.js`.
- If you later switch any file to `<script type="module">`, inline `onclick`
  handlers in the HTML will break — convert those to `addEventListener` first.
