---
alwaysApply: false
---
# Hopscore Project Structure

A static Vite + TypeScript app, deployed to GitHub Pages. No backend: all data stays on the device.

| Path | Holds | Contract |
|---|---|---|
| `src/main.ts` | Entry point, home page, creates the one `PlayerStore` | Shared file: keep changes small |
| `src/app/` | App-wide bits (name, tagline) | |
| `src/scoring/` | Pure scoring logic | No UI, no storage. Callers import `src/scoring/index.ts`. Rule numbers live only in `rules.ts` |
| `src/storage/` | Players and groups on the device | Changes never throw. One store per page. See `src/storage/README.md` |
| `src/game/` | The game in progress: seats, rounds, totals, standings | Pure: no DOM, no storage. Callers import `src/game/index.ts`. Scores only through `scoring` |
| `src/screens/` | The app's screens, one folder each (`players/`, `setup/`, `round/`, `scores/`, `history/`) | Screen file plus its own CSS. Shared helpers in `dom.ts`, shared styles in `common.css` |
| `src/board/` | Three.js garden board, bunnies and the round animations | Loaded lazily (`import()`) so Three.js stays out of the first load. Own `BoardPlayer` type; no imports from `game`, `scoring` or `storage`. Timing is pure in `choreography.ts` and `motion.ts`. See `src/board/README.md` |
| `src/style.css` | Global styles and colour variables | |
| `public/` | Static files copied as-is (`favicon.svg`) | |
| `docs/plan/` | `spec.md`, `00_overview.md`, `plan_manifest.json`, `raw_prompts/` | The task plan |
| `docs/tasks/HS-NN/` | `raw_prompt.md`, `execution_plan.md`, `acceptance_criteria.json` | One folder per task |
| `.github/workflows/deploy.yml` | Test and build on PRs; deploy from `main` | |

## Dependency direction

`screens` and `main.ts` may use `game`, `scoring` and `storage`. `game` uses `scoring` only. `scoring` imports nothing from the app. `storage` does not import `scoring`, `game` or `screens`.

## Each folder has a README

Every `src/` module has a `README.md` that states its contract and how to use it. When a change alters that contract, update the README in the same PR.
