# board

The Three.js garden board and the low-poly bunnies, built in code. No model files, no textures
from outside: everything is made from simple shapes when the board starts.

## Use it

```ts
import { createBoard } from './board/board';

const board = createBoard(container, {
  trackLength: 30,
  players: [{ id: 'a', name: 'Ada', color: '#e85d75', score: 4 }],
});
board.setPlayers(nextPlayers); // new scores; bunnies jump straight there (task 06 adds hops)
board.focusOn('a');            // move the camera in on one bunny
board.showWholeTrack();        // back to the whole track (the default)
board.dispose();
```

The container sets the size; the board follows it. The board takes its own small `BoardPlayer`
type and does not enforce a player count (that rule lives with players and groups, task 03).
Import it lazily (`import()`), so Three.js stays out of the first load.

## Debug page

Add `?board` to the app URL, for example `http://localhost:5173/hopscore/?board`.

| Param | Meaning | Default |
|---|---|---|
| `players` | number of test bunnies, up to the 6 test colours | 4, or the number of scores |
| `length` | track length, 5 to 100 | 30 |
| `scores` | comma-separated scores, in player order | a fixed spread |

Examples: `?board&players=6&scores=3,3,3,3,3,3` (six on one stone),
`?board&length=40&scores=0,41,20,20` (a score past the finish).

## Files

| File | What it does |
|---|---|
| `track.ts` | stone positions along a gentle S-curve (pure, tested) |
| `layout.ts` | where each bunny stands; shared stones line up side by side (pure, tested) |
| `camera.ts` | fit-the-whole-track and focus maths (pure, tested) |
| `bunny.ts` | the code-built bunny |
| `garden.ts` | grass island, stones, stone numbers, bushes, trees, flowers |
| `board.ts` | scene, lights, camera, name labels, the public API |
| `debug.ts`, `debug-params.ts` | the `?board` debug page |

## Keeping it light

- Draws a frame only when something changes (new scores, resize, camera move), never in an idle loop.
- Repeated shapes (stones, bushes, trees, flowers) are one instanced mesh each. Each bunny is 5 meshes.
- Lambert materials, no shadow maps (a soft disc under each bunny instead), pixel ratio capped at 2.
- Name labels are HTML on top of the canvas, so text stays sharp and costs no textures.
