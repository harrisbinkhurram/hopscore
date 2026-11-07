---
alwaysApply: false
---
# Hopscore Error Handling

Each module has its own pattern. Follow the one for the module you are in.

## Scoring: validate, then throw on impossible input

- Validators return a list of problems as plain sentences: `validateRound` and `validateSeats` return `string[]`, empty when valid (`src/scoring/validate.ts`).
- `scoreRound` throws `RoundInputError` (it carries `.problems`) only for input the screen should never have sent. Screens call the validator first and show its sentences.

## Storage: never throw

- Every change returns `Result<T>`: `{ ok: true, value }` or `{ ok: false, error }`, where `error` is a short sentence the screen shows as-is (`src/storage/player-store.ts`).
- Delete and `markUsed` return nothing and do not fail.
- `SafeStorage` falls back to memory when `localStorage` is blocked or full (`src/storage/safe-storage.ts`). `persistent` and `notSavedReason` tell the screen which notice to show.
- `loadData()` drops broken entries one by one and keeps the rest (`src/storage/migrate.ts`).
- Never write over saved data from a newer app version, or data a migration failed on (`notSavedReason` is `'kept-safe'`).
- Another tab's save is reloaded, never overwritten.

## Saved data changes

- One key per kind of data (`hopscore.players`); games and history get their own keys.
- Changing the saved shape needs a migration: bump `CURRENT_VERSION` in `src/storage/types.ts`, add `MIGRATIONS[n]` in `src/storage/migrate.ts`, add a test with real version-n data in `src/storage/migrate.test.ts`.
- Bunny colour ids are saved: add new colours at the end of `src/storage/colours.ts`, never rename or remove one.

## Don't

- Don't let a storage error reach the screen as an exception.
- Don't use browser pop-ups to report errors. Show the message in the page.
