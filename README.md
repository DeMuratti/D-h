# Dō

A calm, single-page **to-do, project, and calendar** app with an AI-assisted
project planner and an optional Fitbit "readiness" score. Plain HTML / CSS /
JavaScript — no build step, no framework.

## Run it

It's a static site, so any of these work:

- **Serve locally:** `python3 -m http.server 8000`, then open <http://localhost:8000>
- **Open the file:** double-click `index.html` (some features prefer an `http://`
  origin — see the note below)
- **In the cloud, nothing installed:** see the next section

> The JavaScript loads as separate `<script>`s and the AI planner + service
> worker behave best over `http(s)://`, so a local server or a host works more
> reliably than opening the file directly with `file://`.

## Work on it from the cloud (Cowork / Codespaces)

You can develop this **without installing anything or granting local
permissions** on a locked-down machine:

1. **Create the repo on github.com** — *New repository*, then drag these files
   into the browser "upload files" page. All in the browser; no admin rights.
2. **Edit + preview in GitHub Codespaces** — on the repo: *Code → Codespaces →
   Create*. The included `.devcontainer` serves the app on port 8000
   automatically; open the forwarded port to preview. Runs entirely in the cloud.
3. **Or hand it to Claude Cowork (web / mobile)** — connect this repo (or a
   Google Drive copy) to your Claude account and run Cowork sessions remotely.
   Remote sessions work against files saved to your account, so nothing is
   installed on your computer and no local permission is requested.

## Project structure

| File | Purpose |
|------|---------|
| `index.html` | Shell — links the stylesheet and scripts in load order |
| `styles.css` | All styles |
| `do-time.js` | Time layer: local-time day keys, DST-safe date maths (**all dates go through this**) |
| `do-store.js` | Storage layer: swappable adapters, schema versioning, backup export/import |
| `do-core.js` | Mutation layer: `Store.update()`, id-based selection grids, shared colour swatches |
| `app.config.js` | Constants + app state |
| `app.helpers.js` | Utilities, persistence, small toggles |
| `app.render.js` | View layer — every `render*` function + `renderAll` |
| `app.panels.js` | Task + calendar-entry panels |
| `app.projects.js` | Project panel, planner, schedule algorithm |
| `app.ai.js` | AI planner: chat, clarifying-question cards, plan parsing |
| `app.wiring.js` | Overlay, panel renderers, recurring schedule, month nav |
| `app.fitbit.js` | Fitbit OAuth + readiness scoring |
| `app.init.js` | Service worker + boot (**must load last**) |
| `sw.js` | Offline cache (**bump `CACHE_VERSION` when you change any shell file**) |
| `tests/` | Test suite + jsdom harness |
| `worker/` | Cloudflare Worker that proxies the AI planner (keeps your API key server-side) |

Load order is fixed in `index.html`. See `STRUCTURE.md` for more.

## AI planner setup

The planner (**New Project → describe a goal**) calls a small Cloudflare Worker
so your Anthropic API key never ships to the browser.

```
cd worker
npm i -g wrangler && wrangler login
wrangler secret put ANTHROPIC_API_KEY   # paste your key
wrangler deploy
```

Then put the deployed `https://` URL into `app.config.js` → `AI_PROXY_URL`.
Lock the Worker to your site with `ALLOWED_ORIGIN` in `worker/wrangler.toml` so
it isn't an open proxy, and update the model string in `app.ai.js` if needed.

## Tests

The suite needs one dev dependency (jsdom). The app itself still has no build
step and ships no runtime dependencies.

    npm install                                   # once
    npm test                                      # or: node tests/run-tests.js
    TZ=Pacific/Kiritimati npm test                # or any timezone

31 tests in two layers:

- **Units** for `do-time.js` and `do-store.js` — the two places where a silently
  wrong answer is expensive (DST arithmetic, corrupt saved data, backup
  round-trips).
- **End-to-end**, booting the whole app in jsdom from `index.html`'s own script
  list and driving it through the DOM: create/edit/delete a task, toggle done,
  add a category, save calendar entries, and confirm each panel selection writes
  the right record's id. Because the script list is read from `index.html`, the
  suite also fails if the load order is ever broken.

Run it after touching anything, not just the two layers. Worth knowing what it
does *not* cover: jsdom is not a browser, so layout, CSS and touch behaviour are
still on you.

## Backup your data

`localStorage` is not durable; browsers can evict it. Use **+ → Back up data**
to download a JSON file, and **Restore backup** to load one back.

## What changed vs. the original single file

- Split the one large file into the modules above. That step was behaviour-
  identical (byte-for-byte slices); the later `do-time` / `do-store` / `do-core`
  passes below changed behaviour deliberately.
- Added **clarifying-question cards** to the AI planner (numbered tappable
  options + a "Something else…" free-text slot).
- Fixed `AI_PROXY_URL` to include `https://` (without it, `fetch` treated the
  string as a relative path and the planner never reached the Worker).
- Registered the service worker with a **relative** path (`sw.js`) so it works
  when the site is hosted on a subpath (e.g. GitHub Pages project sites).
- Added `do-time.js` (timezone/DST-safe dates) and `do-store.js` (swappable
  persistence + backups), with a test suite for both.

## Known issues / good next steps

- ~~Timezone dates~~ — **fixed.** Dates now go through `do-time.js`, which reads
  the local timezone. Previously `toISOString()` shifted every calendar cell and
  scheduled slot one day earlier, and `today()` returned yesterday between
  00:00 and 03:00 at UTC+02/+03.
- ~~Adopt `do-core.js`~~ — **done.** Every state change now goes through
  `Store.update()` (mutate → persist → re-render, so neither half can be
  forgotten), grid selections are read by `data-id` via `getSelectedId()`
  instead of by DOM position, and the three duplicated colour pickers are one
  `renderSwatches()` call each. `do-core.js` no longer carries its own date
  helpers or its own localStorage code — those belong to `do-time.js` and
  `do-store.js`.
- **`app.fitbit.js` still calls `localStorage` directly** (token, expiry and the
  cached readiness score). It predates `do-store.js` and is the one place left
  that bypasses the storage layer — worth moving behind an adapter, especially
  since the Fitbit token is exactly the thing that has to move server-side.
- **Fitbit:** set `FITBIT_CLIENT_ID` in `app.fitbit.js` before that feature works.
- **PWA icons:** `icons/icon-192.png` and `icons/icon-512.png` are plain
  generated placeholders (the wordmark on the theme colour) — swap in your own
  artwork when you have it.
