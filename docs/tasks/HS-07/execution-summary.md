# HS-07 — execution summary

## Current State
- **Phase:** 4 (Finish)
- **Branch:** feature/hs-07-undo-resume-history
- **Last Action:** PR #8 opened, CI green

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

- PR review (self-review, not posted; fixed on the branch instead): Undo/Redo/Done ignore the
  second tap of a double tap; Past games dates a game by when it ended, not when Done was
  tapped or the app reopened; `restoreGame` rejects rounds after the win. Left open: two tabs on
  one game can overwrite each other (tab sync out of scope); a kept-safe in-progress game can be
  recorded twice after Done.
- While testing, Harris asked for one colour per player (marked with the holder, locked while a
  free colour is left) and a players/groups list that does not re-sort on rename. Done.

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
- PR #8 open, CI green. Merge when Harris asks.
