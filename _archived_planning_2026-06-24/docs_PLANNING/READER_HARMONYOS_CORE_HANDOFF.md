# Reader for HarmonyOS — Core Handoff

**Date**: 2026-05-14
**Reader-Core HEAD**: `4347bbb` (feat: add adapter protocol implementation baseline)
**Reader-Core Phase**: Phase 1 CLOSED, Phase 2 STARTING

## 1. What Reader-Core Provides (Frozen)

### Models (ReaderCoreModels) — 73 frozen symbols

| Model | Status | HOS Relevance |
|-------|--------|---------------|
| BookSource | frozen | Core input model for search/discovery |
| SearchQuery / SearchResultItem | frozen | Search flow DTO |
| TOCItem | frozen | Table of contents DTO |
| ContentPage | frozen | Chapter content DTO |
| LocalBookModels | frozen | Local book import DTO |
| ReadingFlowModels | frozen | Reading flow state models |
| RSSSubscriptionModels | frozen | RSS/Explore models |
| URLDSLModels | frozen | URL option descriptors |
| ExploreRequest / ExploreResultModel | frozen | Explore/search discovery |
| Failure / ReaderError / ErrorMapping | frozen | Error taxonomy |
| CSSNode | frozen | DOM tree model |

### Services (ReaderCoreServices) — Ready

| Service | Implementation | Status |
|---------|---------------|--------|
| DefaultSearchService | NonJSParserEngine-backed | iOS-verified |
| DefaultTOCService | NonJSParserEngine-backed | iOS-verified |
| DefaultContentService | NonJSParserEngine-backed | iOS-verified |
| ReaderCoreServiceFactory | DI container | iOS-verified |

### Protocols (ReaderCoreProtocols) — Frozen contracts

| Protocol | Purpose |
|----------|---------|
| HTTPClient | HTTP transport adapter |
| CookieJar / ScopedCookieJar | Cookie management |
| StorageAdapterProtocol | Key-value storage |
| SchedulerAdapterProtocol | Background task scheduling |
| LoggingAdapterProtocol | Logging |
| SearchService / TOCService / ContentService | Core service contracts |
| AdapterProtocols (new) | Platform adapter boundary |

## 2. What Reader-Core Does NOT Provide Yet

| Capability | Status | Phase 2 Task |
|------------|--------|-------------|
| TXT Parser (real) | contract-only | P2.H1 |
| EPUB Parser (real) | contract-only | P2.H2 |
| WebDAV Sync (real) | contract-only | P2.I1 |
| Adapter Protocol (real impl) | partial | P2.J1 (in progress) |
| JS Runtime (real, non-mock) | LOCKED (S26.6) | — |
| WebView Runtime (real) | LOCKED | — |
| Image decode/merge | missing | — |
| Explore/RSS production | partial | — |
| URL DSL full behavior | partial | — |

## 3. Bridge Strategy Options

HarmonyOS (ArkTS) cannot directly consume Swift libraries. Options:

### Option A: DTO/Contract Re-generation
- Extract Reader-Core model definitions (Swift structs)
- Generate equivalent ArkTS interfaces/classes
- Re-implement service logic in ArkTS
- **Pro**: Native performance, no runtime bridge overhead
- **Con**: Duplicates logic, drift risk, maintenance burden

### Option B: Local HTTP Service Bridge
- Run Reader-Core as a local HTTP service (Swift executable)
- HarmonyOS calls it via HTTP/REST
- **Pro**: Full Core capability available, no logic duplication
- **Con**: Process overhead, IPC latency, service lifecycle management

### Option C: FFI/Native Bridge (if available)
- Use HarmonyOS native C/C++ interop (napi)
- Wrap Reader-Core Swift in a C-compatible FFI layer
- **Pro**: Direct call, best performance
- **Con**: Requires Swift→C FFI layer, complex build setup, unproven path

### Option D: Protocol Re-implementation with DTO Sharing
- Define DTO schema (JSON Schema / Protobuf)
- Generate ArkTS models + Swift models from shared schema
- Re-implement service logic in ArkTS following Core protocols
- **Pro**: Single source of truth for DTOs, platform-native implementation
- **Con**: Service logic re-implemented per platform

> **Decision required from user before HOS-2A can proceed.**

## 4. Phase 2 Watch Items

| Core Task | Blocks HOS | Expected Timing |
|-----------|-----------|----------------|
| P2.J1 (Adapter Protocol) | HOS-8A | Phase 2 active |
| P2.I1 (Sync/WebDAV) | HOS-7A | After P2.J1 |
| P2.H1 (TXT Parser) | HOS-6A enhance | Phase 2 |
| P2.H2 (EPUB Parser) | HOS-6A enhance | After P2.H1 |

## 5. Decision Register

| ID | Decision | Status | Owner |
|----|----------|--------|-------|
| HOS-D001 | Bridge strategy (A/B/C/D) | REQUIRES_HUMAN_REVIEW | User |
| HOS-D002 | Whether to scaffold project now or wait for DevEco Studio | REQUIRES_HUMAN_REVIEW | User |
| HOS-D003 | Whether to share DTO schema with Reader-Core | REQUIRES_HUMAN_REVIEW | User |
