# 04 — Game setup and round entry

This joins the scoring engine and saved players into a playable flow. The 3D board comes later, so for now scores show as a plain 2D list.

Build:
1. Home screen: New game, and Resume if a game is in progress.
2. New game: pick a saved group or tap players (3 to 6), add a new player inline, drag to set seat order, choose track length (default 30). 3 players switches on the 3-player rules automatically.
3. Round entry: the storyteller is filled in from the rotation and can be changed. For each other player, tap whose card they voted for. Only valid choices are shown.
4. Review screen with each player's points and the reasons, then Confirm.
5. A plain score list after each round, and a winner screen at the end. An "End game" button for when the deck runs out.

Use the scoring engine and storage from earlier tasks; do not duplicate their logic. It should be fast with one hand, in portrait, in a dim room.

**Depends on:** Task 02 (scoring engine), Task 03 (players and groups).

See full architecture plan: docs/plan/spec.md
