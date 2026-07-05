# HarmonyOS Complete App Gap Matrix

Status: `SLICE_1_STATIC_HEADLESS_PROOF_DEVICE_BLOCKED`

Date: 2026-07-04

Target repo: `/Users/minliny/Documents/Reader for HarmonyOS`

Parent matrix: `docs/frontend-complete-app/FRONTEND_COMPLETE_APP_GAP_MATRIX.md`

## 1. Purpose

This file turns the parent gap matrix into HarmonyOS-specific work. Current evidence is from a local source audit, static no-device validator, contract drift validator, and `assembleHap` build on 2026-07-04. It is not final frontend-complete evidence because runtime headless execution, simulator/real-device AppShell recordings, and full ViewState/Core bridge slice wiring are still missing.

HarmonyOS must implement native ArkUI UI. It must not ship `frontend-demo/` through WebView as the production app.

## 2. HarmonyOS Preflight

| Check | Current local evidence | Required result |
| --- | --- | --- |
| Repo exists | `/Users/minliny/Documents/Reader for HarmonyOS` exists. | Use this repo for HarmonyOS implementation evidence. |
| Build entries exist | `package.json`, `oh-package.json5`, `build-profile.json5`, root `hvigorfile.ts`, `entry/hvigorfile.ts`, `entry/build-profile.json5`, `entry/src/main/module.json5`. | Build command and target module are documented here. |
| Build command | `./hvigorw --mode module -p module=entry assembleHap` -> `BUILD SUCCESSFUL in 1 s 413 ms`; warnings are existing ArkTS/NAPI/unsigned-HAP warnings. | Keep this as the Slice 0/1 compile gate until a signed/device gate is added. |
| Tool versions | `./hvigorw --version` -> `6.22.7`; `ohpm --version` -> `6.0.1`. | Record local toolchain used for evidence. |
| Contract dependency | `entry/src/main/ets/contract/index.ets` exports generated ArkTS contract files; generated file headers say `Synced from: /Users/minliny/Documents/Reader UI/generated/arkts/*.ets`. `Motion.ets` now includes `motionSpecRegistry` / `motionSpecs` / `getMotionSpec`; `Token.ets` now includes `tokenRegistry` / `tokens` / `getToken`, with HarmonyOS-compatible typed arrays backing the registries. | HarmonyOS must keep consuming Reader UI generated ArkTS types or generated artifacts from the same schema. |
| Native UI proof | `entry/src/main/ets/pages/Index.ets` loads ArkUI `MainTabShell` / `ReaderShell`; `entry/src/main/ets/ui/shells/MainTabShell.ets` renders native ArkUI tabs and components. No `frontend-demo` WebView production host was found in this Slice 0/1 path. | Production UI must remain ArkUI/native, not WebView loading the demo. |

## 3. Required HarmonyOS Files Or Equivalents

| Required role | Expected HarmonyOS landing | Acceptance |
| --- | --- | --- |
| Contract import | `entry/src/main/ets/contract/{Route,UiEvent,UiState,ViewState,Motion,Token}.ets`; entrypoint `entry/src/main/ets/contract/index.ets`. | Contract types compile in ArkTS app code via `assembleHap`. |
| Store/reducer | Existing implementation `entry/src/main/ets/ui/ReaderUiState.ets`; Slice 0/1 facade `entry/src/main/ets/ui/store/ReaderReducer.ets`; store `entry/src/main/ets/ui/store/ReaderUiStore.ets`. | Route/tab/reduced-motion/pageState skeleton is covered; overlay mutex, activeSession mutex, async latest-intent/loading guard, and focus restore now have reducer-level validator coverage. |
| Router/coordinator | Current owner is `entry/src/main/ets/pages/Index.ets` plus `ReaderUiReducer` route stack; `MainTabShell` receives callbacks instead of owning navigation. | Needs extraction into a named coordinator after Slice 1 to reduce route logic in `Index.ets`. |
| ViewState mapper | No dedicated `ReaderViewStateMapper.ets` found in this pass. Existing pages read `ReaderUiState` directly. | Still missing. Must map generated ViewState or lossless DTOs before P0 completion. |
| Core bridge | `entry/src/main/ets/cabi/ReaderCoreNapiBridge.ets`, `entry/src/main/ets/api/ReaderCoreClient.ets`, `entry/src/main/cpp/reader_napi.cpp`. | Bridge compiles; Slice 2+ UiEvent/CoreCommand mapping still needs vertical evidence. |
| Host Adapter | `entry/src/main/ets/host/*`, `entry/src/main/ets/adapters/*`, `entry/src/main/ets/platform/*`. | Host capability files exist and compile; Slice 0/1 does not prove all P0 HostRequest behavior. |
| Token Adapter | Generated contract registry `entry/src/main/ets/contract/Token.ets`; Slice 0/1 adapter `entry/src/main/ets/ui/adapters/TokenAdapter.ets`. | Adapter reads generated `tokens` / `getToken` for registry coverage and motion-duration lookup; static `ReaderToken` constants remain as ArkUI convenience/fallback values. Broad component raw-value cleanup remains open. |
| Motion Adapter | Generated contract registry `entry/src/main/ets/contract/Motion.ets`; Slice 0/1 adapter `entry/src/main/ets/ui/adapters/MotionAdapter.ets`. | Adapter reads generated `getMotionSpec` for duration/easing; ArkUI primitive/interrupt labels remain platform-side mapping. Full 40 P0 MotionId recording coverage remains open. |
| AppShell/four tabs | `entry/src/main/ets/pages/Index.ets`, `entry/src/main/ets/ui/shells/MainTabShell.ets`, `entry/src/main/ets/ui/components/{BookshelfTab,DiscoverTab,RssTab,SettingsTab}.ets`, state snapshot `entry/src/main/ets/ui/shells/AppShellStateFlow.ets`. | Native four-tab shell compiles; device/simulator screenshot and tab-switch recording still missing. |
| Evidence tests | `entry/src/main/ets/__tests__/AppShellReducerValidator.ets` exports a Slice 1 coverage manifest and is registered in `entry/src/main/ets/__tests__/TestInfra.ets`; headless entry is `EntryAbility` launch parameter `readerHeadlessTest=1`. Local static validator: `npm run validate:frontend-slice1`. | Compile/static gates cover validator inclusion and generated-registry bridge wiring. Runtime headless execution still needs an `hdc` target. Device/simulator recordings remain separate evidence. |

Latest local command results:

| Command | Result | Boundary |
| --- | --- | --- |
| `npm run validate:frontend-slice1` | `PASS_STATIC_DEVICE_BLOCKED`; `11P 0F / 11`; artifact `artifacts/frontend-slice1-headless/latest/summary.json`. | Static source/contract inclusion evidence only; `runtimeExecuted=false`. |
| `npm run validate:reader-ui-contract` | Pass; Reader UI generated ArkTS files and HarmonyOS contract files both count 13. | Drift check understands HarmonyOS typed-array registry compatibility for Motion/Token. |
| `./hvigorw --mode module -p module=entry assembleHap` | `BUILD SUCCESSFUL in 2 s 229 ms`; existing ArkTS/NAPI/unsigned-HAP warnings remain. | Compile/build proof only. |
| `npm run validate:gap-matrix` | Blocked: missing `docs/PLANNING/HARMONYOS_CORE_LEGADO_CAPABILITY_GAP_MATRIX.json`. | Existing Core/Legado planning validator lane; not AppShell reducer bridge evidence. |

## 4. HarmonyOS P0 Matrix

| ID | Gap | Evidence to collect | Acceptance command or artifact |
| --- | --- | --- | --- |
| HOS-P0-01 | Contract dependency partially proven | `entry/src/main/ets/contract/index.ets`, generated headers, imports in `ReaderUiState.ets`, `ReaderMotion.ets`, `ReaderToken.ets`. | `./hvigorw --mode module -p module=entry assembleHap` builds with contract types. Next: add generated drift/consistency check. |
| HOS-P0-02 | AppShell + four main tabs source proven; device proof missing | `Index.ets`, `MainTabShell.ets`, four tab components, `AppShellStateFlow.ets`. | Native source compiles and reducer test asserts tab switch does not push stack. Next: simulator/real-device cold-start and tab-switch recording. |
| HOS-P0-03 | Reducer/store skeleton expanded | `ReaderUiState.ets`, `ui/store/ReaderReducer.ets`, `ui/store/ReaderUiStore.ets`, `AppShellReducerValidator.ets`. | Slice 1 route/tab/loading/reduced-motion guard plus overlay mutex, activeSession mutex, async latest-intent/loading guard, and focus restore compile into the headless validator. |
| HOS-P0-04 | Bookshelf to immersive reading not proven | ArkUI route, reducer transition, Core bridge call, recording. | Open book enters `immersive-reading`, returns to source, repeated click is latest-intent-wins. |
| HOS-P0-05 | Reader control layer not proven | Reader surface and overlay code plus recording. | Control layer opens/hides without remounting reader context or changing text layout. |
| HOS-P0-06 | TokenAdapter skeleton present; UI adoption incomplete | `ui/adapters/TokenAdapter.ets`, `ui/ReaderToken.ets`, `AppShellReducerValidator.ets`. | Adapter compiles and covers registry count. Next: replace raw values in ArkUI components and add raw-token grep gate. |
| HOS-P0-07 | MotionAdapter P0 subset present; full P0 incomplete | `ui/adapters/MotionAdapter.ets`, `ui/ReaderMotion.ets`, `AppShellReducerValidator.ets`. | firstOpen/route/tab/loading/interrupt subset compiles and reduced-motion tab duration is 0. Next: cover all 40 P0 MotionIds and record motion evidence. |
| HOS-P0-08 | Core bridge exists but Slice 0/1 does not prove reducer effects | NAPI/FFI files compile: `cabi/ReaderCoreNapiBridge.ets`, `api/ReaderCoreClient.ets`, `cpp/reader_napi.cpp`. | Slice 2+ must prove P0 UiEvents emit CoreCommand/HostRequest and stale results are discarded. |
| HOS-P0-09 | Host Adapter source exists but P0 capability proof incomplete | `host/*`, `adapters/*`, `platform/*` compile. | Run host capability tests/smoke on device or headless fixture and attach structured results. |
| HOS-P0-10 | Real-device proof missing | Build log exists locally; no install/run screenshot/recording captured in this pass. | HAP installs and Slice 1 to Slice 5 smoke is recorded on device or simulator. |

## 4.1 Evidence Lanes

| Lane | Current proof | Command or artifact | Remaining gap |
| --- | --- | --- | --- |
| Compile/build proof | HAP build proves ArkTS contract imports, reducer/store/validator source, TokenAdapter, MotionAdapter, ArkUI shell, and NAPI package inclusion compile together. | `./hvigorw --mode module -p module=entry assembleHap` | This is not runtime behavior proof and not device evidence. Signed-HAP and install/run proof remain separate. |
| Validator proof | `AppShellReducerValidator.ets` is registered through `TestInfra.ets` and now covers tab switch, reduced motion, pageState loading, TokenAdapter/MotionAdapter subset, generated `motionSpecRegistry` tab.switch lookup, generated `tokenRegistry` motion-duration lookup, overlay mutex/focus restore, activeSession mutex, and async latest-intent/loading guard. | Static no-device gate: `npm run validate:frontend-slice1`, artifact `artifacts/frontend-slice1-headless/latest/summary.json`. Runtime headless entry: `hdc shell aa start -b com.reader.harmonyos -a EntryAbility --ps readerHeadlessTest 1`; collect `HEADLESS_TEST_JSON` from hilog. Manifest: `HARMONYOS_SLICE1_EVIDENCE_MANIFEST.md`. Local preflight: `hdc list targets` -> `[Empty]`. | Static gate proves source inclusion and generated-registry bridge wiring only. Runtime headless requires available simulator/device target. Existing broader suite may still report unrelated pre-existing failures. |
| Device/simulator evidence | Existing historical screenshots/logs under `evidence/` are not promoted to this Slice 1 completion proof. | Candidate simulator gate: `scripts/run_unified_evidence_simulator.sh`; candidate runtime smoke: `scripts/run_device_runtime_smoke.sh`. | Need fresh cold-start, tab-switch, state-layer, overlay/focus, and session capsule recordings on simulator or real device. Real-device evidence must not be inferred from headless or build success. |

## 5. HarmonyOS Route Implementation Matrix Template

| RouteId | Priority | ArkUI owner | ViewState input | UiEvent output | Core/Host effect | MotionIds | Token groups | Tests/evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bookshelf | P0 | `ui/components/BookshelfTab.ets` under `ui/shells/MainTabShell.ets` | Current `ReaderUiState` plus contract `bookshelf` mirror; no ViewState mapper yet. | `ReaderReducer.selectTab(..., bookshelf)`, bookshelf callbacks from `Index.ets`. | Core bookshelf snapshot not wired in Slice 0/1. | `tab.item.select`, `tab.switch`, `bookshelf.view.switch` | tab, card, list | `AppShellReducerValidator.ets`, `assembleHap` | Source skeleton started; device proof missing |
| discover | P0 | `ui/components/DiscoverTab.ets` under `MainTabShell.ets` | Current `ReaderUiState`; no ViewState mapper yet. | `ReaderReducer.selectTab(..., discover)`. | Core/source discovery data not wired in Slice 0/1. | `tab.switch` | tab, list/card | `AppShellReducerValidator.ets`, `assembleHap` | Source skeleton started; device proof missing |
| rss | P0 | `ui/components/RssTab.ets` under `MainTabShell.ets` | Current `ReaderUiState`; no ViewState mapper yet. | `ReaderReducer.selectTab(..., rss)`. | RSS Core bridge not wired in Slice 0/1. | `tab.switch` | tab, rss-status, list | `AppShellReducerValidator.ets`, `assembleHap` | Source skeleton started; device proof missing |
| settings | P0 | `ui/components/SettingsTab.ets` under `MainTabShell.ets` | Current `ReaderUiState`; no ViewState mapper yet. | `ReaderReducer.selectTab(..., settings)`, reduced-motion toggle. | Settings persistence/Core preferences not wired in Slice 0/1. | `tab.switch`, `toggle.switch` | tab, list, button | `AppShellReducerValidator.ets`, `assembleHap` | Source skeleton started; device proof missing |
| immersive-reading | P0 | `ui/shells/ReaderShell.ets`, `ui/components/ReaderSurface.ets`, `ui/components/ReaderControlLayer.ets` | Current `ReaderUiState` + local reader context; no ViewState mapper yet. | `ReaderUiReducer.pushReaderEntry`, `popRoute`, control callbacks from `Index.ets`. | content load/progress bridge not proved in Slice 0/1. | `reader.entry.coverToImmersive`, `reader.entry.actionToImmersive`, page/control P0 ids | reader typography/theme, overlay | Existing source compiles; no Slice 2 recording yet | Pending Slice 2 |
| source-switch | P1 | Reader control/source-switch code paths in `ReaderControlLayer.ets` and reducer methods where present. | Current `ReaderUiState`; no ViewState mapper yet. | Source-switch reducer methods require dedicated validator in Slice 3/5. | source switch/search not proved in Slice 0/1. | `reader.sourceSwitch.open-close` | source/reader tokens | No current Slice 0/1 evidence | Pending later slice |

## 6. HarmonyOS Acceptance Minimum

HarmonyOS cannot be marked frontend-complete until:

1. It builds against Reader UI generated ArkTS contract types.
2. Store/reducer tests pass for P0 state rules.
3. P0 ArkUI screens render from ViewState or lossless mapped contract DTOs.
4. TokenAdapter and MotionAdapter are present and tested.
5. Core bridge and Host Adapter are connected for first vertical slices.
6. Device or simulator evidence exists for AppShell, reading entry, reader control layer, overlay/focus, session capsule, and orientation/fold where available.
