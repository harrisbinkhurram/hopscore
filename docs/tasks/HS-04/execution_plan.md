# HS-04 — Game setup and round entry: execution plan

Raw prompt: [raw_prompt.md](raw_prompt.md). Spec: [../../plan/spec.md](../../plan/spec.md).
Path: no tracker. "HS-04" is a local label only.
Branch: `feature/hs-04-setup-and-round-entry` (already exists, forked from `main` at `4d740d5`).
Change class: `FEATURE` (new behaviour; no existing test changes).

## Understanding

Tasks 02 (scoring engine) and 03 (saved players and groups) are on `main` but nothing joins them
yet. This task makes a whole game playable on a phone, with scores shown as a plain 2D list.

1. Home: New game, and Resume while a game is in progress.
2. New game: pick a saved group (one tap) or tap players, 3 to 6. Add a new player inline. Drag to
   set seat order. Track length, default 30. With 3 players the 3-player rules switch on by
   themselves (the engine's `rulesFor` already does this; the screen says so).
3. Round entry: storyteller filled in from the rotation, can be changed. For each other player, tap
   whose card they voted for. A player's own name is never offered.
4. Review: each player's points with the engine's reasons, then Confirm.
5. Score list after each round. Winner screen when someone reaches the track length, or when the
   scorekeeper taps End game. Ties share the win.

One hand, portrait, dim room: big tap targets (48 px or more), one column, light and dark.

Out of scope: the 3D board (task 06 puts it in place of the score list), undo, saving the game
across reloads, and history (task 07).

### Assumptions (confirm at the plan checkpoint)

- **Resume is in memory only.** It returns to a game left for the home screen (for example to edit
  players) during the same page visit. Surviving a reload is task 07, which says "Save the game in
  progress after every round".
- **Track length**: a stepper, 10 to 60 in steps of 5, default 30.
- **Seat order**: drag by a handle (pointer events, works with touch and mouse), plus up/down
  buttons on each seat for keyboard and for anyone who finds dragging fiddly. Seat 1 tells the
  first story.
- **Changing the storyteller** mid-entry drops only the new storyteller's own vote; other votes
  stay. The next round's storyteller follows on from whoever actually told this round's story.
- **End game** needs two taps (same pattern as delete on the players screen), since it cannot be
  undone in this task.
- **Names are copied into the game** when it starts, so renaming or deleting a saved player
  mid-game does not break the score list.
- `markUsed(seats)` is called when a game starts, so these players come first next time.

## Approach

### Game state (`src/game/`, new, pure, node-tested)

No DOM, no storage. Uses scoring through `src/scoring/index.ts` only; never re-implements a rule.

- `types.ts`
  - `SeatedPlayer { id, name, colour }`.
  - `Game { seats: SeatedPlayer[]; trackLength; storyteller: PlayerId (next to tell);
    rounds: RoundResult[]; totals: Totals; endedByHand: boolean }`.
  - `TRACK_LENGTH = { default: 30, min: 10, max: 60, step: 5 }` (a setup option, not a scoring
    rule, so it does not go in `scoring/rules.ts`).
- `game.ts`
  - `setupProblems(seatIds, trackLength): string[]` = `validateSeats` plus a track-length check.
  - `newGame(seats, trackLength): Game` (throws `Error` when `setupProblems` is not empty, like the
    engine). Storyteller = seat 1, totals from `startingTotals`.
  - `voteChoices(game, storyteller, voter): SeatedPlayer[]` = every seat except the voter.
  - `scorePending(game, storyteller, votes): RoundResult` = `scoreRound` on the game's seat ids.
  - `applyRound(game, result): Game` = `addRound` totals, round appended, storyteller =
    `nextStoryteller(seats, result.storyteller)`.
  - `endGame(game): Game` sets `endedByHand`.
  - `gameOver(game)` = `isGameOver(totals, trackLength, endedByHand)`.
  - `standings(game)`: seats with total, rank (ties share a rank), and winner flag (`winners`).
- `README.md`: the contract above.

### Screens (`src/screens/`)

- `dom.ts` (new): `h`, `button`, `swatch`, `errorLine` moved out of `players-screen.ts`, so the new
  screens do not copy them. `players-screen.ts` only changes its import (behaviour unchanged).
- `common.css` (new, imported by `dom.ts`): `#app.screen-root`, `.btn*` and `.home-link`, moved
  from `players.css`. The button colours read `--ps-surface`, `--ps-line` and `--ps-danger`, which
  are only defined on `.players-screen`, so outside that screen (the home page today) buttons get
  no surface or line colour. `common.css` defines them as `--surface`, `--line`, `--danger` on
  `:root` (with dark values); `players.css` and the new screens use those names.
- `setup/setup-screen.ts` + `setup.css` (`.su-` prefix): `showSetupScreen(root, store, { onBack,
  onStart(game) })`.
  - Groups first (one tap seats that group, in its saved order); groups under 3 players are shown
    but disabled with "Needs 3 players".
  - Players (recent first): tap to seat or unseat. At 6 seated, the rest are disabled.
  - Inline add: name field + Add; the new player is seated. Store errors shown under the field.
  - Seat order list with drag handle and up/down buttons; "Tells the first story" on seat 1.
  - Track length stepper. A line "3 players: 3-player rules (each player puts in 2 cards)" when 3
    are seated.
  - Start game: disabled until `setupProblems` is empty; calls `store.markUsed`, then `onStart`.
- `round/round-screen.ts` + `round.css` (`.rd-` prefix): `showRoundScreen(root, game,
  { onConfirm(game), onHome })`.
  - Entry step: "Round N", storyteller with a Change button (opens a chip row of all seats).
    Under it, one block per voter in seat order: their name and a row of big name chips from
    `voteChoices`; the storyteller's chip is marked "storyteller". Chosen chip uses
    `aria-pressed`. Review is enabled once every voter has voted.
  - Review step: each player, seat order: name, round points, the engine's reason lines. Confirm
    and "Change votes" (back, votes kept).
- `scores/scores-screen.ts` + `scores.css` (`.sc-` prefix): `showScoresScreen(root, game,
  { onNextRound, onEnd(game), onHome })`.
  - Ranked list: rank, swatch, name, total, "+N" from the last round, and track length.
  - "Next storyteller: X", Next round, End game (two taps), Home.
  - Winner view (same file, when `gameOver`): "Alice wins!" or "Alice and Bob share the win!",
    final standings, Done (returns home and clears the game).

### Flow (`src/main.ts`, shared, kept small)

`main.ts` keeps one `let game: Game | null`. Home shows **New game**, **Resume** (only when a game
is in progress and not over), and **Players & groups**; the "Coming soon" note goes. Each screen's
callbacks move between home → setup → round → scores → round … → winner → home. Board debug view
(`?board`) is untouched.

## Files

```
src/game/types.ts                  Game, SeatedPlayer, TRACK_LENGTH
src/game/game.ts                   newGame, applyRound, standings, ...
src/game/game.test.ts              tests (see test plan)
src/game/README.md                 contract
src/screens/dom.ts                 shared DOM helpers (moved from players-screen.ts)
src/screens/common.css             shared buttons and screen root (moved from players.css)
src/screens/players/players-screen.ts   import helpers from ../dom
src/screens/players/players.css    shared rules removed
src/screens/setup/setup-screen.ts, setup.css
src/screens/round/round-screen.ts, round.css
src/screens/scores/scores-screen.ts, scores.css
src/screens/README.md              list the screens and the flow
src/main.ts                        home buttons and the flow
AGENTS.md, docs/ai-rules/project-structure.md   add src/game; screens folders
docs/ai-rules/project-conventions.md            helpers now in src/screens/dom.ts
docs/plan/plan_manifest.json       statuses (see below)
docs/tasks/HS-04/*                 these notes
```

### Plan manifest fix (asked for in the task)

- prompt 2: `completed`, pr 2 (branch and folder already set).
- prompt 3: `completed`, branch `feature/hs-03-players-and-groups`, folder `docs/tasks/HS-03`, pr 3.
- prompt 5: `completed`, branch `feature/hs-05-garden-board-and-bunnies`, pr 4.
- prompt 4: `in_progress`, branch `feature/hs-04-setup-and-round-entry`, folder
  `docs/tasks/HS-04`; pr filled in once the PR is open. Top-level `status` goes from `planned` to
  `in_progress` (half the prompts are done).

## Test plan

Vitest, node only (no jsdom, as `testing-patterns.md` says). `src/game/game.test.ts`:

- `setupProblems` / `newGame`: 2 and 7 players rejected, duplicate seat rejected, track length
  below 10, above 60 and non-integer rejected; valid game starts with seat 1 telling, totals 0.
- `voteChoices`: never offers the voter; offers the storyteller.
- `scorePending` + `applyRound`: totals add up over two rounds; storyteller rotates in seat order
  and wraps; a changed storyteller makes rotation continue from them; 3 players use the 3-player
  rules (result equals `scoreRound` with `THREE_PLAYER_RULES`); `applyRound` does not change its
  input.
- `gameOver`: false at start, true when a total reaches the track length, true after `endGame`.
- `standings`: ordered by total, ties share rank and both are winners.

Commands: `npm run typecheck`, `npm test`, `npm run build`.

Manual, `npm run dev` in Chrome with a 390 px and a 320 px wide viewport, light and dark:
start from a group; start by tapping players; inline add; drag and up/down reorder; 3-player notice;
round entry hides each voter's own name; change storyteller; review reasons; confirm; score list;
Home then Resume; End game (two taps) to winner; play to the track length (set 10) to winner;
no sideways scroll, tap targets 48 px or more.

## Documentation updates

- `src/game/README.md` (new), `src/screens/README.md` (screens and flow).
- `AGENTS.md` project structure table and `docs/ai-rules/project-structure.md`: add `src/game/`;
  the `src/screens/` row lists the new folders; dependency direction adds: `game` uses `scoring`
  only (no storage, no DOM); `screens` and `main.ts` use `game`.
- `docs/ai-rules/project-conventions.md`: DOM helpers live in `src/screens/dom.ts`.

## Acceptance criteria

See [acceptance_criteria.json](acceptance_criteria.json).

1. AC-1: A game starts only with 3 to 6 distinct players and a valid track length; seat 1 tells first.
2. AC-2: A round's points come from the scoring engine, and totals add up across rounds.
3. AC-3: The storyteller rotates in seat order, following on from a changed storyteller.
4. AC-4: A voter is never offered their own card.
5. AC-5: The game is over at the track length or after End game; ties share the win.
6. AC-6: The setup screen picks a group or players, adds inline, reorders by drag, sets track
   length, notes 3-player rules, and marks players used.
7. AC-7: Round entry, review with reasons, score list and winner screen work one-handed at
   320 px and 390 px, with Resume from home.
8. AC-8: Plan manifest shows prompts 2, 3 and 5 completed and 4 in progress with its PR.
9. AC-9: Typecheck, tests and build pass locally and in CI on the PR.

## Risks

- `main.ts` and `players.css` are shared. The CSS move must not change how the players screen
  looks: check it by hand after the move.
- Drag on touch fights page scroll: the handle uses `touch-action: none` and pointer capture; the
  up/down buttons are the fallback.
- No DOM tests: screens are checked by hand, as before.

## Change log

- 2026-11-07: Plan verifier: CSS variables are scoped to the players screen (fixed in the
  `common.css` step), manifest top-level status, and dependency-direction doc update. Folded in.
- 2026-11-07: Added `src/game/index.ts` as the module's barrel, like `src/scoring`. Start game goes
  straight to round 1 entry (the score list would show only zeros).
- 2026-11-07: Manual check in Chrome (dev server, viewport about 560 px, plus 320 px and 390 px
  frames on the same page): group start, tapping players, inline add with the duplicate-name error,
  up/down and mouse drag reorder, 3-player note, track 10, three rounds to "Ben wins!" by track
  length, Home then Resume, storyteller change (that player's vote dropped, rotation follows on),
  End game armed then played on, End game with a tie ("Eli and Fay share the win!"), players marked
  used. No sideways scroll and no tap target under 48 px on any screen at 320 and 390 px. Light
  mode checked by removing the dark rules in the page. Not checked: a real touch drag on a phone.
- 2026-11-07: Found while testing: the first drag moved the dragged row in the DOM, which drops the
  pointer capture, so the drag stuck after one row. Fixed: neighbours move around the dragged row,
  and losing the capture ends the drag. Also fixed: each re-render jumped the page to the top
  (setup, round votes, arming End game); the scroll position is now kept.
