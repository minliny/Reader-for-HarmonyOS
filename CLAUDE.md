# Reader for HarmonyOS — CLAUDE.md

## Project Identity

Reader for HarmonyOS is the HarmonyOS (ArkTS / Stage Model, API 22 / SDK 6.0.2) native host app for the Reader multi-end architecture. It renders the Reader UI Contract (route / state / motion / token / view-state) as ArkUI, driven by an ArkTS reducer/store, and integrates Reader-Core-Native through a NAPI/Core bridge (`entry/src/main/ets/bridge/CoreRuntime.ets` + `entry/libs/arm64-v8a/libreader_core_napi.so`) plus HarmonyOS Host Adapters (`entry/src/main/ets/host/adapters/`). The P0 UI static link matrix is 120/120. Historical 2026-07-08 CoreSelfCheck + ReadingChain + ReadingChainUi device evidence exists, but current rollout remains 7 Pilot / 28 Shadow / 0 Authoritative and the current release identity still needs fresh proof on an attached hdc target.

## Key Paths

| Resource | Path |
|----------|------|
| Repo root | `/Users/minliny/Documents/Reader/Reader-for-HarmonyOS` |
| UI Contract (read-only source of truth) | `../Reader-UI/contracts` |
| Business Core | `../Reader-Core-Native` |
| Contract codegen | `scripts/gen_contracts.mjs` |
| Generated contract bindings | `entry/src/main/ets/contract/generated/` |

## Current Architecture

The UI shell is contract-first and native, with Core/Host integration landed (P0 reading chain + 15 Host Adapters + 2026-07-08 device evidence):

1. **TokenAdapter** (`ui/adapters/TokenAdapter.ets`) — maps Reader UI token registry → ArkUI `color.json` / spacing / typography / motion. No raw color/spacing/size values anywhere outside `contract/generated/`.
2. **MainTabShell** (`ui/shells/MainTabShell.ets`) — 5 slots: topArea / content / tabNav / overlayHost / stateHost. 4 tabs: bookshelf / discover / rss / settings.
3. **ReaderShell** (`ui/shells/ReaderShell.ets`) — 5 slots: readingSurface / readerOverlayHost / bottomSheetHost / readerModuleNav / readerStateHost.
4. **RouteRenderer** (`ui/router/RouteRenderer.ets`) — `RouteId → Shell → PageState` dispatch. P0 routes: app-shell / main-tabs / bookshelf / book-detail / reader / settings / discover / rss.
5. **MotionAdapter** (`ui/adapters/MotionAdapter.ets`) — page transitions flow `ReaderMotionResolver → MotionSpecRegistry → MotionAdapter`. No ad-hoc `animateTo` in pages.
6. **CoreBridge / NAPI** (`bridge/CoreRuntime.ets` + `bridge/core/sdk/reader_core.ts`) — implemented; connects ArkTS to Reader-Core-Native C ABI via `libreader_core_napi.so`. P0 reading chain (source.import → book.search → book.detail → book.toc → chapter.content) wrapper smoke + 2026-07-08 device evidence verified.
7. **Host Adapter** (`host/adapters/`) — implemented for HTTP, WebView, cookies, WebDAV/sync, JS runtime, media download, auth/login, TTS, file, credential, notification, permission, screen, share, clipboard, background, device. 15 adapters registered through `HostCapabilityRegistry` + `HostDispatcher`; `HostCapabilityManifest` broadcasts at init.

State ownership: `UiState` (reducer-held, mirrors `ui-state.schema.json`) → `ViewState` (reducer-produced, UI-rendered, from `view-state.fixtures.json`). Durable DomainState belongs to Reader-Core-Native and must cross the NAPI/Core bridge or Host Adapter boundary explicitly.

## Toolchain

DevEco-Studio toolchain is available: `hvigorw`, `ohpm`, `node`, `hdc` (under `/Applications/DevEco-Studio.app/Contents/tools`). NOT ENV_BLOCKED.

## Rules

1. **Do NOT modify Reader UI Contract or Reader-Core-Native** unless the user explicitly asks for cross-repo changes.
2. **Do NOT copy iOS / Android code** as HarmonyOS implementation.
3. **Do NOT assume Core capabilities** — read actual contract files before using them.
4. Real Core integration, real book-source access, NAPI bridge, Host Adapters, WebView runtime, JS runtime, WebDAV/sync, HTTP, cookie, media download, and auth/login work are allowed when they are clean-room, evidence-bound, redacted where needed, and validated.
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
