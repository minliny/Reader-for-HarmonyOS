# HarmonyOS DTO Boundary Extraction

**Date**: 2026-05-15
**Core HEAD**: `8b0e8bf`
**Source**: HOS-2A-001 audit (98 Core symbols)

## Classification

| Category | Count | Strategy |
|----------|-------|----------|
| **DTO** (pure data, no logic) | **47** | ArkTS `interface`/`enum` — direct mirror |
| **Protocol** (contract, needs impl) | **26** | ArkTS `interface` — re-implement |
| **Logic** (behavior, needs port) | **16** | ArkTS `class` — re-implement logic |
| **Locked** (must not implement) | **3** | Placeholder only, compile-guard |
| **Internal** (iOS-only, HOS replaces) | **3** | HOS platform-native replacement |
| **Mapping/Utility** | **3** | ArkTS static methods |

---

## Category 1: DTOs (47 symbols — direct mirror)

### Foundation (1)
| # | Symbol | ArkTS |
|---|--------|-------|
| 1 | `JSONValue` | `type JSONValue = string \| number \| boolean \| null \| JSONValue[] \| Record<string, JSONValue>` |

### Core Reader Models (19)
| # | Symbol | ArkTS |
|---|--------|-------|
| 2 | `BookSource` | `interface BookSource` — 12+ fields |
| 3 | `BookSource.LoginDescriptor` | `interface LoginDescriptor` |
| 4 | `BookSource.DynamicCodingKey` | `type DynamicCodingKey = string` |
| 5 | `SearchQuery` | `interface SearchQuery { keyword, page?, pageSize? }` |
| 6 | `SearchResultItem` | `interface SearchResultItem { title, detailURL, author?, coverURL?, intro?, unknownFields }` |
| 7 | `TOCItem` | `interface TOCItem { chapterTitle, chapterURL, chapterIndex, isVip?, unknownFields }` |
| 8 | `ContentPage` | `interface ContentPage { title, content, chapterURL, nextChapterURL?, unknownFields }` |
| 9 | `CSSNode` | `interface CSSNode { type, tagName?, textContent?, attributes, children }` |
| 10 | `CSSNode.NodeType` | `enum NodeType { element, text, comment, document }` |
| 11 | `LocalBook` | `interface LocalBook` — 11 fields |
| 12 | `LocalBookFormat` | `enum LocalBookFormat { txt, epub, pdf, unknown }` |
| 13 | `LocalTOCItem` | `interface LocalTOCItem { title, level, byteOffset?, children? }` |
| 14 | `LocalBookImportRequest` | `interface LocalBookImportRequest { sourcePath, format, encoding?, splitPolicy, metadataOverrides }` |
| 15 | `LocalBookImportResult` | `interface LocalBookImportResult { book, toc, cover?, warnings }` |
| 16 | `LocalBookImportWarning` | `interface LocalBookImportWarning { code, message, context? }` |
| 17 | `ChapterSplitPolicy` | `interface ChapterSplitPolicy { pattern, regex?, marker?, sizeBytes? }` |
| 18 | `ReadingFlowModels` | `interface ReadingFlowState { bookId, currentChapterIndex, chapterProgress, totalChapters }` |
| 19 | `ExploreRequest` | `interface ExploreRequest { url, method, headers }` |
| 20 | `ExploreResultModel` | `interface ExploreResultItem { title, author?, url, coverUrl? }` |

### URL DSL & RSS (2)
| # | Symbol | ArkTS |
|---|--------|-------|
| 21 | `URLDSLModels` | `interface URLDSLDescriptor { baseUrl, keywordReplacement, pageReplacement? }` |
| 22 | `RSSSubscriptionModels` | `interface RSSSubscription { id, name, url, updateInterval? }` |

### EPUB Models (4)
| # | Symbol | ArkTS |
|---|--------|-------|
| 23 | `EPUBMetadata` | `interface EPUBMetadata { title, creator?, identifier?, language?, publisher?, date?, extraFields }` |
| 24 | `EPUBNavPoint` | `interface EPUBNavPoint { label, src?, children }` |
| 25 | `EPUBParseResult` | `interface EPUBParseResult { metadata, navPoints, coverData? }` |
| 26 | `TXTParseResult` | `interface TXTParseResult { encoding, content, toc, byteCount }` |

### Sync/WebDAV Models (from SyncWebDAVModels.swift)
| # | Symbol | ArkTS |
|---|--------|-------|
| 27 | `BackupConfig` | `interface BackupConfig` |
| 28 | `BackupManifest` | `interface BackupManifest` |
| 29 | `BackupPackage` | `interface BackupPackage` |
| 30 | `ProgressCloudSyncRecord` | `interface ProgressSyncRecord` |
| 31 | `RemoteBookMetadata` | `interface RemoteBookMetadata` |

### Error/Compatibility Models (12)
| # | Symbol | ArkTS |
|---|--------|-------|
| 32 | `CompatibilityLevel` | `enum CompatibilityLevel { A, B, C, D }` |
| 33 | `CompatibilityStatus` | `enum CompatibilityStatus { pass, degraded, fail }` |
| 34 | `CompatibilityMark` | `interface CompatibilityMark { level, status, notes? }` |
| 35 | `FailureType` | `enum FailureType` — 14 cases |
| 36 | `Stage` | `enum Stage` — 6 cases |
| 37 | `FailureRecord` | `interface FailureRecord { type, reason, sampleId, detail? }` |
| 38 | `ReaderErrorCode` (models) | `enum ReaderErrorCode` — 6 legacy cases |
| 39 | `ReaderError` | `class ReaderError extends Error { code, message, failure? }` |
| 40 | `ErrorMappingInput` | `type ErrorMappingInput` — discriminated union |
| 41 | `ErrorMappingResult` | `interface ErrorMappingResult { failureType, errorCode, message }` |
| 42 | `StructuredErrorLog` | `interface StructuredErrorLog` — 9 fields |
| 43 | `MappedReaderError` | `class MappedReaderError extends Error { code, stage, message, context }` |

### Adapter Models (4)
| # | Symbol | ArkTS |
|---|--------|-------|
| 44 | `FileAccessResult` | `interface FileAccessResult { data: Uint8Array, fileSize: number, mimeType?: string }` |
| 45 | `Credential` | `interface Credential { identifier, value, label?, accessGroup? }` |
| 46 | `Cookie` | `interface Cookie { name, value, domain, path, expiresAt?, secure, httpOnly }` |
| 47 | `HTTPRequest` | `interface HTTPRequest { url, method, headers, body?, timeout? }` |

---

## Category 2: Protocols (26 symbols — declare interface, re-implement)

| # | Symbol | HOS Strategy |
|---|--------|-------------|
| 1 | `SearchService` | ArkTS `interface` + `DefaultSearchService` class |
| 2 | `TOCService` | ArkTS `interface` + `DefaultTOCService` class |
| 3 | `ContentService` | ArkTS `interface` + `DefaultContentService` class |
| 4 | `BookSourceRepository` | ArkTS `interface` + Preferences-backed impl |
| 5 | `BookSourceDecoder` | ArkTS `interface` + JSON decoder |
| 6 | `SearchParser` | ArkTS `interface` + HTML parser impl |
| 7 | `TOCParser` | ArkTS `interface` + HTML parser impl |
| 8 | `ContentParser` | ArkTS `interface` + HTML parser impl |
| 9 | `RuleScheduler` | ArkTS `interface` |
| 10 | `HTTPClient` | ArkTS `interface` + @ohos.net.http adapter |
| 11 | `CookieJar` | ArkTS `interface` + in-memory impl |
| 12 | `ScopedCookieJar` | ArkTS `interface` |
| 13 | `CookieScopeManaging` | ArkTS `interface` |
| 14 | `RequestBuilder` | ArkTS `interface` + URL DSL impl |
| 15 | `StorageAdapterProtocol` | ArkTS `interface` + @ohos.data.preferences |
| 16 | `SchedulerAdapterProtocol` | ArkTS `interface` + backgroundTask |
| 17 | `LoggingAdapterProtocol` | ArkTS `interface` + hilog adapter |
| 18 | `ReaderErrorLoggingProtocol` | ArkTS `interface` |
| 19 | `ErrorLogger` | ArkTS `interface` |
| 20 | `FileAccessAdapter` | ArkTS `interface` + @ohos.file.fs |
| 21 | `CredentialStorageAdapter` | ArkTS `interface` |
| 22 | `EPUBParserContract` | ArkTS `interface` (ZIP/XML → adapter scope) |
| 23 | `WebDAVAdapter` | ArkTS `interface` (HTTP → adapter scope) |
| 24 | `SyncTransport` | ArkTS `interface` |
| 25 | `BackupService` | ArkTS `interface` |
| 26 | `CacheStore` / `CacheRepository` / `ResponseCache` | ArkTS `interface` + in-memory impl |

---

## Category 3: Logic Classes (16 symbols — port behavior)

| # | Symbol | Lines (Core) | HOS Port Strategy |
|---|--------|-------------|-------------------|
| 1 | `NonJSParserEngine` | ~500 | Port CSS/XPath evaluation engine |
| 2 | `CSSExecutor` | ~200 | Port CSS selector evaluator |
| 3 | `HTMLParser` | ~200 | Port HTML→CSSNode parser |
| 4 | `SelectorEngine` | ~150 | Port selector matching |
| 5 | `RuleParser` | ~100 | Port rule string parser |
| 6 | `TocParser` | ~80 | Port TOC-specific parser |
| 7 | `NonJSRuleScheduler` | ~120 | Port rule scheduler |
| 8 | `TXTParser` | **210** | **Already read — direct port** |
| 9 | `NetworkPolicyLayer` | ~100 | Port request orchestration |
| 10 | `BasicCookieJar` | ~80 | Port in-memory cookie jar |
| 11 | `BookSourceRequestBuilder` | ~150 | Port request builder |
| 12 | `NetworkErrorMapper` | ~60 | Port error mapper |
| 13 | `MinimalCacheHTTPClient` | ~80 | Port caching HTTP decorator |
| 14 | `ReaderCoreServiceFactory` | ~30 | Port DI factory |
| 15 | `DefaultSearchService` | ~40 | Port search orchestration |
| 16 | `DefaultTOCService` / `DefaultContentService` | ~40 each | Port TOC/content orchestration |

**Estimated total port effort**: ~2,200 lines of ArkTS logic (comparable to Core)

---

## Category 4: Locked (3 symbols — DO NOT IMPLEMENT)

| # | Symbol | Reason |
|---|--------|--------|
| 1 | `JSRenderClient` | JS execution locked S26.6 |
| 2 | `JSRenderError` | JS execution locked |
| 3 | `JSParserEngineFactory` | JS execution locked |

---

## Category 5: Internal/iOS-only (3 symbols — HOS replaces)

| # | Symbol | HOS Replacement |
|---|--------|----------------|
| 1 | `URLSessionHTTPClient` | `HarmonyOSHTTPClient` — @ohos.net.http |
| 2 | `MinimalHTTPAdapter` | Same as above |
| 3 | `HTTPAdapterFactory` | `HarmonyOSAdapterFactory` |

---

## Category 6: Mapping/Utility (3 symbols)

| # | Symbol | ArkTS |
|---|--------|-------|
| 1 | `ErrorMapper` | ArkTS static methods |
| 2 | `EPUBMapping` | ArkTS static methods |
| 3 | `CoreRuntimeDependencyInjection` | ArkTS DI factory |

---

## DTO-Only Count: 47

These 47 symbols have **zero behavior** — they are pure data containers (structs with Codable, enums with CaseIterable). They can be mirrored in ArkTS as `interface`/`enum`/`type` declarations with no logic dependency.

**Next step HOS-2A-003**: With DTO boundary clear, evaluate bridge alternatives (Strategy A/B/C/D) against this classification.
