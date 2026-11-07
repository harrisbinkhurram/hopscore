# screens

The app's screens. Plain DOM, no framework: each screen renders into `#app` and re-renders itself
after every change.

| Folder | Screen |
|---|---|
| `players/` | Players and groups |
| `setup/` | New game: group or players, seat order (drag or up/down), track length |
| `round/` | One round: storyteller, each player's vote, then the points with reasons and Confirm |
| `scores/` | The garden board with a compact score readout after a round, and the winner view when the game is over |
| `history/` | Past games: date, players by final score, winner marked, two-tap Delete |

`dom.ts` holds the shared helpers (`h`, `button`, `swatch`, `errorLine`) and loads `common.css`
(screen root, buttons, chips, shared colours). Import it before the screen's own CSS.

## Flow

`main.ts` holds the game in progress and moves between screens:

home → setup → round → scores → round → … → winner → home.

Home shows Resume while a game is in progress; it goes back to the round (with any votes already
entered) or the score list. The game is saved after every step (start, Confirm, Undo, Redo, End
game, and Home with the votes entered), so Resume also works after closing the app. Done moves
the game into the history; a game closed on the winner view goes there the next time the app
opens. Home shows Past games once there is one.

While a game is in progress the page still blocks pull-to-refresh and asks before leaving (kept on
purpose: votes being entered are only saved on Home, and storage can be blocked), and New game
warns before it replaces the game. Two-tap buttons ignore a second tap within
`SECOND_TAP_DELAY_MS` (`dom.ts`).

Undo and Redo sit on the scores screen and the winner view, one tap each. Undo takes back End
game, or else the last round; Redo puts back what was undone; a new round or End game clears Redo.

## The board on the scores screen

The scores screen shows the garden board (`src/board/`, loaded with `import()`) above a compact
readout. `main.ts` passes a play mode: `round` straight after Confirm or Redo of a round (the
round plays once), `finale` straight after End game or its Redo (only the winner's dance),
`{ undoneFrom }` after Undo (the bunnies hop back from where they stood), `none` on Resume. Arming End game
re-renders the screen but keeps the same board, so nothing replays. A Skip button sits on the
board while a round plays; a tap on the board skips too. Leaving the screen disposes the board.
If the board cannot load (no WebGL), the screen works without it. `board-input.ts` maps the game
to the board (pure, tested).
