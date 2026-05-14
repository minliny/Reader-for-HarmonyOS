# HarmonyOS Autodev Task Queue

**Date**: 2026-05-15
**Reader-Core HEAD**: `e6f5af1`
**Loop Command**: `/harmonyos-loop`
**Total Tasks**: 25

---

## Task Index

| # | ID | Stage | Status | Title |
|---|-----|-------|--------|-------|
| 1 | HOS-0A-001 | HOS-0A | DONE | Baseline repo audit & freeze |
| 2 | HOS-0A-002 | HOS-0A | DONE | Build tool check & env report |
| 3 | HOS-0A-003 | HOS-0A | DONE | Reader-Core adjacency audit |
| 4 | HOS-0A-004 | HOS-0A | DONE | Planning docs creation |
| 5 | HOS-0A-005 | HOS-0A | DONE | Loop command creation |
| 6 | HOS-0A-006 | HOS-0A | DONE | Blockers & decisions doc finalize |
| 7 | HOS-0A-007 | HOS-0A | DONE | CLAUDE.md project config |
| 8 | HOS-1A-001 | HOS-1A | DONE | DevEco Studio / SDK env setup |
| 9 | HOS-1A-002 | HOS-1A | DONE | HarmonyOS project scaffold |
| 9.1 | HOS-1A-002b | HOS-1A | DONE | Build verification (BUILD SUCCESSFUL) |
| 10 | HOS-1A-003 | HOS-1A | READY | AppScope & entry module config |
| 11 | HOS-1A-004 | HOS-1A | BLOCKED | EntryAbility + navigation shell |
| 12 | HOS-1A-005 | HOS-1A | BLOCKED | Theme & resource baseline |
| 13 | HOS-2A-001 | HOS-2A | BLOCKED | Core public API full audit |
| 14 | HOS-2A-002 | HOS-2A | BLOCKED | DTO boundary extraction |
| 15 | HOS-2A-003 | HOS-2A | BLOCKED | Bridge alternatives evaluation |
| 16 | HOS-2A-004 | HOS-2A | BLOCKED | Bridge decision matrix |
| 17 | HOS-2A-005 | HOS-2A | BLOCKED | DTO schema generation (BLOCKED_BY_DECISION) |
| 18 | HOS-3A-001 | HOS-3A | BLOCKED | Bookshelf local model contract |
| 19 | HOS-3A-002 | HOS-3A | BLOCKED | Bookshelf mock repository |
| 20 | HOS-3A-003 | HOS-3A | BLOCKED | Bookshelf ViewModel |
| 21 | HOS-3A-004 | HOS-3A | BLOCKED | Bookshelf minimal page |
| 22 | HOS-3A-005 | HOS-3A | BLOCKED | Bookshelf smoke validation |
| 23 | HOS-4A-001 | HOS-4A | PENDING | Search DTO ArkTS mirror |
| 24 | HOS-5A-001 | HOS-5A | PENDING | TOC/Content DTO ArkTS mirror |
| 25 | HOS-6A-001 | HOS-6A | PENDING | LocalBook import DTO mirror |

---

## Detailed Task Definitions

### HOS-0A-001 — Baseline Repo Audit & Freeze
- **Status**: DONE
- **Stage**: HOS-0A
- **Scope**: Audit git state, file structure, HarmonyOS project existence, ArkTS artifact search
- **Allowed files**: `docs/PLANNING/HARMONYOS_BASELINE_AUDIT.md`
- **Forbidden**: Any `.ets`/`.ts` files, any build config files
- **Prerequisites**: None
- **Acceptance**: Audit doc complete with all sections filled
- **Validation**: `test -f docs/PLANNING/HARMONYOS_BASELINE_AUDIT.md`
- **Rollback**: Delete audit doc

### HOS-0A-002 — Build Tool Check & Env Report
- **Status**: DONE
- **Stage**: HOS-0A
- **Scope**: Check ohpm, hvigor, node, npm, java availability; record versions
- **Allowed files**: `docs/PLANNING/HARMONYOS_BASELINE_AUDIT.md` (section update)
- **Forbidden**: Installing any tools or packages
- **Prerequisites**: HOS-0A-001
- **Acceptance**: Tool status documented; ENV_BLOCKED accepted as valid outcome
- **Validation**: `grep -q "ohpm\|hvigor" docs/PLANNING/HARMONYOS_BASELINE_AUDIT.md`
- **Rollback**: Revert audit doc section

### HOS-0A-003 — Reader-Core Adjacency Audit
- **Status**: DONE
- **Stage**: HOS-0A
- **Scope**: Read Reader-Core HEAD, Package.swift, module structure, test count, gap register, service implementations
- **Allowed files**: `docs/PLANNING/HARMONYOS_BASELINE_AUDIT.md` (section update)
- **Forbidden**: Modifying Reader-Core files
- **Prerequisites**: HOS-0A-001
- **Acceptance**: Core capability table populated with actual code evidence
- **Validation**: `grep -q "ReaderCoreModels\|DefaultSearchService" docs/PLANNING/HARMONYOS_BASELINE_AUDIT.md`
- **Rollback**: Revert audit doc section

### HOS-0A-004 — Planning Docs Creation
- **Status**: DONE
- **Stage**: HOS-0A
- **Scope**: Create/update all 8 planning files:
  - `docs/PLANNING/HARMONYOS_BASELINE_AUDIT.md`
  - `docs/PLANNING/HARMONYOS_LONG_TERM_ROADMAP.md`
  - `docs/PLANNING/HARMONYOS_AUTODEV_QUEUE.md` (this file)
  - `docs/PLANNING/HARMONYOS_BLOCKERS_AND_DECISIONS.md`
  - `docs/PLANNING/HARMONYOS_CORE_BRIDGE_DECISION.md`
  - `docs/PLANNING/HARMONYOS_CRON_LOOP_SETUP.md`
  - `.claude/commands/harmonyos-loop.md`
  - `CLAUDE.md`
- **Allowed files**: All in `docs/PLANNING/`, `.claude/commands/harmonyos-loop.md`, `CLAUDE.md`
- **Forbidden**: Any `.ets`/`.ts` files, build configs, Reader-Core files, git destructive operations
- **Prerequisites**: HOS-0A-001 through HOS-0A-003
- **Acceptance**:
  - All 8 files exist
  - Task queue has >= 20 tasks with >= 1 READY
  - Blocker register has all P0 items
  - Loop command file is valid markdown
  - CLAUDE.md has project-level instructions
- **Validation**:
  ```
  test -f docs/PLANNING/HARMONYOS_BASELINE_AUDIT.md
  test -f docs/PLANNING/HARMONYOS_LONG_TERM_ROADMAP.md
  test -f docs/PLANNING/HARMONYOS_AUTODEV_QUEUE.md
  test -f docs/PLANNING/HARMONYOS_BLOCKERS_AND_DECISIONS.md
  test -f docs/PLANNING/HARMONYOS_CORE_BRIDGE_DECISION.md
  test -f docs/PLANNING/HARMONYOS_CRON_LOOP_SETUP.md
  test -f .claude/commands/harmonyos-loop.md
  test -f CLAUDE.md
  ```
- **Rollback**: `git checkout -- docs/PLANNING/ CLAUDE.md .claude/commands/`

### HOS-0A-005 — Loop Command Creation
- **Status**: DONE
- **Stage**: HOS-0A
- **Scope**: Create `.claude/commands/harmonyos-loop.md` with full loop execution rules
- **Allowed files**: `.claude/commands/harmonyos-loop.md`
- **Forbidden**: Installing cron, modifying system crontab
- **Prerequisites**: HOS-0A-004
- **Acceptance**:
  - Loop command defines: pre-check, task selection, execution, post-check, stop rules
  - Priority order matches roadmap (0A → 1A → 2A → ...)
  - Blocked detection logic included
  - Forbidden actions list included
- **Validation**: `test -f .claude/commands/harmonyos-loop.md && grep -q "READY\|BLOCKED\|forbidden\|stop" .claude/commands/harmonyos-loop.md`
- **Rollback**: Delete loop command file

### HOS-0A-006 — Blockers & Decisions Doc Finalize
- **Status**: DONE
- **Stage**: HOS-0A
- **Scope**: Update blockers register with current Core state, add new decisions
- **Allowed files**: `docs/PLANNING/HARMONYOS_BLOCKERS_AND_DECISIONS.md`
- **Forbidden**: Making decisions on behalf of user
- **Prerequisites**: HOS-0A-004
- **Acceptance**: All P0/P1 blockers listed with current status
- **Validation**: `grep -c "P0\|P1\|HOS-D" docs/PLANNING/HARMONYOS_BLOCKERS_AND_DECISIONS.md`
- **Rollback**: Revert file

### HOS-0A-007 — CLAUDE.md Project Config
- **Status**: DONE
- **Stage**: HOS-0A
- **Scope**: Create `CLAUDE.md` with project-level Claude Code instructions
- **Allowed files**: `CLAUDE.md`
- **Forbidden**: None
- **Prerequisites**: HOS-0A-004
- **Acceptance**: CLAUDE.md exists with project context
- **Validation**: `test -f CLAUDE.md && grep -q "HarmonyOS\|Reader-Core" CLAUDE.md`
- **Rollback**: Delete CLAUDE.md

### HOS-1A-001 — DevEco Studio / SDK Env Setup
- **Status**: PARTIAL_DONE
- **Blocker**: Global hvigor missing (project wrapper expected), scaffold still needed for full verification
- **Stage**: HOS-1A
- **Scope**: Verify ohpm/hdc availability, document DevEco environment
- **Allowed files**: `docs/PLANNING/HARMONYOS_BASELINE_AUDIT.md` (env update)
- **Forbidden**: Installing tools automatically
- **Prerequisites**: HOS-0A complete
- **Acceptance**: `ohpm -v` succeeds (6.0.1), `hdc version` succeeds (3.2.0c)
- **Validation**: `command -v ohpm && command -v hdc`
- **Note**: Global hvigor missing ---------------

### HOS-1A-002 — HarmonyOS Project Scaffold
- **Status**: BLOCKED
- **Blocker**: HOS-1A-001 (SDK not installed)
- **Stage**: HOS-1A
- **Scope**: Create Stage Model project skeleton:
  - `AppScope/app.json5`
  - `entry/src/main/module.json5`
  - `hvigorfile.ts`
  - `build-profile.json5`
  - `oh-package.json5`
- **Allowed files**: `AppScope/`, `entry/`, `hvigorfile.ts`, `build-profile.json5`, `oh-package.json5`
- **Forbidden**: No ArkTS business logic, no Reader-Core references
- **Prerequisites**: HOS-1A-001, HOS-D002 decision
- **Acceptance**: `hvigor build` passes on empty shell
- **Validation**: All 5 critical files exist + build passes

### HOS-1A-003 — AppScope & Entry Module
- **Status**: BLOCKED
- **Blocker**: HOS-1A-002 (no scaffold)
- **Stage**: HOS-1A
- **Scope**: Configure app.json5 with bundleName/versionCode, module.json5 with abilities
- **Allowed files**: `AppScope/app.json5`, `entry/src/main/module.json5`
- **Forbidden**: No Reader-Core imports, no mock services
- **Prerequisites**: HOS-1A-002
- **Acceptance**: App config is valid JSON5, module declares EntryAbility
- **Validation**: Manual config review

### HOS-1A-004 — EntryAbility + Navigation Shell
- **Status**: BLOCKED
- **Blocker**: HOS-1A-003 (no entry module configured)
- **Stage**: HOS-1A
- **Scope**: Create EntryAbility.ets with Navigation stack, TabBar shell (Bookshelf/Search/Reader/Settings)
- **Allowed files**: `entry/src/main/ets/entryability/`, `entry/src/main/ets/pages/`
- **Forbidden**: No real service calls, no Core bridge code, no network
- **Prerequisites**: HOS-1A-003
- **Acceptance**: App launches to tabbed shell with 4 tabs
- **Validation**: `grep -rn "@Entry\|EntryAbility\|Navigation\|TabBar" entry/src/main/ets/`

### HOS-1A-005 — Theme & Resource Baseline
- **Status**: BLOCKED
- **Blocker**: HOS-1A-003 (no entry module)
- **Stage**: HOS-1A
- **Scope**: Create color/string/float resources, theme JSON, dark/light mode skeleton
- **Allowed files**: `entry/src/main/resources/`
- **Forbidden**: No business logic
- **Prerequisites**: HOS-1A-003
- **Acceptance**: Resource files compile
- **Validation**: `find entry/src/main/resources -type f | head -10`

### HOS-2A-001 — Core Public API Full Audit
- **Status**: BLOCKED
- **Blocker**: HOS-1A complete + bridge strategy approved
- **Stage**: HOS-2A
- **Scope**: Extract all 73 frozen symbols, list by module, document ArkTS equivalents
- **Allowed files**: `docs/PLANNING/HARMONYOS_CORE_BRIDGE_DECISION.md` (update)
- **Forbidden**: Modifying Reader-Core files
- **Prerequisites**: HOS-D001 decision
- **Acceptance**: Complete API symbol → ArkTS mapping table
- **Validation**: Symbol count >= 73 in mapping table

### HOS-2A-002 — DTO Boundary Extraction
- **Status**: BLOCKED
- **Blocker**: HOS-2A-001
- **Stage**: HOS-2A
- **Scope**: Extract DTO-only subset from Core models (structs with Codable, no logic)
- **Allowed files**: New DTO mapping doc in `docs/PLANNING/`
- **Forbidden**: Modifying Reader-Core
- **Prerequisites**: HOS-2A-001
- **Acceptance**: DTO list with field-by-field ArkTS equivalents
- **Validation**: Every DTO has ArkTS type mapping

### HOS-2A-003 — Bridge Alternatives Evaluation
- **Status**: BLOCKED
- **Blocker**: HOS-2A-001
- **Stage**: HOS-2A
- **Scope**: Evaluate 4 bridge strategies (A/B/C/D) against actual Core structure
- **Allowed files**: `docs/PLANNING/HARMONYOS_CORE_BRIDGE_DECISION.md` (update)
- **Forbidden**: Implementing any bridge
- **Prerequisites**: HOS-2A-001
- **Acceptance**: Each strategy scored on 8 factors
- **Validation**: Matrix table complete

### HOS-2A-004 — Bridge Decision Matrix
- **Status**: BLOCKED
- **Blocker**: HOS-2A-003
- **Stage**: HOS-2A
- **Scope**: Produce final recommendation with rationale
- **Allowed files**: `docs/PLANNING/HARMONYOS_CORE_BRIDGE_DECISION.md` (update)
- **Forbidden**: Acting on recommendation without user approval
- **Prerequisites**: HOS-2A-003, HOS-D001 user input
- **Acceptance**: Clear recommendation with fallback
- **Validation**: Decision section complete

### HOS-2A-005 — DTO Schema Generation (Spike)
- **Status**: BLOCKED (BLOCKED_BY_DECISION)
- **Blocker**: HOS-D001 must be decided first
- **Stage**: HOS-2A
- **Scope**: If Strategy A/D chosen: generate initial ArkTS DTO files from Core models
- **Allowed files**: New ArkTS DTO files (scope depends on bridge decision)
- **Forbidden**: Full parser re-implementation, service re-implementation
- **Prerequisites**: HOS-D001 resolved, HOS-2A-004 complete
- **Acceptance**: At least 5 Core models mirrored as ArkTS types
- **Validation**: TypeScript compilation of generated files

### HOS-3A-001 — Bookshelf Local Model Contract
- **Status**: BLOCKED
- **Blocker**: HOS-1A + HOS-2A
- **Stage**: HOS-3A
- **Scope**: Define ArkTS `LocalBook` interface mirroring Core LocalBookModels
- **Allowed files**: `entry/src/main/ets/models/`, `entry/src/main/ets/viewmodel/`
- **Forbidden**: Network calls, database, Core binary dependency
- **Prerequisites**: HOS-2A DTO mapping done
- **Acceptance**: Model file compiles, matches Core field set
- **Validation**: `grep -c "interface\|class\|type" <model-file>`

### HOS-3A-002 — Bookshelf Mock Repository
- **Status**: BLOCKED
- **Blocker**: HOS-3A-001
- **Stage**: HOS-3A
- **Scope**: In-memory repository with 5-10 mock books
- **Allowed files**: `entry/src/main/ets/repository/`
- **Forbidden**: Real network, real file IO, database
- **Prerequisites**: HOS-3A-001
- **Acceptance**: Repository returns mock book list
- **Validation**: All mock books have required fields (id, title, author, coverPath)

### HOS-3A-003 — Bookshelf ViewModel
- **Status**: BLOCKED
- **Blocker**: HOS-3A-002
- **Stage**: HOS-3A
- **Scope**: ViewModel with @State book list, search filter, sort
- **Allowed files**: `entry/src/main/ets/viewmodel/`
- **Forbidden**: Direct HTTP, database access
- **Prerequisites**: HOS-3A-002
- **Acceptance**: ViewModel exposes observable book list
- **Validation**: ViewModel compiles

### HOS-3A-004 — Bookshelf Minimal Page
- **Status**: BLOCKED
- **Blocker**: HOS-3A-003
- **Stage**: HOS-3A
- **Scope**: Bookshelf list UI with mock data, book tap → placeholder detail
- **Allowed files**: `entry/src/main/ets/pages/BookshelfPage.ets`
- **Forbidden**: Real search, real import, network
- **Prerequisites**: HOS-3A-003
- **Acceptance**: Page renders book list, tap navigates
- **Validation**: `grep -q "@Entry\|@Component" entry/src/main/ets/pages/BookshelfPage.ets`

### HOS-3A-005 — Bookshelf Smoke Validation
- **Status**: BLOCKED
- **Blocker**: HOS-3A-004
- **Stage**: HOS-3A
- **Scope**: Static validation: file structure check, model consistency, no forbidden imports
- **Allowed files**: Any in `entry/`
- **Forbidden**: Modifying any source file (read-only validation)
- **Prerequisites**: HOS-3A-004
- **Acceptance**: All checks pass
- **Validation**: `grep -rn "http://\|https://" entry/src/main/ets/` must show 0 results

### HOS-4A-001 — Search DTO ArkTS Mirror
- **Status**: PENDING
- **Blocker**: HOS-2A complete, bridge strategy implemented
- **Stage**: HOS-4A
- **Scope**: ArkTS mirror of BookSource, SearchQuery, SearchResultItem
- **Allowed files**: `entry/src/main/ets/models/`
- **Forbidden**: Real HTTP, real search execution
- **Prerequisites**: HOS-2A DTO generation
- **Acceptance**: DTOs match Core field set
- **Validation**: Field-by-field comparison with Core models

### HOS-5A-001 — TOC/Content DTO ArkTS Mirror
- **Status**: PENDING
- **Blocker**: HOS-2A complete, bridge strategy implemented
- **Stage**: HOS-5A
- **Scope**: ArkTS mirror of TOCItem, ContentPage, ReadingFlowModels
- **Allowed files**: `entry/src/main/ets/models/`
- **Forbidden**: Real HTTP, real content fetch
- **Prerequisites**: HOS-2A DTO generation
- **Acceptance**: DTOs match Core field set
- **Validation**: Field-by-field comparison

### HOS-6A-001 — LocalBook Import DTO Mirror
- **Status**: PENDING
- **Blocker**: HOS-2A complete
- **Stage**: HOS-6A
- **Scope**: ArkTS mirror of LocalBookImportRequest, LocalBookImportResult, LocalBookFormat
- **Allowed files**: `entry/src/main/ets/models/`
- **Forbidden**: TXT/EPUB parser implementation
- **Prerequisites**: HOS-2A DTO generation
- **Acceptance**: DTOs match Core ImportProtocols
- **Validation**: Field-by-field comparison

---

## Summary

| Status | Count |
|--------|-------|
| DONE | 7 |
| READY | 0 |
| BLOCKED | 13 |
| PENDING | 5 |
| BLOCKED_BY_DECISION | 0 |

**Next READY task**: HOS-1A-002 (scaffold creation) — BLOCKED_BY_HUMAN_ACTION (user must create HarmonyOS project in DevEco Studio)
**Blocked by**: HOS-1A-002 (no scaffold exists, HUMAN_ACTION_REQUIRED)
**Next stage**: HOS-1A can proceed to scaffold creation when user creates project via DevEco Studio.
