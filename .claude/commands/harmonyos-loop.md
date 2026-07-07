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
- If an older task row says it is waiting for bridge runtime, re-triage it under
  CURRENT MODE. Bridge work is open; only measured missing prerequisites may
  block the task.

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

## CURRENT MODE: FEATURE + INTEGRATION OPEN

Feature development is open for Core bridge, Host Adapter, WebView/JS runtime, WebDAV/sync, HTTP, cookie, media download, auth/login, and device evidence work. Validation/RC hardening remains valid, but it no longer blocks feature work.
New feature tasks may be created when they are scoped, clean-room, evidence-bound, and tied to Reader UI Contract / Reader-Core-Native boundaries.
UI changes are allowed when required for auth/login, WebView capability proof, Core bridge evidence, route integration, or production Host Adapter workflows.

## Task Selection Priority

1. Core bridge and NAPI tasks.
2. Host Adapter capability tasks: HTTP, cookie, WebView, JS runtime, media download, WebDAV/sync, auth/login, anti-bot.
3. Device evidence tasks on attached HarmonyOS targets.
4. UI route integration required by auth/login, WebView, reader, and source workflows.
5. Validation/RC hardening tasks.

Foundation/headless tasks may be re-executed when needed to validate new bridge, adapter, or device evidence work.

## SCOPE HARD CONSTRAINTS (effective immediately)

These constraints override all task definitions. No task may violate them.

### CURRENT PHASE: BRIDGE + HOST ADAPTER IMPLEMENTATION OPEN
- HOS-2B-002 no longer blocks feature work.
- Bridge work should target the selected HarmonyOS bridge design, preferably NAPI + Reader-Core-Native C ABI unless a task documents a better option.
- Capabilities may move beyond LOCAL_FALLBACK / FIXTURE_MODE once implemented and validated with headless and device evidence.
- A capability may be marked PRODUCTION_READY only after measured validation passes; do not claim readiness from fixtures alone.

### UI SCOPE
- New pages, components, builders, state holders, ViewModels, services, and repository wiring are allowed when required by Core bridge, Host Adapter, auth/login, WebView, source, reader, import, sync, or evidence workflows.
- UI state must still flow through reducer/store and ViewState where applicable.
- Avoid unrelated visual polish that is not tied to a validated product workflow.

### ALLOWED (headless + integration scope)
- **models/**: DTO interfaces, enums, type definitions
- **repository/**: Data access layer (no UI imports)
- **services/**: Business logic
- **adapters/**: Platform wrappers (@ohos.* APIs)
- **parser/**: TXT/EPUB parsing logic
- **bridge/** and native sources: NAPI/Core bridge implementation
- **webview/**, **http/**, **cookie/**, **auth/**, **sync/**, **media/**, **antibot/**: Host Adapter implementations and tests
- **pages/** and UI modules: production workflow UI needed for auth/login, WebView, source, reader, import, sync, and evidence
- **__tests__/**: Headless domain validators
- **docs/PLANNING/**: Planning documents, capability matrices, reports

### CAPABILITY STATUS RULES
- DTO mirroring → mark CONTRACT_ONLY until execution is implemented.
- Fixture-based search/TOC/content → mark FIXTURE_MODE until real Core/Host execution passes.
- Mock repositories → mark MOCK_ONLY.
- Bridge client/server partial implementation → mark BRIDGE_PARTIAL until cross-validation passes.
- TXT/EPUB parser ArkTS port → mark LOCAL_FALLBACK_EXPERIMENTAL until validated against corpus/device evidence.
- WebDAV/Sync contracts → may progress to IMPLEMENTED / DEVICE_PROVEN once real Host Adapter tests pass.
- UI-bound ViewModel → may be production if reducer/store/ViewState ownership and device proof are satisfied.

### BRIDGE GATE
- Bridge work is now allowed.
- Headless services may move out of FIXTURE_MODE only after real Core/Host execution is measured.
- Tasks may create bridge-dependent work, but each task must declare whether it is CONTRACT_ONLY, IMPLEMENTED, DEVICE_READY, DEVICE_PROVEN, or PRODUCTION_READY.

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
- Copy Android/Kotlin code into HarmonyOS as-is
- Fake network, device, cookie, source, login, or release-gate success
- Persist or commit real credentials, session cookies, tokens, or private account data
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
| LEGACY_BRIDGE_WAIT | Historical bridge-runtime wait label; re-triage under CURRENT MODE |
| PENDING | Planned but prerequisites not yet met |
| ENV_BLOCKED | Build tools missing |
| CONTRACT_ONLY | Contract defined, implementation deferred |
| FAILED | Last execution failed |

## Quick Reference: Stage Dependencies

```
Feature + Integration Loop (current):
HOS-2B (Core bridge / NAPI runtime) ── OPEN
HOS-8B (Host Adapter capabilities) ── OPEN
  ├── HTTP / Cookie / WebView / JS runtime ── OPEN
  ├── WebDAV / Sync / Media / Auth / Login ── OPEN
  └── Device evidence ── OPEN when a target is attached

Foundation Loop (may proceed in parallel):
HOS-1A (app shell) ── PARTIAL
HOS-2A (bridge strategy) ── OPEN for refinement, not a blocker
HOS-3A+ (bookshelf / reader / source / sync UI) ── OPEN when tied to bridge,
  Host Adapter, auth/login, WebView, source, reader, import, sync, or evidence workflows

Historical blocked / bridge-wait labels in older planning rows
must not be used as blockers after CURRENT MODE became FEATURE + INTEGRATION OPEN.
Only current environment, explicit user decision, or measured missing prerequisite can block a task.
```
