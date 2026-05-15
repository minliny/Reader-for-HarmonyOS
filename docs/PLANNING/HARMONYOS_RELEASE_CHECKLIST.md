# HarmonyOS Release Checklist

**Date**: 2026-05-16
**HEAD**: (current)
**Reader-Core**: `8b0e8bf`

## Build Gate

- [x] `./hvigorw assembleHap` passes
- [x] No ArkTS compile errors
- [x] No forbidden imports (JS, WebView, real book source URLs)
- [ ] Signing config (deferred — unsigned HAP for dev)

## DTO Completeness

- [x] All 47 Core DTOs mirrored in ArkTS
- [x] All 26 Core protocols mapped to ArkTS interfaces
- [x] All 16 Core logic classes identified for port (TXTParser done)
- [x] 3 locked symbols (JS/WebView) guarded

## Domain Services

- [x] Bookshelf: IBookshelfRepository + 2 impls + BookshelfService + ProgressService
- [x] Search: BookSourceRepository + SearchService + SearchError model
- [x] TOC/Content: TOCService + ContentService + ReadingFlowStateMachine
- [x] Import: TXTParser (210-line port) + ImportPipeline + EPUBParserContract
- [x] Sync: SyncWebDAV models + WebDAVAdapter/BackupService contracts

## Platform Adapters

- [x] HTTPAdapter (@ohos.net.http)
- [x] StorageAdapter (preferences + memory)
- [x] FileAccessAdapter (@ohos.file.fs)
- [x] CredentialStorageAdapter

## Bridge

- [x] Bridge API contract (5 endpoints)
- [x] BridgeHTTPClient (ArkTS)
- [x] FixtureReplayInterceptor + BridgeClientWithFallback
- [x] BridgeHealthCheck
- [ ] Swift bridge service (BLOCKED_BY_CORE_REPO_ACCESS)

## Tests

- [x] Bookshelf: 16 fixture tests
- [x] Search: 11 fixture tests
- [x] TOC/Content: 12 state machine tests
- [x] Import: 8 TXT parser tests
- [x] Sync: 5 contract tests
- [x] TestInfra: runAllDomainTests() aggregator

## Boundary Compliance

- [x] No JS runtime
- [x] No WebView
- [x] No real book source URLs in domain code
- [x] No hardcoded secrets
- [x] No Core modifications
- [x] MOCK_ONLY / CONTRACT_ONLY / FIXTURE tags present

## Documentation

- [x] HARMONYOS_BASELINE_AUDIT.md
- [x] HARMONYOS_LONG_TERM_ROADMAP.md
- [x] HARMONYOS_AUTODEV_QUEUE.md
- [x] HARMONYOS_BLOCKERS_AND_DECISIONS.md
- [x] HARMONYOS_CORE_BRIDGE_DECISION.md
- [x] HARMONYOS_HEADLESS_CAPABILITY_PLAN.md
- [x] HARMONYOS_BRIDGE_API_SPEC.md
- [x] HARMONYOS_CAPABILITY_MATRIX.yml
- [x] HARMONYOS_CRON_LOOP_SETUP.md
- [x] CLAUDE.md
- [x] .claude/commands/harmonyos-loop.md

## Release Readiness

- [x] Foundation Loop COMPLETE (25/25)
- [x] Headless Capability Loop: 40/42 (1 BLOCKED, 1 remaining)
- [x] BUILD SUCCESSFUL
- [x] Capability matrix documented
- [ ] Simulator/device testing (requires HarmonyOS device or emulator)
- [ ] Signing config for release HAP
