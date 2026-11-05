# storage

Saves players and groups on the device, with a safe fallback when storage is blocked.

## Use it

```ts
import { createPlayerStore } from './storage/player-store';

const store = createPlayerStore(); // uses localStorage, or memory if that fails
store.addPlayer('Alice');          // returns { ok, value } or { ok: false, error }
store.players();                   // recently used first, then by name
store.markUsed(ids);               // call when a game starts, so these players come first
store.persistent;                  // false: show "names won't be remembered"
```

Changes never throw. A bad name or group returns `{ ok: false, error }` with a short message for
the screen.

## Files

| File | Holds |
|---|---|
| `types.ts` | `Player`, `Group`, `SavedData`, `CURRENT_VERSION`, name and group-size limits |
| `colours.ts` | The bunny palette. Ids are saved: add new colours at the end, never rename one |
| `migrate.ts` | `loadData()`: runs migrations, then checks every entry; never throws |
| `safe-storage.ts` | `localStorage` wrapper that falls back to memory when blocked or full |
| `player-store.ts` | The players and groups API |

## Saved data

One key, `hopscore.players`:

```json
{ "version": 1, "players": [{ "id": "…", "name": "Alice", "colour": "sky", "lastUsedAt": 0 }],
  "groups": [{ "id": "…", "name": "Friday crew", "playerIds": ["…"] }] }
```

Games and history (later tasks) use their own keys, so a broken game never costs the players.

## Rules

- Player names: 1 to 20 characters, unique ignoring case.
- Groups: name 1 to 30 characters, unique ignoring case, 3 to 6 players. Deleting a player removes
  it from its groups; a group left with fewer than 3 is kept and the screen marks it.

## Bad or blocked storage

- Blocked, or full at start: the app reads what it can, keeps changes in memory, and
  `persistent` is false.
- A write fails later (quota): same, from that moment on. Listeners are told.
- Broken saved data: broken entries are dropped one by one, the rest are kept.
- Data from a newer app version, or data a migration fails on: read as best it can, never
  written over (`notSavedReason` is `'kept-safe'`).
- Another tab saves: this store reloads from storage, so it does not write over that save.

## Adding a migration

1. Bump `CURRENT_VERSION` in `types.ts` to n+1.
2. Add `MIGRATIONS[n]` in `migrate.ts`: it takes version-n data and returns version n+1.
3. Add a test with real version-n data in `migrate.test.ts`.
