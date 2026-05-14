# HarmonyOS Long-Term Development Roadmap

**Date**: 2026-05-14
**Reader-Core Ref**: HEAD `5b199ff` (Phase 2 ACTIVE: P2.J1 done, P2.I1 done)

## Phase Overview

| Stage | Name | Status | Prerequisites | Output |
|-------|------|--------|---------------|--------|
| HOS-0A | Baseline Audit / Repo Freeze | **READY** | None | Audit docs, blocker register |
| HOS-1A | App Shell Baseline | **BLOCKED** | HOS-0A + DevEco Studio + ohpm/hvigor | Min Stage Model app shell |
| HOS-2A | Core Bridge Strategy | **BLOCKED** | HOS-0A + HOS-D001 decision | Bridge decision doc + DTO schema |
| HOS-3A | Bookshelf MVP | **BLOCKED** | HOS-1A + HOS-2A | Bookshelf UI with mock data |
| HOS-4A | Search Integration | **BLOCKED** | HOS-2A + bridge ready | Search UI wired to Core DTOs |
| HOS-5A | TOC / Content Flow | **BLOCKED** | HOS-2A + bridge ready | Reader content flow |
| HOS-6A | Local Book Import | **BLOCKED** | HOS-2A + filepicker API | Local book import UI |
| HOS-7A | Sync / WebDAV | **PENDING** | HOS-2A + bridge + Core Phase 2 done | Sync UI + adapter |
| HOS-8A | Adapter Protocol | **PENDING** | HOS-2A + bridge ready | Platform adapters |
| HOS-9A | Release / QA | **PENDING** | All above | Release gate + matrix |

---

## HOS-0A — Baseline Audit / Repo Reality Freeze

**Goal**: Freeze current repo reality, generate all planning artifacts, create loop command, document blockers.

**Inputs**: Repo filesystem, git state, Reader-Core adjacency, build tool availability.

**Outputs**:
- `docs/PLANNING/HARMONYOS_BASELINE_AUDIT.md` — Full repo + Core audit
- `docs/PLANNING/HARMONYOS_LONG_TERM_ROADMAP.md` — This document
- `docs/PLANNING/HARMONYOS_AUTODEV_QUEUE.md` — Fine-grained task queue (20+ tasks)
- `docs/PLANNING/HARMONYOS_BLOCKERS_AND_DECISIONS.md` — Blocker + decision register
- `docs/PLANNING/HARMONYOS_CORE_BRIDGE_DECISION.md` — Bridge strategy analysis
- `docs/PLANNING/HARMONYOS_CRON_LOOP_SETUP.md` — Cron/loop install guide
- `.claude/commands/harmonyos-loop.md` — Loop command definition
- `CLAUDE.md` — Project-level Claude Code instructions

**Acceptance**:
- [ ] All 8 files exist and have valid content
- [ ] git status is clean or only planning files changed
- [ ] Task queue has >= 20 tasks with >= 1 READY
- [ ] Blocker register has all P0 items
- [ ] Loop command file exists at `.claude/commands/harmonyos-loop.md`
- [ ] Build tool status documented (ENV_BLOCKED accepted as valid state)

**Status**: READY (this is the current executing stage)

---

## HOS-1A — App Shell Baseline

**Goal**: Create a minimal HarmonyOS Stage Model application that builds and runs an empty shell.

**Prerequisites**:
- DevEco Studio or HarmonyOS SDK installed
- `ohpm` and `hvigor` available on PATH
- HOS-D002 decision: scaffold method (CLI vs IDE)

**Scope**:
- `AppScope/app.json5` — App manifest
- `entry/src/main/module.json5` — Module manifest
- `entry/src/main/ets/entryability/EntryAbility.ets` — Main ability
- `entry/src/main/ets/pages/Index.ets` — Root page
- `entry/src/main/resources/` — Resources skeleton
- `hvigorfile.ts` — Build entry
- `build-profile.json5` — Build config
- `oh-package.json5` — Dependency manifest

**Forbidden**:
- No Reader-Core bridge code
- No real data service
- No network calls
- No database

**Acceptance**:
- [ ] `hvigor build` passes (or documented ENV_BLOCKED if tools missing)
- [ ] App has EntryAbility + Index page
- [ ] Navigation structure defined (shelf/search/reader/settings tabs)

**Status**: BLOCKED (requires DevEco Studio + ohpm/hvigor + HOS-D002)

---

## HOS-2A — Core Bridge Strategy

**Goal**: Define how HarmonyOS consumes Reader-Core capabilities, produce decision document and DTO schema.

**Prerequisites**:
- HOS-0A complete
- HOS-D001 decision: bridge strategy chosen
- Reader-Core public API audited (done in HOS-0A)

**Four Candidate Strategies** (detailed in CORE_BRIDGE_DECISION.md):

| # | Strategy | Pro | Con |
|---|----------|-----|-----|
| A | DTO regeneration | Native perf, no runtime dep | Duplicates logic, drift risk |
| B | Local HTTP service | Full Core, no duplication | IPC overhead, lifecycle mgmt |
| C | FFI/napi bridge | Direct call, best perf | Complex FFI, unproven |
| D | Shared schema + re-impl | Single DTO truth, native | Re-implement service logic |

**Scope**:
- DTO schema extraction from Reader-Core Models
- ArkTS DTO type generation plan
- Service interface mapping
- Platform adapter mapping (HTTP, storage, file, credential)

**Forbidden**:
- No Swift-to-ArkTS compiler or transpiler
- No actual bridge implementation (spike only)
- No modification to Reader-Core

**Acceptance**:
- [ ] Bridge decision doc with recommendation
- [ ] DTO mapping table (Core Swift type → ArkTS equivalent)
- [ ] Service interface mapping table
- [ ] Adapter protocol mapping table

**Status**: BLOCKED (requires HOS-D001 user decision)

---

## HOS-3A — Bookshelf MVP

**Goal**: Local bookshelf with mock data, ViewModel/Repository/UI layers.

**Prerequisites**: HOS-1A (app shell), HOS-2A (bridge DTOs decided)

**Scope**:
- `LocalBook` ArkTS model (mirrors Core DTO)
- `BookshelfRepository` with in-memory store
- `BookshelfViewModel` with state management
- `BookshelfPage` with list UI
- Mock data for 5-10 books

**Forbidden**:
- No network search
- No Core service bridge (use mock only)
- No real file import
- No database

**Acceptance**:
- [ ] Bookshelf page displays mock book list
- [ ] Book tap navigates to placeholder detail
- [ ] ViewModel state management works

**Status**: BLOCKED (requires HOS-1A + HOS-2A)

---

## HOS-4A — Book Source / Search Integration

**Goal**: Search UI wired to Core DTOs via bridge.

**Prerequisites**: HOS-2A complete, bridge ready, Core SearchService DTOs mapped

**Scope**:
- `BookSource` ArkTS model
- `SearchQuery` / `SearchResultItem` ArkTS DTOs
- `SearchViewModel` with bridge call
- Search page UI
- Mock fallback when bridge unavailable

**Forbidden**:
- No real HTTP to book sources
- No JS-based search
- No login/cookie sources

**Acceptance**:
- [ ] Search UI accepts keyword input
- [ ] Mock search returns results
- [ ] Bridge integration point defined (even if mock-only)

**Status**: BLOCKED (requires HOS-2A + bridge)

---

## HOS-5A — TOC / Content Flow

**Goal**: Table of contents and chapter reading flow.

**Prerequisites**: HOS-2A complete, bridge ready

**Scope**:
- `TOCItem` / `ContentPage` ArkTS DTOs
- `TOCViewModel` / `ContentViewModel`
- TOC list page
- Content reader page
- Chapter navigation (prev/next)

**Forbidden**:
- No real HTTP content fetch
- No JS rendering
- No WebView content

**Acceptance**:
- [ ] TOC page displays chapter list
- [ ] Content page displays text
- [ ] Chapter prev/next works

**Status**: BLOCKED (requires HOS-2A + bridge)

---

## HOS-6A — Local Book Import

**Goal**: File picker + local book import UI using Core LocalBook contracts.

**Prerequisites**: HOS-2A complete, HarmonyOS file picker API researched

**Scope**:
- File picker integration
- `LocalBookImportRequest` ArkTS model
- Import flow UI (select file → metadata → confirm)
- TXT file reading (basic, no Core parser needed)
- EPUB placeholder (CONTRACT_ONLY until Core P2.H2)

**Forbidden**:
- No TXT parser implementation (use raw text read)
- No EPUB parser implementation
- No WebDAV import

**Acceptance**:
- [ ] File picker opens and returns file path
- [ ] Import UI shows metadata form
- [ ] Basic TXT import works (read raw, display)
- [ ] EPUB import shows "coming soon" placeholder

**Status**: BLOCKED (requires HOS-2A + HOS-1A)

---

## HOS-7A — Sync / WebDAV

**Goal**: Sync UI placeholder + Core Sync DTO integration.

**Prerequisites**: HOS-2A complete, Core P2.I1 done (Sync/WebDAV baseline IMPLEMENTED)

**Note**: Core P2.I1 (`5b199ff`) provides Sync/WebDAV DTOs and baseline implementation. HOS still needs bridge to consume.

**Scope**:
- Sync config UI (WebDAV URL, credentials)
- Backup/restore trigger UI
- Bridge mapping for Sync DTOs

**Forbidden**:
- No production WebDAV sync (bridge not ready)
- No real credential storage (use mock)

**Acceptance**:
- [ ] Sync settings page exists
- [ ] WebDAV config form works
- [ ] Bridge integration points defined

**Status**: PENDING (requires bridge + Core P2.I1 is done, so unblocked on Core side)

---

## HOS-8A — Adapter Protocol

**Goal**: HarmonyOS platform adapter implementations.

**Prerequisites**: HOS-2A complete, Core P2.J1 done (Adapter Protocol IMPLEMENTED)

**Note**: Core P2.J1 (`4347bbb`) provides FileAccessAdapter and CredentialStorageAdapter protocols. HOS needs to implement these in ArkTS-equivalent form.

**Scope**:
- `FileAccessAdapter` → HarmonyOS file API mapping
- `CredentialStorageAdapter` → HarmonyOS credential API mapping
- `HTTPClient` → HarmonyOS `@ohos.net.http` mapping
- `StorageAdapter` → HarmonyOS preferences/database mapping
- `SchedulerAdapter` → HarmonyOS background task mapping

**Forbidden**:
- No JS/WebView runtime
- No real HTTP to book sources

**Acceptance**:
- [ ] All adapter protocols mapped to HarmonyOS APIs
- [ ] File adapter works for local file reads
- [ ] HTTP adapter works for basic requests

**Status**: PENDING (requires bridge + Core P2.J1 is done, so unblocked on Core side)

---

## HOS-9A — Release / QA / Matrix

**Goal**: Capability matrix, smoke checklist, build validation, release readiness.

**Prerequisites**: All above stages complete or explicitly skipped

**Scope**:
- Capability matrix aligned with Core matrix
- Smoke test checklist
- Build validation script
- Boundary compliance check (no JS, no WebView, no WebDAV unless approved)

**Acceptance**:
- [ ] Capability matrix complete
- [ ] Smoke checklist executable
- [ ] Build passes
- [ ] Boundary checks pass

**Status**: PENDING (requires all above)
