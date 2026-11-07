# HS-07 — Undo, resume and history: prompt understanding

Raw prompt: [raw_prompt.md](raw_prompt.md). Spec: section 5 of [../../plan/spec.md](../../plan/spec.md).

## What changes

1. **Undo the last round, any number of times.** On the scores screen (and the winner view), an
   Undo button takes the last round off: the totals go back, and the storyteller goes back to
   whoever told that round, so it can be entered again. The bunnies hop back to where they were,
   one stone at a time (reduced motion: they glide back). Skip (tap or button) works as it does
   for a round. Undo again takes off the round before, down to round 1.
2. **The game is saved after every round.** Starting a game, Confirm, Undo, End game and Home
   all save it. Closing the tab and opening the app again shows Resume on the home screen, which
   lands where the game was: the round being entered (with the votes entered before Home) or the
   scores. Resume and End game do not replay the hops (as today).
3. **History of finished games.** When a game ends it goes into a short history: date, players
   and final scores, winner first. The home screen links to it; each entry can be deleted (two
   taps). The newest games are kept, the oldest dropped past a fixed limit.
4. **Old or broken saved data never crashes the app.** The game and the history each have their
   own key and version, separate from the players. A broken saved game is dropped (the players
   stay); broken history entries are dropped one by one. Data from a newer app version, or that a
   migration fails on, is never written over.

Kept as they are: the players key and its migrations, two-tap New game and End game, the hop
animation playing only straight after Confirm, no 6-player limit in what is saved (task 09).

Out of scope: syncing a game between tabs or devices, redo, PWA/offline (task 08).

## Decisions for Harris

See the questions asked at the checkpoint; answers are recorded in execution-summary.md.

## Applicable Rules

- `project-conventions.md`, `project-structure.md`: `src/game/` stays pure (undo lives there),
  storage has no barrel, screens are plain DOM with two-tap destructive actions, 48 px targets,
  no sideways scroll at 320 px.
- `error-handling.md`: storage never throws; one key per kind of data; never write over newer or
  unmigratable data; broken entries dropped one by one.
- `testing-patterns.md`, `test-scope-policy.md`, `test-layer-policy.md`: node-only Vitest;
  undo, game/history loading and the hop-back beats are pure tested functions; screens checked by
  hand at 390 px and 320 px.
- `lean-docs.md`, `lean-doc-comments.md`: update `src/game/README.md`, `src/storage/README.md`,
  `src/screens/README.md`, `src/board/README.md`.

## Change Class

FEATURE. Existing tests stay untouched; new behaviour gets new tests.
