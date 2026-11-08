# screens

The app's screens. Plain DOM, no framework: each screen renders into `#app` and re-renders itself
after every change.

| Folder | Screen |
|---|---|
| `players/` | Players and groups. The list keeps its order while the screen is open (a rename or new colour never moves a row; new ones go last) and is sorted again on the next visit. The colour picker shows who has each colour and locks taken ones while a free one is left |
| `setup/` | New game: group or players, seat order (drag or up/down), track length. Tapping a seated player's name opens the same name and colour editor as the players screen |
| `round/` | One round: storyteller, each player's vote, then the points with reasons and Confirm |
| `scores/` | The garden board (or the 2D track) with a compact score readout after a round, and the winner view when the game is over |
| `history/` | Past games: date, players by final score, winner marked, two-tap Delete |

`dom.ts` holds the shared helpers (`h`, `button`, `swatch`, `errorLine`) and loads `common.css`
(screen root, buttons, chips, shared colours). Import it before the screen's own CSS.

`player-editor.ts` is the name field and colour picker for a saved player, used by `players/` and
`setup/`. Picking a colour also saves a name typed but not saved yet.

## Flow

`main.ts` holds the game in progress and moves between screens:

home → setup → round → scores → round → … → winner → home.

Home shows Resume while a game is in progress; it goes back to the round (with any votes already
entered) or the score list. The game is saved after every step (start, Confirm, Undo, Redo, End
game) and each vote or storyteller change as it is tapped, so Resume also works after closing
the app mid-round. Done moves
the game into the history; a game closed on the winner view goes there the next time the app
opens. Home shows Past games once there is one.

While a game is in progress the page still blocks pull-to-refresh and asks before leaving (kept on
purpose: storage can be blocked or full, and then leaving loses the game), and New game
warns before it replaces the game. Two-tap buttons ignore a second tap within
`SECOND_TAP_DELAY_MS` (`dom.ts`).

Undo and Redo sit on the scores screen and the winner view, one tap each. They and Done ignore a
tap within `SECOND_TAP_DELAY_MS` of the screen opening, so a double tap cannot act twice. Undo takes back End
game, or else the last round; Redo puts back what was undone; a new round or End game clears Redo.

Home also shows:

- "This game was changed in another tab." when another tab changed the saved game while this one
  was on Home, setup, round or scores; this tab then takes the saved game and never writes its
  old copy. A change of only the votes being entered, or of the screen, is taken quietly.
- A note when the saved game is kept safe (from a newer version, or one that could not be
  upgraded): it is not offered for Resume, so it is never changed or recorded here.
- "New version ready: tap to update" when a new version has downloaded (`src/app/updates.ts`);
  the reload skips the leave-page prompt, since the game is saved.
- The footer: "Not affiliated with or endorsed by Libellud. Dixit is a trademark of Libellud."

## The board on the scores screen

The scores screen shows the garden board (`src/board/`, loaded with `import()`) above a compact
readout. `main.ts` passes a play mode: `round` straight after Confirm or Redo of a round (the
round plays once), `finale` straight after End game or its Redo (only the winner's dance),
`{ undoneFrom }` after Undo (the bunnies hop back from where they stood), `none` on Resume. Arming End game
re-renders the screen but keeps the same board, so nothing replays. A Skip button sits on the
board while a round plays; a tap on the board skips too. Leaving the screen disposes the board.
If the board cannot load (no WebGL, or its file is missing after an update), or rounds play too
slowly even with effects turned down, the screen shows a 2D track instead (`flat-track.ts`):
stones in rows of 10 that wind back and forth, numbered every 5, and a coloured marker with each
player's initial on their stone. No animation; the readout names everyone. A slow phone keeps its
level (lite or 2D) for the rest of the session. `board-input.ts` maps the game to the board, and
`flatTrackLayout` places the 2D track (both pure, tested).
