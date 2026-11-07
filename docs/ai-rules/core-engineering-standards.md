---
alwaysApply: false
---
# Core Engineering Standards

Language-neutral checks that apply to a client-only app. The project's own idioms are in `project-conventions.md`, `error-handling.md` and `testing-patterns.md`.

## Input
- Validate and bound everything a player types (names, scores) where it enters, before it reaches scoring or storage.

## Error handling
- Don't swallow errors. Distinguish expected problems (shown to the player as a sentence) from impossible states (thrown, caught in development).

## Privacy
- No data leaves the device. Don't add network calls, analytics or third-party scripts without a task that asks for it.

## Structure & conventions
- Place new code per `project-structure.md`; respect the dependency direction.
- Mirror the nearest existing code's naming and patterns. Don't impose a foreign style.

## Tests
- Follow `test-change-policy.md`: behaviour-preserving changes leave existing tests untouched (they're the regression oracle); contract/feature changes update only what the contract delta invalidates.
