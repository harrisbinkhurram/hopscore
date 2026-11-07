# Hopscore

Dixit Score Tracker: a free score keeper for storytelling card games, made for a phone at the table. It remembers players and groups on the device and shows scores as low-poly bunnies hopping along a garden track. A static Vite + TypeScript site with Three.js, deployed to GitHub Pages. No backend: all data stays on the device.

## Quick Start

- Setup: Node 22 or newer (see `.nvmrc`), then npm install
- Run: npm run dev (add -- --host to try it on a phone on the same Wi-Fi)
- Test: npm test (Vitest, runs once)
- Typecheck: npm run typecheck
- Build: npm run build (typecheck, then a static site in dist/)
- Preview the build: npm run preview

CI (`.github/workflows/deploy.yml`) runs npm ci, npm test and npm run build on every PR into `main`, and deploys to GitHub Pages on a push to `main`.

## Project Structure

| Path | Holds |
|---|---|
| `index.html` | Page shell |
| `src/main.ts` | Entry point, home page and the game flow; creates the one player store |
| `src/app/` | App-wide bits (name, tagline) |
| `src/scoring/` | Pure scoring logic, imported through its index.ts |
| `src/storage/` | Players and groups saved on the device, with migrations |
| `src/game/` | The game in progress: seats, rounds, totals. Pure, imported through its index.ts |
| `src/screens/` | The app's screens, one folder each, with shared helpers in `dom.ts` and `common.css` |
| `src/board/` | The Three.js garden board, bunnies and round animations, loaded lazily |
| `docs/plan/` | Spec, overview, plan manifest and the task prompts |
| `docs/tasks/` | One folder per task (HS-NN): raw prompt, execution plan, acceptance criteria |

Each `src/` module has a README.md stating its contract. Keep it current when the contract changes.

## Invariants

- The Vite base stays /hopscore/ (`vite.config.ts`), to match the Pages URL.
- `src/scoring/` stays pure: no DOM, no storage. Rule numbers live only in `src/scoring/rules.ts`.
- Storage changes never throw, and saved data from a newer version or a failed migration is never written over. Changing the saved shape needs a migration (`src/storage/README.md`).
- Bunny colour ids are saved: never rename or remove one.
- "Dixit" appears only in the tagline, never in the app name.

## Documentation

- `README.md`: run, test and deploy
- `docs/plan/spec.md`: what the app does
- `docs/plan/00_overview.md`: the task plan

## Agentic Repos

Coding rules live in `docs/ai-rules/`. Read the ones that apply before changing code:

- Extracted from this codebase: `docs/ai-rules/project-conventions.md`, `docs/ai-rules/project-structure.md`, `docs/ai-rules/error-handling.md`, `docs/ai-rules/testing-patterns.md`
- Framework rules: `docs/ai-rules/core-engineering-standards.md`, `docs/ai-rules/code-review.md`, `docs/ai-rules/critical-thinking.md`, `docs/ai-rules/task.md`, `docs/ai-rules/task-flow-startup.md`, `docs/ai-rules/test-change-policy.md`, `docs/ai-rules/test-scope-policy.md`, `docs/ai-rules/test-layer-policy.md`, `docs/ai-rules/lean-docs.md`, `docs/ai-rules/lean-doc-comments.md`, `docs/ai-rules/lean-inline-comments.md`, `docs/ai-rules/failure-classification.md`, `docs/ai-rules/learning-routing.md`, `docs/ai-rules/delegation-and-cost.md`, `docs/ai-rules/diagram-output-medium.md`

Workflow: drive real work through ar-taskflow (one task per branch, named feature/hs-NN-short-description, merged into main by PR). Capture framework friction with ar-record-improvement. Task IDs are HS-NN, managed in the plan (no issue tracker).

### Prerequisites

The ar-* skills and devkit agents are a per-machine layer, installed once with ./install.sh from the agentic-repos framework (the complete path) or the Claude Code plugin (ar-* skills and hooks only, not agentic-devkit). Without it, this repo has no ar-taskflow, no review or PR agents, and no default-branch guard.

Agentic Repos framework version: 1.3.1
