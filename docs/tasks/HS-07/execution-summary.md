# HS-07 — execution summary

## Current State
- **Phase:** 4 (Finish)
- **Branch:** feature/hs-07-undo-resume-history
- **Last Action:** Code, tests, docs and review fixes done; PR next

## Q&A Log
- Leave-page prompt once the game is saved? **Keep it always** (Harris).
- Undo on the winner view? **Yes**: a win at the finish loses the winning round; End game is
  simply taken back.
- Undo taps? **One tap.**
- History size? **10.**
- During coding Harris asked for **Redo**, cleared by the next move. Added (plan Change Log, AC-9).
- Plan verifier: storage may not import `game`/`scoring` (`project-structure.md`), so storage
  checks shapes only and `restoreGame` in `src/game` checks the rules; `SafeStorage.remove` keeps
  a removed key from coming back from the read-only fallback.

- Code review: two bugs fixed (an over game kept safe for a newer app was recorded into the
  history on every visit; clearing the game did not remove it from full storage). Not done:
  the game store's `notSavedReason` is not shown on any screen; the kept leave-page prompt covers
  the blocked-storage case.

## Verification
- `npm run typecheck`, `npm test` (330 tests), `npm run build`: pass locally.
- Manual, Chrome at 390 px: Confirm, Undo (bunnies hop back, Skip shown), Redo of a round,
  Resume in a fresh tab lands on round 2 with the entered vote, Resume onto the scores screen does
  not replay, End game, Undo End game, Redo End game, Done, Past games, two-tap delete and the
  empty state, a broken and a rule-breaking saved game dropped with the players kept, no console
  errors.
- **Not checked by hand:** reduced motion for the hop back (the glide path is shared with
  forward hops), and a real 320 px viewport (Chrome's window would not go below 400 px; page
  width stayed inside the viewport there).

## Next Steps
- Code review, commit, PR, CI.
