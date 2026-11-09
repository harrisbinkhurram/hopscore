# HS-08 follow-up: keep the main action on screen

A polish follow-up to HS-08 (PR #9). Not a plan prompt.

## Problem

On a short window, Start game (New game screen) moved below the fold as players were picked. It
could be scrolled to, but nothing showed it was there. Round (Review points, Confirm) and scores
(Score next round, Done) had the same problem: measured at 457px tall, Score next round started at
737px (320px wide) and 587px (700px wide).

## Change

- `common.css`: a shared `.screen-actions` bar, `position: sticky; bottom: 0`, with the page background
  and safe-area padding. When it is the last element it covers `#app`'s bottom padding (negative margin).
- `style.css`: `overflow-x: clip` on html and body, with `hidden` kept as the fallback. `hidden` made body
  a scroll container, so sticky never stuck.
- Setup: Start game plus its hint go in the bar; the "game in progress" warning stays in the page flow
  above it (Harris: keep the bar short).
- Round: Review points plus its hint, and Confirm with Change votes.
- Scores: Next storyteller plus Score next round, and Done on the winner view. Undo, Redo and End game
  stay in the page flow below the bar.

## Checked by hand (preview build, frames 320 and 700 wide, 457 tall)

- Setup with 3 and 6 players, round entry and review with 6, scores and the winner view: the bar sits
  on the window edge at the top of the page and at the end. The element above it ends 20px above the bar.
  Undo and End game are fully visible at the end of the page.
- No sideways scroll at 320px.
- Not checked: light mode, reduced motion (the bar has no animation), a real phone's safe area and
  on-screen keyboard.
