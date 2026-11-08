# HS-08 — execution summary

## Pull Request
- **PR:** #9, HS-08: Offline, install and polish
- **URL:** https://github.com/harrisbinkhurram/hopscore/pull/9
- **Status:** Open

## Current State
- **Phase:** 4 (Finish)
- **Branch:** feature/hs-08-offline-install-polish
- **Worktree:** true (reused, created before the flow started)
- **Last Action:** PR #9 open, CI green (run 42482986084); every acceptance criterion passes

## Q&A Log
- New version deployed? **Button on Home** ("New version ready"), never mid-game; otherwise it
  takes over on the next fresh open (Harris).
- Last resort when 3D is too slow? **Simple 2D SVG track**, also used without WebGL (Harris).
- Leave-page prompt once votes save per tap? **Keep it always** (Harris).
- HS-07 loose ends? **Fix both simply**: another tab's change sends this tab Home with a notice;
  a kept-safe game is not offered for Resume (Harris).

- Plan review (independent reviewer, verdict repair, all fixed): precache with cache 'reload'
  (Pages max-age=600 could pair an old index.html with new chunks); the update reload skips the
  leave-page prompt; other tabs reload on an unasked controllerchange; frame watcher under ~24
  fps so a 30 fps battery-saver cap is not "slow"; the other-tab path never writes; generated
  service worker run in a test against fakes.
- Plan verifier: existing branding test left untouched (new DISCLAIMER case); AGENTS.md Dixit
  invariant reworded; plugin apply 'build' and no-op after a failed build; @types/node ^22.12.0.

- Mid-coding (Harris): rename players on the New game screen; a colour change must not reset a
  typed name. Done (shared player editor).
- AC-1 / AC-6 methods accepted with notes in the PR; AC-12 flips once CI is green (Harris).

## Next Steps
- PR #9 open, CI green. Merge when Harris asks.
