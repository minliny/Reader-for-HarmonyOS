# Reader for HarmonyOS

ArkUI (ArkTS / Stage Model, API 22) native host for the Reader multi-end architecture.

**Phase 1: UI skeleton.** Renders the Reader UI Contract as ArkUI shells, driven by contract fixtures / demo state. No real Core integration in this phase.

## P0 链路闭环交付（2026-07-10）

Reader for HarmonyOS 完成 Contract-first Native UI Architecture 的 P0 链路全闭环。5 条 P0 链路（bookshelf / reader / source-switch / book-detail / settings）× A-F 六列全部 ✅，矩阵 120/120 全绿。

### 交付成果

**B1 — SourceSwitchFlowFrame + MotionAdapter + settings reducer（5 commits）**
- `SourceSwitchFlowFrame` 纳入 `ViewStateRenderer` 渲染注册
- `MotionAdapter.apply` 接入各链路组件（无 ad-hoc animateTo）
- settings reducer case 落地
- 37 新测试覆盖 source-switch / settings / motion 接线

**B2-B4 — 验证 + 补缺口 + 12 新测试（1 commit）**
- 5 条链路 A-F 全量验证，补齐缺口
- 12 新测试覆盖 ViewStateRenderer 注册 / RouteTable / Reducer / MotionAdapter / token raw / 测试存在性

**B6 — reader overlay chrome 修复（2 commits）**
- reader overlay chrome 6 项失败修复
- raw `rgba(` 字面量清零，统一引用 `ReaderToken` 语义 token

### 验收

- `test_contracts`：49/0 pass（49 测试全绿）
- `test.mjs`：164 pass
- `npm run build`（hvigorw assembleHap）：SUCCESS
- P0 链路矩阵：120/120 全绿（退出码 0）

### 遗留

- 2 项 by-design NAPI 测试需真机运行（模拟器/单测环境不覆盖）

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
