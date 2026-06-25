# Reader for HarmonyOS — AutoDev Queue

**Generated**: 2026-05-14
**Source**: Baseline audit against Reader-Core HEAD `4347bbb`
**Status**: PLANNING_READY

## Task Queue

| Task | Status | Goal | Core Dependency | Notes |
|------|--------|------|-----------------|-------|
| HOS-0A | READY | Project Baseline Audit | None | Confirm repo state, build env, project scaffold readiness |
| HOS-1A | BLOCKED | App Shell Baseline | HOS-0A + DevEnv | Basic ArkTS/Stage Model app shell with navigation skeleton |
| HOS-2A | BLOCKED | Reader-Core Bridge Strategy | HOS-0A + Decision | Define how HarmonyOS consumes Reader-Core (Swift→ArkTS bridge) |
| HOS-3A | BLOCKED | Bookshelf MVP | HOS-1A + HOS-2A | Bookshelf UI with mock/local state; Core DTO when bridge ready |
| HOS-4A | BLOCKED | Book Source / Search Integration | HOS-2A + Core SearchService | Search UI + bridge to DefaultSearchService |
| HOS-5A | BLOCKED | TOC / Content Flow | HOS-2A + Core TOC/Content | TOC and reader content flow |
| HOS-6A | BLOCKED | Local Book Import | HOS-2A + Core LocalBook contract | File picker + LocalBookImporter UI |
| HOS-7A | PENDING | Sync / WebDAV | Core Phase 2 P2.I1 | Blocked until Core Sync/WebDAV baseline implemented |
| HOS-8A | PENDING | Adapter Protocol | Core Phase 2 P2.J1 | Blocked until Core Adapter Protocol baseline implemented |
| HOS-9A | PENDING | Release / QA / Matrix | All above | Release gate aligned with Core matrix |

## Immediate Next Action

**HOS-0A** is the only READY task. It requires:
1. Init HarmonyOS project scaffold (DevEco Studio or CLI)
2. Verify ArkTS / Stage Model / entry module
3. Confirm build passes
4. This produces the project structure that HOS-1A through HOS-6A depend on

## Reader-Core Dependency Mapping

| Core Capability | Frozen? | HOS Tasks Unblocked |
|----------------|---------|---------------------|
| ReaderCoreModels (DTO/Model) | frozen | HOS-2A, HOS-3A |
| ReaderCoreProtocols (Service contracts) | frozen | HOS-2A, HOS-4A, HOS-5A |
| ReaderCoreParser (NonJSParserEngine) | frozen | HOS-4A, HOS-5A |
| ReaderCoreNetwork (NetworkPolicyLayer) | frozen | HOS-4A, HOS-5A |
| DefaultSearchService | frozen | HOS-4A |
| DefaultTOCService | frozen | HOS-5A |
| DefaultContentService | frozen | HOS-5A |
| LocalBookModels | frozen | HOS-6A |
| ImportProtocols | frozen | HOS-6A |
| AdapterProtocols | frozen (contract) | HOS-8A (needs Core impl) |
| Sync/WebDAV | contract-only | HOS-7A (needs Core impl) |
| TXT Parser | contract-only | HOS-6A (needs Core impl) |
| EPUB Parser | contract-only | HOS-6A (needs Core impl) |

## Key Constraints

1. Reader-Core is written in **Swift**. Direct binary linkage from ArkTS is impossible.
2. HarmonyOS uses **ArkTS** (TypeScript superset). No Swift interop.
3. Bridge must be: DTO generation, local service, or protocol re-implementation.
4. Cannot assume any Core capability until bridge strategy is decided.
