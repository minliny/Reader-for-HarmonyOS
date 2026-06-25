# HarmonyOS Baseline Audit

**Date**: 2026-05-15
**Audit Type**: Full Baseline Freeze
**Audited By**: Automated Baseline Audit Script

## 1. Repository Identity

| Field | Value |
|-------|-------|
| Path | `/Users/minliny/Documents/Reader for HarmonyOS` |
| Git Toplevel | `/Users/minliny/Documents/Reader for HarmonyOS` |
| Branch | `main` |
| HEAD | `393b2ab` |
| Remote | `https://github.com/minliny/Reader-for-HarmonyOS.git` |
| Working Tree | clean |
| Commits | 2 (initial + planning baseline) |

## 2. HarmonyOS Project Structure

### Critical Files

| File | Exists? |
|------|---------|
| `oh-package.json5` | **MISSING** |
| `hvigorfile.ts` | **MISSING** |
| `hvigorw` | **MISSING** (expected in scaffold) |
| `build-profile.json5` | **MISSING** |
| `AppScope/app.json5` | **MISSING** |
| `entry/src/main/module.json5` | **MISSING** |

### Critical Directories

| Directory | Exists? |
|-----------|---------|
| `AppScope/` | **MISSING** |
| `entry/` | **MISSING** |
| `entry/src/main/ets/` | **MISSING** |
| `entry/src/main/ets/entryability/` | **MISSING** |
| `entry/src/main/ets/pages/` | **MISSING** |
| `entry/src/main/resources/` | **MISSING** |
| `docs/PLANNING/` | EXISTS (4 files from prior audit) |

### ArkTS / Source Artifacts

| Check | Result |
|-------|--------|
| `.ets` files | **0 found** |
| `.ts` files | **0 found** |
| `.arkts` files | **0 found** |
| `@Entry` decorator | **0 found** |
| `@Component` decorator | **0 found** |
| `EntryAbility` reference | **0 found** |
| `UIAbility` reference | **0 found** |

### Conclusion

**This is NOT a HarmonyOS project.** It is a bare git repository containing only:
- `README.md` (`# Reader-for-HarmonyOS`)
- `.gitignore` (`.DS_Store`)
- `.claude/` (Claude Code config)
- `docs/PLANNING/` (4 planning files from prior audit)

## 3. Build Tool Status

| Tool | Status | Version |
|------|--------|---------|
| `ohpm` | **READY** | 6.0.1 |
| `hdc` | **READY** | 3.2.0c |
| `hvigor` (global) | **MISSING** | — |
| `hvigorw` (project) | EXPECTED in scaffold | — |
| `node` | FOUND | v22.16.0 (DevEco bundled) |
| `npm` | FOUND | 10.9.8 |
| `java` | FOUND | OpenJDK 17 |

**Status**: ENV_PARTIAL_READY — ohpm and hdc are ready. Global hvigor is missing but project-level hvigorw wrapper is expected. HarmonyOS scaffold still needed.

## 4. Reader-Core Adjacency

| Field | Value |
|-------|-------|
| Path | `/Users/minliny/Documents/Reader-Core` |
| Exists? | **YES** |
| HEAD | `e6f5af1` |
| Latest commit | `feat: add Sync/WebDAV implementation baseline (P2.I1)` |
| Language | Swift 5.9 |
| Platforms | iOS 15+, macOS 13+ |
| Tests | 115 test files, ~1300+ tests |
| Phase | Phase 2 CLOSED (verified 2026-05-15) |

### Reader-Core Module Structure

```
Core/Sources/
  ReaderCoreFoundation    — JSONValue, base types
  ReaderCoreModels        — BookSource, DTOs, LocalBook, errors
  ReaderCoreProtocols     — Service contracts, adapter protocols
  ReaderCoreParser        — NonJSParserEngine, CSSExecutor, HTMLParser
  ReaderCoreNetwork       — NetworkPolicyLayer, CookieJar, RequestBuilder
  ReaderCoreCache         — MinimalCacheHTTPClient
  ReaderCoreServices      — DefaultSearchService, DefaultTOCService, DefaultContentService
  ReaderCoreJSRenderer    — [unstable] JS rendering
  ReaderPlatformAdapters  — [internal] URLSessionHTTPClient
```

### Reader-Core Capability Snapshot (Actual, not assumed)

| Capability | Status | Evidence |
|------------|--------|----------|
| BookSource model | **FROZEN** | 22150 bytes, full Codable |
| SearchResultItem DTO | **FROZEN** | API snapshot verified |
| TOCItem DTO | **FROZEN** | API snapshot verified |
| ContentPage DTO | **FROZEN** | API snapshot verified |
| LocalBook models | **FROZEN** | 7439 bytes, full Codable |
| LocalBookImportRequest/Result | **FROZEN** | ImportProtocols.swift |
| DefaultSearchService | **PRODUCTION** | iOS-verified, factory-wired |
| DefaultTOCService | **PRODUCTION** | iOS-verified, factory-wired |
| DefaultContentService | **PRODUCTION** | iOS-verified, factory-wired |
| NonJSParserEngine | **FROZEN** | CSS + XPath + JSONPath + Regex |
| NetworkPolicyLayer | **FROZEN** | Search/TOC/Content orchestration |
| FileAccessAdapter protocol | **FROZEN** | AdapterProtocols.swift (P2.J1 done) |
| CredentialStorageAdapter protocol | **FROZEN** | AdapterProtocols.swift (P2.J1 done) |
| Sync/WebDAV DTOs | **IMPLEMENTED** | P2.I1 done (`5b199ff`) |
| TXT Parser | **CONTRACT_ONLY** | P2.H1 pending |
| EPUB Parser | **CONTRACT_ONLY** | P2.H2 pending |
| JS Runtime | **LOCKED** (S26.6) | Must not use |
| WebView Runtime | **LOCKED** | Must not use |

## 5. Existing Documentation

| File | Status |
|------|--------|
| `README.md` | Exists (1 line: `# Reader-for-HarmonyOS`) |
| `CLAUDE.md` | **MISSING** |
| `docs/PLANNING/READER_HARMONYOS_AUTODEV_QUEUE.md` | Exists (prior round) |
| `docs/PLANNING/READER_HARMONYOS_BLOCKERS_AND_DECISIONS.md` | Exists (prior round) |
| `docs/PLANNING/READER_HARMONYOS_CORE_HANDOFF.md` | Exists (prior round) |
| `docs/PLANNING/READER_HARMONYOS_LOOP_STATE.yml` | Exists (prior round) |

## 6. Risk Summary

| ID | Risk | Severity | Status |
|----|------|----------|--------|
| B-001 | No HarmonyOS project scaffold | **P0 BLOCKER** | Requires DevEco Studio |
| B-002 | ohpm now READY, hdc now READY, global hvigor missing (project wrapper expected) | **P1 MEDIUM** | Partial unblock possible |
| B-003 | Core bridge strategy undecided | **P0 BLOCKER** | Requires user decision |
| R-001 | Swift ↔ ArkTS language barrier | P1 HIGH | Bridge decision will resolve |
| R-002 | Core Phase 2 timing (TXT/EPUB) | P1 MEDIUM | Only affects HOS-6A enhance |
| R-003 | No HarmonyOS handoff in Core | P1 LOW | This doc set is the handoff |

## 7. Audit Verdict

**HOS_BASELINE_FROZEN** — The repo is a planning-only artifact. No HarmonyOS project exists. No build tools are installed. Development cannot proceed until:
1. HarmonyOS SDK / DevEco Studio is installed
2. A HarmonyOS project scaffold is created
3. Bridge strategy is decided (HOS-D001)

Planning can continue at the document level.
