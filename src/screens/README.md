# screens

The app's screens. Plain DOM, no framework: each screen renders into `#app` and re-renders itself
after every change.

| Folder | Screen |
|---|---|
| `players/` | Players and groups |
| `setup/` | New game: group or players, seat order (drag or up/down), track length |
| `round/` | One round: storyteller, each player's vote, then the points with reasons and Confirm |
| `scores/` | The score list after a round, and the winner view when the game is over |

`dom.ts` holds the shared helpers (`h`, `button`, `swatch`, `errorLine`) and loads `common.css`
(screen root, buttons, chips, shared colours). Import it before the screen's own CSS.

## Flow

`main.ts` holds the game in progress and moves between screens:

home → setup → round → scores → round → … → winner → home.

Home shows Resume while a game is in progress; it goes back to the round or the score list. The
game is kept for this page visit only; saving it is task 07. Task 06 puts the board in place of the
score list.
