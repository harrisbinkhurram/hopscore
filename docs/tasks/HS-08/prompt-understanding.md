# HS-08 — Offline, install and polish: prompt understanding

Raw prompt: [raw_prompt.md](raw_prompt.md). Spec: sections 6-8, "Technical direction" and "What can
go wrong" in [../../plan/spec.md](../../plan/spec.md).

## What changes

1. **Installable.** A web app manifest names the app "Hopscore" (name and short name), with a
   bunny icon and the light theme colour (dark comes from the page's existing `theme-color`
   metas). Start URL and scope are `/hopscore/`, the
   Pages path. Android's "Add to home screen" and iOS's home-screen icon both show the bunny and
   "Hopscore". "Dixit" is never in the manifest, the icon or the home-screen label.
2. **Works offline after the first visit.** A service worker caches the whole built app,
   including the lazy board chunk, on the first visit, and serves it with no connection.
   - A new deploy downloads in the background. Home then shows a small "New version ready" button;
     it is never shown on game screens. Tapping it switches to the new version and reloads.
     Ignored, the new version takes over the next time the app is opened from scratch.
   - Old cached versions are deleted once the new one takes over.
   - The service worker never touches localStorage: the game, history, players and groups survive
     every update.
3. **Footer** on Home: "Not affiliated with or endorsed by Libellud. Dixit is a trademark of
   Libellud."
4. **Performance.** First load stays at about 1 MB compressed or less, with Three.js still loaded
   lazily (measured before the change: about 17 KB gzip first load, 144 KB gzip board chunk). The
   board watches its frame rate while a round plays; when frames drop it turns effects down
   (fewer pixels, no dust or petals). If it is still too slow, the scores screen swaps the 3D
   board for a simple 2D track: a flat track of numbered stones with a coloured marker carrying each
   player's initial at their score (names in the score list right below), no animation. The 2D track is also shown when WebGL is missing (today
   the board just disappears). Tested with Chrome's CPU throttling; a real mid-range Android phone
   is not available from this session.
5. **Polish pass** on readability, tap target size (48 px) and light/dark rooms, checked by hand
   at a true 320 px width and with reduced motion, including the Undo hop back.
6. **Undo hook:** already connected in HS-07 (undo hops the bunnies back). Nothing to do; said in
   the PR.

### Loose ends from HS-07

7. **Votes are saved as they are tapped.** Each vote and storyteller change on the round screen
   saves the draft, so closing the tab mid-round keeps the votes. The leave-page prompt
   during a game stays as it is (Harris).
8. **Two tabs on one game.** When another tab changes the saved game, this tab drops its copy,
   takes the saved one and goes to Home with a short notice, so it never writes its stale game
   over the newer one.
9. **A game kept safe for a newer app version** is not offered for Resume: Home says it is kept
   for the newer version. It can then never reach Done here, so it is never recorded twice.

### Added by Harris during coding

10. **Rename on the New game screen.** Tapping a seated player's name opens the name and colour
    editor from the players screen. On both screens, picking a colour also saves a name typed but
    not saved yet, so it is never reset.

Kept as they are: storage keys and versions (no saved-shape change, no migration), the lazy board
chunk, the Vite base `/hopscore/`, no 6-player limit added anywhere (task 09 adds 7-8 players).

Also: `docs/plan/plan_manifest.json` marks prompt 7 completed (PR 8) and prompt 8 in progress.

## Assumptions

- The footer is on Home only, so the game screens stay uncluttered (spec: "the footer carries").
- No new runtime dependency: the service worker is a small hand-written file whose list of files
  to cache is filled in at build time by a small Vite plugin (no Workbox / vite-plugin-pwa).
- Icon PNGs (192, 512, a maskable 512 and a 180 apple-touch-icon) are rendered once from a new
  bunny SVG and committed in `public/`.

## Applicable Rules

- `project-conventions.md`, `project-structure.md`: plain DOM screens, 48 px targets, no sideways
  scroll at 320 px; board stays lazy and imports nothing from `game`/`scoring`/`storage`;
  `main.ts` changes kept small; `public/` holds static files.
- `error-handling.md`: storage never throws, never writes over kept-safe data; service worker
  registration failures are silent (the app works without it).
- `testing-patterns.md`, `test-scope-policy.md`, `test-layer-policy.md`: node-only Vitest; the
  frame-rate watcher, the 2D track layout, the cache list, the generated service worker (run
  against fakes), update watching and the other-tab signal get tests; install, screens and the
  board are checked by hand in Chrome.
- `lean-docs.md`, `lean-doc-comments.md`: update `README.md`, `src/board/README.md`,
  `src/screens/README.md`, `src/storage/README.md` where contracts change.

## Change Class

FEATURE. Existing tests stay untouched; new behaviour gets new tests.
