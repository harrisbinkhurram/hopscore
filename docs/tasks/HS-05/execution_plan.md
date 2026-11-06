# HS-05 — Garden board and bunnies: execution plan

Raw prompt: [raw_prompt.md](raw_prompt.md). Spec: [../../plan/spec.md](../../plan/spec.md).
Path: no tracker. "HS-05" is a local label only.
Branch: `feature/hs-05-garden-board-and-bunnies` (already exists, forked from `main`).

## Understanding

Build the static 3D board: a small garden with a winding path of stepping stones, code-built
low-poly bunnies (one colour per player, name above), bunnies standing on the stone for their
score, side by side when they share a stone, a portrait camera that shows the whole track or
focuses on one bunny, and warm lighting that reads in a dark room. No movement (task 06). Not
wired into the game flow (task 06); a debug URL flag shows it with test scores.

Out of scope: hops and effects, the game screens, storage, the 2D fallback, the PWA.

## Approach

All code stays in `src/board/`. The board does not import from `src/scoring` or `src/storage`
(they are being built in parallel). It takes its own small input type:

```ts
interface BoardPlayer { id: string; name: string; color: string; score: number }
```

Task 06 maps the real game state onto it.

Pure logic, kept free of WebGL so it can be unit tested:

- `track.ts`: stone positions for a given track length. Stone 0 is the start, stone N the
  finish, so N + 1 stones. The path is a gentle S-curve that zig-zags up the screen, so a long
  track fits a portrait view. Stones are evenly spaced along the curve.
- `layout.ts`: where each bunny stands. Score is clamped to 0..N (a score past the end waits on
  the final stone). Bunnies on the same stone are spread side by side, across the path, with
  spacing wide enough that they never overlap.
- `camera.ts`: camera distance that fits a set of points in the view for a given aspect and
  field of view, plus the "focus one bunny" target.

Three.js parts:

- `bunny.ts`: an original bunny from a few low-poly shapes (rounded body, head, two long ears
  with a light inner colour, tail puff, dot eyes), flat-shaded. Name label is a sprite with a
  canvas texture, always facing the camera, with a dark outline so it reads on any background.
- `garden.ts`: grass ground, path stones (low-poly cylinders), numbers on every 5th stone and
  on the finish (canvas texture on top of the stone), and a few bushes, trees and flowers placed
  with a fixed seed. Repeated decorations use `InstancedMesh` to keep draw calls low.
- `board.ts`: `createBoard(container, { trackLength, players })` returns
  `{ setPlayers, showWholeTrack, focusOn(playerId), dispose }`. Warm hemisphere light plus
  one warm sun, no shadows maps (a cheap blob shadow under each bunny instead). Renders only
  when something changes or the window resizes, not every frame, so an idle board costs nothing.
  Pixel ratio capped at 2. Antialias on.
- `debug.ts`: the debug page. Opened with `?board` on the normal URL. Optional params:
  `players=4`, `length=30`, `scores=0,5,5,12`. The board itself draws any number of players and
  does not enforce a player count: the 3 to 6 rule belongs to task 03. The debug page caps
  `players` at its six test colours, as a debug convenience only. Shows buttons: "Whole track", one per
  bunny name to focus it, and "Random scores".

Shared files, minimal change:

- `src/main.ts`: if the URL has `board`, lazy-load `./board/debug` with a dynamic `import()`.
  Otherwise unchanged. Three.js stays out of the main chunk, so the first load stays small.
- `src/style.css`: no change (the debug page brings its own small styles from `src/board/`).
- `README.md`: one line on how to open the debug board.

## Files

```
src/board/track.ts            stone positions along the path (pure)
src/board/track.test.ts
src/board/layout.ts           bunny positions, side by side on shared stones (pure)
src/board/layout.test.ts
src/board/camera.ts           fit-whole-track and focus math (pure)
src/board/camera.test.ts
src/board/bunny.ts            code-built bunny + name label
src/board/garden.ts           ground, stones, numbers, decorations
src/board/board.ts            scene, lights, camera, render-on-demand, public API
src/board/board.css           board and name-label styles
src/board/debug.ts            ?board debug page
src/board/debug-params.ts     reads the debug URL params (pure, tested)
src/board/debug-params.test.ts
src/board/debug.css
src/board/README.md           what is here and how to open the debug page
src/main.ts                   lazy-load the debug page on ?board
README.md                     one line about ?board
docs/tasks/HS-05/*            these task notes
```

## Test plan

- Unit (Vitest, node): track has N + 1 stones, evenly spaced, fits a portrait-shaped area,
  numbered stones are 5, 10, ... and the finish; layout clamps scores, puts bunnies on the right
  stone, and shared-stone bunnies keep a minimum gap; camera fit contains every point.
- `npm run typecheck`, `npm test`, `npm run build`. Check the main chunk does not contain
  Three.js (separate lazy chunk).
- By hand, in Chrome at phone sizes (360×780, 390×844): open `?board`, `?board&players=6&scores=3,3,3,3,3,3`,
  `?board&length=40&scores=0,41,20,20`. Whole track fits, names readable, no overlap, focus
  works, light and dark system themes both read. Screenshots in the PR.

## Acceptance criteria

See [acceptance_criteria.json](acceptance_criteria.json).

## Risks

- Real mid-range Android performance can only be checked on a phone. Mitigation: render on
  demand, few draw calls (instancing), no shadow maps, pixel ratio cap. A real-phone check is
  reported as "not confirmed" unless Harris tries it.
- Text on canvas textures can blur at small sizes. Labels are drawn at 2x and sized in world
  units with a minimum on-screen size.

## Change log

- 2026-11-05: Harris noted the 3 to 6 player rule belongs to task 03. The board does not
  enforce a player count.
- 2026-11-05: Bunnies that share a stone now line up along the screen's x axis, not across the
  path. Across the path read as front/back on screen on diagonal stretches. To keep them clear of
  the next stone, the path never turns more than 30 degrees off straight up (tested).
- 2026-11-05: Name labels are HTML over the canvas, not sprites: sharp text at any zoom, and easy
  to keep apart in screen pixels. Crowded labels stack, each with a thin stem to its bunny. A
  label that would leave the top of the screen goes under its bunny's feet instead.
- 2026-11-05: Bunnies drawn 1.3x bigger to read better in the whole-track view. The footprint is
  a constant in `layout.ts`, and the tests check that footprints never touch, on a shared stone or
  on neighbouring stones.
- 2026-11-05: Checked in Chrome in 360x700 and 390x700 frames (dark system theme): track lengths
  20, 30 and 40, six bunnies on one stone, six crowded at the finish, a score past the end, focus
  and back. No console errors, no sideways scroll. The light theme only changes the background
  colour and was not checked by eye. Not checked on a real phone.
- 2026-11-05: Build: main chunk 2.9 kB; Three.js and the board are a lazy 140 kB (gzip) chunk
  loaded only by `?board`. Vite warns the lazy chunk is over 500 kB before compression; that is
  Three.js itself and within the 1 MB budget.
- 2026-11-06: Harris asked for a camera that can be pinched to zoom and dragged to pan. Added
  `controls.ts`: one-finger drag pans (the ground stays under the finger), two-finger pinch zooms
  about the point between the fingers, mouse wheel zooms about the cursor, double tap goes back
  to the whole track. Limits: no closer than 2.5 units, no farther than 1.3x the whole-track
  view, and the view stays over the garden. After a gesture the camera stays put until a reset.
  The maths is in `camera.ts`, and both files are unit tested. Checked in Chrome: wheel zoom,
  drag pan, double click, and a synthetic two-finger pinch (the bunnies stayed under the fingers).
  Not checked with real fingers on a phone.
- 2026-11-06: Harris asked for bigger stones that hold 3 to 4 bunnies. Stones are now 1.05
  across in radius (start and finish 1.5, for the whole group). Bunnies gather on the stone: one
  in the middle, a pair, a triangle, a 2x2 square; five or six stand in two rows of three. Each
  group now stays on its own stone, so the path no longer needs the 30-degree limit. It winds in
  side-to-side rows to fill a portrait screen: `buildTrack` tries several amounts of winding and
  keeps the most compact one where no two stones crowd (neighbours included, on tight bends too).
  A faint worn trail under the stones shows the order. Tests check that bunnies on any two stones
  never touch for every way of splitting six players. Net effect: the 30-step track is shorter
  on screen, so the bunnies are bigger in the whole-track view.

