# 08 — Offline, install and polish

The last step makes Hopscore feel like a real app on game night, even with bad signal.

Build:
1. Installable to the home screen (PWA): "Hopscore" as the app name, a bunny icon, theme colours.
2. Works fully offline after the first visit.
3. Footer with: "Not affiliated with or endorsed by Libellud. Dixit is a trademark of Libellud." Keep "Dixit" out of the app name, icon and home-screen label.
4. A performance pass on a mid-range Android phone: smooth hops, first load around 1 MB compressed or less. If frames drop, turn effects down automatically; as a last resort, show a simple 2D track.
5. A final pass on readability, tap target size, and light/dark rooms.
6. If task 07 left an undo hook for the animations, connect it now.

**Depends on:** Task 06 (animations), Task 07 (undo, resume, history).

See full architecture plan: docs/plan/spec.md
