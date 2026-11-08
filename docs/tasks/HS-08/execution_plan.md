# HS-08 — Offline, install and polish: execution plan

**Branch:** `feature/hs-08-offline-install-polish` (worktree already on it, from `main` at `8ad1042`)
**Change Class:** FEATURE. Existing tests stay untouched; new behaviour gets new tests.
Understanding: [prompt-understanding.md](prompt-understanding.md).

## Execution Tracking
- **Started:** 2026-11-08
- **Developer:** 5244263+harrisbinkhurram@users.noreply.github.com
- **Branch:** feature/hs-08-offline-install-polish
- **Collaborators:** (none yet)

## Summary

Make Hopscore installable and fully offline with a small hand-written service worker, add the
Libellud footer, have the board turn its effects down when frames drop (and fall back to a flat
2D track as a last resort or without WebGL), save votes as they are tapped, stop two tabs from
overwriting each other's game, keep a game from a newer app version out of Resume, and do a hand
polish pass at 320 px, in light/dark and with reduced motion.

## Approach and trade-offs

### 1. Install (manifest and icons)

- `public/manifest.webmanifest`, static, with **relative** URLs so it works under any base:
  `name` and `short_name` "Hopscore", `start_url` "./", `scope` "./", `display` "standalone",
  `id` "./" (a stable install identity),
  `background_color` and `theme_color` `#fff7ec` (the light `--bg` in `src/style.css`), icons
  `icons/icon-192.png`, `icons/icon-512.png` and `icons/icon-maskable-512.png` (`purpose: maskable`).
  Relative URLs resolve against `/hopscore/manifest.webmanifest`, so start URL and scope are
  `/hopscore/`.
- Icons: a new code-drawn bunny head in `public/icons/icon.svg` (same style as the board bunny,
  on the warm background), rendered once to the PNG sizes with headless Chrome and committed:
  192, 512, maskable 512 (bunny inside the safe zone) and `apple-touch-icon.png` 180.
  `public/favicon.svg` is replaced by the bunny too.
- `index.html`: `<link rel="manifest">`, `<link rel="apple-touch-icon">` (root-absolute hrefs
  such as `/manifest.webmanifest`, as `favicon.svg` is today, so Vite rewrites them under
  `/hopscore/`; the built hrefs are checked),
  `<meta name="apple-mobile-web-app-title" content="Hopscore">`, `application-name`, and
  `apple-mobile-web-app-capable`/`mobile-web-app-capable`. The two `theme-color` metas stay.
- Trade-off: no build-time icon generation (no new dependency); the PNGs are small static files.

### 2. Offline (service worker)

- **No Workbox / vite-plugin-pwa.** A small Vite plugin in `build/pwa.ts` (`apply: 'build'`)
  writes `dist/sw.js` in `closeBundle`, after Vite has written every file (`public/` is copied in
  `renderStart`, chunks in `write`; `closeBundle` runs in a `finally` after both). Because that
  hook also runs after a failed build, it does nothing when `dist/index.html` is missing. It lists
  every file in `dist/` (except `sw.js`), hashes their contents **and the service worker
  template** into a version string (a change to the worker alone also gets a new cache), and fills
  both into the service worker source (also in `build/pwa.ts`, as a template). Pure helpers
  `precacheList(paths)` and `serviceWorkerSource(version, files)` are tested.
- The service worker (cache name `hopscore-<version>`):
  - `install`: caches every listed file (URLs relative to its scope, so `/hopscore/...`), each
    fetched with `cache: 'reload'` so the browser's HTTP cache (Pages sends `max-age=600`) can
    never hand it an old `index.html` next to new chunks. `addAll` is all or nothing: a failed
    install leaves the old version in place and is retried on the next visit. It does **not**
    skip waiting on its own.
  - `activate`: deletes every other `hopscore-*` cache, then `clients.claim()` so the first visit
    is offline-ready without a reload.
  - `fetch`: same-origin GET only. Page loads (`mode: navigate`, any query such as `?board`) get the
    cached `index.html`, falling back to the network; other files cache first, then network.
    Anything else goes straight to the network.
  - `message` `'skip-waiting'`: `self.skipWaiting()`.
  - It never reads or writes localStorage (it cannot), so updates never touch saved data.
- Registration in `src/app/updates.ts`, production only (`import.meta.env.PROD`), at
  `${import.meta.env.BASE_URL}sw.js` with that scope. Failures are ignored (the app works without
  it). `watchForUpdates(container, onReady)` reports a waiting worker (present at load, or found
  later via `updatefound`/`statechange`), only when a worker already controls the page (so the
  first install is not reported as an update). `applyUpdate()` posts `'skip-waiting'` and reloads
  on `controllerchange`. It also checks for a new version (`registration.update()`) whenever the
  page becomes visible again, because an installed app resumed from the background may not load
  a page for days. Tested with a fake `ServiceWorkerContainer`.
- **Other open tabs** when one tab applies the update: they are now controlled by the new worker
  but still run the old code, whose lazy board chunk may be gone. On a `controllerchange` it did
  not ask for (and only when a worker controlled it before), a tab reloads at once if it is not
  on a game screen, otherwise the next time Home opens. Until then a missing board chunk falls
  back to the flat track (item 4), so the game screens keep working.
- **The update reload skips the leave-page prompt:** `main.ts` sets a flag before an update
  reload that the `beforeunload` handler checks (the game is saved, so nothing is lost).
- `main.ts`: Home shows a "New version ready, tap to update" button while an update waits.
  Game screens never show it; when it becomes ready on Home, Home re-renders.
- Type-checking: `build/` and `vite.config.ts` move to a new `tsconfig.node.json` (Node types,
  no DOM); `tsconfig.json` keeps `src` only. `typecheck` and `build` run both. Adds the
  `@types/node` dev dependency, `^22.12.0` (inside both Vite's and Vitest's peer ranges, and
  `.nvmrc` 22).
  `vite.config.ts` test `include` adds `build/**/*.test.ts`.

### 3. Footer

`src/app/branding.ts` gains `DISCLAIMER` ("Not affiliated with or endorsed by Libellud. Dixit is a
trademark of Libellud."), and its tagline comment changes to "Dixit appears only here and in the
disclaimer". Home ends with a small muted `<footer>` holding it. `branding.test.ts` gets a **new**
case for `DISCLAIMER` (text, and it names Libellud); the existing case (app name has no Dixit) is
left as it is. The AGENTS.md invariant becomes: "Dixit" appears only in the tagline and the
Libellud disclaimer, never in the app name.

### 4. Performance

- Baseline (measured on `main`, gzip -9): first load `index.html` + `index-*.js` + `index-*.css`
  + favicon about **17 KB**; the lazy board chunk **144 KB**. Re-measured after the change; the
  number goes in the PR.
- `src/board/frame-watch.ts` (pure, tested): fed each frame's duration only while a round
  plays, and only between two drawn frames (the board draws on demand, so idle gaps are never
  fed); ignores the first frames of a round and gaps over 250 ms (tab hidden); says `slow` when
  the average over a window of frames is under about 24 fps. That is below the 30 fps cap of iOS
  Low Power Mode and Android battery saver, so capped phones are not pushed down. After a switch
  to `lite` the window starts again, so frames from before the switch never count towards
  `flat`. Constants live in the file.
- `board.ts`: new options `quality?: 'full' | 'lite'` and `onSlow?(next: 'lite' | 'flat')`. On
  `slow` at `full` it switches to `lite` on its own: pixel ratio 1, no dust or petals (hops and
  celebrations' poses stay; `board.ts` simply skips its `spawnDust`/`spawnPetals` calls), and
  calls `onSlow('lite')`. On `slow` at `lite` it calls
  `onSlow('flat')`.
- Scores screen: keeps the quality for the session (module variable), so the next board starts
  at `lite`, or straight at the flat track. On `'flat'` it disposes the board and shows the flat
  track.
- `src/screens/scores/flat-track.ts`: `flatTrackLayout(trackLength, players)` (pure, tested)
  places the stones in rows of 10 that wind back and forth, with a number every 5, and groups the
  players by stone; `showFlatTrack(stage, ...)` draws it as an SVG with one coloured dot per
  player carrying their initial (names are in the score list right below). No animation. It is
  also shown when the board fails to load (no WebGL), instead of removing the stage.
- Tested with Chrome DevTools CPU throttling (4x/6x) in `npm run preview`; a real mid-range
  Android phone is **not** available, and the PR says so.

### 5. Polish pass (hand check)

At a real 320 px (Chrome window cannot go below 400 px, so an `<iframe width="320">` page served
next to the preview), 390 px, light and dark, and with reduced motion (DevTools rendering
emulation): Home, players, setup, round, scores, winner, history, the flat track. Fix what is
found in the screens' CSS (readability, 48 px targets, contrast, sideways scroll). Check the
Undo hop back glides under reduced motion.

### 6. Undo hook

Already connected in HS-07 (`undoPlay` in `src/screens/scores/board-input.ts`). Nothing to do;
the PR says so.

### 7. Votes saved per tap

`showRoundScreen` gains `onDraftChange(draft)`, called after a vote or storyteller change.
`main.ts` stores it as `roundDraft` and saves the game. The leave-page prompt stays (Harris).
The comments that say votes are saved only on Home (`main.ts` on `roundDraft` and `guardGame`,
`src/screens/README.md`) change: the prompt now stays for blocked or full storage.

### 8. Two tabs

`GameStore` gains `onGameChanged(listener)` (returns an unsubscribe), fired from the existing
`storage` listener when `hopscore.game` changes in another tab (after re-reading it).
It also fires when another tab clears all storage (`event.key === null`) and when the other tab
wrote a game this version keeps safe (a newer app).
`main.ts`: on that, takes the saved game as its own with a new `adoptSavedGame()` (not
`loadSavedGame()`, which records a finished game): a game that is over there is left for the
other tab, this tab forgets it without recording it. **This path never writes** (no `saveGame`,
no `finishGame`), so two tabs cannot set each other off.
- When only the draft or the view changed (the other tab tapped a vote or opened Resume), the
  game is the same: this tab takes the new draft quietly and stays where it is. Last tap wins for
  the draft.
- When the game itself changed (seats, rounds, End game, Redo list, or it is gone or kept safe)
  and this tab is on Home, setup, round or scores, it shows Home with "This game was changed in
  another tab." Setup is included, so its Start cannot replace a game it did not warn about.
  Players and history screens are left alone.

### 9. Kept-safe game not resumable

`loadSavedGame` in `main.ts`: when `games.gameKeptSafe`, the saved game is not taken (no Resume,
never finished here). Today a newer-version game whose shape still reads is resumed
(`loadSavedGame` in `src/storage/game-data.ts` returns it together with `keepSaved`), which is
how it could be recorded twice. Home shows "A saved game is from a newer version of Hopscore. It is kept
safe and not changed here." New game still works (as today, it is not saved while the newer data
is kept).

### 10. Plan manifest

`docs/plan/plan_manifest.json`: prompt 7 `completed` with pr 8; prompt 8 `in_progress` with
branch, `docs/tasks/HS-08` and the PR number once it exists. Prompt 9 stays `planned`.

## Files to change

| File | Change |
|---|---|
| `build/pwa.ts` | new: Vite plugin, `precacheList`, `serviceWorkerSource` (service worker template) |
| `build/pwa.test.ts` | new: tests for the two helpers |
| `vite.config.ts` | add the plugin; test include `build/**/*.test.ts` |
| `tsconfig.json`, `tsconfig.node.json` | split app and build type-checking |
| `package.json`, `package-lock.json` | `@types/node` dev dependency; `typecheck`/`build` run both configs |
| `public/manifest.webmanifest` | new |
| `public/icons/icon.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` | new |
| `public/favicon.svg` | the bunny |
| `index.html` | manifest, icons, app title metas |
| `src/app/branding.ts`, `branding.test.ts` | `DISCLAIMER` and the tagline comment; test: a new `DISCLAIMER` case, the existing case untouched |
| `src/app/updates.ts`, `updates.test.ts` | new: register, watch, apply update |
| `src/main.ts` | footer, update button, notices, draft per tap, other-tab change, kept-safe game |
| `src/style.css` / `src/screens/common.css` | footer, notice, update button, polish fixes |
| `src/storage/game-store.ts`, `game-store.test.ts` | `onGameChanged` |
| `src/screens/round/round-screen.ts` | `onDraftChange` |
| `src/screens/scores/scores-screen.ts`, `scores.css` | session quality, flat track fallback |
| `src/screens/scores/flat-track.ts`, `flat-track.test.ts` | new |
| `src/board/frame-watch.ts`, `frame-watch.test.ts` | new |
| `src/board/board.ts` | `quality`, `onSlow`, lite mode |
| other screen CSS | polish fixes found by hand |
| `docs/plan/plan_manifest.json` | statuses |
| `AGENTS.md`, `docs/ai-rules/project-structure.md`, READMEs | see Documentation updates |

## Test plan

- New unit tests:
  - `build/pwa.test.ts`: every built file listed, `sw.js` left out, URLs relative; the version
    changes when a file or the template changes and not otherwise. It also **runs the generated
    service worker** against a fake `self`, `caches`, `clients` and `fetch`: install caches every
    file with `cache: 'reload'`; activate deletes other `hopscore-*` caches and keeps foreign
    ones; a page load returns the cached `index.html`, also with `?board`; a cached file comes
    from the cache; a cross-origin or non-GET request is not intercepted; `'skip-waiting'` calls
    `skipWaiting`.
  - `src/app/updates.test.ts`: no report on first install; report when a worker waits with a
    controller; report on a later `updatefound`; apply posts `skip-waiting` and reloads on
    `controllerchange`; an unasked `controllerchange` is reported as "reload when safe";
    `update()` on becoming visible.
  - `src/storage/game-store.test.ts` (new cases, window stubbed as in `player-store.test.ts`):
    `onGameChanged` fires for another tab's game change and for `key === null`, and reports a
    newer-version game as kept safe; not for history or players keys; unsubscribe stops it.
  - `src/board/frame-watch.test.ts`: steady fast frames ok; a 30 fps cap ok; steady slow frames
    slow; warm-up and long gaps ignored; a short spike not slow; after a reset old frames do not
    count.
  - `src/screens/scores/flat-track.test.ts`: stone count, rows of 10 winding, numbered every 5,
    players grouped per stone, a score past the finish on the last stone, no player count limit.
  - `src/app/branding.test.ts`: a new case for `DISCLAIMER`.
- Existing suite unchanged and green.
- Hand checks in Chrome on `npm run preview` (manifest/installability in DevTools Application,
  offline reload, update flow with a second build, CPU throttling, 320 px iframe, light/dark,
  reduced motion, two tabs, kept-safe game crafted in localStorage, close mid-round and Resume).
- Size: gzip of the first-load files and the board chunk from `dist/`.

## Documentation updates

- `README.md`: install and offline, how updates arrive, `build/` in the layout, the size number.
- `AGENTS.md`: the Dixit invariant (tagline and disclaimer), `build/` row, `src/app/` row (name,
  tagline, disclaimer, updates), typecheck covers `tsconfig.node.json`.
- `docs/ai-rules/project-structure.md`: `build/` row; `public/` holds the manifest and icons
  (installed rules edit, flagged in the PR).
- `src/board/README.md`: `quality`, `onSlow`, frame watching, `frame-watch.ts` in the file table.
- `src/screens/README.md`: votes saved per tap, the flat track, other-tab notice, kept-safe game,
  update button, footer.
- `src/storage/README.md`: `onGameChanged`.

## Acceptance criteria

See [acceptance_criteria.json](acceptance_criteria.json) for the machine-checked copy.

1. Installable: the manifest names the app Hopscore with the bunny icons and theme colours, start
   URL and scope `/hopscore/`; "Dixit" in none of manifest, icons, home-screen label.
2. Works offline after the first visit: Home, a whole game and the board load with no connection.
3. A new deploy shows "New version ready" on Home only; tapping it loads the new version; old
   caches are deleted; saved game, history, players and groups are unchanged.
4. Home shows the Libellud footer.
5. First load is about 1 MB compressed or less, with Three.js still in the lazy chunk.
6. When frames drop the board turns effects down, then switches to the flat track.
7. The flat track shows every player's score when the board is too slow or WebGL is missing.
8. Votes survive closing the tab mid-round.
9. A change to the game in another tab sends this tab Home with a notice, never overwritten.
10. A game kept safe for a newer version is not offered for Resume and never reaches the history.
11. Polish: 320 px with no sideways scroll, 48 px targets, readable in light and dark; reduced
    motion glides, including the Undo hop back.
12. Typecheck, tests and build pass locally and in CI.

## Change Log

| Date | Time | Person | Change |
|------|------|--------|--------|
| 2026-11-08 | coding | Claude | Icon SVGs live in `build/icons/` with `render.sh` (not `public/icons/`), so the sources are not shipped and cached twice |
| 2026-11-08 | coding | Claude | Service worker matches with `ignoreVary`: found offline in Chrome, scripts and styles are requested with an Origin header and a `Vary: Origin` server answer missed the cache (blank page offline). Test added |
| 2026-11-08 | coding | Claude | Frame watch: warm-up 6 and window 24 frames (not 10 and 45): a short round on a 12 fps phone ended before 55 frames, and each scores visit makes a new board. The new hitch test uses two 150 ms frames |
| 2026-11-08 | coding | Claude | A tab switched to a new version by another tab reloads on Home (at once, or the next time Home opens), not on setup/players/history, so an unsaved setup is not lost |
| 2026-11-08 | coding | Claude | The kept-safe notice shows whenever the saved game is kept safe (it disappeared after a new game's Done); wording covers a failed upgrade too |
| 2026-11-08 | coding | Harris | Asked mid-task: rename players on the New game screen too, and a colour change must not reset a name just typed. Done with a shared `src/screens/player-editor.ts` (players and setup screens); a colour tap now also saves the typed name |
| 2026-11-08 | review | Claude | Code review: a game ended in another tab is recorded before this tab saves a new game over it (`recordGameEndedElsewhere`); `current` starts as `'other'` so the `?board` debug page is never replaced |
| 2026-11-08 | Harris | Harris | AC-1 closed on the manifest, icon, scope and service worker checks (DevTools installability and a real install not confirmed); AC-6 closed on a 70 ms-per-frame CPU load instead of DevTools throttling (a real phone not confirmed); AC-12 flipped once CI is green |
| 2026-11-08 | testing | Claude | Browser pass of the new editor: the open setup editor shrinks to its row (review nit); the score readout columns are at least 12rem, so names such as "Bobby" are no longer cut to "Bob…" (two columns on phones, one at 320 px) |
| 2026-11-08 | coding | Claude | The 2D track takes its own height (the 3D stage height left it small at 320 px); larger markers and numbers |
