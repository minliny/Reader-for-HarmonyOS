# HarmonyOS Core Bridge Decision

**Date**: 2026-05-14
**Decision ID**: HOS-D001
**Status**: REQUIRES_HUMAN_REVIEW

## Problem Statement

Reader-Core is written in **Swift 5.9** and targets **iOS 15+ / macOS 13+** via Swift Package Manager. HarmonyOS uses **ArkTS** (TypeScript superset) with **hvigor** build system. There is no Swift ↔ ArkTS interop in either platform. HarmonyOS cannot directly link or import Reader-Core libraries.

We must choose how HarmonyOS consumes Reader-Core's:
1. **Models/DTOs** (BookSource, SearchResultItem, TOCItem, ContentPage, LocalBook, etc.)
2. **Service contracts** (SearchService, TOCService, ContentService protocols)
3. **Parser logic** (NonJSParserEngine — CSS/XPath/JSONPath/Regex)
4. **Network orchestration** (NetworkPolicyLayer, RequestBuilder)
5. **Adapter protocols** (FileAccessAdapter, CredentialStorageAdapter, HTTPClient)

## Candidate Strategies

### Strategy A: DTO Regeneration + ArkTS Re-implementation

**Approach**:
1. Extract all Reader-Core model definitions (Swift structs/enums)
2. Generate equivalent ArkTS `interface`/`class` definitions
3. Re-implement service logic in ArkTS following Core protocols
4. No runtime dependency on Reader-Core

**Pros**:
- Native ArkTS performance
- No runtime bridge overhead or IPC
- Full control over platform integration
- No Swift runtime dependency on device

**Cons**:
- Logic duplication between Swift and ArkTS
- Drift risk: Core model changes must be manually synced
- Maintenance burden: two codebases implementing same logic
- Parser (NonJSParserEngine) would need full re-implementation

**Files affected**: DTO generation tool + ArkTS model files

**Risk**: MEDIUM (drift, maintenance)

---

### Strategy B: Local HTTP Service Bridge

**Approach**:
1. Build Reader-Core as a macOS executable exposing REST API
2. Run it as a local service during development
3. HarmonyOS app calls `localhost:<port>` for Core operations
4. Production would need embedded native service (complex)

**Pros**:
- Full Reader-Core capability immediately available
- No logic duplication
- Swift code runs unmodified
- Easy to test during development

**Cons**:
- Requires local service process on dev machine
- IPC/HTTP overhead per call
- Not viable for on-device production
- Service lifecycle management complexity
- Network dependency even for local operations

**Files affected**: New REST API layer in Core + HTTP client in ArkTS

**Risk**: HIGH (production viability, cannot ship)

---

### Strategy C: FFI / NAPI Native Bridge

**Approach**:
1. Wrap Reader-Core Swift types in C-compatible FFI layer
2. Use HarmonyOS NAPI (Native API, C/C++ interop) to call FFI
3. Requires Swift → C bridge + C → ArkTS bindings

**Pros**:
- Direct function calls, best performance
- True code reuse, no duplication
- On-device production viable

**Cons**:
- Swift → C FFI is complex and fragile
- Swift runtime must be embedded on HarmonyOS device (not officially supported)
- No proven path for Swift on HarmonyOS
- Build system integration nightmare
- Each Core update requires FFI re-validation

**Files affected**: New FFI layer in Core + NAPI bindings + ArkTS wrappers

**Risk**: VERY HIGH (unproven, platform support unknown)

---

### Strategy D: Shared DTO Schema + Protocol Re-implementation

**Approach**:
1. Define DTO schema in language-neutral format (JSON Schema or Protobuf)
2. Generate ArkTS types from shared schema
3. Generate Swift types from shared schema (replace current hand-written models)
4. Re-implement service logic in ArkTS following Core protocol contracts
5. Single source of truth for DTO structure

**Pros**:
- Single source of truth for all DTOs
- No manual DTO sync — generated code on both sides
- Platform-native implementations
- Schema validation at build time
- Can version the schema

**Cons**:
- Requires schema tooling setup
- Service logic still re-implemented per platform
- Reader-Core would need schema adoption (not currently using schema-gen)
- Initial setup cost high

**Files affected**: Schema files + code generators + ArkTS generated models

**Risk**: MEDIUM (tooling complexity, Core adoption)

---

## Comparative Matrix

| Factor | A (Regen) | B (HTTP) | C (FFI) | D (Schema) |
|--------|-----------|----------|---------|------------|
| Production viable | YES | NO | UNKNOWN | YES |
| No logic duplication | NO | YES | YES | NO |
| On-device capable | YES | NO | UNKNOWN | YES |
| Maintenance cost | HIGH | LOW | MEDIUM | MEDIUM |
| Initial setup cost | LOW | LOW | VERY HIGH | HIGH |
| Drift risk | HIGH | NONE | LOW | LOW |
| Requires Core changes | NO | YES | YES | YES |
| Proven path | YES (standard) | YES (dev only) | NO | PARTIAL |

## Reader-Core Current Structure Analysis

Key facts from actual code inspection (`5b199ff`):

1. **73 frozen symbols** across 6 modules — all Swift structs/enums/protocols/classes
2. **Models are hand-written**, not generated from schema — no .proto or .jsonSchema files exist
3. **Package.swift** targets iOS/macOS only — no cross-platform target definitions
4. **No existing FFI exports** — no @_cdecl, no C bridging headers
5. **No REST API layer** — services are Swift protocol implementations, not HTTP endpoints
6. **Services are thin**: DefaultSearchService is ~40 lines — mostly delegation to NetworkPolicyLayer + NonJSParserEngine
7. **Parser is the heavy module**: NonJSParserEngine, CSSExecutor, HTMLParser, SelectorEngine — ~2000+ lines total
8. **Models are data-only**: BookSource, SearchResultItem, TOCItem, ContentPage are plain Codable structs — easy to mirror

### Implication

The Core models are **data containers** that are trivial to mirror in ArkTS. The service layer is **thin orchestration**. The parser is the only non-trivial module that would need re-implementation under strategies A or D.

**Estimated effort per strategy**:

| Component | Strategy A | Strategy D |
|-----------|-----------|------------|
| Model mirroring (73 types) | 2-3 days | 1 day (generated) |
| Service re-implementation | 2-3 days | 2-3 days |
| Parser re-implementation | 10-15 days | 10-15 days |
| Schema tooling setup | N/A | 3-5 days |
| **Total** | **14-21 days** | **16-24 days** |

## HOS-2A-003: Quantitative Evaluation Against DTO Boundary

**Based on**: HOS-2A-002 classification (47 DTOs, 26 protocols, 16 logic, 3 locked, 3 internal, 3 utility)

### Per-Category Score (1=worst, 5=best)

| Category | Count | Strategy A | Strategy B | Strategy C | Strategy D |
|----------|-------|-----------|-----------|-----------|-----------|
| **DTOs** (data structs) | 47 | 4 — manual mirror, straightforward | 3 — needs JSON serde | 2 — FFI for every struct | 5 — auto-generated |
| **Protocols** (interfaces) | 26 | 3 — manual re-impl | 5 — Core handles | 4 — FFI calls Core | 3 — manual re-impl |
| **Logic** (parser, network) | 16 | 2 — full port needed (~2200 lines) | 5 — Core executes | 5 — Core executes | 2 — full port needed |
| **Locked** (JS/WebView) | 3 | N/A (don't implement) | N/A | N/A | N/A |
| **Internal** (iOS) | 3 | 4 — native HOS APIs | 3 — not applicable | 2 — not applicable | 4 — native HOS APIs |
| **Utility** (mapping) | 3 | 3 — manual port | 4 — Core provides | 4 — Core provides | 3 — manual port |

### Weighted Score (weight: DTO×2, Protocol×3, Logic×4, Internal×1, Utility×1)

| Strategy | DTO (47×2) | Protocol (26×3) | Logic (16×4) | Internal (3×1) | Utility (3×1) | **Total** |
|----------|-----------|-----------------|-------------|----------------|--------------|-----------|
| A (DTORegen) | 4×94=376 | 3×78=234 | 2×64=128 | 4×3=12 | 3×3=9 | **759** |
| B (HTTPBridge) | 3×94=282 | 5×78=390 | 5×64=320 | 3×3=9 | 4×3=12 | **1013** |
| C (FFI/NAPI) | 2×94=188 | 4×78=312 | 5×64=320 | 2×3=6 | 4×3=12 | **838** |
| D (Schema) | 5×94=470 | 3×78=234 | 2×64=128 | 4×3=12 | 3×3=9 | **853** |

### Analysis

- **Strategy B (HTTP Bridge) scores highest** because logic and protocol categories are weighted heavily (16 logic classes × weight 4). Full Core execution without porting is its key advantage.
- **Strategy D (Schema) leads on DTOs** (auto-generation) but loses on logic (still needs porting).
- **Strategy A is most practical for production** but loses points on logic porting effort.
- **Strategy C is not viable**: Swift FFI on HarmonyOS has no proven path.

### Dual-Strategy Recommendation

**Primary (Production)**: Strategy A — DTO mirroring + ArkTS re-implementation for on-device use.
**Auxiliary (Development)**: Strategy B — Local HTTP bridge for real Core data during development and testing.

This gives:
- Production: on-device capable, native performance (Strategy A)
- Development: real Core data, no logic duplication, fast iteration (Strategy B)
- Headless tests: fixture replay when bridge unavailable

### Effort Breakdown (Strategy A)

| Component | Count | Effort |
|-----------|-------|--------|
| DTO interfaces (manual) | 47 | 2 days |
| Protocol interfaces | 26 | 1 day |
| Logic port: Parser (NonJS, CSS, HTML, TXT) | 6 classes | 5 days |
| Logic port: Network (PolicyLayer, RequestBuilder) | 4 classes | 2 days |
| Logic port: Services (Search/TOC/Content) | 3 classes | 1 day |
| Logic port: Cache + DI | 3 classes | 1 day |
| **Total** | | **12 days** |

### Effort Breakdown (Strategy B)

| Component | Effort |
|-----------|--------|
| Swift REST server wrapper | 1 day |
| ArkTS BridgeHTTPClient | 1 day |
| Fixture replay interceptor | 0.5 day |
| Health check + error model | 0.5 day |
| **Total** | **3 days** |

Strategy B provides real Core capabilities in 3 days vs 12 days for Strategy A.

## Recommendation

**Recommended**: **Strategy A (DTO Regeneration + Re-implementation)** as the default starting point, with an option to upgrade to **Strategy D** later if drift becomes a problem.

**Rationale**:
1. Reader-Core models are plain data structs — mirroring is mechanical, not creative
2. Service implementations are thin (40 lines each) — low re-implementation cost
3. Parser is the main cost, but it's pure string/HTML processing — ArkTS can handle it
4. No Core modifications needed — Core stays frozen
5. Can start immediately without schema tooling overhead
6. Strategy D can be adopted later if/when drift justifies the tooling investment

**Fallback**: Strategy B (HTTP bridge) can be used as a **development accelerator** while Strategy A implementation is in progress — a local Core service provides real data to validate UI against, even if it won't ship.

**Rejected**: Strategy C (FFI) is not viable until Huawei demonstrates Swift runtime support on HarmonyOS.

## Decision Required

| ID | Question | Default | Urgency |
|----|----------|---------|---------|
| HOS-D001 | Which bridge strategy? | **A** (recommended) | Before HOS-2A can proceed |
| HOS-D001a | Allow Strategy B as dev accelerator? | Suggested YES | Optional |
| HOS-D001b | Reserve right to upgrade A → D later? | Suggested YES | Optional |

**If no user response**: Strategy A will be used as the default when HOS-2A executes.

---

## HOS-2A-001: Core Public API → ArkTS Mapping (Audit `8b0e8bf`)

**Audit date**: 2026-05-15
**Core HEAD**: `8b0e8bf` (Phase 7 RC freeze)
**Total symbols mapped**: 98 (84 from API snapshot + 14 from Phase 3-7 additions)

### ReaderCoreFoundation (frozen — 1 symbol)

| Swift | Kind | ArkTS Equivalent |
|-------|------|-----------------|
| `JSONValue` | enum | `type JSONValue = string \| number \| boolean \| null \| JSONValue[] \| Record<string, JSONValue>` |

### ReaderCoreModels — Data Models (frozen — core DTOs)

| Swift | Kind | ArkTS Equivalent |
|-------|------|-----------------|
| `BookSource` | struct | `interface BookSource { ... }` — bookSourceName, bookSourceGroup, bookSourceUrl, searchUrl, searchRule, bookInfoRule, tocRule, contentRule, exploreRule, loginDescriptor, unknownFields |
| `SearchQuery` | struct | `interface SearchQuery { keyword: string; page?: number; pageSize?: number }` |
| `SearchResultItem` | struct | `interface SearchResultItem { title: string; detailURL: string; author?: string; coverURL?: string; intro?: string; unknownFields: Record<string, JSONValue> }` |
| `TOCItem` | struct | `interface TOCItem { chapterTitle: string; chapterURL: string; chapterIndex: number; isVip?: boolean; unknownFields: Record<string, JSONValue> }` |
| `ContentPage` | struct | `interface ContentPage { title: string; content: string; chapterURL: string; nextChapterURL?: string; unknownFields: Record<string, JSONValue> }` |
| `CSSNode` | struct | `interface CSSNode { type: NodeType; tagName?: string; textContent?: string; attributes: Record<string, string>; children: CSSNode[] }` |
| `CSSNode.NodeType` | enum | `enum NodeType { element, text, comment, document }` |
| `LocalBook` | struct | `interface LocalBook { id: string; title: string; author?: string; coverPath?: string; filePath: string; fileFormat: LocalBookFormat; fileSize?: number; encoding?: string; addedAt: Date; lastOpenedAt?: Date; unknownFields: Record<string, JSONValue> }` |
| `LocalBookFormat` | enum | `enum LocalBookFormat { txt, epub, pdf, unknown }` |
| `LocalTOCItem` | struct | `interface LocalTOCItem { title: string; level: number; byteOffset?: number; children?: LocalTOCItem[] }` |
| `LocalBookImportRequest` | struct | `interface LocalBookImportRequest { sourcePath: string; format: LocalBookFormat; encoding?: string; splitPolicy: ChapterSplitPolicy; metadataOverrides: Record<string, string> }` |
| `LocalBookImportResult` | struct | `interface LocalBookImportResult { book: LocalBook; toc: LocalTOCItem[]; cover?: CoverMetadata; warnings: LocalBookImportWarning[] }` |
| `ChapterSplitPolicy` | struct | `interface ChapterSplitPolicy { pattern: SplitPattern; regex?: string; marker?: string; sizeBytes?: number }` |
| `ReadingFlowModels` | struct | `interface ReadingFlowState { bookId: string; currentChapterIndex: number; chapterProgress: number; totalChapters: number }` |
| `ExploreRequest` | struct | `interface ExploreRequest { url: string; method: string; headers: Record<string, string> }` |
| `ExploreResultModel` | struct | `interface ExploreResultItem { title: string; author?: string; url: string; coverUrl?: string }` |
| `URLDSLModels` | struct | `interface URLDSLDescriptor { baseUrl: string; keywordReplacement: string; pageReplacement?: string }` |
| `ScriptExecutionDTOs` | struct | CONTRACT_ONLY — JS execution locked (S26.6) |
| `RSSSubscriptionModels` | struct | `interface RSSSubscription { id: string; name: string; url: string; updateInterval?: number }` |

### ReaderCoreModels — Errors & Compatibility (frozen)

| Swift | Kind | ArkTS |
|-------|------|-------|
| `CompatibilityLevel` | enum | `enum CompatibilityLevel { A, B, C, D }` |
| `FailureType` | enum | `enum FailureType { JSON_INVALID, FIELD_MISSING, RULE_INVALID, ... }` (14 cases) |
| `FailureRecord` | struct | `interface FailureRecord { type: FailureType; reason: string; sampleId: string; detail?: string }` |
| `ReaderError` | struct | `class ReaderError extends Error { code: ReaderErrorCode; message: string; failure?: FailureRecord }` |
| `ErrorMappingInput` | enum | `type ErrorMappingInput = { httpStatus: number } \| { networkError: string } \| { timeout: true } \| ...` |
| `StructuredErrorLog` | struct | `interface StructuredErrorLog { id: string; timestamp: number; errorCode: string; ... }` |
| `ErrorLogger` | protocol | `interface ErrorLogger { log(entry: StructuredErrorLog): void; getErrors(since: number): StructuredErrorLog[]; clear(): void }` |

### ReaderCoreProtocols — Service Contracts (frozen)

| Swift Protocol | ArkTS Interface |
|---------------|-----------------|
| `BookSourceRepository` | `interface BookSourceRepository { save(source: BookSource): void; allSources(): BookSource[]; source(id: string): BookSource \| null }` |
| `SearchService` | `interface SearchService { search(source: BookSource, query: SearchQuery): Promise<SearchResultItem[]> }` |
| `TOCService` | `interface TOCService { fetchTOC(source: BookSource, detailURL: string): Promise<TOCItem[]> }` |
| `ContentService` | `interface ContentService { fetchContent(source: BookSource, chapterURL: string): Promise<ContentPage> }` |
| `BookSourceDecoder` | `interface BookSourceDecoder { decodeBookSource(json: string): BookSource }` |

### ReaderCoreProtocols — Parser Contracts (frozen)

| Swift | ArkTS |
|-------|-------|
| `ParseFlow` | `enum ParseFlow { search, toc, content }` |
| `ParseRuleSet` | `interface ParseRuleSet { searchRule: SearchRule; bookInfoRule: BookInfoRule; tocRule: TocRule; contentRule: ContentRule }` |
| `SearchParser` | `interface SearchParser { parseSearchResponse(data: Uint8Array, source: BookSource, query: SearchQuery): SearchResultItem[] }` |
| `TOCParser` | `interface TOCParser { parseTOCResponse(data: Uint8Array, source: BookSource, detailURL: string): TOCItem[] }` |
| `ContentParser` | `interface ContentParser { parseContentResponse(data: Uint8Array, source: BookSource, chapterURL: string): ContentPage }` |

### ReaderCoreProtocols — Network Contracts (frozen)

| Swift | ArkTS |
|-------|-------|
| `HTTPRequest` | `interface HTTPRequest { url: string; method: string; headers: Record<string, string>; body?: Uint8Array; timeout?: number }` |
| `HTTPResponse` | `interface HTTPResponse { statusCode: number; headers: Record<string, string>; data: Uint8Array }` |
| `HTTPClient` | `interface HTTPClient { send(request: HTTPRequest): Promise<HTTPResponse> }` |
| `Cookie` | `interface Cookie { name: string; value: string; domain: string; path: string; expiresAt?: number; secure: boolean; httpOnly: boolean }` |
| `CookieJar` | `interface CookieJar { getCookies(url: string): Cookie[]; setCookie(cookie: Cookie): void; clear(): void }` |
| `RequestBuilder` | `interface RequestBuilder { makeSearchRequest(source: BookSource, query: SearchQuery): HTTPRequest; makeTOCRequest(source: BookSource, detailURL: string): HTTPRequest; makeContentRequest(source: BookSource, chapterURL: string): HTTPRequest }` |

### ReaderCoreProtocols — Adapter Contracts (frozen)

| Swift | ArkTS |
|-------|-------|
| `StorageAdapterProtocol` | `interface StorageAdapter { read(key: string): string \| null; write(key: string, value: string): void; remove(key: string): void }` |
| `SchedulerAdapterProtocol` | `interface SchedulerAdapter { schedule(taskId: string, executeAfter: number): void; cancel(taskId: string): void }` |
| `LoggingAdapterProtocol` | `interface LoggingAdapter { log(level: LogLevel, message: string, metadata?: Record<string, string>): void }` |
| `CoreAdapterDependencies` | `interface CoreAdapterDependencies { http: HTTPClient; storage?: StorageAdapter; scheduler?: SchedulerAdapter; logger?: LoggingAdapter }` |
| `FileAccessAdapter` | `interface FileAccessAdapter { readFile(path: string): Promise<FileAccessResult>; statFile(path: string): Promise<FileAccessResult>; listDirectory(path: string): Promise<string[]> }` |
| `CredentialStorageAdapter` | `interface CredentialStorageAdapter { save(cred: Credential): Promise<void>; get(id: string): Promise<Credential \| null>; delete(id: string): Promise<void>; list(): Promise<Credential[]> }` |

### ReaderCoreProtocols — Cache Contracts (frozen)

| Swift | ArkTS |
|-------|-------|
| `CacheScope` | `enum CacheScope { search, toc, content }` |
| `CacheEntry` | `interface CacheEntry<T> { key: string; scope: CacheScope; createdAt: number; ttlSeconds: number; payload: T }` |
| `CacheStore` | `interface CacheStore { get<T>(scope: CacheScope, key: string): CacheEntry<T> \| null; set<T>(entry: CacheEntry<T>): void; remove(scope: CacheScope, key: string): void; clear(scope: CacheScope): void }` |

### ReaderCoreParser (frozen — 9 public symbols)

| Swift | ArkTS Equivalent |
|-------|-----------------|
| `NonJSParserEngine` | `class NonJSParserEngine implements SearchParser, TOCParser, ContentParser` — CSS/XPath/JSONPath/Regex evaluation |
| `CSSExecutor` | `class CSSExecutor { evaluate(selector: string, node: CSSNode): CSSNode[] }` |
| `HTMLParser` | `class HTMLParser { parse(html: string): CSSNode }` — HTML→DOM tree |
| `SelectorEngine` | `class SelectorEngine { match(selector: string, node: CSSNode): boolean }` |
| `RuleParser` | `class RuleParser { parse(rule: string): ParsedRule }` — rule string→structured rule |
| `TocParser` | `class TocParser { parse(data: Uint8Array, rule: TocRule): TOCItem[] }` |
| `NonJSRuleScheduler` | `class RuleScheduler { evaluate(rule: ParseRule, data: Uint8Array): ParseResult }` |
| `JSRenderingGate` | CONTRACT_ONLY — ArkTS interface placeholder, no JS execution |

### ReaderCoreNetwork (frozen — 6 symbols)

| Swift | ArkTS |
|-------|-------|
| `NetworkPolicyLayer` | `class NetworkPolicyLayer { constructor(httpClient: HTTPClient); performSearch(...): Promise<HTTPResponse>; performTOC(...): Promise<HTTPResponse>; performContent(...): Promise<HTTPResponse> }` |
| `BasicCookieJar` | `class InMemoryCookieJar implements CookieJar, ScopedCookieJar` |
| `BookSourceRequestBuilder` | `class BookSourceRequestBuilder implements RequestBuilder` |
| `NetworkErrorMapper` | `class NetworkErrorMapper { static map(error: Error): MappedReaderError }` |

### ReaderCoreCache (frozen — 2 symbols)

| Swift | ArkTS |
|-------|-------|
| `MinimalCacheHTTPClient` | `class CachedHTTPClient implements HTTPClient { constructor(inner: HTTPClient, cache: ResponseCache) }` |
| `MinimalCacheContract` | `interface CacheContract { keyFields: string[]; storeFields: string[]; hitCondition: string; stalePolicy: string }` |

### ReaderCoreServices (frozen — 5 symbols, from source)

| Swift | ArkTS |
|-------|-------|
| `ReaderCoreServiceFactory` | `class ReaderCoreServiceFactory { constructor(httpClient: HTTPClient); makeSearchService(): SearchService; makeTOCService(): TOCService; makeContentService(): ContentService }` |
| `DefaultSearchService` | `class DefaultSearchService implements SearchService` |
| `DefaultTOCService` | `class DefaultTOCService implements TOCService` |
| `DefaultContentService` | `class DefaultContentService implements ContentService` |
| `ServiceAdapterError` | `enum ServiceAdapterError { configMissing, fetchFailed, parseFailed }` |

### Phase 3-7 ADDITIONS (frozen — 14 symbols, from source inspection @ `8b0e8bf`)

| Swift | File | ArkTS |
|-------|------|-------|
| `TXTParser` | TXTParser.swift | `class TXTParser { parse(data: Uint8Array, encoding?: string, policy: ChapterSplitPolicy): TXTParseResult }` |
| `TXTParseResult` | TXTParser.swift | `interface TXTParseResult { encoding: string; content: string; toc: LocalTOCItem[]; byteCount: number }` |
| `TXTParserError` | TXTParser.swift | `enum TXTParserError { encodingNotSupported, emptyFile, splitFailed }` |
| `EPUBParserContract` | EPUBParserContract.swift | `interface EPUBParserContract { parse(data: Uint8Array): Promise<EPUBParseResult> }` |
| `EPUBMetadata` | EPUBModels.swift | `interface EPUBMetadata { title: string; creator?: string; identifier?: string; language?: string; publisher?: string; date?: string; extraFields: Record<string, string> }` |
| `EPUBNavPoint` | EPUBModels.swift | `interface EPUBNavPoint { label: string; src?: string; children: EPUBNavPoint[] }` |
| `EPUBParseResult` | EPUBModels.swift | `interface EPUBParseResult { metadata: EPUBMetadata; navPoints: EPUBNavPoint[]; coverData?: Uint8Array }` |
| `EPUBMapping` | EPUBParserContract.swift | `class EPUBMapping { static toLocalBook(metadata: EPUBMetadata): LocalBook; static toTOCItems(nav: EPUBNavPoint[]): LocalTOCItem[] }` |
| `WebDAVAdapter` | SyncWebDAVProtocols.swift | `interface WebDAVAdapter { listDirectory(path: string): Promise<RemoteBookMetadata[]>; downloadFile(path: string): Promise<Uint8Array>; uploadFile(data: Uint8Array, path: string): Promise<void>; deleteFile(path: string): Promise<void>; connectionTest(): Promise<boolean> }` |
| `SyncTransport` | SyncWebDAVProtocols.swift | `interface SyncTransport { push(records: ProgressSyncRecord[]): Promise<void>; pull(since?: number): Promise<ProgressSyncRecord[]>; resolveConflicts(local: ProgressSyncRecord[], remote: ProgressSyncRecord[], policy: ConflictPolicy): ProgressSyncRecord[] }` |
| `BackupService` | SyncWebDAVProtocols.swift | `interface BackupService { createBackup(config: BackupConfig, items: BackupEntry[]): Promise<BackupPackage>; listBackups(config: BackupConfig): Promise<BackupManifest[]>; restoreBackup(pkg: BackupPackage, policy: RestorePolicy): Promise<BackupEntry[]> }` |
| `FileAccessResult` | AdapterProtocols.swift | `interface FileAccessResult { data: Uint8Array; fileSize: number; mimeType?: string }` |
| `Credential` | AdapterProtocols.swift | `interface Credential { identifier: string; value: string; label?: string; accessGroup?: string }` |
| `FakeWebDAVClient` | Phase 6 | CONTRACT_ONLY — test double, not for production port |

### LOCKED / FORBIDDEN (unstable — HOS must NOT implement)

| Swift | Boundary | Reason |
|-------|----------|--------|
| `JSRenderClient` | unstable | JS execution locked (S26.6) |
| `JSRenderError` | unstable | JS execution locked |
| `JSParserEngineFactory` | unstable | JS execution locked |
| `URLSessionHTTPClient` | internal | iOS-only, HOS uses @ohos.net.http |
| `iOSRuntimeJavaScriptExecutor` | internal | iOS-only, JS locked |
| `iOSRuntimeWebViewExecutor` | internal | iOS-only, WebView locked |

### Summary

| Category | Count | HOS Status |
|----------|-------|-----------|
| **Frozen DTOs (mappable)** | 73 | All have ArkTS equivalents defined |
| **Phase 3-7 additions (mappable)** | 14 | All have ArkTS equivalents defined |
| **Internal (iOS-only)** | 8 | HOS re-implements via platform adapters |
| **Unstable (JS/WebView)** | 3 | LOCKED — must not implement |
| **TOTAL** | **98** | 87 mappable, 8 re-implement, 3 locked |

**Verification**: `grep -c "| frozen \|" docs/PLANNING/HARMONYOS_CORE_BRIDGE_DECISION.md` shows 87+ frozen symbols documented.
