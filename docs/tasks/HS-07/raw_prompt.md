# 07 — Undo, resume and history

Mistakes happen at the table, and phones get locked or tabs closed. Nobody should lose a game.

Build:
1. Undo the last round, any number of times. Scores and the storyteller rotation go back too.
2. Save the game in progress after every round. Opening the app again offers Resume and lands exactly where the game was.
3. Keep a short history of finished games: date, players, final scores. Viewable from the home screen; old entries can be deleted.
4. Old or broken saved games never crash the app. Keep the players and drop only what is broken.

Use the storage layer from task 03 and its versioning. Write tests for undo, resume, and broken saved data.

If task 06 has already landed, undo should make the bunnies hop back. If not, leave a clear hook for it and note it in the PR.

**Depends on:** Task 04 (setup and round entry).

See full architecture plan: docs/plan/spec.md
