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
board.setPlayers(nextPlayers); // new scores; bunnies jump straight there
await board.play({             // play one round from the current scores
  players: afterRound,         //   scores after the round
  gains: { a: 3 },             //   points gained this round (not clamped to the track)
  storyteller: 'a',
  winners: [],                 //   non-empty only when the game is over
});
board.skip();                  // everyone to their final stone at once
board.focusOn('a');            // move the camera in on one bunny
board.showWholeTrack();        // back to the whole track (the default)
board.dispose();
```

Options: `reducedMotion` overrides the phone's setting; `onPlayingChange(playing)` says when a
round starts and stops (the scores screen shows Skip with it).

## A round

`play()` shows where everyone was for a moment, then:

- each bunny that scored hops forward one stone at a time, smallest gain first (ties in the
  order given), facing where it goes, with squash and stretch and a dust puff on each landing.
  A bunny landing on a shared stone takes its place in the group and the others make room;
- a gain of 5 or more (`BIG_ROUND`) ends with a spin and a burst of petals;
- a storyteller on 0 droops its ears for a moment;
- with `winners`, the winner dances and the others clap; with no gains it plays only that
  (after End game);
- the camera follows whoever moves, then settles on the whole track. A pinch or drag during a
  round leaves the camera with the player.

Hops share a budget of about 8 seconds per round; longer runs hop faster. A tap on the board
skips (a double tap still resets the camera). `play()` always resolves: at the end, on skip,
when replaced by another `play()` or `setPlayers()`, or on `dispose()`, after which no callback
fires.

Reduced motion (the phone's setting, or the option): each bunny in turn glides to its stone, with
no bounce, squash, dust, petals, droop, dance or camera move.

Players can move the camera themselves:

- pinch to zoom (about the point between the fingers), drag with one finger to pan;
- on a computer, the mouse wheel or trackpad zooms about the cursor, and dragging pans;
- double tap (or double click) goes back to the whole track.

Zoom stops between a close-up and a little past the whole track, and the view stays over the
garden. After a gesture the camera stays where it was left, also when scores change, until
`showWholeTrack()`, `focusOn()` or a double tap.

The container sets the size; the board follows it. The board takes its own small `BoardPlayer`
type and does not enforce a player count (that rule lives with players and groups, task 03).
Import it lazily (`import()`), so Three.js stays out of the first load.

## Debug page

Add `?board` to the app URL, for example `http://localhost:5173/hopscore/?board`.

| Param | Meaning | Default |
|---|---|---|
| `motion` | `reduce` plays rounds as reduced motion | off |
| `players` | number of test bunnies, up to the 6 test colours | 4, or the number of scores |
| `length` | track length, 5 to 100 | 30 |
| `scores` | comma-separated scores, in player order | a fixed spread |

Examples: `?board&players=6&scores=3,3,3,3,3,3` (six on one stone),
`?board&length=40&scores=0,41,20,20` (a score past the finish).

Buttons: "Play round" (random gains 0 to 7 and a random storyteller), "Final round" (the leader
reaches the finish, then the finale), "Skip".

## Files

| File | What it does |
|---|---|
| `track.ts` | stone positions along a winding path; picks the most compact path where no stones crowd (pure, tested) |
| `layout.ts` | where each bunny stands; up to four gather on one stone, five or six in two rows (pure, tested) |
| `camera.ts` | fit-the-whole-track, focus, zoom, pan and limits maths (pure, tested) |
| `controls.ts` | pinch, drag, wheel and double-tap handling (tested with a stand-in element) |
| `bunny.ts` | the code-built bunny; ears on pivots so they can droop, `setPose` for hops, squash, spin |
| `choreography.ts` | a round as ordered beats: hops, cheers, droop, finale (pure, tested) |
| `motion.ts` | the timeline (beats, dust, petals, camera events), hop and squash curves (pure, tested) |
| `effects.ts` | dust puffs and petals, pooled particles |
| `garden.ts` | open grass field with lighter and darker patches, the trail, stones, stone numbers, bushes, trees, flowers |
| `board.ts` | scene, lights, camera, name labels, playing a round, the public API |
| `debug.ts`, `debug-params.ts` | the `?board` debug page |

## Keeping it light

- Draws a frame only when something changes (new scores, resize, camera move) or while a round
  plays, never in an idle loop.
- Repeated shapes (stones, bushes, trees, flowers) are one instanced mesh each. Each bunny is 8
  meshes. Dust and petals are one instanced mesh each, with a fixed pool: nothing is allocated
  per frame.
- Shaders are compiled when the board is made, and `dispose()` frees the WebGL context, because
  the scores screen makes a new board each visit.
- Lambert materials, no shadow maps (a soft disc under each bunny instead), pixel ratio capped at 2.
- Name labels are HTML on top of the canvas, so text stays sharp and costs no textures.
