# 02 — Scoring engine

The heart of the app is working out each round's points from the votes. People argue about bonus points at the table, so this must always be right.

Build the scoring as pure logic with no UI and no storage:
1. Input: the players in seat order, the storyteller, and for each other player whose card they voted for.
2. Output: each player's points for the round, plus a short reason for each ("found the storyteller: +3", "2 votes on your card: +2").
3. Standard rules and the 3-player rules, exactly as the spec's Scoring section describes them.
4. Reject impossible input, such as voting for your own card or a missing vote, with a clear message.
5. Storyteller rotation: who tells the story next, in seat order.
6. Game end: a bunny reached the track length, or the game was ended by hand. Highest total wins; ties share the win.

Write table-driven tests covering every row of the scoring table, the bonus, 3 to 6 players, the 3-player rules, ties, and bad input.

Note: the 3-player rules are marked "to verify" in the spec. Keep them in one easy-to-change place.

**Depends on:** Task 01 (project skeleton).

See full architecture plan: docs/plan/spec.md
