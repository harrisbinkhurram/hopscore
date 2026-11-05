# 05 — Garden board and bunnies (static)

The board is what makes Hopscore fun. This task builds the scene and the characters; movement comes in the next task.

Build with Three.js:
1. A small garden with a winding path of stepping stones. The number of stones follows the track length. Every 5th stone shows its number.
2. Original low-poly bunnies built in code from simple shapes. Cute and readable on a small screen. One colour per player, with the player's name floating above.
3. Bunnies standing on the stone for their current score. When two or more share a stone, they stand side by side and do not overlap.
4. A camera that shows the whole track in portrait, and can focus on one bunny.
5. Warm, bright lighting that still reads in a dark room.

Nothing should be copied from any existing game. Keep the scene light: it must run smoothly on a mid-range Android phone. A simple way to show the board with test scores (a debug page or URL flag) is enough; wiring into the game flow can wait for task 06.

**Depends on:** Task 01 (project skeleton).

See full architecture plan: docs/plan/spec.md
