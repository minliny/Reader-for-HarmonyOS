# HarmonyOS Autodev Task Queue

**Date**: 2026-05-15
**Reader-Core HEAD**: `784e98d` (Phase 3 ACTIVE)
**Loop Command**: `/harmonyos-loop`
**Total Tasks**: 67 (25 foundation + 42 headless)

---

## Task Index

### Foundation Loop (HOS-0A → HOS-6A)

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
| 9 | HOS-1A-002 | HOS-1A | DONE | HarmonyOS project scaffold + BUILD SUCCESSFUL |
| 10 | HOS-1A-003 | HOS-1A | DONE | AppScope & entry module config refine |
| 11 | HOS-1A-004 | HOS-1A | DONE | EntryAbility + Navigation shell |
| 12 | HOS-1A-005 | HOS-1A | READY | Theme & resource baseline |
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

### Headless Capability Loop (HOS-2B → HOS-9B)

| # | ID | Stage | Status | Title |
|---|-----|-------|--------|-------|
| 26 | HOS-2B-001 | HOS-2B | PENDING | Bridge API contract spec |
| 27 | HOS-2B-002 | HOS-2B | PENDING | Swift bridge service executable |
| 28 | HOS-2B-003 | HOS-2B | PENDING | Bridge HTTP client (ArkTS) |
| 29 | HOS-2B-004 | HOS-2B | PENDING | Fixture replay interceptor |
| 30 | HOS-2B-005 | HOS-2B | PENDING | Bridge health check & error model |
| 31 | HOS-2B-006 | HOS-2B | PENDING | Bridge smoke validation |
| 32 | HOS-3B-001 | HOS-3B | PENDING | LocalBook ArkTS model (field-complete) |
| 33 | HOS-3B-002 | HOS-3B | PENDING | BookshelfRepository (preferences-backed) |
| 34 | HOS-3B-003 | HOS-3B | PENDING | Book CRUD service |
| 35 | HOS-3B-004 | HOS-3B | PENDING | Reading progress metadata service |
| 36 | HOS-3B-005 | HOS-3B | PENDING | Bookshelf domain fixture tests |
| 37 | HOS-3B-006 | HOS-3B | PENDING | Bookshelf domain smoke validation |
| 38 | HOS-4B-001 | HOS-4B | PENDING | BookSource ArkTS model (field-complete) |
| 39 | HOS-4B-002 | HOS-4B | PENDING | BookSourceRepository (add/list/remove) |
| 40 | HOS-4B-003 | HOS-4B | PENDING | SearchService (request build + parse) |
| 41 | HOS-4B-004 | HOS-4B | PENDING | Search error model & fallback |
| 42 | HOS-4B-005 | HOS-4B | PENDING | Search fixture tests (offline HTML) |
| 43 | HOS-4B-006 | HOS-4B | PENDING | Search domain smoke validation |
| 44 | HOS-5B-001 | HOS-5B | PENDING | TOCService (fetch + parse + cache) |
| 45 | HOS-5B-002 | HOS-5B | PENDING | ContentService (fetch + parse + cache) |
| 46 | HOS-5B-003 | HOS-5B | PENDING | ReadingFlowStateMachine |
| 47 | HOS-5B-004 | HOS-5B | PENDING | TOC/Content fixture tests |
| 48 | HOS-5B-005 | HOS-5B | PENDING | TOC/Content domain smoke validation |
| 49 | HOS-6B-001 | HOS-6B | PENDING | LocalBookImportRequest/Result ArkTS models |
| 50 | HOS-6B-002 | HOS-6B | PENDING | TXT parser ArkTS port (from Core TXTParser.swift) |
| 51 | HOS-6B-003 | HOS-6B | PENDING | EPUB parser adapter contract |
| 52 | HOS-6B-004 | HOS-6B | PENDING | Import pipeline (meta → parse → store) |
| 53 | HOS-6B-005 | HOS-6B | PENDING | Import fixture tests (TXT samples) |
| 54 | HOS-6B-006 | HOS-6B | PENDING | Import domain smoke validation |
| 55 | HOS-7B-001 | HOS-7B | PENDING | SyncWebDAV ArkTS models |
| 56 | HOS-7B-002 | HOS-7B | PENDING | WebDAVAdapter contract + BackupService contract |
| 57 | HOS-7B-003 | HOS-7B | PENDING | ProgressSyncService (local) |
| 58 | HOS-7B-004 | HOS-7B | PENDING | Sync domain contract tests |
| 59 | HOS-8B-001 | HOS-8B | PENDING | HTTPAdapter (@ohos.net.http wrapper) |
| 60 | HOS-8B-002 | HOS-8B | PENDING | StorageAdapter (@ohos.data.preferences) |
| 61 | HOS-8B-003 | HOS-8B | PENDING | FileAccessAdapter (@ohos.file.fs wrapper) |
| 62 | HOS-8B-004 | HOS-8B | PENDING | CredentialStorageAdapter |
| 63 | HOS-8B-005 | HOS-8B | PENDING | Adapter integration smoke tests |
| 64 | HOS-9B-001 | HOS-9B | PENDING | Fixture test infrastructure |
| 65 | HOS-9B-002 | HOS-9B | PENDING | Capability matrix + boundary compliance |
| 66 | HOS-9B-003 | HOS-9B | PENDING | Build gate + release checklist |
| 67 | HOS-9B-004 | HOS-9B | PENDING | Headless loop closure report |

---

## Task Status Summary

| Status | Count |
|--------|-------|
| DONE | 11 |
| READY | 1 |
| BLOCKED | 11 |
| PENDING | 44 |

**Next READY task**: HOS-1A-005 (Theme & resource baseline)
**First headless task**: HOS-2B-001 (after HOS-2A completes)

---

## Foundation Loop Task Details (unchanged from baseline)

HOS-0A-001 through HOS-0A-007: See commit `393b2ab` for full definitions.
HOS-1A-001 through HOS-3A-005: See prior queue version for full definitions.
HOS-4A-001 through HOS-6A-001: Single DTO mirror tasks.

---

## Headless Capability Loop Task Details

### HOS-2B — Core Bridge Runtime (6 tasks)

#### HOS-2B-001 — Bridge API Contract Spec
- **Status**: PENDING
- **Blocker**: HOS-2A complete (DTO boundary known)
- **Stage**: HOS-2B
- **Scope**: Define REST API contract for local Core bridge service. JSON request/response schemas for search, toc, content, txt-parse endpoints. API versioning. Error response format.
- **Allowed files**: `docs/PLANNING/HARMONYOS_CORE_BRIDGE_DECISION.md`, new `docs/PLANNING/HARMONYOS_BRIDGE_API_SPEC.md`
- **Forbidden**: No bridge implementation, no Core modification, no HTTP client code
- **Prerequisites**: HOS-2A-002 (DTO boundary extraction)
- **Acceptance**: API spec doc with all 5 endpoints defined, each with request/response JSON schema
- **Validation**: `test -f docs/PLANNING/HARMONYOS_BRIDGE_API_SPEC.md && grep -c "POST\|GET" docs/PLANNING/HARMONYOS_BRIDGE_API_SPEC.md`
- **Rollback**: Delete spec doc

#### HOS-2B-002 — Swift Bridge Service Executable
- **Status**: PENDING
- **Blocker**: HOS-2B-001 (API spec defined)
- **Stage**: HOS-2B
- **Scope**: Create Swift executable in Reader-Core that wraps ReaderCoreServiceFactory + TXTParser behind REST endpoints. Uses Vapor or SwiftNIO for HTTP server. Listens on localhost:8899. Endpoints: POST /search, POST /toc, POST /content, POST /parse/txt, GET /health.
- **Allowed files**: New `Core/Sources/ReaderCoreBridge/` in Core repo (requires Core repo permission)
- **Forbidden**: No Core model modification, no Core protocol changes, no production deployment configs
- **Prerequisites**: HOS-2B-001, user permission to add target to Core
- **Acceptance**: `swift run ReaderCoreBridge` starts and responds to GET /health
- **Validation**: `curl http://localhost:8899/health` returns 200
- **Note**: **BLOCKED_BY_CORE_REPO_ACCESS** — requires user approval to modify Core

#### HOS-2B-003 — Bridge HTTP Client (ArkTS)
- **Status**: PENDING
- **Blocker**: HOS-2B-002 (bridge service running)
- **Stage**: HOS-2B
- **Scope**: ArkTS BridgeHTTPClient class wrapping @ohos.net.http. Methods: search(source, query), fetchTOC(source, url), fetchContent(source, url), parseTXT(data, policy). Configurable baseURL (default localhost:8899). Error mapping to ArkTS error types.
- **Allowed files**: `entry/src/main/ets/services/BridgeHTTPClient.ets`, `entry/src/main/ets/models/BridgeModels.ets`
- **Forbidden**: No hardcoded credentials, no production URLs, no external network calls
- **Prerequisites**: HOS-2B-002
- **Acceptance**: BridgeHTTPClient compiles, health check returns success
- **Validation**: `grep -c "class BridgeHTTPClient" entry/src/main/ets/services/BridgeHTTPClient.ets`

#### HOS-2B-004 — Fixture Replay Interceptor
- **Status**: PENDING
- **Blocker**: HOS-2B-003 (HTTP client defined)
- **Stage**: HOS-2B
- **Scope**: FixtureReplayInterceptor that intercepts BridgeHTTPClient calls and returns pre-recorded JSON fixtures when bridge is unavailable. Reads fixture files from `samples/fixtures/`. Enables headless development without running Core process.
- **Allowed files**: `entry/src/main/ets/services/FixtureReplayInterceptor.ets`, `samples/fixtures/`
- **Forbidden**: No real HTTP, no network access
- **Prerequisites**: HOS-2B-003
- **Acceptance**: Interceptor returns fixture data, logs "FIXTURE_REPLAY" mode
- **Validation**: `grep -c "FIXTURE_REPLAY" entry/src/main/ets/services/FixtureReplayInterceptor.ets`

#### HOS-2B-005 — Bridge Health Check & Error Model
- **Status**: PENDING
- **Blocker**: HOS-2B-003
- **Stage**: HOS-2B
- **Scope**: BridgeHealthCheck service (periodic /health polling). Bridge error model: BridgeConnectionError, BridgeTimeoutError, BridgeParseError. Fallback strategy: bridge → fixture → error.
- **Allowed files**: `entry/src/main/ets/services/BridgeHealthCheck.ets`
- **Forbidden**: No real network, no production alerts
- **Prerequisites**: HOS-2B-003
- **Acceptance**: Health check detects bridge unavailable, switches to fixture mode
- **Validation**: `grep -c "BridgeConnectionError\|FIXTURE_FALLBACK" entry/src/main/ets/services/BridgeHealthCheck.ets`

#### HOS-2B-006 — Bridge Smoke Validation
- **Status**: PENDING
- **Blocker**: HOS-2B-004, HOS-2B-005
- **Stage**: HOS-2B
- **Scope**: End-to-end check: health check passes OR fixture interceptor active. Bridge error model exercises all error paths. README for bridge setup.
- **Allowed files**: `entry/src/main/ets/services/`, `docs/`
- **Forbidden**: No production changes
- **Prerequisites**: HOS-2B-004, HOS-2B-005
- **Acceptance**: Bridge layer compiles, health check path works
- **Validation**: Build passes + health check logic verified

---

### HOS-3B — Headless Bookshelf Domain (6 tasks)

#### HOS-3B-001 — LocalBook ArkTS Model (Field-Complete)
- **Status**: PENDING
- **Blocker**: HOS-2A-005 (Core DTOs mirrored)
- **Stage**: HOS-3B
- **Scope**: ArkTS interface/class for LocalBook matching ALL fields from Core LocalBookModels.swift (id, title, author, coverPath, filePath, fileFormat, fileSize, encoding, addedAt, lastOpenedAt, unknownFields). LocalBookFormat enum (txt, epub, pdf, unknown). Serialization to/from JSON.
- **Allowed files**: `entry/src/main/ets/models/LocalBook.ets`
- **Forbidden**: No UI imports, no @State, no @Component, no network
- **Prerequisites**: HOS-2A-005
- **Acceptance**: All 11 Core fields present, JSON roundtrip works
- **Validation**: `grep -c "id\|title\|author\|coverPath\|filePath\|fileFormat\|fileSize\|encoding\|addedAt\|lastOpenedAt\|unknownFields" entry/src/main/ets/models/LocalBook.ets`

#### HOS-3B-002 — BookshelfRepository (Preferences-Backed)
- **Status**: PENDING
- **Blocker**: HOS-3B-001 (model ready)
- **Stage**: HOS-3B
- **Scope**: BookshelfRepository interface + PreferencesBookshelfRepository using @ohos.data.preferences. Stores book list as JSON array. Methods: getAll(), getById(id), add(book), update(book), remove(id), exists(id). Handle empty shelf, duplicate add, missing remove gracefully.
- **Allowed files**: `entry/src/main/ets/repository/BookshelfRepository.ets`
- **Forbidden**: No UI, no network, no third-party DB
- **Prerequisites**: HOS-3B-001
- **Acceptance**: CRUD operations work, survives app restart (preferences persistent)
- **Validation**: `grep -c "getAll\|getById\|add\|update\|remove\|exists" entry/src/main/ets/repository/BookshelfRepository.ets`

#### HOS-3B-003 — Book CRUD Service
- **Status**: PENDING
- **Blocker**: HOS-3B-002 (repository ready)
- **Stage**: HOS-3B
- **Scope**: BookshelfService class wrapping repository with validation. Add: generate UUID, set addedAt, validate required fields. Remove: confirm exists first. Update: merge partial updates, preserve unknownFields. List: return all, sorted by lastOpenedAt desc.
- **Allowed files**: `entry/src/main/ets/services/BookshelfService.ets`
- **Forbidden**: No UI, no network
- **Prerequisites**: HOS-3B-002
- **Acceptance**: All CRUD operations validated, error on invalid input
- **Validation**: `grep -c "class BookshelfService" entry/src/main/ets/services/BookshelfService.ets`

#### HOS-3B-004 — Reading Progress Metadata Service
- **Status**: PENDING
- **Blocker**: HOS-3B-002 (repository ready)
- **Stage**: HOS-3B
- **Scope**: ProgressService tracking: currentChapterIndex, chapterProgress (0.0-1.0), totalChapters, lastOpenedAt. Per-book progress stored in preferences. Methods: getProgress(bookId), updateProgress(bookId, progress), deleteProgress(bookId). Update lastOpenedAt on book when progress changes.
- **Allowed files**: `entry/src/main/ets/services/ProgressService.ets`
- **Forbidden**: No UI, no network
- **Prerequisites**: HOS-3B-002
- **Acceptance**: Progress persists, updating progress updates book lastOpenedAt
- **Validation**: `grep -c "getProgress\|updateProgress" entry/src/main/ets/services/ProgressService.ets`

#### HOS-3B-005 — Bookshelf Domain Fixture Tests
- **Status**: PENDING
- **Blocker**: HOS-3B-003, HOS-3B-004
- **Stage**: HOS-3B
- **Scope**: Offline fixture tests for bookshelf domain. Test: add valid book, add duplicate, add missing title, remove existing, remove missing, update book, list empty, list with books, progress save/load, progress range validation. Use JSON fixture files as test data.
- **Allowed files**: `entry/src/main/ets/__tests__/BookshelfDomain.test.ets`, `samples/fixtures/bookshelf/`
- **Forbidden**: No real device tests, no network
- **Prerequisites**: HOS-3B-003, HOS-3B-004
- **Acceptance**: 10+ test cases pass with fixture data
- **Validation**: `grep -c "test\|it\|describe" entry/src/main/ets/__tests__/BookshelfDomain.test.ets`

#### HOS-3B-006 — Bookshelf Domain Smoke Validation
- **Status**: PENDING
- **Blocker**: HOS-3B-005
- **Stage**: HOS-3B
- **Scope**: Run all bookshelf tests, verify no forbidden imports (no @Component, no @Entry, no http:// in domain code). Build verification.
- **Allowed files**: All in `entry/src/main/ets/` (read-only check)
- **Forbidden**: Modifying source files (validation only)
- **Prerequisites**: HOS-3B-005
- **Acceptance**: All tests pass, boundary checks pass
- **Validation**: Build passes + no UI imports in domain layer

---

### HOS-4B — Headless Book Source / Search (6 tasks)

#### HOS-4B-001 — BookSource ArkTS Model (Field-Complete)
- **Status**: PENDING
- **Blocker**: HOS-2A-005 (Core DTOs mirrored)
- **Stage**: HOS-4B
- **Scope**: ArkTS interface for BookSource matching Core BookSource.swift fields (bookSourceName, bookSourceGroup, bookSourceUrl, searchUrl, searchRule, bookInfoRule, tocRule, contentRule, exploreRule, loginDescriptor, etc.). SearchRule model (url, method, headers, body, parseRule). JSON serialization.
- **Allowed files**: `entry/src/main/ets/models/BookSource.ets`, `entry/src/main/ets/models/SearchRule.ets`
- **Forbidden**: No UI, no network
- **Prerequisites**: HOS-2A-005
- **Acceptance**: All Core BookSource fields mirrored, JSON roundtrip
- **Validation**: Field count matches Core BookSource.swift

#### HOS-4B-002 — BookSourceRepository (Add/List/Remove)
- **Status**: PENDING
- **Blocker**: HOS-4B-001
- **Stage**: HOS-4B
- **Scope**: BookSourceRepository with preferences-backed JSON storage. Methods: addSource(source), removeSource(id), getSource(id), getAllSources(), importFromJSON(json). Validate source has searchUrl.
- **Allowed files**: `entry/src/main/ets/repository/BookSourceRepository.ets`
- **Forbidden**: No network, no UI
- **Prerequisites**: HOS-4B-001
- **Acceptance**: CRUD operations for book sources
- **Validation**: `grep -c "addSource\|getAllSources\|importFromJSON" entry/src/main/ets/repository/BookSourceRepository.ets`

#### HOS-4B-003 — SearchService (Request Build + Parse)
- **Status**: PENDING
- **Blocker**: HOS-4B-002, HOS-2B (bridge or fixture)
- **Stage**: HOS-4B
- **Scope**: SearchService class. Method: search(source, query) → [SearchResultItem]. Builds search URL from source.searchUrl + query.keyword. If bridge available: POST to bridge /search. If fixture mode: return pre-recorded fixture data. ParseSearchResponse from HTML using URL DSL rules. Handles: empty results, malformed response, timeout.
- **Allowed files**: `entry/src/main/ets/services/SearchService.ets`
- **Forbidden**: No real HTTP to book source websites (only localhost bridge or fixture replay)
- **Prerequisites**: HOS-4B-002, HOS-2B-004 (fixture interceptor)
- **Acceptance**: Search with fixture returns [SearchResultItem]
- **Validation**: Fixture search returns non-empty result array
- **Note**: **BLOCKED_BY_BRIDGE_RUNTIME** for live search execution

#### HOS-4B-004 — Search Error Model & Fallback
- **Status**: PENDING
- **Blocker**: HOS-4B-003
- **Stage**: HOS-4B
- **Scope**: SearchError enum (configMissing, networkError, parseError, emptyResult). SearchResult wrapper (success + data / failure + error). Error mapping from bridge errors + fixture parse errors. Fallback: try bridge → try fixture → return error.
- **Allowed files**: `entry/src/main/ets/models/SearchError.ets`
- **Forbidden**: No network, no UI
- **Prerequisites**: HOS-4B-003
- **Acceptance**: All error paths exercised in tests
- **Validation**: `grep -c "configMissing\|networkError\|parseError\|emptyResult" entry/src/main/ets/models/SearchError.ets`

#### HOS-4B-005 — Search Fixture Tests (Offline HTML)
- **Status**: PENDING
- **Blocker**: HOS-4B-004
- **Stage**: HOS-4B
- **Scope**: Fixture-based search tests using pre-recorded HTML responses. Tests: search with valid source, search with empty keyword, search with missing searchUrl, search with malformed HTML, search with empty result, multiple sources search. Use Core samples/booksources HTML fixtures as test data.
- **Allowed files**: `entry/src/main/ets/__tests__/SearchDomain.test.ets`, `samples/fixtures/search/`
- **Forbidden**: No real HTTP, no real book source sites
- **Prerequisites**: HOS-4B-004
- **Acceptance**: 8+ test cases pass
- **Validation**: Test file has 8+ test cases

#### HOS-4B-006 — Search Domain Smoke Validation
- **Status**: PENDING
- **Blocker**: HOS-4B-005
- **Stage**: HOS-4B
- **Scope**: Boundary check: no real HTTP URLs in search code, no JS execution, no WebView. Build verification.
- **Allowed files**: Read-only scan of search domain files
- **Forbidden**: Modifying source
- **Prerequisites**: HOS-4B-005
- **Acceptance**: Build passes, boundary clean
- **Validation**: `grep -rn "http://\|https://" entry/src/main/ets/services/SearchService.ets` shows 0 results (only localhost:8899 allowed)

---

### HOS-5B — Headless TOC / Content Flow (5 tasks)

#### HOS-5B-001 — TOCService (Fetch + Parse + Cache)
- **Status**: PENDING
- **Blocker**: HOS-2B (bridge or fixture)
- **Stage**: HOS-5B
- **Scope**: TOCService class. Method: fetchTOC(source, detailURL) → [TOCItem]. If bridge: POST /toc. If fixture: replay fixture. Parse TOC from HTML. Cache results by source+url. TOCItem: chapterTitle, chapterURL, chapterIndex, isVip.
- **Allowed files**: `entry/src/main/ets/services/TOCService.ets`
- **Forbidden**: No real HTTP to book sources
- **Prerequisites**: HOS-2B-004 (fixture interceptor)
- **Acceptance**: Fixture TOC returns [TOCItem] list
- **Note**: **BLOCKED_BY_BRIDGE_RUNTIME** for live TOC

#### HOS-5B-002 — ContentService (Fetch + Parse + Cache)
- **Status**: PENDING
- **Blocker**: HOS-2B (bridge or fixture)
- **Stage**: HOS-5B
- **Scope**: ContentService class. Method: fetchContent(source, chapterURL) → ContentPage. If bridge: POST /content. If fixture: replay fixture. ContentPage: title, content, chapterURL, nextChapterURL. Cache by chapterURL.
- **Allowed files**: `entry/src/main/ets/services/ContentService.ets`
- **Forbidden**: No real HTTP, no JS, no WebView
- **Prerequisites**: HOS-2B-004
- **Acceptance**: Fixture content returns ContentPage
- **Note**: **BLOCKED_BY_BRIDGE_RUNTIME** for live content

#### HOS-5B-003 — ReadingFlowStateMachine
- **Status**: PENDING
- **Blocker**: HOS-5B-001, HOS-5B-002
- **Stage**: HOS-5B
- **Scope**: ReadingFlowStateMachine class. States: idle → toc_loading → toc_ready → chapter_loading → chapter_ready → error. Transitions: openBook, selectChapter, nextChapter, prevChapter, closeBook. Progress update on chapter change.
- **Allowed files**: `entry/src/main/ets/services/ReadingFlowStateMachine.ets`
- **Forbidden**: No UI (no @State, no @Component), no network
- **Prerequisites**: HOS-5B-001, HOS-5B-002
- **Acceptance**: All state transitions valid, no invalid states reachable
- **Validation**: `grep -c "idle\|toc_loading\|toc_ready\|chapter_loading\|chapter_ready\|error" entry/src/main/ets/services/ReadingFlowStateMachine.ets`

#### HOS-5B-004 — TOC/Content Fixture Tests
- **Status**: PENDING
- **Blocker**: HOS-5B-003
- **Stage**: HOS-5B
- **Scope**: Tests: TOC from fixture, content page from fixture, chapter navigation (next/prev bounds), cache hit/miss, empty TOC, empty content, malformed HTML, state machine transitions.
- **Allowed files**: `entry/src/main/ets/__tests__/TOCContentDomain.test.ets`, `samples/fixtures/toc/`, `samples/fixtures/content/`
- **Forbidden**: No real HTTP
- **Prerequisites**: HOS-5B-003
- **Acceptance**: 10+ test cases pass
- **Validation**: Test count >= 10

#### HOS-5B-005 — TOC/Content Domain Smoke Validation
- **Status**: PENDING
- **Blocker**: HOS-5B-004
- **Stage**: HOS-5B
- **Scope**: Boundary check, build verification, test results report.
- **Allowed files**: Read-only scan
- **Forbidden**: Modifying source
- **Prerequisites**: HOS-5B-004
- **Acceptance**: Build passes, boundary clean
- **Validation**: Standard boundary scan

---

### HOS-6B — Headless Local Book Import (6 tasks)

#### HOS-6B-001 — LocalBookImportRequest/Result ArkTS Models
- **Status**: PENDING
- **Blocker**: HOS-2A-005 (DTOs mirrored)
- **Stage**: HOS-6B
- **Scope**: ArkTS models matching Core ImportProtocols.swift: LocalBookImportRequest (sourcePath, format, encoding, splitPolicy, metadataOverrides), LocalBookImportResult (book, toc, cover, warnings), LocalBookImportWarning (code, message, context), ChapterSplitPolicy (pattern type, regex, marker, sizeBytes), LocalBookFormat enum.
- **Allowed files**: `entry/src/main/ets/models/LocalBookImport.ets`
- **Forbidden**: No parser implementation yet
- **Prerequisites**: HOS-2A-005, HOS-3B-001
- **Acceptance**: All Core import model fields present, JSON roundtrip
- **Validation**: Field count matches Core ImportProtocols

#### HOS-6B-002 — TXT Parser ArkTS Port
- **Status**: PENDING
- **Blocker**: HOS-6B-001
- **Stage**: HOS-6B
- **Scope**: Port Core TXTParser.swift (210 lines) to ArkTS. Encoding detection (BOM sniffing, UTF-8/GBK/ASCII/Latin1). Chapter splitting (regex/marker/size/auto). Output: TXTParseResult (encoding, content, toc, byteCount). GBK decoding using TextDecoder or equivalent. Clean-room port — follows Core logic, not copy-paste.
- **Allowed files**: `entry/src/main/ets/parser/TXTParser.ets`
- **Forbidden**: No file IO (takes Data/Uint8Array input), no network
- **Prerequisites**: HOS-6B-001
- **Acceptance**: Identical output to Core TXTParser for same inputs
- **Validation**: Cross-validate with Core TXT fixture test files

#### HOS-6B-003 — EPUB Parser Adapter Contract
- **Status**: PENDING
- **Blocker**: HOS-6B-001
- **Stage**: HOS-6B
- **Scope**: ArkTS port of Core EPUBParserContract protocol + EPUBModels. EPUBMetadata (title, creator, identifier, language, publisher, date). EPUBNavPoint (label, src, children). EPUBParseResult (metadata, navPoints, coverData). EPUBMapping (toLocalBook, toTOCItems). Note: actual ZIP/XML parsing is adapter scope (CONTRACT_ONLY for now).
- **Allowed files**: `entry/src/main/ets/parser/EPUBParserContract.ets`, `entry/src/main/ets/models/EPUBModels.ets`
- **Forbidden**: No ZIP decompression, no XML parsing, no file IO
- **Prerequisites**: HOS-6B-001
- **Acceptance**: Models match Core EPUBParserContract + EPUBModels
- **Validation**: Field count comparison with Core
- **Note**: CONTRACT_ONLY for ZIP/XML — adapter implementation deferred to HOS-8B

#### HOS-6B-004 — Import Pipeline
- **Status**: PENDING
- **Blocker**: HOS-6B-002 (TXT parser), HOS-6B-003 (EPUB contract)
- **Stage**: HOS-6B
- **Scope**: ImportPipeline class. Flow: detectFormat → parseMetadata → parseContent → buildLocalBook → store. Supports TXT (via TXTParser) and EPUB placeholder. Duplicate detection (same filePath + fileSize). Failure handling: encoding fallback, empty file, parse error.
- **Allowed files**: `entry/src/main/ets/services/ImportPipeline.ets`
- **Forbidden**: No UI file picker, no network import
- **Prerequisites**: HOS-6B-002, HOS-6B-003, HOS-3B-003 (bookshelf service)
- **Acceptance**: Full import flow for TXT fixture files
- **Validation**: Import pipeline produces valid LocalBook from TXT data

#### HOS-6B-005 — Import Fixture Tests (TXT Samples)
- **Status**: PENDING
- **Blocker**: HOS-6B-004
- **Stage**: HOS-6B
- **Scope**: Tests using Core TXT fixture samples (samples/localbook/txt/). Test: UTF-8 TXT import with regex split, GBK TXT import, empty file rejection, encoding fallback warning, markdown heading split, auto chapter detection, no-marker TXT (single chapter), duplicate detection, metadata override.
- **Allowed files**: `entry/src/main/ets/__tests__/ImportDomain.test.ets`, `samples/localbook/`
- **Forbidden**: No real file system calls (use in-memory Data)
- **Prerequisites**: HOS-6B-004
- **Acceptance**: 8+ test cases pass
- **Validation**: Test count >= 8

#### HOS-6B-006 — Import Domain Smoke Validation
- **Status**: PENDING
- **Blocker**: HOS-6B-005
- **Stage**: HOS-6B
- **Scope**: Boundary check, build verification, cross-validate ArkTS TXTParser output matches Core TXTParser for same fixture inputs.
- **Allowed files**: Read-only scan
- **Forbidden**: Modifying source
- **Prerequisites**: HOS-6B-005
- **Acceptance**: Build passes, boundary clean, Core cross-validation
- **Validation**: Standard boundary scan + cross-validation report

---

### HOS-7B — Headless Sync / WebDAV (4 tasks)

#### HOS-7B-001 — SyncWebDAV ArkTS Models
- **Status**: PENDING
- **Blocker**: HOS-2A-005 (DTOs mirrored)
- **Stage**: HOS-7B
- **Scope**: ArkTS models matching Core SyncWebDAVModels.swift: BackupConfig, BackupManifest, BackupPackage, ProgressCloudSyncRecord, RemoteBookMetadata, RestorePolicy, ConflictPolicy enum.
- **Allowed files**: `entry/src/main/ets/models/SyncModels.ets`
- **Forbidden**: No real WebDAV HTTP
- **Prerequisites**: HOS-2A-005
- **Acceptance**: All Core sync model fields present
- **Validation**: Field count matches Core

#### HOS-7B-002 — WebDAVAdapter Contract + BackupService Contract
- **Status**: PENDING
- **Blocker**: HOS-7B-001
- **Stage**: HOS-7B
- **Scope**: ArkTS interface matching Core SyncWebDAVProtocols: WebDAVAdapter (listDirectory, downloadFile, uploadFile, deleteFile, connectionTest), SyncTransport (push, pull, resolveConflicts), BackupService (createBackup, listBackups, restoreBackup). All CONTRACT_ONLY — no implementation.
- **Allowed files**: `entry/src/main/ets/services/WebDAVAdapter.ets`, `entry/src/main/ets/services/BackupService.ets`
- **Forbidden**: No actual WebDAV HTTP implementation
- **Prerequisites**: HOS-7B-001
- **Acceptance**: Interfaces compile, match Core protocol signatures
- **Validation**: Signature comparison with Core
- **Note**: CONTRACT_ONLY for HTTP — production WebDAV is adapter scope

#### HOS-7B-003 — ProgressSyncService (Local)
- **Status**: PENDING
- **Blocker**: HOS-7B-001, HOS-3B-004 (progress service)
- **Stage**: HOS-7B
- **Scope**: ProgressSyncService for local progress sync. Methods: exportProgress() → [ProgressCloudSyncRecord], importProgress(records), getUnsyncedChanges(), markSynced(ids). Uses local BookshelfRepository + ProgressService. No remote sync — local only.
- **Allowed files**: `entry/src/main/ets/services/ProgressSyncService.ets`
- **Forbidden**: No network, no WebDAV HTTP
- **Prerequisites**: HOS-7B-001, HOS-3B-004
- **Acceptance**: Export/import cycle preserves all progress data
- **Validation**: Roundtrip test: export → modify → import → verify

#### HOS-7B-004 — Sync Domain Contract Tests
- **Status**: PENDING
- **Blocker**: HOS-7B-002, HOS-7B-003
- **Stage**: HOS-7B
- **Scope**: Contract tests: progress export/import roundtrip, backup manifest creation, conflict resolution policy logic (lastWriteWins, manual, keepBoth), empty sync state, large progress record count.
- **Allowed files**: `entry/src/main/ets/__tests__/SyncDomain.test.ets`
- **Forbidden**: No network
- **Prerequisites**: HOS-7B-002, HOS-7B-003
- **Acceptance**: 6+ test cases pass
- **Validation**: Test count >= 6

---

### HOS-8B — Platform Adapter Implementation (5 tasks)

#### HOS-8B-001 — HTTPAdapter (@ohos.net.http Wrapper)
- **Status**: PENDING
- **Blocker**: HOS-1A complete (module entry exists)
- **Stage**: HOS-8B
- **Scope**: HTTPAdapter wrapping @ohos.net.http.createHttp(). Methods: get(url, headers), post(url, body, headers). Request timeout config. Response model: statusCode, headers, data (ArrayBuffer). Error mapping: timeout, network error, invalid URL. Does NOT access book sources — only localhost bridge.
- **Allowed files**: `entry/src/main/ets/adapters/HTTPAdapter.ets`
- **Forbidden**: No real book source URLs, no external domains
- **Prerequisites**: HOS-1A complete
- **Acceptance**: HTTP GET to localhost:8899/health works, timeout triggers error
- **Validation**: `grep -c "class HTTPAdapter" entry/src/main/ets/adapters/HTTPAdapter.ets`

#### HOS-8B-002 — StorageAdapter (@ohos.data.preferences)
- **Status**: PENDING
- **Blocker**: HOS-1A complete
- **Stage**: HOS-8B
- **Scope**: StorageAdapter wrapping @ohos.data.preferences. Methods: read(key) → string|null, write(key, value), remove(key), keys(). JSON serialization for complex values. Namespace isolation (per module).
- **Allowed files**: `entry/src/main/ets/adapters/StorageAdapter.ets`
- **Forbidden**: No raw file system access
- **Prerequisites**: HOS-1A complete
- **Acceptance**: Write/read roundtrip works for all value types
- **Validation**: `grep -c "read\|write\|remove\|keys" entry/src/main/ets/adapters/StorageAdapter.ets`

#### HOS-8B-003 — FileAccessAdapter (@ohos.file.fs Wrapper)
- **Status**: PENDING
- **Blocker**: HOS-1A complete
- **Stage**: HOS-8B
- **Scope**: FileAccessAdapter wrapping @ohos.file.fs. Methods: readFile(path) → {data, fileSize, mimeType}, statFile(path), listDirectory(path). Error mapping: notFound, permissionDenied, tooLarge, ioError. Matches Core FileAccessAdapter protocol.
- **Allowed files**: `entry/src/main/ets/adapters/FileAccessAdapter.ets`
- **Forbidden**: No access outside app sandbox
- **Prerequisites**: HOS-1A complete
- **Acceptance**: Read file returns data, stat returns metadata
- **Validation**: `grep -c "readFile\|statFile\|listDirectory" entry/src/main/ets/adapters/FileAccessAdapter.ets`

#### HOS-8B-004 — CredentialStorageAdapter
- **Status**: PENDING
- **Blocker**: HOS-1A complete
- **Stage**: HOS-8B
- **Scope**: CredentialStorageAdapter for secure credential storage. Matches Core CredentialStorageAdapter protocol: save(credential), get(identifier), delete(identifier), list(). Uses @ohos.security.huks or preferences with encryption for MVP. Credential model: identifier, value, label, accessGroup.
- **Allowed files**: `entry/src/main/ets/adapters/CredentialStorageAdapter.ets`
- **Forbidden**: No plain-text credential logging, no hardcoded secrets
- **Prerequisites**: HOS-1A complete
- **Acceptance**: Save/get roundtrip, delete removes
- **Validation**: `grep -c "save\|get\|delete\|list" entry/src/main/ets/adapters/CredentialStorageAdapter.ets`

#### HOS-8B-005 — Adapter Integration Smoke Tests
- **Status**: PENDING
- **Blocker**: HOS-8B-001 through HOS-8B-004
- **Stage**: HOS-8B
- **Scope**: Integration smoke for all adapters: HTTP adapter connects to bridge health endpoint, storage adapter roundtrip, file adapter reads test fixture, credential adapter save/get/delete cycle. Boundary check: no real external URLs.
- **Allowed files**: `entry/src/main/ets/__tests__/AdapterIntegration.test.ets`
- **Forbidden**: No real book source URLs
- **Prerequisites**: HOS-8B-001 through HOS-8B-004
- **Acceptance**: All 4 adapters pass smoke
- **Validation**: Test count >= 8

---

### HOS-9B — Non-UI QA / Release Gates (4 tasks)

#### HOS-9B-001 — Fixture Test Infrastructure
- **Status**: PENDING
- **Blocker**: HOS-3B, HOS-4B, HOS-5B, HOS-6B domain tests exist
- **Stage**: HOS-9B
- **Scope**: Test infrastructure: fixture loader (JSON/HTML/txt), expected result comparison, snapshot update mechanism. Test runner configuration. CI-compatible (headless, no device needed). Fixture manifest: sample_id → fixture_path → expected_path.
- **Allowed files**: `entry/src/main/ets/__tests__/infra/`, `samples/fixtures/manifest.json`
- **Forbidden**: No production code changes
- **Prerequisites**: All domain tests exist
- **Acceptance**: All fixture tests runnable with single command
- **Validation**: Test runner script works

#### HOS-9B-002 — Capability Matrix + Boundary Compliance
- **Status**: PENDING
- **Blocker**: All B-stage domain tasks complete
- **Stage**: HOS-9B
- **Scope**: Capability matrix aligned with Core CORE_RC_GAP_REGISTER.yml. Each HOS capability marked: IMPLEMENTED, CONTRACT_ONLY, MOCK_ONLY, BLOCKED_BY_CORE, LOCKED. Boundary compliance scan: no JS runtime, no WebView, no real book source URLs, no hardcoded secrets, no production credentials, no Core modifications.
- **Allowed files**: `docs/PLANNING/HARMONYOS_CAPABILITY_MATRIX.yml`
- **Forbidden**: No source changes (scan only)
- **Prerequisites**: All B-stage domain tasks complete
- **Acceptance**: Matrix complete, 0 boundary violations
- **Validation**: Boundary scan script returns 0

#### HOS-9B-003 — Build Gate + Release Checklist
- **Status**: PENDING
- **Blocker**: HOS-9B-002 (boundary clean)
- **Stage**: HOS-9B
- **Scope**: Build gate: `./hvigorw assembleHap` must pass. Release checklist: all DTOs match Core, all services have tests, all adapters compile, bridge works or fixture fallback active, no mock-as-real in capability matrix, no forbidden imports in domain layer.
- **Allowed files**: `docs/PLANNING/HARMONYOS_RELEASE_CHECKLIST.md`
- **Forbidden**: No production deployment, no signing config
- **Prerequisites**: HOS-9B-002
- **Acceptance**: Build passes, checklist complete
- **Validation**: `./hvigorw assembleHap` passes + checklist verified

#### HOS-9B-004 — Headless Loop Closure Report
- **Status**: PENDING
- **Blocker**: HOS-9B-003
- **Stage**: HOS-9B
- **Scope**: Final report: task completion summary (67 tasks), capability achievement (what's real vs contract-only vs locked), test summary (pass/fail counts), build status, next recommendations.
- **Allowed files**: `docs/PLANNING/HARMONYOS_HEADLESS_CLOSURE_REPORT.md`
- **Forbidden**: No code changes
- **Prerequisites**: HOS-9B-003
- **Acceptance**: Complete closure report
- **Validation**: Report exists with all sections
