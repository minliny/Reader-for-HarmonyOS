# /harmonyos-loop

Reader for HarmonyOS automated development loop. Executes **exactly one** READY task per invocation, updates the task queue, and stops.

## Pre-Check (EVERY invocation)

### 0. Environment Setup (EVERY invocation)
```bash
# Source DevEco environment (required for cron/non-interactive shells)
[ -f "$HOME/.deveco_env" ] && source "$HOME/.deveco_env"
```

### 1. Git Safety Check
```bash
cd "/Users/minliny/Documents/Reader for HarmonyOS"
git status --short
git branch --show-current
git rev-parse --short HEAD
```

- If worktree has uncommitted changes NOT in `docs/PLANNING/` or `.claude/`: **STOP** and report. Do NOT reset, stash, or overwrite.
- If on a branch other than `main`: **STOP** and report.

### 2. Read Current State
Read these files (do not skip):
- `docs/PLANNING/HARMONYOS_AUTODEV_QUEUE.md` — task queue
- `docs/PLANNING/HARMONYOS_BLOCKERS_AND_DECISIONS.md` — blockers + decisions
- `docs/PLANNING/HARMONYOS_HEADLESS_CAPABILITY_PLAN.md` — headless capability plan
- `docs/PLANNING/HARMONYOS_LOOP_STATE.yml` — loop state (update if exists)

### 3. Find First READY Task
Scan the task queue for the first task with `Status: READY`.
- If none: report all BLOCKED/PENDING reasons and **STOP**.
- If a BLOCKED_BY_DECISION task is blocking the chain: report the decision needed.
- If a BLOCKED_BY_BRIDGE_RUNTIME task is found: check if HOS-2B (bridge runtime) is complete. If bridge available, mark READY. If not, report and skip to next available task.

## Task Selection Priority

**Foundation Loop** (app shell + UI + DTOs):
1. HOS-0A tasks (alphabetically: 001 → 002 → ... → 007)
2. HOS-1A tasks
3. HOS-2A tasks
4. HOS-3A through HOS-6A in stage order

**Headless Capability Loop** (non-UI domain services + adapters + QA):
5. HOS-2B tasks (bridge runtime)
6. HOS-3B tasks (bookshelf domain)
7. HOS-4B tasks (search domain)
8. HOS-5B tasks (TOC/content domain)
9. HOS-6B tasks (import domain)
10. HOS-7B tasks (sync domain)
11. HOS-8B tasks (platform adapters)
12. HOS-9B tasks (QA gates)

## CURRENT MODE: VALIDATION ONLY

Feature development (HOS-0A through HOS-9B) is **CLOSED**. All 67 feature tasks DONE.
Only **HOS-10 Validation/RC Hardening** tasks are eligible for execution.
DO NOT create new feature tasks. DO NOT expand pages/. DO NOT add UI.

## Task Selection Priority (Validation Mode)

1. HOS-10A tasks (bridge cross-validation): 001 → 002 → ... → 006
2. HOS-10B tasks (simulator + network): 001 → 002
3. HOS-10C tasks (release readiness): 001

Foundation/Headless tasks are CLOSED. Do not re-execute them.

## SCOPE HARD CONSTRAINTS (effective immediately)

These constraints override all task definitions. No task may violate them.

### CURRENT PHASE: BRIDGE_BLOCKED
- **HOS-2B-002 (Swift bridge) is NOT complete.**
- Until bridge is done, all capabilities that depend on it are LOCAL_FALLBACK / FIXTURE_MODE only.
- **NO capability may be marked PRODUCTION_READY until bridge cross-validation passes.**

### FORBIDDEN (UI scope)
- **Do NOT create new pages/** files. Existing shell placeholders may stay.
- **Do NOT add @Entry, @Component, @Builder, or @State to any new code.**
- **Do NOT expand existing page placeholders** beyond the current placeholder text.
- **Do NOT add UI components, layouts, themes, or visual polish.**
- **Do NOT add ViewModel files that bind to UI pages.** Existing BookshelfViewModel is SHELL_ONLY_PLACEHOLDER.
- **Do NOT wire services/repository to UI components.**

### ALLOWED (headless scope)
- **models/**: DTO interfaces, enums, type definitions
- **repository/**: Data access layer (no UI imports)
- **services/**: Business logic (no UI imports, no @State/@Component)
- **adapters/**: Platform wrappers (@ohos.* APIs)
- **parser/**: TXT/EPUB parsing logic (mark as LOCAL_FALLBACK until bridge validated)
- **__tests__/**: Headless domain validators
- **docs/PLANNING/**: Planning documents, capability matrices, reports

### CAPABILITY STATUS RULES
- DTO mirroring → mark CONTRACT_ONLY (types exist, no execution)
- Fixture-based search/TOC/content → mark FIXTURE_MODE (not production)
- Mock repositories → mark MOCK_ONLY
- Bridge client without server → mark BRIDGE_BLOCKED
- TXTParser ArkTS port → mark LOCAL_FALLBACK_EXPERIMENTAL
- WebDAV/Sync contracts → mark CONTRACT_ONLY
- UI-bound ViewModel → mark SHELL_ONLY_PLACEHOLDER

### BRIDGE GATE
- Until HOS-2B-002 is complete and cross-validation passes, all headless services remain in FIXTURE_MODE.
- Next READY task after bridge is HOS-2B-002. If BLOCKED, loop should report and stop.
- No new tasks should be created that assume bridge is available.

## Execution Rules

### ALLOWED
- Read any file in the repo
- Read any file in Reader-Core (`/Users/minliny/Documents/Reader-Core`)
- Write/Edit files within the scope defined by the task's `Allowed files`
- Create directories needed for allowed files
- Run `git status`, `git diff --check`, `git add` (for allowed files only)
- Commit planning docs with message format: `docs: <task-id> <short description>`
- Run validation commands listed in task's `Validation`
- Update task status in queue from READY → DONE
- Update loop state file

### FORBIDDEN (never do, even if task says otherwise)
- Modify Reader-Core files (`/Users/minliny/Documents/Reader-Core`)
- Copy iOS Swift code into HarmonyOS as-is
- Access real book source websites
- Make real HTTP requests to external servers (except Reader-Core localhost if Strategy B)
- Implement WebDAV, JS Runtime, WebView Runtime
- Implement TXT/EPUB parser (read raw text only)
- Install npm packages, ohpm packages, or system tools
- Install cron, modify crontab, or create LaunchAgents
- `git reset --hard`, `git clean -fd`, `git push --force`
- Delete user files outside task scope
- Execute more than ONE task
- Continue to next task after completing one
- Mark ENV_BLOCKED task as DONE (use ENV_BLOCKED status)
- Treat mock as real implementation (always tag MOCK_ONLY)

## When Task Requires Reader-Core Knowledge

If the current task involves Reader-Core models, protocols, or services, you MUST read the actual Core source files before acting. Do not rely on summaries or memory. At minimum:
- `Core/Sources/ReaderCoreModels/` — for DTO fields
- `Core/Sources/ReaderCoreProtocols/` — for contract signatures
- `Core/Sources/ReaderCoreServices/` — for service behavior

## Post-Execution (EVERY invocation)

### 1. Update Task Queue
- Change task status: READY → DONE
- If task uncovered new blockers: add them and mark subsequent tasks
- If task was ENV_BLOCKED: leave as BLOCKED with note

### 2. Run Validation
Execute the task's `Validation` commands. Record results:
- PASS: command succeeded
- FAIL: command failed (document why)
- SKIPPED: command requires unavailable tools (ENV_BLOCKED)

### 3. Generate Loop Report
Write report to `docs/PLANNING/LOOP_REPORTS/loop-<YYYYMMDD>-<HHMMSS>.md`:
```markdown
# Loop Report — <task-id>

- **Timestamp**: <ISO timestamp>
- **Task**: <task-id> — <title>
- **Status**: DONE | ENV_BLOCKED | FAILED
- **HEAD before**: <sha>
- **HEAD after**: <sha>
- **Files changed**: <list>
- **Validation**: PASS/FAIL/SKIPPED — <details>
- **Next READY task**: <task-id> or NONE
- **Blockers**: <any new blockers found>
- **Decisions needed**: <any new decisions>
```

### 4. Commit (if changes made)
Only if changes are within allowed scope:
```bash
git add docs/PLANNING/ .claude/commands/ CLAUDE.md  # planning docs only
git add <task-specific allowed files>
git commit -m "docs: <task-id> <short description>"
```

### 5. Update Loop State
Update `docs/PLANNING/HARMONYOS_LOOP_STATE.yml`:
- `last_task`: completed task ID
- `last_run`: ISO timestamp
- `last_head`: new HEAD sha
- `next_task`: next READY task ID or `NONE`

### 6. STOP
Output the loop report and **STOP**. Do not execute another task.

## Environment-Blocked Handling

If ohpm/hdc are missing:
- Tasks requiring build: mark as BLOCKED with reason `ENV_BLOCKED: ohpm/hdc not available`

If global hvigor is missing:
- Check if project has `./hvigorw` (project wrapper)
- If `./hvigorw` exists: use it for builds (`./hvigorw assembleHap`)
- If `./hvigorw` missing - If DevEco project structure missing (no hvigorw, no entry/, no build-profile.json5): mark as `HARMONYOS_SCAFFOLD_MISSING`

Planning/docs tasks: continue normally regardless of hvigor/hvigorw status.
Never fake a build success.

## Decision-Blocked Handling

If a task requires a user decision (HOS-D001 through HOS-D008):
- Mark task as BLOCKED_BY_DECISION
- Report which decision ID is needed
- If the decision has a default that is safe to auto-apply, apply it and document
- If the decision requires explicit user input, STOP and report

## Quick Reference: Task States

| State | Meaning |
|-------|---------|
| READY | Can execute now |
| IN_PROGRESS | Currently executing (only one at a time) |
| DONE | Completed successfully |
| BLOCKED | Missing prerequisite (task, env, or decision) |
| BLOCKED_BY_DECISION | Waiting for user decision |
| BLOCKED_BY_BRIDGE_RUNTIME | Waiting for HOS-2B bridge runtime |
| PENDING | Planned but prerequisites not yet met |
| ENV_BLOCKED | Build tools missing |
| CONTRACT_ONLY | Contract defined, implementation deferred |
| FAILED | Last execution failed |

## Quick Reference: Stage Dependencies

```
Foundation Loop:
HOS-0A (planning) ── DONE (no deps)
  └── HOS-1A (app shell) ── PARTIAL (003 READY)
       └── HOS-2A (bridge strategy) ── BLOCKED (needs 1A complete)
            └── HOS-3A (bookshelf UI) ── BLOCKED
                 └── HOS-4A/5A/6A ── PENDING

Headless Capability Loop (parallel to Foundation):
HOS-2B (bridge runtime) ── PENDING (needs 2A + Core repo access)
  ├── HOS-3B (bookshelf domain) ── PENDING (needs 2A DTOs + 2B bridge or fixture)
  ├── HOS-4B (search domain) ── PENDING (BLOCKED_BY_BRIDGE_RUNTIME)
  ├── HOS-5B (TOC/content domain) ── PENDING (BLOCKED_BY_BRIDGE_RUNTIME)
  ├── HOS-6B (import domain) ── PENDING (needs 3B + 2B)
  ├── HOS-7B (sync domain) ── PENDING (needs 3B + 2B)
  ├── HOS-8B (platform adapters) ── PENDING (needs 1A complete)
  └── HOS-9B (QA gates) ── PENDING (needs all B-stages)
```
