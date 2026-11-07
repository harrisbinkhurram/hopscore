# 09 — Seven and eight players

The current edition of the card game is for 3 to 8 players, but Hopscore stops at 6. Bigger groups
should be able to keep score too.

Build:
1. Games of 3 to 8 players: setup, round entry, the score list and the winner screen all handle 7 and 8.
2. Saved groups can hold up to 8 players. Existing groups stay valid; no saved data is lost.
3. Check the rules for 7 and 8 players against a rulebook before coding. If they differ from the 4-to-6 rules (for example in how voting or scoring works), add them to the scoring rules the same way the 3-player rules were added, switched on by player count, with table-driven tests. If they cannot be confirmed, mark them "to verify" in one place, as the 3-player rules are.
4. The board fits 7 and 8 bunnies, including all of them on one stone, and every name label stays readable in portrait.
5. Round entry stays quick with one hand at 8 players: 7 voters, each with 7 choices, at 320 px wide.

Use the scoring, storage and board code from earlier tasks; extend them rather than adding a second path. There are 8 bunny colours, so each player still gets their own.

**Depends on:** Task 04 (setup and round entry), Task 05 (board and bunnies). It touches the board, so coordinate with task 06 if both are open at once.

See full architecture plan: docs/plan/spec.md
