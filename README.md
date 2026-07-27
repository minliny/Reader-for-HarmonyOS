# Reader for HarmonyOS

ArkUI (ArkTS / Stage Model, API 22) native host for the Reader multi-end architecture.

It renders Reader UI contracts with ArkUI, owns the ArkTS reducer/store and Host Adapters, and integrates Reader-Core-Native through the NAPI/Core bridge. This is a mixed-rollout native host, not a fixture-only Phase 1 skeleton.

## 当前 Reader UI 消费边界（2026-07-12）

- 消费 Reader UI 2.5.1 的 immutable release identity；精确值以 `READER_UI_CONSUMER.json` 为准。
- 35 条 covered event 中 7 条为 Pilot、28 条为 Shadow、0 条为 Authoritative。
- 2026-07-08 有历史真机 ReadingChain 证据，但当前没有 hdc target，不能为本次 release identity 生成 fresh Core NAPI/device proof。
- 因此当前状态是“合同/静态接线与部分 runtime Pilot 已落地”，不是“前端或五条 workflow 全闭环”。

## P0 静态链路矩阵（2026-07-10，非完成口径）

5 条 P0 链路（bookshelf / reader / source-switch / book-detail / settings）× A-F 六列的代码、fixture 与静态接线矩阵达到 120/120。该数字不证明 native 视觉一致、fresh 设备交互或 Authoritative rollout。

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

### 当时静态验收

- `test_contracts`：49/0 pass（49 测试全绿）
- `npm test`：Reader-UI consumer gate 通过，Host 227/227 pass（含 3 条 shared runtime shadow pilot）
- `npm run build`（hvigorw assembleHap）：SUCCESS
- P0 链路矩阵：120/120 全绿（退出码 0）

### 遗留

- Host 单测不代替真实 NAPI 证明；当前无 hdc 目标，`npm run test:device` 会按设计失败，连接真机后需重新采集 fresh CoreSelfCheck 证据

## Current architecture

```
Reader UI Contract  (read-only source of truth)
  ../Reader-UI/contracts
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

State ownership: `UiState` (reducer-held) → `ViewState` (reducer-produced, UI-rendered). Durable DomainState belongs to Reader-Core-Native and crosses the NAPI/Core or Host Adapter boundary explicitly.

## Build & verify

```bash
npm run gen:contracts     # regenerate contract bindings (idempotent; re-run when contracts change)
npm run build             # hvigorw assembleHap — pure ArkTS HAP, no native compile
npm run test              # Reader-UI consumer drift gate + entry HAP hypium host tests
npm run test:device       # install current signed HAP and require fresh Core NAPI self-check evidence
npm run check:reader-ui-consumer # verify Reader-UI version/action hash/dependency lock for HarmonyOS
npm run lint:tokens       # no raw #hex / Npx outside contract/generated/
```

`reader_ui_runtime` is consumed as a sibling source HAR in shadow mode. Its
ArkTS sources are compiled with the entry module, and runtime behavior is
tested by `entry/src/test/ReaderUIRuntimePilot.test.ets`. DevEco's standalone
external-HAR TestAbility is not a release proof; the consuming HAP harness and
the explicit real-device gate own executable verification.

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

See `CLAUDE.md` for rules. Current follow-up work is to close the 28 Shadow events selectively and collect fresh physical-device evidence; static route coverage does not promote rollout authority.
