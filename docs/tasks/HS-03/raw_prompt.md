# 03 — Players and groups

The whole reason Hopscore exists is that the official app forgets names. This task makes players and groups stick on the device.

Build the saved data layer and its screens:
1. A player has a name and a bunny colour. Players can be added, renamed, recoloured and deleted.
2. Groups: a named set of players ("Friday crew"). Groups can be created, edited and deleted.
3. Recently used players come first.
4. Everything is saved in the browser's local storage, with a version number so later changes can migrate old data.
5. If storage is blocked (private mode) or broken, the app keeps working for the session and shows a small notice that names will not be remembered. It never crashes on bad saved data.
6. A simple, phone-friendly screen to manage players and groups. Big tap targets, portrait.

Write tests for saving, loading, migration, and the storage-blocked case.

**Depends on:** Task 01 (project skeleton).

See full architecture plan: docs/plan/spec.md
