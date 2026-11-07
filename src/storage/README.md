# storage

Saves players and groups on the device, with a safe fallback when storage is blocked.

## Use it

```ts
import { createPlayerStore } from './storage/player-store';

const store = createPlayerStore(); // uses localStorage, or memory if that fails
store.addPlayer('Alice');          // returns { ok, value } or { ok: false, error }
store.players();                   // recently used first, then by name
store.markUsed(ids);               // call when a game starts, so these players come first
store.notSavedReason;              // 'storage-off' | 'kept-safe' | null: pick the notice from this
```

**Create one store per page and pass it to the screens** (`main.ts` does this). Each store keeps
its own copy in memory, and the browser does not tell a tab about its own writes, so a second store
in the same tab would write its old copy over the first one's changes.

`persistent` is false in both `notSavedReason` cases, but they mean different things:
`'storage-off'` means names won't be remembered; `'kept-safe'` means saved names are still there and
only this session's changes are not saved.

Changes never throw. A bad name or group returns `{ ok: false, error }` with a short message for
the screen.

## Files

| File | Holds |
|---|---|
| `types.ts` | `Player`, `Group`, `SavedData`, `CURRENT_VERSION`, name and group-size limits; `SavedGame`, `HistoryEntry`, their versions, `HISTORY_LIMIT` |
| `colours.ts` | The bunny palette. Ids are saved: add new colours at the end, never rename one |
| `migrate.ts` | `loadData()`: runs migrations, then checks every entry; never throws. `runMigrations()` is shared by every key |
| `safe-storage.ts` | `localStorage` wrapper that falls back to memory when blocked or full; `remove()` keeps a removed key gone |
| `player-store.ts` | The players and groups API |
| `game-data.ts` | Reads a saved game and the history: migrations (`GAME_MIGRATIONS`, `HISTORY_MIGRATIONS`), shape checks |
| `game-store.ts` | The game in progress and the history API |

## Saved data

One key, `hopscore.players`:

```json
{ "version": 1, "players": [{ "id": "…", "name": "Alice", "colour": "sky", "lastUsedAt": 0 }],
  "groups": [{ "id": "…", "name": "Friday crew", "playerIds": ["…"] }] }
```

## The game in progress and the history

`createGameStore()` (`game-store.ts`) keeps two more keys, each with its own version, so a
broken game never costs the players:

- `hopscore.game`: `{ version, game: { seats, trackLength, storyteller, rounds, endedByHand,
  redo }, view, draft }`. Saved after every step of a game (`main.ts`). Totals are not saved:
  they are worked out from the rounds. Nothing in the shape limits the number of players.
- `hopscore.history`: `{ version, entries }`, finished games newest first, at most
  `HISTORY_LIMIT` (10). Each entry: id, date, track length, rounds played, ended by hand, and
  each player's name, colour and final score.

```ts
const games = createGameStore();
games.saveGame({ game, view: 'scores', draft: null });
games.savedGame();          // what was saved, shape-checked, or null
games.recordFinished({ trackLength, rounds, endedByHand, players });
games.deleteHistory(id);
```

Storage checks only the shape (`game-data.ts`); the game rules are checked by `restoreGame` in
`src/game` (storage imports nothing from `game` or `scoring`). A game with any broken part is
dropped whole, since keeping some rounds would change the scores; a broken Redo list or draft
costs only itself; broken history entries are dropped one by one. Newer or unmigratable data is
never written over, as for the players.

## Rules

- Player names: 1 to 20 characters, unique ignoring case.
- Groups: name 1 to 30 characters, unique ignoring case, 3 to 6 players. Deleting a player removes
  it from its groups; a group left with fewer than 3 is kept and the screen marks it.

## Bad or blocked storage

- Blocked, or full at start: the app reads what it can, keeps changes in memory, and
  `persistent` is false.
- Private browsing is **not** detected. Current browsers (Safari 11+, Chrome, Firefox) allow
  storage in private mode and clear it when the private session ends, so no notice shows there.
  It cannot be detected reliably.
- A write fails later (quota): same, from that moment on. Listeners are told.
- Broken saved data: broken entries are dropped one by one, the rest are kept.
- Data from a newer app version, or data a migration fails on: read as best it can, never
  written over (`notSavedReason` is `'kept-safe'`).
- Another tab saves: this store reloads from storage, so it does not write over that save.

## Adding a migration

1. Bump `CURRENT_VERSION` in `types.ts` to n+1.
2. Add `MIGRATIONS[n]` in `migrate.ts`: it takes version-n data and returns version n+1.
3. Add a test with real version-n data in `migrate.test.ts`.
