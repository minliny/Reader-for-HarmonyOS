# HarmonyOS Headless Capability Plan

**Date**: 2026-05-15
**Reader-Core HEAD**: `784e98d` (Phase 3 ACTIVE)
**Status**: PLANNING

## 1. Gap Analysis: Foundation Loop vs Headless Capability Complete

### What the current 25-task queue delivers (Foundation Loop)

| Stage | Capability Level | Limitation |
|-------|-----------------|------------|
| HOS-0A | Planning done | Docs only |
| HOS-1A | App shell | UI skeleton, no data |
| HOS-2A | Bridge strategy | Doc, no runtime |
| HOS-3A | Bookshelf MOCK | Mock data, no real storage |
| HOS-4A-001 | Search DTO mirror | Types only, no search |
| HOS-5A-001 | TOC/Content DTO mirror | Types only, no reading |
| HOS-6A-001 | LocalBook DTO mirror | Types only, no import |

**Conclusion**: Current 25 tasks = **FOUNDATION + MOCK_UI + DTO_CONTRACT**. Not enough for "all capabilities except frontend UI."

### What's missing for Headless Capability Complete

| Capability | Core Status | HOS Status | Gap |
|------------|-------------|------------|-----|
| TXT Parsing | **IMPLEMENTED** (TXTParser.swift, 210 lines) | No port to ArkTS | Need ArkTS TXTParser |
| EPUB Parsing | Contract+DTOs (EPUBParserContract, EPUBModels) | No ArkTS mirror | Need ArkTS EPUB adapter |
| Search Service | **IMPLEMENTED** (DefaultSearchService) | No ArkTS equivalent | Need ArkTS SearchService |
| TOC Service | **IMPLEMENTED** (DefaultTOCService) | No ArkTS equivalent | Need ArkTS TOCService |
| Content Service | **IMPLEMENTED** (DefaultContentService) | No ArkTS equivalent | Need ArkTS ContentService |
| BookSource Model | **FROZEN** | DTO-only mirror | Need ArkTS model |
| LocalBook Storage | ImportProtocols exist | No repository | Need ArkTS storage |
| Sync/WebDAV | Protocols exist (SyncWebDAVProtocols) | No ArkTS mapping | Need ArkTS adapter |
| Platform Adapters | AdapterProtocols frozen | No ArkTS adapters | Need HTTP/Storage/File adapters |
| Fixture Testing | 1300+ tests in Core | 0 HOS tests | Need headless test infra |
| Bridge Runtime | N/A | Strategy A doc only | Need Strategy B runtime |

### Key insight from Core code reading

Core services are **thin orchestration layers** (~40 lines each). The heavy module is NonJSParserEngine (~2000+ lines). TXT parser is fully implemented (210 lines). All Phase 2 tasks (P2.J1 Adapter, P2.I1 Sync/WebDAV, P2.H1 TXT, P2.H2 EPUB) are **DONE in Core**.

For HarmonyOS, the path is:
1. **Strategy B (Local HTTP Bridge)** — gives real Core capabilities NOW for development/testing
2. **Strategy A (ArkTS re-implementation)** — production path, port models + services + parsers

---

## 2. Headless Capability Stages

### HOS-2B — Core Bridge Runtime

**Goal**: Working ArkTS → Core execution chain via local HTTP bridge.

**Why**: Strategy A (DTO mirroring) gives types but no execution. Without a bridge runtime, all headless services can only use mock data. Strategy B provides real Core capabilities during development.

**Scope**:
- Build Swift executable wrapping Core services (REST API)
- Define API contract (JSON request/response schemas)
- Implement ArkTS HTTP client for the bridge
- Offline fixture replay mode (no Core process needed)
- Bridge health check and error handling

**Tasks**: HOS-2B-001 through HOS-2B-006 (6 tasks)

### HOS-3B — Headless Bookshelf Domain

**Goal**: Real bookshelf data layer — models, storage, CRUD, progress tracking.

**Prerequisites**: HOS-2A (DTOs) complete, HOS-2B (bridge) or fixture fallback.

**Scope**:
- LocalBook ArkTS model (field-complete, matching Core)
- BookshelfRepository with preferences/filesystem storage
- Book CRUD (add, remove, update, list)
- Reading progress metadata
- Headless tests with fixture data

**Tasks**: HOS-3B-001 through HOS-3B-006 (6 tasks)

### HOS-4B — Headless Book Source / Search

**Goal**: Real search service — source management, search execution, result parsing.

**Prerequisites**: HOS-2B bridge runtime OR fixture replay mode.

**Scope**:
- BookSource ArkTS model (field-complete)
- BookSourceRepository (add, list, remove sources)
- SearchService (build request, execute, parse)
- Error model (network, parse, policy errors)
- Offline fixture validation
- BLOCKED_BY_BRIDGE_RUNTIME for live search

**Tasks**: HOS-4B-001 through HOS-4B-006 (6 tasks)

### HOS-5B — Headless TOC / Content Flow

**Goal**: Real TOC and content services — chapter list, content fetch, reading state machine.

**Prerequisites**: HOS-2B bridge runtime OR fixture replay mode.

**Scope**:
- TOCItem/ContentPage ArkTS models
- TOCService (fetch, parse, cache)
- ContentService (fetch chapter, parse, cache)
- ReadingFlowStateMachine (prev/next/progress)
- Offline fixture tests

**Tasks**: HOS-5B-001 through HOS-5B-005 (5 tasks)

### HOS-6B — Headless Local Book Import

**Goal**: Full import pipeline — file metadata, TXT parsing, EPUB contract, encoding detection.

**Prerequisites**: HOS-3B (bookshelf domain), Core TXTParser port.

**Scope**:
- LocalBookImportRequest/Result ArkTS models
- TXT parser ArkTS port (from Core TXTParser.swift, 210 lines)
- EPUB parser adapter contract (mirrors Core EPUBParserContract)
- Encoding detection (BOM sniffing, GBK/UTF-8)
- Chapter splitting (regex/marker/size/auto)
- Import pipeline (metadata extraction → parse → store)
- Headless tests with sample TXT/EPUB fixtures

**Tasks**: HOS-6B-001 through HOS-6B-006 (6 tasks)

### HOS-7B — Headless Sync / WebDAV

**Goal**: Sync data layer — backup, progress sync, WebDAV adapter contract.

**Prerequisites**: HOS-3B (bookshelf), HOS-2B (bridge).

**Scope**:
- SyncWebDAV ArkTS models (mirrors Core SyncWebDAVModels)
- WebDAVAdapter contract (mirrors Core WebDAVAdapter protocol)
- BackupService contract (mirrors Core BackupService)
- ProgressSyncService (local progress tracking)
- Conflict resolution policy model
- CONTRACT_ONLY for actual WebDAV HTTP (adapter scope)

**Tasks**: HOS-7B-001 through HOS-7B-004 (4 tasks)

### HOS-8B — Platform Adapter Implementation

**Goal**: Real HarmonyOS platform adapters.

**Prerequisites**: HOS-2B (bridge), HarmonyOS API knowledge.

**Scope**:
- HTTPAdapter (wrapping @ohos.net.http)
- StorageAdapter (wrapping @ohos.data.preferences)
- FileAccessAdapter (wrapping @ohos.file.fs)
- CredentialStorageAdapter (wrapping credential API)
- SchedulerAdapter (wrapping @ohos.resourceschedule.backgroundTaskManager)
- JS/WebView adapters remain LOCKED

**Tasks**: HOS-8B-001 through HOS-8B-005 (5 tasks)

### HOS-9B — Non-UI QA / Release Gates

**Goal**: Headless test suite, capability matrix, build gates, release readiness.

**Prerequisites**: All B-stages complete or explicitly skipped.

**Scope**:
- Fixture test infrastructure (offline HTML/JSON samples)
- Contract tests per service
- Capability matrix aligned with Core matrix
- Build validation (hvigorw assembleHap passes)
- Boundary compliance (no JS, no WebView, no real book source access)
- Release readiness checklist

**Tasks**: HOS-9B-001 through HOS-9B-004 (4 tasks)

---

## 3. Strategy B: Local HTTP Bridge (HOS-2B Runtime)

Strategy A (DTO regeneration) solves the type problem but not the execution problem. For headless capability development, we need a way to exercise real Core logic from ArkTS.

**Strategy B Bridge Architecture**:

```
ArkTS App (HarmonyOS)
  → BridgeHTTPClient (@ohos.net.http)
    → http://localhost:8899/search  (JSON request)
      → Swift Bridge Service (macOS executable)
        → ReaderCoreServiceFactory
          → DefaultSearchService
            → NonJSParserEngine
              → [SearchResultItem] (JSON response)
```

**Offline Fixture Mode** (when Core process not available):

```
ArkTS App
  → BridgeHTTPClient
    → FixtureReplayInterceptor
      → samples/fixtures/search/*.json (pre-recorded)
```

**Bridge API Endpoints**:

| Endpoint | Core Service | Request | Response |
|----------|-------------|---------|----------|
| POST /search | DefaultSearchService | {source, query} | [SearchResultItem] |
| POST /toc | DefaultTOCService | {source, detailURL} | [TOCItem] |
| POST /content | DefaultContentService | {source, chapterURL} | ContentPage |
| POST /parse/txt | TXTParser | {data_b64, encoding?, policy} | TXTParseResult |
| GET /health | — | — | {status, coreVersion} |

---

## 4. Task Count Summary

| Stage | Tasks | Status |
|-------|-------|--------|
| HOS-0A (foundation) | 7 | DONE |
| HOS-1A (app shell) | 5 | PARTIAL (002 done, 003 READY) |
| HOS-2A (bridge strategy) | 5 | BLOCKED |
| **HOS-2B (bridge runtime)** | **6** | **PENDING** |
| HOS-3A (bookshelf UI) | 5 | BLOCKED |
| **HOS-3B (bookshelf domain)** | **6** | **PENDING** |
| HOS-4A (search DTO) | 1 | PENDING |
| **HOS-4B (search domain)** | **6** | **PENDING** |
| HOS-5A (TOC/content DTO) | 1 | PENDING |
| **HOS-5B (TOC/content domain)** | **5** | **PENDING** |
| HOS-6A (import DTO) | 1 | PENDING |
| **HOS-6B (import domain)** | **6** | **PENDING** |
| **HOS-7B (sync domain)** | **4** | **PENDING** |
| **HOS-8B (platform adapters)** | **5** | **PENDING** |
| **HOS-9B (QA gates)** | **4** | **PENDING** |

**Foundation tasks**: 25 (existing) + 42 (new headless) = **67 total**
**Headless-only tasks**: 42 (HOS-2B through HOS-9B)

---

## 5. Bridge Runtime Dependency Chain

Tasks requiring Core bridge runtime (BLOCKED_BY_BRIDGE_RUNTIME until HOS-2B complete):

| Stage | Tasks | What needs bridge |
|-------|-------|-------------------|
| HOS-4B | SearchService | Live search via Core |
| HOS-5B | TOCService, ContentService | Live TOC/content via Core |
| HOS-6B | TXT parsing validation | Cross-validate ArkTS TXTParser against Core |
| HOS-7B | Sync services | WebDAV/backup via Core |

**Mitigation**: Fixture replay mode allows these tasks to proceed without live Core. Tasks can use pre-recorded JSON fixtures and mark bridge-dependent tests as SKIPPED_BRIDGE_REQUIRED.

---

## 6. First READY Task

**HOS-1A-003** (AppScope & entry module config) — foundation loop continues uninterrupted.
**HOS-2B-001** (Bridge API contract spec) — can start once HOS-2A is complete (docs only, no bridge code).

---

## 7. Contract-Only Boundaries

The following remain CONTRACT_ONLY even after all 67 tasks:

| Capability | Reason |
|------------|--------|
| JS Runtime execution | S26.6 LOCKED — must not implement |
| WebView rendering | LOCKED |
| Real book source HTTP access | Forbidden in loop rules |
| EPUB ZIP/XML parsing | Adapter scope (Core contract only) |
| WebDAV production HTTP | Adapter scope, needs real credential storage |
| Login/cookie-gated sources | Requires auth gate (Core gap still open) |

---

## 8. What Headless Capability Complete Means

After all 67 tasks (25 foundation + 42 headless):

| Layer | Status | Description |
|-------|--------|-------------|
| Models/DTOs | **COMPLETE** | All 73 Core symbols mirrored in ArkTS |
| Services | **COMPLETE** | Search/TOC/Content re-implemented in ArkTS |
| Parsers | **COMPLETE** | TXT parser ported, EPUB contract defined |
| Storage | **COMPLETE** | Preferences/filesystem repositories |
| Adapters | **COMPLETE** | HTTP/Storage/File/Credential adapters |
| Bridge | **COMPLETE** | Strategy B local HTTP bridge for dev |
| Tests | **COMPLETE** | Fixture-based offline tests per service |
| UI | **MOCK_SHELL** | TabBar navigation + placeholder pages |
| Build | **VERIFIED** | hvigorw assembleHap passes |

**Not included**: Polished UI, animations, accessibility, i18n beyond zh/en, production WebDAV, JS/WebView runtime, real online book source testing.
