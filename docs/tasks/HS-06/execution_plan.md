# HS-06 — Hops and celebrations: execution plan

Raw prompt: [raw_prompt.md](raw_prompt.md). Understanding: [prompt-understanding.md](prompt-understanding.md).
Spec: section 6 of [../../plan/spec.md](../../plan/spec.md).
Path: no tracker. "HS-06" is a local label only.
Branch: `feature/hs-06-hops-and-celebrations` (already exists, forked from `main` at `32cc389`).
Change Class: FEATURE.

## Summary

Put the HS-05 board on the scores screen, with a compact readout under it, and play each
confirmed round on it: bunnies hop one at a time (smallest gain first), big rounds celebrate,
a storyteller on 0 droops, the winner dances while the others clap, the camera follows and then
settles on the whole track. A tap or a Skip button jumps to the end. Reduced motion turns it into
a plain glide.

## Approach

Extend `src/board/`; do not rebuild it. The board keeps taking its own `BoardPlayer` type and
still knows nothing about `src/game`, `src/scoring` or `src/storage`.

### 1. Pure planning (tested, no WebGL)

- `src/board/choreography.ts`: `planRound(input)` turns one round into an ordered list of beats.

  ```ts
  interface RoundPlay {
    /** Scores after the round. The board's current scores are the "before". */
    players: readonly BoardPlayer[];
    /** Points each player gained this round (not clamped to the track). */
    gains: Readonly<Record<string, number>>;
    storyteller: string;
    /** Non-empty only when this round (or End game) finished the game. */
    winners: readonly string[];
  }
  type Beat =
    | { kind: 'hop'; id: string; stones: number[]; big: boolean } // stones to land on, in order
    | { kind: 'cheer'; id: string }                                // big gain but no stone to move (already at the finish)
    | { kind: 'droop'; id: string }
    | { kind: 'finale'; winners: string[]; others: string[] };
  ```

  Order: players with a gain, smallest gain first, ties in the order given (seat order). A player
  with gain 0 has no beat, except the storyteller, who droops in that slot (so first). Hops land
  on every stone from `before + 1` to the target, clamped to `0..trackLength` with
  `stoneForScore` from `layout.ts`. `big` is `gain >= BIG_ROUND` (5, a board constant in
  `choreography.ts`: it is a celebration threshold, not a scoring rule, so it does not belong in
  `src/scoring/rules.ts`). The finale comes last when `winners` is non-empty. A finale-only plan
  (End game tapped) is `planRound` with every gain 0 and no storyteller droop (`storyteller: ''`).

- `src/board/motion.ts`: timings and curves, all pure.
  - `timeline(beats, { reduced })` gives each beat a start and duration, one after another with a
    short pause between them, and lists every effect and camera move as timed events
    (`dust` at a landing, `petals`, `follow` a bunny, `settle` on the whole track). `board.ts`
    only carries the events out, so the tests prove what happens. Hop: about 300 ms a stone.
    Budget: hops and glides together take at most about 8 s per round; past that the time per
    stone shrinks (never under 160 ms). Big: +900 ms for the spin and petals. Droop: 1000 ms.
    Finale: 2400 ms. Reduced: hops become a glide of about 120 ms a stone, and there are no
    droop, cheer, finale, big extra, dust, petals, follow or settle events, so reduced motion has
    no effects or camera moves by construction.
  - `foldStones(before, beats)`: where each bunny ends after the beats (used by the tests to
    prove the hops end on `stoneForScore(after)` for every player, overshoot included).
  - `hopHeight(t)`, `squash(t)` (scale x/y/z for take-off and landing; volume about 1), an
    ease-in-out. Tested at the ends, peak and volume.

### 2. Three.js parts

- `bunny.ts`: split the ears out of the merged fur mesh into two ear groups, each pivoting at the
  top of the head (outer ear in fur colour + inner ear), so they can droop. Add an inner `body`
  group between the placed group and the meshes: squash/stretch scales it from the feet, hops
  raise it, spins turn it. The blob shadow stays on the ground and shrinks while the bunny is in
  the air. New methods: `setPose({ lift, squash, spin, droop })` and `restPose()`. Draw calls per
  bunny go from 5 to 8 (the outer and inner ears split into one mesh per side). With 8 bunnies
  that is 64, still small.
- `effects.ts`: one small particle pool: dust puffs (beige, low, quick fade) and petals (pink and
  white, rise then flutter down). One `InstancedMesh` per kind, a fixed pool size, no allocation
  per frame. `spawnDust(at)`, `spawnPetals(at)`, `update(dtMs)` returns whether anything is
  still alive, `clear()`, `dispose()`.
- `board.ts`:
  - New API:
    - `play(round: RoundPlay): Promise<void>`: always resolves, never rejects: when the round
      has finished, been skipped, been replaced by another `setPlayers`/`play` (which first skips
      what is playing), or the board was disposed. After `dispose()` no callback fires.
      The first hop starts only after the board has drawn its first frame with the "before"
      positions (shaders compiled with `renderer.compile`) and a short pause (about 400 ms), so
      the start does not stutter and players see where everyone was.
    - `skip(): void`
    - `BoardOptions.reducedMotion?: boolean` overrides the system setting (the debug page
      uses it). Otherwise `prefers-reduced-motion` is read. One `reduced()` check is used by the
      timeline and by the existing `goTo` camera tween (which today reads the media query only).
    - `BoardOptions.onPlayingChange?(playing: boolean)` lets the screen show and hide Skip.
  - Each bunny keeps a displayed stone. Every hop (intermediate ones too) lands on the spot
    `layoutBunnies` gives with the mover provisionally on that stone, so it never lands inside
    bunnies already standing there. When a hop starts, the bunnies on the stone it leaves and the
    stone it lands on start sliding to their new spots (about 200 ms), so nobody overlaps. The
    end state equals `layoutBunnies(final)`.
  - While playing, frames run every animation frame; when the timeline and the particles are
    done, it goes back to drawing only on change.
  - Camera: while a bunny moves, the camera follows it at a middle distance
    (`FOCUS_DISTANCE * 1.6`), smoothed. The finale and the end of the round tween back to the
    whole track. A pinch or drag during play stops the follow and the settle (the player took the
    camera; a double tap still brings back the whole track); the round keeps playing. With
    reduced motion the camera does not move.
  - Name labels follow the bunny's live x/z position, not its final spot.
  - Skip: every bunny goes to its final spot in its rest pose, particles clear, the camera goes
    to the whole track, the promise resolves.
  - `dispose()` also calls `renderer.forceContextLoss()`, because the scores screen now creates
    a board each round and browsers cap live WebGL contexts.
- `controls.ts`: add an optional `tap?()` to `ControlsHost`, called on a single tap (a
  `pointerup`, never a `pointercancel`, that did not move, with no other finger down). Double tap
  still resets. `tap` fires at once on the first tap; the second tap of a double tap calls
  `reset`, not `tap` again. The board's `tap` skips while playing and does nothing otherwise.

### 3. Game flow

- `src/screens/scores/board-input.ts` (pure, tested): maps the game to the board. It imports
  only types from `src/board/`, so Three.js stays out of the main chunk.
  - `boardPlayers(game, totals)`: seats in seat order, colour id to hex with `bunnyColour`.
  - `roundPlay(game)` (tested: after = before + gains for every player): the "before" players (totals minus the last round's points) and the
    `RoundPlay` for the last round (gains from its points, its storyteller, `winners` from
    `standings` only when `gameOver(game)`).
  - `finalePlay(game)`: no gains, the winners, for a game ended with End game.
- `src/screens/scores/scores-screen.ts`:
  - New option `play: 'round' | 'finale' | 'none'`.
  - One board stage element per screen visit, created once and re-appended on every re-render,
    so arming End game does not rebuild or replay the board.
  - The board module is loaded with `import('../../board/board')`, so Three.js stays out of the
    first load. Until it loads, the stage shows the garden background colour. If loading or
    `createBoard` fails (no WebGL), the stage is removed and the readout carries the scores.
    The screen returns an unsubscribe that disposes the board (and ignores a load that finishes
    after the screen was left).
  - A Skip button sits over the board's bottom-right corner while a round plays (48 px,
    keyboard reachable, `aria-label="Skip the animation"`).
  - Readout: compact two columns (rank, swatch, name, +gained, total), in standings order. The
    winner view keeps its title, reason line and Done button, with the board between title and
    readout.
- `src/screens/scores/scores.css`: stage (`height: clamp(15rem, 50dvh, 32rem)`, rounded, full
  column width), Skip overlay, compact readout grid; no sideways scroll at 320 px. The canvas
  takes all touches on it (pan and pinch), so the page scrolls only from outside the board: the
  stage stays at half the screen so the header, readout and buttons always leave room to swipe.
- Board lifetime: one board per scores-screen visit, disposed when the screen is left, rather
  than one board kept alive across rounds. Simpler (no canvas moved between screens, nothing
  alive behind the round screen); the start-up cost is hidden by the first-frame-then-pause
  start above, and `forceContextLoss` frees each context.
- `src/main.ts`: `showGame(root, view, play = 'none')` gains a play-mode parameter. Confirm
  (`onConfirm`) opens the scores screen with `'round'`, End game (`onEnd`) with `'finale'`,
  Resume keeps the default `'none'`. (Setup opens the round screen, so the scores screen always
  has at least one round or an ended game.) The guards are untouched: they key off
  `inProgress()`, which this does not change.

### 4. Debug page

- `debug.ts`: buttons "Play round" (random gains 0 to 7 and a random storyteller), "Final round"
  (pushes the leader to the finish and plays the finale), "Skip". URL param `motion=reduce`
  passes `reducedMotion: true`.
- `debug-params.ts`: parse `motion`; `randomGains(count, random)` (tested).

## Files

```
src/board/choreography.ts         round -> ordered beats (pure)
src/board/choreography.test.ts
src/board/motion.ts               timeline, hop/squash curves (pure)
src/board/motion.test.ts
src/board/effects.ts              dust and petal particles
src/board/bunny.ts                ear pivots, body group, setPose/restPose
src/board/board.ts                play, skip, camera follow, live labels, forceContextLoss
src/board/controls.ts             optional single-tap callback
src/board/controls.test.ts        new tests for tap (existing tests unchanged)
src/board/debug.ts                Play round, Final round, Skip
src/board/debug-params.ts         motion=reduce, randomGains
src/board/debug-params.test.ts    new tests (existing tests unchanged)
src/board/README.md               play/skip contract, new files, debug buttons
src/screens/scores/board-input.ts game -> board players and round (pure)
src/screens/scores/board-input.test.ts
src/screens/scores/scores-screen.ts board + readout + Skip
src/screens/scores/scores.css
src/screens/README.md             scores screen now shows the board
src/main.ts                       pass play mode
README.md                         debug page buttons, one line
AGENTS.md                         src/board/ no longer "planned"
docs/ai-rules/project-structure.md src/board/ is built
docs/plan/plan_manifest.json      prompt 6: in_progress, branch, folder, PR
docs/tasks/HS-06/*                these task notes
```

## Test plan

- Unit (Vitest, node):
  - `choreography.test.ts`: smallest gain first with seat-order ties; gain 0 has no beat; the
    storyteller on 0 droops; `big` from 5; hop stones are consecutive and clamp at the finish; a
    bunny at the finish with a big gain gets `cheer`; finale only with winners; finale-only plan.
  - `motion.test.ts`: beats do not overlap and run in order; reduced has no effect or camera
    events and glides faster than hops; the round budget holds for 8 players with big gains;
    `foldStones` ends every bunny on `stoneForScore(after)` (overshoot, already at the finish); `hopHeight` is 0 at both ends and peaks mid-way;
    `squash` keeps volume near 1.
  - `board-input.test.ts`: hex colours, before = after minus last points, gains, storyteller,
    winners only when over (by track and by End game); a game with no rounds (defensive) has
    no round to play.
  - `controls.test.ts`: a tap calls `tap`; a drag, a pinch (also when one finger lifts) or a
    `pointercancel` does not; a double tap calls `tap` once and `reset` once.
  - `debug-params.test.ts`: `motion=reduce`; `randomGains` range.
- `npm run typecheck`, `npm test`, `npm run build`; the main chunk still has no Three.js.
- By hand, Chrome at 390x844 and 320x700, dark and light: play a 4-player game through several
  rounds (a big round, a storyteller on 0, a shared stone), Skip by tap and by button, Home then
  Resume (no replay), End game armed (no replay) and ended (finale), a game won on the track
  (finale), and reduced motion by overriding `matchMedia` before Confirm and by
  `?board&motion=reduce`. At 320x700 with 6 players, swipe outside the board to reach End game.
  Leave mid-round (Home, Score next round) with no console errors. No sideways scroll.
  Screenshots in the PR.

## Documentation updates

- `src/board/README.md`: `play`, `skip`, the options, what each beat looks like, reduced motion,
  new files, debug buttons, draw calls now 8 per bunny.
- `src/screens/README.md`: the scores screen shows the board and readout; the play modes.
- `README.md`: one line on the debug page buttons.
- `AGENTS.md` and `docs/ai-rules/project-structure.md`: `src/board/` is no longer "planned" /
  "only a README".
- `docs/plan/plan_manifest.json`: prompt 6 `in_progress`, branch, `docs/tasks/HS-06`, PR number.

## Acceptance criteria

See [acceptance_criteria.json](acceptance_criteria.json).

## Risks

- Real-phone smoothness can only be confirmed on a phone. Mitigation: pooled particles, no
  per-frame allocation, render loop only while playing. Reported as "not confirmed" unless
  Harris tries it.
- A WebGL context per scores screen visit: mitigated by `forceContextLoss()` on dispose; checked
  by playing 10+ rounds in Chrome without a context-lost warning.
- The board takes touches for pan and pinch, so a tall board could trap scrolling. Mitigation:
  stage at half the screen height; manual swipe check at 320x700 with 6 players.
- Reduced motion from the OS can only be emulated in Chrome here (overriding `matchMedia`); the
  real phone setting is "not confirmed".

## Change log

- 2026-11-07: Plan written. Decisions with Harris: smallest gain first; board on top with
  readout below; reduced motion is a short glide with no effects.
- 2026-11-07: Plan verifier: 8 draw calls per bunny (not 9); no scores screen right after
  setup, play mode passed through `showGame`; `pointercancel` never taps. Plan reviewer: play()
  always resolves; first hop after a first frame; effects and camera as timed events; hops
  land on layout spots; round budget; board at half height; extra tap and fold tests.
- 2026-11-07: Harris asked for bunnies to face the way they travel. During a hop or glide a
  bunny turns towards where it goes (eased, about 70 ms), and turns back to face the camera when
  its turn is over.
- 2026-11-07: Found in Chrome: drooped ears stuck out sideways; they now hang beside the head.
  The finale settled to the whole track as it started, so the dance was too small to see on a
  30-step track; the camera now follows the (first) winner through the finale and settles on the
  whole track after it. Bunnies far from the winner clap out of frame.
- 2026-11-07: At 320 px the readout is one column so names stay readable; End game is reached by
  swiping on the readout. Two columns from about 340 px.
- 2026-11-07: Code review fixes: a skip always goes back to the whole track (a finger tap's
  small jitter had already made the camera "free", so it stayed zoomed in); a bunny's next hop
  starts from the stone it landed on, not from the last drawn frame.
- 2026-11-07: Checked in Chrome (dark system theme) in 390x680 and 320x680 frames: a full
  4-player game to the finish on a 10-step track, a 6-player round, Skip by button and by a
  jittery tap, Home then Resume (no replay), End game armed (same board, no replay) and ended
  (finale), leaving mid-round (board disposed, no errors), reduced motion by overriding
  `matchMedia` before Confirm (1.6 s glide, no celebration). Droop, squash, facing and the finale
  were checked frame by frame with a slowed clock on the debug page. Not checked: the light
  theme by eye, a real phone, the phone's own reduced-motion setting.

- 2026-11-07: PR self-review fixes: the bunnies' shared geometry and materials are freed when
  the last bunny is disposed (each renderer leaves a dispose listener on them, so keeping them
  kept every disposed board's renderer in memory), with a test; the round-budget test is split
  into a case where the 8 s budget holds and one that hits the 160 ms floor; the board README's
  `controls.ts` row mentions the single tap.
