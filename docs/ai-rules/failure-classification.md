# Failure Classification

Applies whenever a defect surfaces after a check had already accepted the work: a real-bug review
finding, a failed CI check after a local green, a previously-passing acceptance criterion that now
fails, or a defect reported against a merged change. Classify it before fixing it.

## Classes

| Class | Meaning | Repair, in this order |
|---|---|---|
| `implementation` | the code breaks a stated requirement under stated conditions | add a check that fails on it, then fix the code |
| `requirement` | the code meets what was written, what was written missed what the stakeholder wanted | amend the requirement (Change Log + approved acceptance criterion, or the ticket), add its check, then fix the code |
| `environment` | the real environment differs from what the checks assumed: data, platform, external service, timing, resources | record the corrected assumption, add a check that exercises the real condition or mark the criterion as needing target-environment evidence, then fix the code |
| `evaluator` | a check that should have caught it did not: too weak, wrong level, skipped, or never run | strengthen that check until it fails on the defect, then fix the code |

A defect can belong to more than one class: apply every row that fits. A code-only fix for a
`requirement`, `environment`, or `evaluator` defect is incomplete, because the gap that admitted
it stays open for the next one.

Style, naming, and readability findings are not defects in this sense. Do not classify them.

## Where the record goes

Find the task folder: under `paths.tasks_root` in `.claude/skill.config`, the folder whose
`execution_plan.md` names the change's branch, including archived tasks. If found, append to
`{task_folder}/failure-log.md`, creating it with this header:

```markdown
| Date | Source | What happened | Class | Artifact revised | Evidence |
|---|---|---|---|---|---|
```

If there is no task folder, put the class and the revised artifact in the reply or report for the
finding, one line: `Class: {class}. Revised: {artifact}.`

A defect reported after merge that needs code changes becomes a new task whose raw prompt cites
the original task folder and its failure-log row.

## Recurrence

The same class in the same area twice, in one failure log or across a project's failure logs, is a
lesson candidate. Route it per `learning-routing.md` destination 1.
