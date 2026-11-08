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

## Offline and install

Hopscore installs to the home screen ("Add to Home Screen") and works with no connection after
the first visit. `build/pwa.ts` writes `dist/sw.js` at build time: a service worker that caches
every built file of that version. It runs only in the built site (`npm run preview`), not in
`npm run dev`.

A new deploy downloads in the background. Home then shows "New version ready: tap to update";
game screens never show it. Ignored, the new version takes over the next time the app is opened
from scratch. The old version's cache is deleted, and saved players, groups, games and history
are never touched.

First load is about 19 KB gzip (page, app script and styles); the 3D board loads when the scores
first open, about 145 KB gzip. Both are cached for offline use.

The icons are drawn in `build/icons/*.svg`. After changing one, run `build/icons/render.sh` (it
uses Chrome) and commit the PNGs in `public/icons/`.

## Layout

```
index.html        page shell
src/main.ts       entry point
public/           favicon, web app manifest, app icons
build/            build code: the offline service worker plugin, icon sources
src/app/          app-wide bits (name, tagline, disclaimer, new versions)
src/scoring/      pure scoring logic
src/storage/      saving players, groups and games on the device
src/screens/      the app's screens
src/board/        the Three.js garden board and bunnies
docs/plan/        the spec and the task plan
```
