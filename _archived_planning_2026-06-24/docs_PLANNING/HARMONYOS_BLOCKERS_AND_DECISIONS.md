# HarmonyOS Blockers & Decisions Register

**Date**: 2026-05-15
**Reader-Core HEAD**: `e6f5af1`
**Loop State**: PLANNING

---

## P0 Blockers (prevents any code execution)

### B-001/B-002: RESOLVED
- Project scaffold created, BUILD SUCCESSFUL. ohpm 6.0.1, hvigorw 6.22.7, hdc 3.2.0c.

### B-003: RESOLVED
- Bridge strategy decided: dual Strategy A (production DTO regen) + B (local HTTP dev bridge).

### B-004: Bridge Service Missing — All Capabilities Blocked
- **Severity**: P0
- **Symptom**: HOS-2B-002 (Swift bridge executable) is BLOCKED_BY_CORE_REPO_ACCESS. No bridge server exists.
- **Impact**: ALL headless services operate in FIXTURE_MODE only. Search/TOC/Content/Import cannot execute real operations.
- **Resolution**: User grants Core repo write access → build Swift bridge → cross-validate TXTParser + services.
- **Loop behavior**: HOS-2B-002 remains BLOCKED. No task may be marked PRODUCTION_READY until bridge is built and cross-validation passes.

### B-005: UI Scope Overreach Detected (CORRECTED)
- **Severity**: P0 (corrected 2026-05-16)
- **Symptom**: Index.ets contained full BookshelfContent component with ViewModel binding, book cards, sort toggle, and reading progress display (264 lines). BookshelfViewModel had @Observed UI state management (155 lines).
- **Impact**: UI development was advancing as if bridge were complete. Violates headless-only scope.
- **Resolution (applied)**: BookshelfContent demoted to simple placeholder. ViewModel demoted to SHELL_ONLY_PLACEHOLDER. Loop command updated with hard UI constraints.
- **Loop behavior**: pages/ is FROZEN. No new UI components. No ViewModel-page binding.

### B-006: Core Boundary Risk — TXTParser ArkTS Port
- **Severity**: P0
- **Symptom**: TXTParser.ets (184 lines) is an ArkTS re-implementation following Core TXTParser.swift logic. Not cross-validated against Core output.
- **Impact**: Risk of divergent behavior between Core and ArkTS TXT parsers. Import results may differ from Core expectations.
- **Resolution**: Mark TXTParser as LOCAL_FALLBACK_EXPERIMENTAL. Cross-validate against Core TXTParser after HOS-2B-002 is built. Do not claim production readiness.
- **Loop behavior**: TXTParser.ets stays LOCAL_FALLBACK_EXPERIMENTAL indefinitely unless bridge cross-validation is completed.

---

## P1 Risks (may affect downstream tasks)

### R-001: Swift ↔ ArkTS Language Barrier
- **Severity**: HIGH
- **Impact**: All Core-dependent features need DTO mirroring or bridge
- **Mitigation**: Strategy A chosen as default; DTO-only mirroring is low-risk
- **Status**: ACTIVE — will persist through HOS-3A to HOS-6A

### R-002: Reader-Core Parser Complexity
- **Severity**: MEDIUM
- **Impact**: NonJSParserEngine (~2000+ lines) is non-trivial to re-implement in ArkTS
- **Mitigation**: Phased approach — mock-first for UI, real parser later
- **Status**: MONITORED — only relevant at HOS-4A/5A

### R-003: No HarmonyOS Handoff in Reader-Core
- **Severity**: LOW
- **Impact**: No prior art or documentation for HOS-specific integration
- **Mitigation**: This doc set is the initial handoff; HOS-2A will produce detailed mapping
- **Status**: MITIGATED by current planning

### R-004: Platform Adapter Divergence
- **Severity**: MEDIUM
- **Impact**: HarmonyOS adapters (file, HTTP, credential, storage) differ from iOS equivalents
- **Mitigation**: HOS-8A explicitly scoped; Core adapter protocols are frozen and well-defined (P2.J1 done)
- **Status**: DEFERRED to HOS-8A

### R-005: ohpm/hvigor May Not Work with Node v22
- **Severity**: LOW
- **Impact**: HarmonyOS build tools may require specific Node version
- **Mitigation**: DevEco bundled Node v22.16.0 is confirmed working
- **Status**: MITIGATED (DevEco Node verified)

---

## Decisions Requiring Human Review

| ID | Question | Options | Default | Auto-apply? |
|----|----------|---------|---------|-------------|
| **HOS-D001** | Bridge strategy for consuming Reader-Core | A: DTO regen / B: HTTP service / C: FFI / D: Shared schema | **A** | YES — if no response, use A |
| **HOS-D002** | How to scaffold HarmonyOS project | DevEco Studio / CLI / Manual file creation | DevEco Studio | NO — requires SDK |
| **HOS-D003** | Share DTO schema between Core and HOS? | JSON Schema / Protobuf / Manual / None | Manual (Strategy A) | YES — follows D001 |
| **HOS-D004** | UI framework architecture | ArkUI declarative only / MVVM + ArkUI / Custom component lib | MVVM + ArkUI | YES — can start with default |
| **HOS-D005** | Allow mock layer for Core-dependent features? | Yes, with MOCK_ONLY tags / No, wait for bridge | **YES** | YES |
| **HOS-D006** | Install cron for loop automation? | Yes / No | **NO** (manual trigger only) | NO — user must authorize |
| **HOS-D007** | Auto-commit planning changes? | Yes, with review / No, manual only | **YES** (planning docs only) | YES — planning docs safe to auto-commit |
| **HOS-D008** | Allow loop to create ArkTS files without build verification? | Yes (ENV_BLOCKED accepted) / No | **YES** | YES — env blocked is valid |

---

## Auto-Decision Policy (for Loop Execution)

The following decisions have safe defaults and DO NOT require user input during loop execution:

1. **Strategy A** is the default bridge strategy (HOS-D001) — loop can plan against it
2. **MVVM + ArkUI** is the default UI architecture (HOS-D004)
3. **Mock layer allowed** with MOCK_ONLY tags (HOS-D005)
4. **Planning doc commits** are auto-approved (HOS-D007)
5. **Build verification skipped** when ohpm/hvigor missing (HOS-D008)

The following decisions MUST have explicit user input:

1. **Installing HarmonyOS SDK** (B-002 resolution) — loop cannot do this
2. **Creating project scaffold** (HOS-D002) — loop can generate files but cannot run DevEco Studio
3. **Installing cron** (HOS-D006) — loop documents setup but does not install
4. **Any Core modification** — loop is forbidden from touching Reader-Core

---

## Blocked Task Chains

```
HOS-1A-001 (SDK install)
  └── HOS-1A-002 (scaffold)
       └── HOS-1A-003 (app config)
            └── HOS-1A-004 (navigation shell)
                 └── HOS-1A-005 (resources)
                      └── HOS-3A (bookshelf)

HOS-D001 (bridge decision)
  └── HOS-2A-001..005 (bridge implementation)
       └── HOS-3A (bookshelf with real DTOs)
            └── HOS-4A, HOS-5A, HOS-6A (search, content, import)
                 └── HOS-7A, HOS-8A (sync, adapters)
                      └── HOS-9A (release)
```

## Current Unblock Path

1. **User installs HarmonyOS SDK** → HOS-1A unblocks
2. **User confirms or defaults bridge strategy** → HOS-2A unblocks
3. **Loop executes HOS-1A tasks** → project scaffold created
4. **Loop executes HOS-2A tasks** → DTO mirroring begins
5. **Loop executes HOS-3A tasks** → first feature (bookshelf) emerges
