---
alwaysApply: false
---
# Development Task Guidelines

**For the complete task workflow, use the `ar-taskflow` skill.**

Say "ar-taskflow" to start a structured development workflow with:
- Ticket-first or ticket-late approach
- Phase-based progression (Understand → Plan → Code → Document)
- Automatic task tracking and archiving

## Quick Reference

This file contains quick guidelines that `ar-taskflow` references.

### Branch Naming

Format: `feature/hs-<NN>-<short-description>`

Examples:
- `feature/hs-02-scoring-engine`
- `feature/hs-05-garden-board-and-bunnies`

### Never Fabricate Data

If implementation requires:
- Configuration data (URLs, API keys, mappings)
- Business rules or domain-specific logic
- Integration details (endpoints, schemas)
- Any data not in the codebase

**STOP and ASK** the user before implementing.

### Git Safety

- Never commit directly to `main`
- Never use `git add .` or `git add -A`
- Stage only files intentionally edited for the task
- Start the commit message with the task ID (`HS-03: Saved players and groups`)
- Never bypass with `--no-verify`

### Testing Before Commit

Run `npm test` and `npm run build` (includes the typecheck) before committing.

### Coding Standards

Follow the rules in `docs/ai-rules/`, listed in AGENTS.md.
