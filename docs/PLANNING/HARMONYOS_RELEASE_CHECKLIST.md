# HarmonyOS Release Checklist

**Date**: 2026-06-23
**HEAD**: (current)
**Reader-Core**: `28d155d5` plus RECOVERY-25 root gate application evidence

## Build Gate

- [x] `./hvigorw assembleHap` passes
- [x] No ArkTS compile errors
- [x] No ungoverned imports (ArkWeb/JS/HUKS/nativeHTTP are evidence-bound runtime runners; real source URLs require explicit authorization)
- [ ] Signing config (deferred — unsigned HAP for dev)

## DTO Completeness

- [x] All 47 Core DTOs mirrored in ArkTS
- [x] All 26 Core protocols mapped to ArkTS interfaces
- [x] All 16 Core logic classes identified for port (TXTParser done)
- [x] Former locked JS/WebView symbols are guarded by device runtime evidence rows

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
- [x] Swift bridge service (Core bridge exists; HarmonyOS client remains dev-only / fixture fallback on device)

## Tests

- [x] Bookshelf: 16 fixture tests
- [x] Search: 11 fixture tests
- [x] TOC/Content: 12 state machine tests
- [x] Import: 8 TXT parser tests
- [x] Sync: 5 contract tests
- [x] Home Dashboard: 22 local UI composition assertions, including fixture-bound reader preview and source management fields
- [x] Device App Shell Smoke: install/start/layout verified on HarmonyOS emulator
- [x] Device Runtime Smoke Runner: `npm run smoke:device-runtime` produced last-known PASS artifact `artifacts/device-runtime-smoke/20260623T111857Z/device_runtime_smoke_summary.json`
- [x] Historical Device Runtime Smoke: authorized corpus live execution verified in `artifacts/device-runtime-smoke/20260623T111857Z`
- [x] Device Runtime CI Gate implemented: `npm run ci:device-runtime` writes redacted JSON/JUnit artifacts and validates `artifacts/device-runtime-smoke/latest/device_runtime_smoke_summary.json`
- [x] Device Runtime CI fail-closed validator: `npm run ci:device-runtime:validate-fail` validates the current external nativeHTTP/corpus failure artifact while preserving LocalHTTP PASS evidence and without treating it as runtime parity
- [ ] Device Runtime CI Gate latest PASS: latest artifact `artifacts/device-runtime-smoke/20260623T141611Z/device_runtime_smoke_summary.json` currently fail-closes on external nativeHTTP `FAIL 0` / `diag:native:network_error local:none feed:none store:none book:none proxy:env:<hash>:7890:app:on corpus:corpus_error`; LocalHTTP reports `PASS 2xx`; LocalFeed reports `PASS rss:1`; DataStore reports `PASS v75:3`; LocalBook reports `PASS epub:1`; ReaderShell reports `PASS fixture` with `TOC 12` in the home layout; SourceMgmt reports `PASS fixture` with `启用 2/3` and `redacted:true` in the settings layout; Headless reports `PASS fixture` with `Download PASS 2/2`, `TTS PASS q:3`, `WebDAV PASS sync`, `FileToken PASS opaque`, and `DBMig PASS v75:32`; runtimeNetwork records `proxyEndpointRewrittenForEmulator=true`, `proxyListenScope=unlisted-reachable`, `proxyLocalPortReachable=true`, and `proxyAppLevelApplied=true`; hostNetworkProbe records `directHttpsClass=tls_error`, `proxyHttpsClass=tls_error`, and `proxyHttpClass=http_5xx`.
- [x] TestInfra: runAllDomainTests() aggregator

## Boundary Compliance

- [x] JS runtime is evidence-bound to the ArkWeb runtime smoke panel; no ungoverned JS execution in domain code
- [x] WebView runtime is evidence-bound to the ArkWeb runtime smoke panel; no ungoverned WebView dependency in domain services
- [x] Real external URLs are confined to authorized runtime evidence runners and are not exported raw
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
- [x] HARMONYOS_HOME_DASHBOARD_LOCAL_BINDING_REPORT.md
- [x] HARMONYOS_DEVICE_RUNTIME_SMOKE_REPORT.md
- [x] HARMONYOS_DEVICE_RUNTIME_CI_GATE.md
- [x] HARMONYOS_CORE_LEGADO_CAPABILITY_GAP_MATRIX.json
- [x] HARMONYOS_CRON_LOOP_SETUP.md
- [x] CLAUDE.md
- [x] .claude/commands/harmonyos-loop.md

## Release Readiness

- [x] Foundation Loop COMPLETE (25/25)
- [x] Headless Capability Loop: 42/42 locally closeable rows complete
- [x] BUILD SUCCESSFUL
- [x] Capability matrix documented
- [x] Simulator/device app-shell smoke testing
- [x] Device runtime runner implemented: ArkWeb, native HTTP, cookie/session, secure storage, corpus
- [x] Device runtime CI gate implemented: JSON/JUnit artifact plus offline validator
- [x] Device runtime fail-closed artifact validator implemented
- [ ] Device runtime CI gate latest PASS: current 5557 run fails external nativeHTTP/corpus network evidence after app-level proxy application while LocalHTTP stays PASS 2xx, LocalFeed stays PASS rss:1, DataStore stays PASS v75:3, LocalBook stays PASS epub:1, ReaderShell stays PASS fixture with TOC 12, SourceMgmt stays PASS fixture with redacted source-management evidence, and Headless stays PASS fixture with Download PASS 2/2, TTS PASS q:3, WebDAV PASS sync, FileToken PASS opaque, and DBMig PASS v75:32
- [x] HarmonyOS + Core vs Legado gap matrix validates current fail-closed runtime gap and clean-room boundaries
- [x] Device secure-storage entitlement runner
- [x] Authorized corpus live execution smoke
- [ ] Signing config for release HAP
