# Reader for HarmonyOS — Blockers & Decisions

**Date**: 2026-05-14

## P0 Blockers (must resolve before any code)

### B-001: No HarmonyOS Project Scaffold
- **Symptom**: Repo contains only README.md, .gitignore, .claude/
- **Impact**: Cannot write any ArkTS code, cannot build, cannot verify architecture
- **Resolution**: Create HarmonyOS project via DevEco Studio or hvigor CLI
- **Owner**: User (requires DevEco Studio or HarmonyOS SDK)

### B-002: Build Environment Missing
- **Symptom**: `ohpm` not found, `hvigor` not found
- **Impact**: Cannot build, cannot manage dependencies, cannot verify
- **Resolution**: Install HarmonyOS SDK / DevEco Studio on dev machine
- **Note**: Node.js v25.9.0 IS available (ohpm underlying requirement met)

### B-003: Core Bridge Strategy Undecided
- **Symptom**: Reader-Core is Swift, HarmonyOS is ArkTS — no interop path decided
- **Impact**: Cannot implement any Core-dependent feature
- **Resolution**: Choose from options A/B/C/D in HANDOFF doc
- **Owner**: User decision required

## P1 Risks

### R-001: Language Barrier (Swift ↔ ArkTS)
- **Severity**: High
- **Mitigation**: Bridge strategy decision (HOS-D001) + DTO schema sharing (HOS-D003)
- **If unresolved**: All Core-dependent tasks remain BLOCKED

### R-002: Reader-Core Phase 2 Timing
- **Severity**: Medium
- **Impact**: HOS-7A (Sync), HOS-8A (Adapter) depend on Core Phase 2 completion
- **Mitigation**: These tasks are marked PENDING; can proceed with other tasks meanwhile

### R-003: No Existing HarmonyOS Handoff
- **Severity**: Low
- **Impact**: No prior art for HarmonyOS integration with Reader-Core
- **Mitigation**: This planning doc set serves as the initial handoff

### R-004: Platform Adapter Complexity
- **Severity**: Medium
- **Impact**: HarmonyOS adapters (HTTP, storage, file picker) differ from iOS (URLSession, Keychain, FileManager)
- **Mitigation**: HOS-8A explicitly scoped for this; Core adapter protocols are frozen

## Decisions Requiring Human Review

| ID | Question | Options | Context |
|----|----------|---------|---------|
| HOS-D001 | How should HarmonyOS consume Reader-Core? | A: DTO regeneration / B: Local HTTP service / C: FFI native bridge / D: Shared DTO schema + protocol re-impl | Core is Swift; HOS is ArkTS |
| HOS-D002 | Scaffold project now or wait for DevEco Studio setup? | Now via CLI / Wait for IDE | Requires HarmonyOS SDK |
| HOS-D003 | Share DTO schema between Core and HOS? | JSON Schema / Protobuf / Manual sync | Reduces drift between platforms |
| HOS-D004 | Initial UI framework approach? | ArkUI declarative / MVVM with ViewModels / Custom component library | Affects HOS-1A architecture |
