# game

The game in progress: who sits where, whose turn it is to tell, the rounds so far and the totals.
Pure: no DOM, no storage. Import from `src/game` (the `index.ts`). Every point comes from
`src/scoring`; this module never applies a scoring rule itself.

- `setupProblems(seatIds, trackLength)` lists why a game cannot start (seats checked by the
  scoring engine, track length against `TRACK_LENGTH`: 10 to 60, default 30).
- `newGame(seats, trackLength)` starts one. Seat 1 tells first. Seats carry a copy of each player's
  name and colour, so editing saved players does not reach a game in progress.
- `voteChoices(game, voter)`: everyone but the voter.
- `scorePending(game, storyteller, votes)` scores a round for review without changing the game.
- `applyRound(game, result)` adds it. The next storyteller follows on from whoever told this round,
  so changing the storyteller on the round screen moves the rotation too.
- `endGame`, `gameOver` (track length reached, or ended by hand), `standings` (ties share a rank
  and the win).
- `undoLast(game)` takes back the last step: End game, or else the last round (its points come
  off and whoever told it is the storyteller again). `canUndo` says if there is one.
- `redoNext(game)` puts back the step undone last; `nextRedo` says which (a round or End game).
  The Redo list lives on the game (`redo`); a new round or End game clears it.
- `restoreGame(saved)` rebuilds a game read back from the device, or returns null when it breaks
  a rule (seats, track, storyteller, scores out of seat order, unknown reasons or reasons that do
  not add up). Totals are always worked out again from the rounds. A broken Redo list costs only
  the Redo list.
- `RoundDraft`: the votes entered for the next round, saved with the game.

Every function returns a new `Game` and never changes the one it is given. Saving is `main.ts`'s
job, through `src/storage/game-store.ts`.
