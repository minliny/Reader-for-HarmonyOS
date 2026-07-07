# Reader for HarmonyOS — CLAUDE.md

## Project Identity

Reader for HarmonyOS is the HarmonyOS (ArkTS / Stage Model, API 22 / SDK 6.0.2) native host app for the Reader multi-end architecture. It renders the Reader UI Contract (route / state / motion / token / view-state) as ArkUI, driven by an ArkTS reducer/store. **Phase 1: UI skeleton only — no real Core integration.** Pages render contract fixtures / demo state.

## Key Paths

| Resource | Path |
|----------|------|
| Repo root | `/Users/minliny/Documents/Reader-for-HarmonyOS` |
| UI Contract (read-only source of truth) | `/Users/minliny/Documents/Reader UI/contracts` |
| Business Core (Phase 2+, not wired in Phase 1) | `/Users/minliny/Documents/Reader-Core-Native` |
| Contract codegen | `scripts/gen_contracts.mjs` |
| Generated contract bindings | `entry/src/main/ets/contract/generated/` |

## Phase 1 Architecture (UI skeleton)

Five core components, all driven by contract fixtures:

1. **TokenAdapter** (`ui/adapters/TokenAdapter.ets`) — maps Reader UI token registry → ArkUI `color.json` / spacing / typography / motion. No raw color/spacing/size values anywhere outside `contract/generated/`.
2. **MainTabShell** (`ui/shells/MainTabShell.ets`) — 5 slots: topArea / content / tabNav / overlayHost / stateHost. 4 tabs: bookshelf / discover / rss / settings.
3. **ReaderShell** (`ui/shells/ReaderShell.ets`) — 5 slots: readingSurface / readerOverlayHost / bottomSheetHost / readerModuleNav / readerStateHost.
4. **RouteRenderer** (`ui/router/RouteRenderer.ets`) — `RouteId → Shell → PageState` dispatch. P0 routes: app-shell / main-tabs / bookshelf / book-detail / reader / settings / discover / rss.
5. **MotionAdapter** (`ui/adapters/MotionAdapter.ets`) — page transitions flow `ReaderMotionResolver → MotionSpecRegistry → MotionAdapter`. No ad-hoc `animateTo` in pages.

State ownership: `UiState` (reducer-held, mirrors `ui-state.schema.json`) → `ViewState` (reducer-produced, UI-rendered, from `view-state.fixtures.json`). DomainState (Core) is not touched in Phase 1.

## Toolchain

DevEco-Studio toolchain is available: `hvigorw`, `ohpm`, `node`, `hdc` (under `/Applications/DevEco-Studio.app/Contents/tools`). NOT ENV_BLOCKED — Phase 1 is buildable.

## Rules

1. **Do NOT modify Reader UI Contract or Reader-Core-Native** unless the user explicitly asks for cross-repo changes.
2. **Do NOT copy iOS / Android code** as HarmonyOS implementation.
3. **Do NOT assume Core capabilities** — read actual contract files before using them.
4. **Phase 1 uses contract fixtures / demo state only** — no real book-source access, no NAPI bridge, no host adapters. Native C++ bridge was removed for Phase 1.
5. **All tokens flow through TokenAdapter** — no raw `#hex` / `Npx` outside `contract/generated/` (enforced by `scripts/lint_tokens.mjs`).
6. **All page motion flows through the resolver** — no ad-hoc `animateTo` in page components.
7. **Durable UI state lives in the reducer/store**, not inside ArkUI page components.
8. **ENV_BLOCKED** is valid only for a true environment blocker; do not fake build / test success.

## Build & Verify

```bash
node scripts/gen_contracts.mjs        # regenerate contract bindings (idempotent)
hvigorw assembleHap --no-daemon       # build pure-ArkTS HAP
hvigorw test                           # hypium unit tests
node scripts/lint_tokens.mjs           # no raw token values outside generated/
```
