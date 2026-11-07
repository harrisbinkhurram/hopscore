# screens

The app's screens. Plain DOM, no framework: each screen renders into `#app` and re-renders itself
after every change.

| Folder | Screen |
|---|---|
| `players/` | Players and groups |
| `setup/` | New game: group or players, seat order (drag or up/down), track length |
| `round/` | One round: storyteller, each player's vote, then the points with reasons and Confirm |
| `scores/` | The garden board with a compact score readout after a round, and the winner view when the game is over |

`dom.ts` holds the shared helpers (`h`, `button`, `swatch`, `errorLine`) and loads `common.css`
(screen root, buttons, chips, shared colours). Import it before the screen's own CSS.

## Flow

`main.ts` holds the game in progress and moves between screens:

home → setup → round → scores → round → … → winner → home.

Home shows Resume while a game is in progress; it goes back to the round (with any votes already
entered) or the score list. The
game is kept for this page visit only; saving it is task 07. Until then, while a game is in
progress the page blocks pull-to-refresh and asks before leaving, and New game warns before it
replaces the game. Two-tap buttons ignore a second tap within `SECOND_TAP_DELAY_MS` (`dom.ts`).

## The board on the scores screen

The scores screen shows the garden board (`src/board/`, loaded with `import()`) above a compact
readout. `main.ts` passes a play mode: `round` straight after Confirm (the round plays once),
`finale` straight after End game (only the winner's dance), `none` on Resume. Arming End game
re-renders the screen but keeps the same board, so nothing replays. A Skip button sits on the
board while a round plays; a tap on the board skips too. Leaving the screen disposes the board.
If the board cannot load (no WebGL), the screen works without it. `board-input.ts` maps the game
to the board (pure, tested).
