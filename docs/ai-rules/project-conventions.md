---
alwaysApply: true
---
# Hopscore Code Conventions

Taken from the code on `main`. No linter or formatter runs, so match the nearest existing file by hand.

## Language and formatting

- TypeScript, `strict`, with `noUnusedLocals`, `noUnusedParameters` and `verbatimModuleSyntax` (`tsconfig.json`). `npm run typecheck` must pass.
- 2-space indent, single quotes, semicolons, trailing commas in multi-line literals.
- British spelling in identifiers and text: `colour`, `recolourPlayer`, `BUNNY_COLOURS`.

## Naming

- Files are kebab-case: `player-store.ts`, `safe-storage.ts`, `players-screen.ts`.
- Each module keeps its types in its own `types.ts` (`src/scoring/types.ts`, `src/storage/types.ts`).
- Named exports only. No default exports in `src/`.
- Constants are UPPER_SNAKE (`PLAYERS_KEY`, `CURRENT_VERSION`, `LIMITS`, `BUNNY_COLOURS`).
- Kinds and states are string-literal unions (`'storage-off' | 'kept-safe' | null`), not enums.
- Screens are `show<Name>Screen(root, store or game, options)` and return an unsubscribe function (a no-op when the screen reads no store).

## Imports

- Relative paths, no file extensions, no path aliases.
- Mark every type import: `import type { ... }` or an inline `type` name, as `verbatimModuleSyntax` requires.

```ts
import { SafeStorage, type StorageLike } from './safe-storage';
import type { PlayerStore, Result } from '../../storage/player-store';
```

- Import scoring only through its barrel, `src/scoring/index.ts`. Storage has no barrel: import the file directly.

## Comments

- Short `/** */` notes on exports that say what a caller needs or why it is this way (`src/storage/player-store.ts`). No `@param` boilerplate.
- Plain, short user-facing text: full sentences, no jargon ("A game needs 3 to 6 players, not 2.").

## Screens (no framework)

- Plain DOM. Build elements with `h()` and the other helpers in `src/screens/dom.ts`, and re-render the whole screen after each change (`src/screens/players/players-screen.ts`). Keep the scroll position across a re-render; the whole-screen swap otherwise jumps to the top.
- One CSS file per screen, imported by the screen after `../dom` (which loads `common.css`), so the screen's rules win. Screen classes use a short prefix (`.ps-` players, `.su-` setup, `.rd-` round, `.sc-` scores); buttons, chips and the `--surface`, `--line`, `--danger` colours live in `src/screens/common.css`, the page colours in `src/style.css`.
- Phone first: portrait, one column, tap targets 48 px or more, no sideways scroll at 320 px.
- No `alert`/`confirm`/`prompt`. Confirm destructive actions in the page (delete needs two taps).

## Don't

- Don't add a UI framework, path aliases or a default export without a task that asks for it.
