# HarmonyOS Home Dashboard Local Binding Report

Date: 2026-06-23

## Scope

- Capability slice: local app shell data binding for bookshelf, search, reader preview, and source management panels.
- Owned repo: Reader for HarmonyOS.
- Core boundary: no Reader-Core mutation in this slice.
- Clean-room status: no external GPL implementation copied, translated, or adapted.

## Gate Context

- Local network is reachable from the Mac, but this slice does not use live external network.
- Later on 2026-06-23 HarmonyOS emulator targets became available and app-shell/runtime smoke evidence was captured. The current device-runtime CI artifact is `artifacts/device-runtime-smoke/20260623T141611Z/device_runtime_smoke_summary.json` on target `127.0.0.1:5557`. This report remains scoped to the earlier local home-dashboard binding slice.
- Reader-Core `production_release` gate is not mutated by HarmonyOS evidence.

## Failure Reason

Before this slice, `Index.ets`, `BookshelfPage.ets`, and `SearchPage.ets` still rendered shell-only placeholder text. That made local app behavior weaker than the already implemented headless bookshelf/search services and left the UI capability matrix at `SHELL_ONLY` / `PLACEHOLDER`.

## Samples

- Bookshelf sample source: `MockBookshelfRepository(true)`.
- Search sample source: `FixtureReplayInterceptor` default search fixture through `BridgeClientWithFallback`.
- Validation sample: `HomeDashboardValidator` over `HomeDashboardService.getBookshelfSnapshot()`, `getReaderPreviewSnapshot()`, and `getSourceManagementSnapshot()`.

## Expected Change

- `Index.ets` bookshelf tab shows local counts, filter chips, book rows, format labels, and progress labels.
- `Index.ets` bookshelf tab shows a fixture-bound reader preview with title/progress, chapter, content preview, TOC count, and next chapter text.
- `Index.ets` settings tab shows fixture-bound source management counts, rule-chain/debug labels, and redaction state from `BookSourceRepository`.
- `BookshelfPage.ets` shows the same local bookshelf rows outside the tab shell.
- `Index.ets` search tab and `SearchPage.ets` call `HomeDashboardService.search()` and show fixture fallback results when no dev bridge is available.
- Capability matrix moves app shell and bookshelf UI from placeholder status to local service-bound status, while search remains explicitly fixture/dev-bound.

## Regression Result

| Check | Result | Evidence |
| --- | --- | --- |
| HAP build | PASS | `./hvigorw assembleHap` completed successfully |
| Home dashboard validator | PASS by compile inclusion | `runAllDomainTests()` includes `Home Dashboard` with 22 assertions, including 6 fixture-bound reader preview assertions and 7 source-management assertions |
| Device/simulator execution | SUPERSEDED_BY_DEVICE_SMOKE | This local slice did not use `hdc`; later device evidence is recorded in `HARMONYOS_DEVICE_RUNTIME_SMOKE_REPORT.md`, `HARMONYOS_DEVICE_RUNTIME_EXECUTION_REPORT.md`, and `artifacts/device-runtime-smoke/20260623T141611Z/device_runtime_smoke_summary.json`. |
| External network execution | NOT_EXECUTED | Search uses fixture fallback unless a dev bridge is explicitly available |

## Residual Limits

- This local binding slice does not prove ArkWeb, JS eval, native HTTP, cookie mirror, secure storage, or real device behavior; those are proven separately by the later device runtime smoke reports. Its reader preview is fixture-bound and not full reader shell parity; its source-management panel is fixture-bound and not live source debugger parity.
- This does not execute authorized real source corpus validation.
- Dev bridge and fixture fallback do not replace production device/runtime evidence.
