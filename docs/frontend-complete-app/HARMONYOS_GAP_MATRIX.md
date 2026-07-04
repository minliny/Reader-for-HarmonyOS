# HarmonyOS Complete App Gap Matrix

Status: `AUDIT_TEMPLATE_PENDING_HARMONYOS_CODE_EVIDENCE`

Date: 2026-07-04

Target repo: `/Users/minliny/Documents/Reader for HarmonyOS`

Parent matrix: `docs/frontend-complete-app/FRONTEND_COMPLETE_APP_GAP_MATRIX.md`

## 1. Purpose

This file turns the parent gap matrix into HarmonyOS-specific work. It is not yet a final HarmonyOS audit because this pass did not inspect every ArkUI page, reducer/store, NAPI bridge, adapter, test, or device artifact.

HarmonyOS must implement native ArkUI UI. It must not ship `frontend-demo/` through WebView as the production app.

## 2. HarmonyOS Preflight

| Check | Current local evidence | Required result |
| --- | --- | --- |
| Repo exists | `/Users/minliny/Documents/Reader for HarmonyOS` exists. | Use this repo for HarmonyOS implementation evidence. |
| Build entries exist | `oh-package.json5`, `build-profile.json5`, `hvigorfile.ts`, and entry module build files exist. | Build command and target module must be documented. |
| Contract dependency | Not verified in this pass. | HarmonyOS must consume Reader UI generated ArkTS types or generated artifacts from the same schema. |
| Native UI proof | Not verified in this pass. | Production UI must be ArkUI/native, not WebView loading the demo. |

## 3. Required HarmonyOS Files Or Equivalents

| Required role | Expected HarmonyOS landing | Acceptance |
| --- | --- | --- |
| Contract import | generated ArkTS `Route.ets`, `UiEvent.ets`, `UiState.ets`, `ViewState.ets`, `Motion.ets`, `Token.ets` | Contract types compile in ArkTS app code. |
| Store/reducer | `ReaderReducer.ets` / `ReaderStore.ets` | Owns route, overlay, activeSession, focus, loading, async guard. |
| Router/coordinator | ArkUI router/coordinator module | Controls navigation/back stack without scattering route state in views. |
| ViewState mapper | `ReaderViewStateMapper.ets` | ArkUI pages render ViewState or a lossless mapped model. |
| Core bridge | NAPI/FFI bridge module | Maps reducer effects to Reader-Core-Native protocol. |
| Host Adapter | platform service module | Owns HTTP, WebView, Cookie, file, permission, TTS, background, share, notification. |
| Token Adapter | ArkUI token/theme bridge | Uses generated token registry and Reader UI semantic names. |
| Motion Adapter | ArkUI transition/animation adapter | Maps MotionId/MotionSpec to ArkUI animation primitives and reduced-motion behavior. |
| Evidence tests | unit tests, preview/device screenshots, HAP/device smoke | Proves native behavior, not browser demo behavior. |

## 4. HarmonyOS P0 Matrix

| ID | Gap | Evidence to collect | Acceptance command or artifact |
| --- | --- | --- | --- |
| HOS-P0-01 | Contract dependency not proven | ArkTS imports of generated Reader UI types. | App builds with generated ArkTS contract types. |
| HOS-P0-02 | AppShell + four main tabs not proven | ArkUI source and screenshot/recording. | Main tabs are native and tab switch does not push page route stack. |
| HOS-P0-03 | Reducer/store not proven | Store/reducer source and tests. | Tests cover route, overlay mutex, activeSession mutex, loading guard, focus restore. |
| HOS-P0-04 | Bookshelf to immersive reading not proven | ArkUI route, reducer transition, Core bridge call, recording. | Open book enters `immersive-reading`, returns to source, repeated click is latest-intent-wins. |
| HOS-P0-05 | Reader control layer not proven | Reader surface and overlay code plus recording. | Control layer opens/hides without remounting reader context or changing text layout. |
| HOS-P0-06 | TokenAdapter not proven | Token adapter source and visual/snapshot evidence. | Contract-owned ArkUI uses semantic tokens, not copied literal values. |
| HOS-P0-07 | MotionAdapter not proven | Motion adapter and recordings/tests. | P0 MotionIds map to ArkUI motion and reduced-motion/test switch behavior. |
| HOS-P0-08 | Core bridge not proven | NAPI/FFI bridge tests. | P0 UiEvents emit CoreCommand/HostRequest and stale results are discarded. |
| HOS-P0-09 | Host Adapter not proven | Host capability source/tests. | HTTP/WebView/Cookie/file/permission/TTS/background/share return structured results. |
| HOS-P0-10 | Real-device proof missing | Build logs, install/run evidence, screenshots/recordings. | HAP installs and Slice 1 to Slice 5 smoke is recorded on device or simulator. |

## 5. HarmonyOS Route Implementation Matrix Template

| RouteId | Priority | ArkUI owner | ViewState input | UiEvent output | Core/Host effect | MotionIds | Token groups | Tests/evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bookshelf | P0 | TBD | TBD | TBD | Core bookshelf snapshot | tab/app route | app shell, bookshelf cards | TBD | Pending audit |
| immersive-reading | P0 | TBD | TBD | TBD | content load/progress | reader entry, page turn | reader typography/theme | TBD | Pending audit |
| reader | P0 | TBD | TBD | TBD | progress/session | reader control, module switch | reader control tokens | TBD | Pending audit |
| source-switch | P1 | TBD | TBD | TBD | source switch/search | source overlay | source/reader tokens | TBD | Pending audit |

## 6. HarmonyOS Acceptance Minimum

HarmonyOS cannot be marked frontend-complete until:

1. It builds against Reader UI generated ArkTS contract types.
2. Store/reducer tests pass for P0 state rules.
3. P0 ArkUI screens render from ViewState or lossless mapped contract DTOs.
4. TokenAdapter and MotionAdapter are present and tested.
5. Core bridge and Host Adapter are connected for first vertical slices.
6. Device or simulator evidence exists for AppShell, reading entry, reader control layer, overlay/focus, session capsule, and orientation/fold where available.
