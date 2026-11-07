---
alwaysApply: false
---
# Hopscore Testing Patterns

Vitest, run with `npm test`. What to test and when a test may change: `test-scope-policy.md`, `test-change-policy.md`, `test-layer-policy.md`.

## Placement and naming

- Tests sit next to the code as `<file>.test.ts` (`src/scoring/score.test.ts`). `vite.config.ts` collects `src/**/*.test.ts`.
- The environment is node, with no jsdom. Scoring and storage are tested as plain functions; screens and `main.ts` have no automated tests and are checked by hand at 390 px and 320 px.

## Style

- `describe` per exported function, `it` in plain words ("accepts a valid round").
- Many similar cases go in a table run with `it.each`, headed by a comment naming the columns:

```ts
// [label, input, expected problems]
const cases: [string, RoundInput, string[]][] = [ ... ];
it.each(cases)('rejects: %s', (_label, input, expected) => { ... });
```

- Assert exact values with `toEqual`, including the user-facing sentences.

## Storage tests

- Pass a stand-in storage instead of replacing globals: `FakeStorage`, `BlockedStorage` and `FillingStorage` in `src/storage/test-helpers.ts`. `createPlayerStore(null)` gives a memory-only store.
- Migration tests use real saved data from the old version (`src/storage/migrate.test.ts`).
- When a test needs a global (the cross-tab `storage` event), use `vi.stubGlobal` and undo it in `afterEach` with `vi.unstubAllGlobals()` (`src/storage/player-store.test.ts`).
