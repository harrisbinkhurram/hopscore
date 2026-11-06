# HS-03 — Players and groups: execution plan

Raw prompt: [raw_prompt.md](raw_prompt.md). Spec: [../../plan/spec.md](../../plan/spec.md).
Path: no tracker. "HS-03" is a local label only.
Branch: `feature/hs-03-players-and-groups` (already exists, forked from `main`).

## Understanding

The official app forgets names. This task makes players and groups stick on the device. It delivers
a saved data layer in `src/storage` and a phone-friendly screen to manage players and groups.

- A player has a name and a bunny colour. Add, rename, recolour, delete.
- A group is a named set of players. Create, edit, delete.
- Recently used players come first.
- Saved in local storage with a version number, so later tasks can migrate old data.
- If storage is blocked or broken, the app works for the session, shows a small notice, and never
  crashes on bad saved data.

Out of scope: game setup and "start a game from a group" (task 04), the game in progress and
history (task 07), the 3D bunnies (task 05). Task 04 will call `markUsed()` when a game starts;
this task only provides it.

## Approach

### Data (`src/storage`)

- `types.ts`
  - `Player { id, name, colour, lastUsedAt }` (`lastUsedAt` is a ms timestamp, 0 = never used).
  - `Group { id, name, playerIds }`.
  - `SavedData { version: 1, players, groups }`.
- `colours.ts`: a fixed palette of 8 bunny colours, each with a hex value and a short name
  ("Clover", "Sky", ...). The name is shown next to the swatch, so colour is never the only cue.
  A new player gets the first colour nobody uses yet.
- `migrate.ts`: `loadData(raw: unknown)` turns whatever was saved into valid `SavedData`.
  - Runs a table of migrations (`MIGRATIONS[n]` turns version n into n+1) up to `CURRENT_VERSION`.
    Version 1 is the first, so the table is empty today; tests drive it with a test table.
  - Missing, unparsable or wrong-shape data → empty data, no throw.
  - Each player and group is checked one by one. A broken entry is dropped, the rest are kept.
    Groups lose ids of players that no longer exist.
  - Data from a **newer** version than this app knows: loaded as best it can, and the store will not
    write over it (so an old cached tab cannot wipe newer data). The notice still shows.
- `safe-storage.ts`: wraps `localStorage`. On start it probes with a test write and remove. Any
  throw (blocked, quota; old Safari private mode) → falls back to memory for the session and reports
  `persistent: false`. A later failed write (quota full) does the same.
- `player-store.ts`: `createPlayerStore(backend?)` holds the data in memory and saves after every
  change. One key: `hopscore.players`. API:
  - `players()` sorted by `lastUsedAt` (newest first), then name.
  - `addPlayer(name, colour?)`, `renamePlayer`, `recolourPlayer`, `deletePlayer` (also removes the
    player from every group).
  - `groups()`, `createGroup(name, playerIds)`, `updateGroup(id, {name?, playerIds?})`,
    `deleteGroup`.
  - `markUsed(playerIds, now?)` for task 04.
  - `persistent` flag and `subscribe(listener)` for the screen.
  - Rules: names are trimmed, 1 to 20 characters, unique ignoring case (two "Sam"s would be
    confusing on the board). Group names 1 to 30 characters, unique ignoring case. A group holds 3 to 6 players (a
    valid game). Deleting a player can leave a group short; the group is kept and the screen marks
    it "needs 3 players" so it can be fixed.
    Bad input returns a short error message instead of throwing, so the screen can show it.
- IDs from `crypto.randomUUID()`, with a small fallback.

### Screen (`src/screens/players`)

- `players-screen.ts`: plain DOM, no framework, same style as `main.ts`.
  - Top: "Players" heading, "Back" button.
  - Notice when changes are not saved, worded by `notSavedReason`: storage off or full ("Names
    won't be remembered on this device."), or saved data kept safe ("Changes won't be saved, to
    keep your saved names safe. Reload the page to update Hopscore.").
  - Add a player: name field + Add button.
  - Player list (recent first): name, colour swatch with its name. Tap a row to open it: rename
    field, colour picker (8 big swatches with names), Delete (tap twice to confirm, no browser
    dialog).
  - Groups section: list of groups with their players' names. "New group": name field and a
    checklist of players. Edit and delete work the same way.
  - Tap targets at least 48 px, portrait, single column, works in light and dark.
- `src/main.ts` (shared file, minimal change): the home page gets one "Players & groups" button that
  opens the screen, and Back returns home. Task 04 will replace the home screen anyway.
- Styles go in a new `src/screens/players/players.css`, imported by the screen, so `style.css`
  barely changes (only `#app` alignment when the screen is open, via a class).

## Files

```
src/storage/types.ts                data shapes
src/storage/colours.ts              bunny palette
src/storage/migrate.ts              versioned load, validation, migrations
src/storage/safe-storage.ts         localStorage with memory fallback
src/storage/player-store.ts         players + groups API
src/storage/*.test.ts               tests (see test plan)
src/storage/README.md               what lives here, the storage key, how to add a migration
src/screens/players/players-screen.ts
src/screens/players/players.css
src/main.ts                         one button to open the screen
docs/tasks/HS-03/*                  these notes
```

## Test plan

Vitest, no DOM needed: tests use an in-memory fake `Storage`.

- Saving: add/rename/recolour/delete a player, create/edit/delete a group; a fresh store on the same
  backend sees the same data. Deleting a player removes it from groups.
- Loading: recent-first order; bad JSON, wrong types, one broken player among good ones, group with
  unknown player ids, `null`, arrays, numbers.
- Migration: a test migration table takes v1 data to v2 and v3 in order; current data passes
  through untouched; newer-version data loads but is not written over.
- Storage blocked: a backend that throws on every call → store works, `persistent` is false; a
  backend that throws only on `setItem` (quota) → switches to memory, keeps the change.
- Rules: empty / too long / duplicate names rejected; colour default picks an unused colour.
- `npm run typecheck`, `npm test`, `npm run build` pass.
- Manual: `npm run dev` in Chrome at phone width (390 px): add, rename, recolour, delete, groups;
  reload keeps them; with storage blocked the notice shows and the screen still works.

## Documentation updates

- `src/storage/README.md`: the data shape, the key, how to add a migration.
- `README.md` (shared): no change unless needed.

## Acceptance criteria

See [acceptance_criteria.json](acceptance_criteria.json).

1. AC-1: Players can be added, renamed, recoloured and deleted, and are saved.
2. AC-2: Groups can be created, edited and deleted, and are saved.
3. AC-3: Recently used players come first.
4. AC-4: Saved data has a version number and runs through migrations on load (tested).
5. AC-5: Blocked or broken storage never crashes; the app works for the session and shows a notice.
6. AC-6: Bad saved data never crashes; good entries are kept.
7. AC-7: A phone-friendly screen manages players and groups (big tap targets, portrait).
8. AC-8: Typecheck, tests and build pass locally and in CI on the PR.

## Risks

- Parallel lanes (02, 05) may also touch `src/main.ts` or `style.css`. Changes there are kept to a
  few lines; merge `main` before the PR merges.
- No DOM test setup exists (adding jsdom would touch `package.json`). The screen is checked by hand.

## Change log

- 2026-11-05: Harris chose groups of 3 to 6 players (a playable game), not 1 or more.
- 2026-11-05: Found while testing: when storage is full at start, the probe write fails, and the
  app ignored the saved players. Fixed: full storage is still read; only writes go to memory.
  Test added for it.
- 2026-11-05: Manual check in Chrome, app in a 390 px and a 320 px frame: add, duplicate-name
  error (typed text kept), rename, recolour, two-tap delete, group create with the 3-player error,
  group marked "Needs 3 players" after a delete, reload keeps everything, storage filled to quota
  shows the notice and keeps the new player for the session, broken saved JSON keeps the good
  player. No sideways scroll; smallest tap target 48 px.
- 2026-11-05: Players use the store's `markUsed()` only from task 04 on; until then everyone has
  `lastUsedAt` 0 and the list is in name order.
- 2026-11-05: Code review (Claude's reviewer agent) approved with three warnings, all fixed:
  a failed migration now keeps the last good step and never writes over the saved data; a
  second tab's save is loaded (`storage` event) so tabs do not overwrite each other; adding a
  player no longer clears a half-typed group name. Also: duplicate group names in saved data
  are dropped on load, and the notice says why changes are not saved (storage off, or saved
  data kept safe). 45 tests.
- 2026-11-06: Self-review of PR #3 (fresh reviewer agent), all five findings fixed: tapping a
  colour no longer wipes a typed rename; focus survives re-renders (every control has a
  `data-focus` key); README and JSDoc say to create one store per page; README points at
  `notSavedReason` instead of `persistent`; docs no longer claim private mode is detected
  (current private modes allow storage and clear it later, so it cannot be caught).
