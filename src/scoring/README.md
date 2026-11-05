# scoring

Pure scoring logic. No UI, no storage. Import from `src/scoring` (the `index.ts`).

- `scoreRound({ seats, storyteller, votes })` scores one round. `votes` maps each voter to whose
  card they picked. Returns each player's points in seat order, with reasons
  ("found the storyteller: +3", "2 votes on your card: +2"). Throws `RoundInputError` for
  impossible input; `validateRound` returns the same problems without throwing.
- `nextStoryteller(seats, current)` gives the next storyteller in seat order.
- `startingTotals`, `addRound`, `isGameOver(totals, trackLength, endedByHand)`, `winners` (ties share).

**Rule numbers live only in `rules.ts`**, including the 3-player rules, which are still to be
checked against a rulebook. 3 players switches them on automatically (`rulesFor`).
