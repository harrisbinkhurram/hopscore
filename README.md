# Hopscore

**Dixit Score Tracker.** A free score keeper for storytelling card games, made for a phone at the
table. It remembers players and groups, and shows the scores as low-poly bunnies hopping along a
garden track.

Live: https://harrisbinkhurram.github.io/hopscore/

Not affiliated with or endorsed by Libellud. Dixit is a trademark of Libellud.

## Run it

You need Node 22 or newer (see `.nvmrc`).

```sh
npm install
npm run dev        # dev server, open the URL it prints
```

To try it on a phone on the same Wi-Fi, run `npm run dev -- --host` and open the "Network" URL.

To see the 3D garden board with test scores, add `?board` to the URL. Its buttons play a
random round or a final round; `&motion=reduce` plays them as reduced motion would (params in
`src/board/README.md`).

## Test it

```sh
npm test           # Vitest, runs once
npm run typecheck  # TypeScript, no output files
npm run build      # static site in dist/
npm run preview    # serves dist/ at http://localhost:4173/hopscore/
```

## How it deploys

`.github/workflows/deploy.yml` runs on every pull request into `main` and every push to `main`.
It installs, tests and builds. On a push to `main` it also deploys `dist/` to GitHub Pages.

The Vite `base` is `/hopscore/`, to match the Pages URL. Pages must be set to source
"GitHub Actions" in the repo settings (done once).

## Layout

```
index.html        page shell
src/main.ts       entry point
src/app/          app-wide bits (name, tagline)
src/scoring/      pure scoring logic
src/storage/      saving players, groups and games on the device
src/screens/      the app's screens
src/board/        the Three.js garden board and bunnies
docs/plan/        the spec and the task plan
```
