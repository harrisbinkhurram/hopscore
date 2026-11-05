# HS-02 — Scoring engine: execution plan

Raw prompt: [raw_prompt.md](raw_prompt.md). Spec: [../../plan/spec.md](../../plan/spec.md), Scoring section.
No tracker. "HS-02" is a local label. Branch: `feature/hs-02-scoring-engine`.

## Understanding

Pure TypeScript logic in `src/scoring/`, no UI, no storage. Given the seat order, the storyteller
and each voter's pick, it returns every player's points for the round with short reasons. It
rejects impossible input with a clear message, says who tells the story next, and decides when the
game is over and who won. Task 04 calls it; task 07 replays it for undo.

Out of scope: screens, storage, the board. Other lanes own `src/storage`, `src/board`.

## Approach

Files, all under `src/scoring/`:

| File | Holds |
|---|---|
| `rules.ts` | **The one place for rule numbers**: the points table, the +1 bonus, and the 3-player variant (`cardsPerNonStoryteller: 2`, `bonusCap: null`, marked "to verify"). `rulesFor(playerCount)` picks the set. |
| `types.ts` | `PlayerId` (string), `RoundInput`, `PlayerRoundScore`, `ScoreReason`, `RoundResult`. |
| `validate.ts` | `validateRound(input)` returns a list of plain-English problems; `RoundInputError` carries them. |
| `score.ts` | `scoreRound(input)`: validates (throws `RoundInputError`), then scores. |
| `rotation.ts` | `nextStoryteller(seats, current)`, wraps around. |
| `game.ts` | `addRound(totals, result)`, `isGameOver(totals, trackLength, endedByHand)`, `winners(totals)` (ties share). |
| `index.ts` | Public exports. |
| `*.test.ts` | Table-driven Vitest tests. |

Input shape: `{ seats: PlayerId[], storyteller: PlayerId, votes: Record<voter, cardOwner> }`.
A vote names *whose card* was picked, as in the spec's round entry. In 3-player games that also
covers "either of a player's two cards", so the input shape is the same.

Scoring (from the spec table):
- All voters found the storyteller, or none did: storyteller 0, every other player 2.
- Some found it: storyteller 3, finders 3, the rest 0.
- Plus each non-storyteller gets +1 per vote on their card (capped by `bonusCap` if set).

Reasons, one per scoring line, with the points: "found the storyteller: +3",
"missed the storyteller: +0", "everyone found the storyteller: +2",
"nobody found the storyteller: +2", "some found your card: +3", "everyone found your card: +0",
"nobody found your card: +0", "1 vote on your card: +1", "2 votes on your card: +2".
Each reason also has a stable `kind` code, so task 04 can style or translate them.

Rejected input (each with its own message): fewer than 3 or more than 6 players, duplicate or
blank seat names, storyteller not seated, storyteller voting, a missing vote, a vote from or for
someone not seated, a vote for your own card.

Game end: over when any total reaches `trackLength`, or when ended by hand. `winners` returns
every player sharing the top total (all of them if everyone ties).

Also: update `docs/plan/plan_manifest.json` prompt 01 to completed / `feature/hs-01-skeleton-and-deploy` / PR 1
(only this lane does that), mark prompt 02 in progress. Replace `src/scoring/README.md` with a short
usage note. No changes to `package.json`, `main.ts`, `vite.config.ts`.

## Test plan

- `rules`/`score`: one table row per spec case (all found, none found, some found) for 3, 4, 5, 6
  players; bonus counting (0, 1, several votes; storyteller never gets bonus); 3-player rules
  picked for 3 players; bonus cap applied when set (tested by passing a rules object).
- `validate`: one row per bad-input case, checking the message.
- `rotation`: next in order, wraps, unknown storyteller rejected.
- `game`: totals add up, over at exactly the track length and past it, ended by hand, single
  winner, two-way and all-way ties.
- `npm test`, `npm run typecheck`, `npm run build` all pass; CI green on the PR.

## Acceptance criteria

See [acceptance_criteria.json](acceptance_criteria.json).

## Risks

- The 3-player rules are unconfirmed. Kept in `rules.ts` so a rulebook check is a one-line edit.
- Parallel lanes may touch the README; this lane does not.
