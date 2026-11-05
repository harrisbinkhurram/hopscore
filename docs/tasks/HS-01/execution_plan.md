# HS-01 — Skeleton and deploy: execution plan

Raw prompt: [raw_prompt.md](raw_prompt.md). Spec: [../../plan/spec.md](../../plan/spec.md).
Path: ticket-late, no tracker. "HS-01" is a local label only.
Branch: `feature/hs-01-skeleton-and-deploy` (already exists, forked from `main`).

## Understanding

Hopscore has no code yet. This task gives every later task a place to land and a live URL to open
on a phone. It delivers a Vite + TypeScript app with Three.js and Vitest, one passing test, a build
that makes static files, a GitHub Actions workflow that tests and then deploys to GitHub Pages on
every push to `main`, a placeholder page ("Hopscore" / "Dixit Score Tracker") that works in
portrait on a phone, and a short README.

Out of scope: any scoring, storage, screens or 3D work. Those folders get a short placeholder only.
No `/ar-install` (that runs after this task).

## Approach

- Plain Vite `vanilla-ts` setup, written by hand (no `npm create`), so nothing extra comes in.
- Versions: Vite 8, Vitest 5, TypeScript 7, Three 0.187 (+ `@types/three`). Pinned with `^` in
  `package.json`, `package-lock.json` committed. Node 22 LTS in CI (`.nvmrc` = 22).
- Vite `base: '/hopscore/'`, so asset paths match the Pages URL
  `https://harrisbinkhurram.github.io/hopscore/`.
- Three.js is a dependency but is **not imported** on the placeholder page, so the first load stays
  tiny. Task 05 imports it.
- Page: centred title and tagline, mobile viewport meta, `theme-color`, light/dark via
  `prefers-color-scheme`, safe-area padding, no horizontal scroll. Footer disclaimer is task 08.
- One workflow, `.github/workflows/deploy.yml`:
  - on `push` to `main` and `pull_request` to `main` (plus manual `workflow_dispatch`);
  - job `test`: checkout, setup-node with npm cache, `npm ci`, `npm test`, `npm run build`;
  - job `deploy`: only on push to `main`, needs `test`, uploads `dist` with
    `actions/upload-pages-artifact` and runs `actions/deploy-pages`. Permissions
    `pages: write`, `id-token: write`; concurrency group `pages`.
  - Running tests on PRs too gives a check on each PR. Deploy still only happens from `main`.
- Enable Pages with source "GitHub Actions" via
  `gh api -X POST repos/harrisbinkhurram/hopscore/pages -f build_type=workflow`.
  If GitHub refuses because the repo is private on a free plan: stop and report. Do not make the
  repo public.

## Files

```
index.html                     placeholder page markup
src/main.ts                    entry; renders the placeholder
src/style.css                  mobile-first styles
src/app/branding.ts            name + tagline constants (used by page and test)
src/app/branding.test.ts       the trivial test
src/scoring/README.md          home for scoring logic (task 02)
src/storage/README.md          home for storage (task 03)
src/screens/README.md          home for screens (task 04)
src/board/README.md            home for the 3D board (task 05)
public/favicon.svg             simple original icon
vite.config.ts                 base '/hopscore/', vitest config (jsdom not needed)
tsconfig.json
package.json, package-lock.json
.nvmrc, .gitignore
.github/workflows/deploy.yml
README.md
docs/tasks/HS-01/*             these task notes
```

## Test plan

- `npm test` runs Vitest once; `branding.test.ts` checks the name and tagline.
- `npm run typecheck` (`tsc --noEmit`) passes.
- `npm run build` writes `dist/` with asset URLs under `/hopscore/`.
- `npm run preview` and a phone-width look (390×844) in a browser: title and tagline show, no
  horizontal scroll.
- CI: the PR run of the `test` job passes.

## Documentation updates

- New `README.md`: what the app is, run, test, build, how it deploys (and the one-time Pages setup).

## Acceptance criteria

See [acceptance_criteria.json](acceptance_criteria.json).

1. AC-1: `npm test` passes locally with at least one test.
2. AC-2: `npm run build` succeeds and `dist/index.html` references assets under `/hopscore/`.
3. AC-3: The page shows "Hopscore" and "Dixit Score Tracker" at phone portrait width with no
   horizontal scroll.
4. AC-4: The workflow runs tests on the PR and the check passes.
5. AC-5: Pages is enabled with source "GitHub Actions".
6. AC-6: README covers what, run, test, deploy.
7. AC-7: After merge to `main`, the page is live at the Pages URL. **Can only be confirmed after
   merge; reported as "not confirmed" until then.**

## Risks

- Pages on a private repo needs a paid plan. Unknown until Claude tries the API call.
- The very first deploy can fail if Pages was not enabled before the workflow ran; enabling it
  first avoids that.

## Change log

- 2026-11-05: GitHub refused Pages on the private repo ("Your current plan does not support
  GitHub Pages for this repository"). Harris chose to make the repo public.
- 2026-11-05: Workflow uses the current action majors: checkout v7, setup-node v7,
  upload-pages-artifact v5, deploy-pages v5.
- 2026-11-05: Phone check done by loading the built page in 320, 360 and 390 px frames
  (the Chrome window would not report a narrow viewport). No sideways scroll at any width.
- 2026-11-05: The repo is now public. Pages is enabled with source "GitHub Actions"
  (`build_type: workflow`), checked with `gh api repos/harrisbinkhurram/hopscore/pages`.
