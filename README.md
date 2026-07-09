# Reader for HarmonyOS

ArkUI (ArkTS / Stage Model, API 22) native host for the Reader multi-end architecture.

**Phase 1: UI skeleton.** Renders the Reader UI Contract as ArkUI shells, driven by contract fixtures / demo state. No real Core integration in this phase.

## Architecture (Phase 1)

```
Reader UI Contract  (read-only source of truth)
  /Users/minliny/Documents/Reader UI/contracts
      token / route / motion / motion-policy / ui-state / view-state
            │
            ▼  scripts/gen_contracts.mjs  (codegen, idempotent)
  contract/generated/*.ets  +  resources/.../color.json
            │
            ▼
  TokenAdapter  →  color.json / ReaderTypography / ReaderThemeState / motion
  RouteRenderer →  RouteId → Shell → PageState
  MainTabShell / ReaderShell / LibraryShell / SettingsShell / FlowShell  (explicit slots)
  ReaderMotionResolver → MotionSpecRegistry → MotionAdapter  (no ad-hoc animateTo)
  ArkTS reducer/store (UiState) + ViewState fixtures
```

State ownership: `UiState` (reducer-held) → `ViewState` (reducer-produced, UI-rendered). DomainState (Core) is untouched in Phase 1.

## Build & verify

```bash
npm run gen:contracts     # regenerate contract bindings (idempotent; re-run when contracts change)
npm run build             # hvigorw assembleHap — pure ArkTS HAP, no native compile
npm run test              # hypium unit tests (token / route / motion / shell-slot)
npm run lint:tokens       # no raw #hex / Npx outside contract/generated/
```

Toolchain (DevEco-Studio): `hvigorw` / `ohpm` / `node` / `hdc` must be on PATH.

## Layout

```
entry/src/main/ets/
  contract/generated/   # codegen output (ColorTokens, RouteTable, MotionSpecTable, ...)
  ui/tokens/             # ReaderToken, ReaderTypography, ReaderThemeState
  ui/adapters/           # TokenAdapter, MotionAdapter
  ui/motion/             # MotionSpecRegistry, ReaderMotionResolver
  ui/router/             # RouteStack, ShellHost, RouteRenderer
  ui/shells/             # MainTabShell, ReaderShell, LibraryShell, SettingsShell, FlowShell
  ui/slots/              # OverlayHost, StateHost, TopStatusArea
  ui/store/              # ReaderUiState, ReaderReducer, ReaderUiStore
  ui/fixtures/           # DemoUiState, DemoViewState (from contract fixtures)
  ui/components/         # ViewStateRenderer + P0 demo components
  entryability/          # EntryAbility (Stage model)
  pages/                 # Index (@Entry)
  resources/rawfile/font/# Noto Serif CJK SC reader font
```

See `CLAUDE.md` for rules. Phase 2 (page families) follows once the skeleton builds and routes are verified.
