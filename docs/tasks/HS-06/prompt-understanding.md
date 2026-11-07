# HS-06 — Hops and celebrations: prompt understanding

Raw prompt: [raw_prompt.md](raw_prompt.md). Spec: section 6 of [../../plan/spec.md](../../plan/spec.md).

## What changes

The screen after a round stops being a plain list. It shows the garden board from HS-05, and
right after Confirm the round plays out on it:

1. **Board in the game flow.** The scores screen shows the board on top (about 60% of the
   screen height) with a compact two-column readout under it (rank, name, points gained this
   round, total), then "Next storyteller", "Score next round" and the two-tap End game, as today.
   The winner view keeps its title and Done button, with the board above them. Before the first
   round the board shows everyone on the start stone.
2. **Hops.** After Confirm, each bunny that scored hops forward one stone at a time, with squash
   and stretch on take-off and landing and a dust puff on each landing. Bunnies go one after
   another: **smallest gain first, biggest last**, ties in seat order. A bunny that scored 0 does
   not hop.
3. **Big round.** A bunny that gained 5 or more this round spins and a burst of petals goes up
   once it lands.
4. **Storyteller scored 0.** Its ears droop for a moment, in its turn in the order.
5. **Winner.** When the round ends the game, the winner (or every tied winner) does a victory
   dance where they stand (the finish, or their stone when End game was used), and the others
   clap: small bounces in place.
6. **Camera.** Follows the bunny that is moving, then settles back on the whole track.
7. **Skip.** A tap on the board, or a visible Skip button on it, puts every bunny on its final
   stone at once and ends the effects.
8. **Reduced motion.** When the phone asks for less motion: each bunny in turn glides along the
   path to its new stone, with no bounce, squash, dust, petals, droop, dance, clapping or camera
   moves.

The animation plays once, straight after Confirm. Coming back to the scores screen through Home
then Resume, or arming End game, shows the final positions without replaying.

Kept as they are: the in-game guards (pull-to-refresh blocked, leave-page prompt, two-tap New
game and End game), the pinch/drag/double-tap camera, and render-on-demand when nothing moves.
No 6-bunny limit is added to the board (task 09 brings 7 and 8 players).

Out of scope: undo with hops back (task 07), saving the game (task 07), sounds, PWA.

## Applicable Rules

- `docs/ai-rules/project-conventions.md`, `project-structure.md`: `src/board/` stays separate
  from `src/scoring`; board input stays its own `BoardPlayer` type; Three.js stays lazy-loaded.
- `docs/ai-rules/testing-patterns.md`, `test-scope-policy.md`, `test-layer-policy.md`: node-only
  Vitest, so the order of moves and the motion curves are pure, tested functions; the screen and
  WebGL parts are checked by hand at 390 px and 320 px.
- `docs/ai-rules/project-conventions.md` (Screens): plain DOM, whole-screen re-render keeping the
  scroll, `.sc-` classes, 48 px tap targets, no sideways scroll at 320 px. The board element must
  survive the re-render that arming End game does.
- `docs/ai-rules/error-handling.md`: no pop-ups. Not written there but kept in the same spirit:
  if the board cannot load (no WebGL), the screen still works, because the readout carries the
  scores.
- `core-engineering-standards.md`, `lean-docs.md`, `lean-doc-comments.md`: update
  `src/board/README.md` and `src/screens/README.md` for the new contract.

## Change Class

FEATURE. Existing tests stay untouched; new behaviour gets new tests.

## Decisions taken with Harris (2026-11-07)

- Hop order: smallest gain first, ties in seat order.
- Layout: board on top, compact readout below.
- Reduced motion: short glide, no effects.
