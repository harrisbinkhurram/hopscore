# HS-07 — Undo, resume and history: execution plan

Branch: `feature/hs-07-undo-resume-history`. Understanding: [prompt-understanding.md](prompt-understanding.md).

## Decisions (Harris, 2026-11-07)

- Leave-page prompt: **kept always** while a game is in progress, even though the game is saved.
  Pull-to-refresh stays blocked too.
- Undo on the winner screen: yes. Won at the finish: Undo takes the winning round off and the
  bunnies hop back. Ended with End game: Undo reopens the game, no round removed.
- Undo is **one tap**.
- History keeps the **10** newest finished games.

## Approach

### 1. Undo, pure, in `src/game/`

- `undoLast(game)`: after End game, clears `endedByHand` only. Otherwise drops the last round,
  recomputes the totals from the remaining rounds (through `src/scoring`'s `startingTotals` and
  `addRound`), and sets the storyteller to whoever told the undone round, so the rotation goes
  back and that round can be entered again. With nothing to undo it returns the game unchanged.
- `canUndo(game)`: `endedByHand || rounds.length > 0`.
- `restoreGame(saved)`: builds a `Game` from the saved seats, track length, rounds, storyteller
  and `endedByHand`, after the rule checks in section 2, recomputing the totals (saved totals are
  never trusted). Returns `null` when the game breaks a rule. Called by `main.ts`.
- `RoundDraft` (storyteller + votes) moves from `round-screen.ts` to `src/game/types.ts`, since it
  is now saved; the round screen imports it from there.

Why recompute instead of keeping snapshots: the saved game stays small and needs no undo stack,
and the totals can never disagree with the rounds.

### 2. Saving, in `src/storage/` (same layer and versioning as task 03)

- Extract the version-and-migration loop of `loadData()` into `runMigrations(raw, migrations,
  currentVersion)` in `migrate.ts`, returning `{ data, keepSaved }`. `loadData()` calls it; its
  behaviour and tests do not change.
- New `game-data.ts` (pure, tested): `loadSavedGame(raw)` and `loadHistory(raw)`, each with its
  own `*_VERSION = 1` and empty `*_MIGRATIONS`, never throwing. **Structural checks only**, with
  storage's own types (`project-structure.md`: storage imports nothing from `game` or `scoring`).
  - Saved game: `{ version, game: { seats, trackLength, storyteller, rounds, endedByHand }, view,
    draft? }`. Seats need a non-empty string id (unique) and name; a bad colour falls back to the
    first bunny colour, as for players. Each round needs a storyteller among the seats and one
    score per seat in seat order, with whole points >= 0 and reasons of `{ kind, points, text }`.
    **Anything broken in the game drops the whole game** (keeping some rounds would silently change
    the scores); the players are on their own key and are untouched. A broken draft drops only the
    draft (votes for or by unknown players are removed); an unknown view becomes `round`.
  - History: `{ version, entries: [...] }`; each entry `{ id, finishedAt, trackLength, rounds,
    endedByHand, players: [{ name, colour, score }] }`. Broken entries are dropped one by one;
    newest first; at most `HISTORY_LIMIT = 10`.
- The rule checks run in `src/game`: `restoreGame(saved)` (section 1) applies `setupProblems` (so
  the 3-6 rule stays in one place and task 09 widens it there; nothing in the saved format caps
  players), checks each reason kind against scoring's list and that reasons add up to the points,
  and recomputes the totals. It returns `null` for a game that fails; `main.ts` then drops it.
  Scoring gains an exported `SCORE_REASON_KINDS` list next to its types for that check.
- New `game-store.ts`: `createGameStore(backend?)` on its own `SafeStorage`, keys
  `hopscore.game` and `hopscore.history`. `savedGame()`, `saveGame(saved)`, `clearGame()`,
  `history()`, `recordFinished(game, now?)`, `deleteHistory(id)`, `persistent`, `notSavedReason`.
  Never throws. Like the player store, it never writes over a key whose data came from a newer
  version or failed a migration, and reloads on another tab's `storage` event.
- `SafeStorage` gains `remove(key)` for `clearGame()`: never throws, and remembers the key as
  removed, so `get` does not read the old value back from the read-only fallback after storage
  filled up. Tested.

### 3. Main flow (`src/main.ts`)

- On load: read the saved game. If it is already over (closed on the winner screen), record it
  in the history and clear it; otherwise it becomes the game in progress with its view and draft.
- Save after: starting a game, Confirm, Undo, End game, and Home from the round screen (with the
  draft). Done records the game in the history and clears it. One `saveGame` helper, no second
  storage path.
- Home: Resume when a game is in progress (now also after reopening the app); "Past games" when
  the history has entries.
- The leave-page prompt and pull-to-refresh block stay as they are; only their comment changes.

### 4. Screens

- Scores screen: an **Undo round N** button (one tap) while the game is in progress and has a
  round. Winner view: **Undo round N** after a win at the finish, **Undo End game** after End game.
  After an undo the scores screen opens with play mode `undo`: the board starts where the bunnies
  were and they hop back (reduced motion: glide). Undoing End game plays nothing. Resume and End
  game still never replay hops. The "there is no undo yet" comment goes.
- New `screens/history/history-screen.ts` + `history.css` (`.hs-` prefix): Home button, a list of
  past games, newest first: date, rounds, players by final score with the winner(s) marked, and a
  two-tap Delete per entry (the players-screen pattern). Empty state text when the last one is
  deleted.

### 5. Board: hop back (`src/board/`)

- `planRound` accepts negative gains: such a bunny hops backwards stone by stone to its new
  stone (no spin, petals or droop): the movers filter takes any non-zero gain, and the stone list
  counts down when the new stone is lower. Order stays "smallest gain first", so the longest hop
  back goes first. `board.ts` already hops along any list of stones and
  faces the way it moves; `motion.ts` timing and the Skip/reduced-motion handling are reused
  unchanged.
- `board-input.ts`: `undoPlay(before, after)` builds the `RoundPlay` (gains = after - before
  totals, no storyteller, no winners) and the starting positions.

## Files to change

| File | Change |
|---|---|
| `src/game/types.ts` | `RoundDraft` |
| `src/game/game.ts`, `index.ts` | `undoLast`, `canUndo`, `restoreGame` |
| `src/scoring/types.ts` or `score.ts`, `index.ts` | export `SCORE_REASON_KINDS` |
| `src/game/game.test.ts` | undo tests |
| `src/storage/migrate.ts` | extract `runMigrations` |
| `src/storage/safe-storage.ts` (+ test) | `remove(key)` |
| `src/storage/game-data.ts` (+ test) | load/validate saved game and history |
| `src/storage/game-store.ts` (+ test) | the store |
| `src/storage/types.ts` | `SavedGame`, `HistoryEntry`, versions, `HISTORY_LIMIT` |
| `src/board/choreography.ts` (+ test) | negative gains hop back |
| `src/screens/scores/board-input.ts` (+ test) | `undoPlay`, `PlayMode` `undo` |
| `src/screens/scores/scores-screen.ts`, `scores.css` | Undo button, undo play |
| `src/screens/round/round-screen.ts` | import `RoundDraft` from game |
| `src/screens/history/history-screen.ts`, `history.css` | new screen |
| `src/main.ts` | load, save, history, Past games |

## Test plan

- `game.test.ts`: undo drops the last round and restores totals and storyteller (also when the
  storyteller was changed on the round screen); undo twice; undo back to round 0; undo with no
  rounds is a no-op; undo after End game only reopens; undo after a win at the finish reopens;
  `restoreGame` recomputes totals and returns null for bad seats (too few, duplicate ids), an
  unknown reason kind, or reasons that do not add up.
- `game-data.test.ts`: a real version-1 saved game round-trips; resume keeps view and draft;
  broken data cases (not JSON / not an object / missing seats / bad round / unknown storyteller /
  negative points / bad draft / unknown view) never throw and drop only what is broken; a newer
  version is read as best it can and flagged `newer-version`; history drops broken entries, sorts
  newest first, caps at 10; a 7-seat game loads structurally (no cap in the format; today only
  `restoreGame`'s `setupProblems` rejects it).
- `game-store.test.ts`: save then a new store reads it back (resume after closing); clear; record
  finished game into history and the 11th drops the oldest; delete an entry; blocked storage keeps
  working in memory; a newer-version game is never written over; broken game key leaves the
  players key alone.
- `choreography.test.ts`: negative gains hop back stone by stone, biggest loss first, clamp at
  the finish, no celebrations.
- `board-input.test.ts`: `undoPlay` gains and start positions.
- Manual (Chrome 390 px and 320 px): undo hops back, Skip and tap skip it, reduced motion glides;
  reload mid-round and on the scores screen resumes in place without replaying; Past games list
  and two-tap delete; no sideways scroll.
- `npm run typecheck`, `npm test`, `npm run build`.

## Documentation updates

- `src/game/README.md`: undo, restore, draft.
- `src/storage/README.md`: game and history keys, shapes, broken-data rules, `remove`.
- `src/scoring/README.md`: `SCORE_REASON_KINDS`.
- `src/screens/README.md`: saving, Undo, history screen, flow.
- `src/board/README.md`: negative gains hop back.
- `docs/plan/plan_manifest.json`: prompt 7 in progress with branch, folder and PR number;
  prompt 6 completed with PR 7.

## Acceptance criteria

See [acceptance_criteria.json](acceptance_criteria.json) (machine-checkable mirror).

1. Undo takes off the last round: totals go back and the next storyteller is whoever told it.
2. Undo works repeatedly, down to no rounds.
3. Undo on the winner view reopens the game (removing the winning round, or only End game).
4. After Undo the bunnies hop back one stone at a time; Skip and reduced motion work.
5. The game is saved after every round; reopening the app offers Resume and lands on the same
   screen with the same votes, without replaying hops.
6. Finished games appear in a history (date, players, final scores) reachable from Home, at most
   10, each deletable with two taps.
7. Broken or old saved games and history never crash the app: the players survive, only broken
   parts are dropped, newer data is not written over.
8. Typecheck, tests and build pass.

## Change Log

- **2026-11-07, Redo (asked by Harris during coding).** Undo keeps what it took back on a Redo
  list stored on the game (`Game.redo`), so Redo puts it back: a round (the hops play again, as
  after Confirm) or End game (the finale plays). Confirming a new round or End game clears the
  list. Redo is one tap, next to Undo, on the scores screen and the winner view. The list is saved
  with the game; a broken saved list costs only the list. New AC-9. Redo is no longer out of scope.
