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
