# HarmonyOS First Batch Platform Adapter Evidence

Status: `PARTIAL_MEASURED`

Superseded for current capability status by
`docs/core-platform-adapter/HARMONYOS_COMPLETE_EVIDENCE_REPORT.md`. This file is retained
as the historical first-batch record.

This report records the first HarmonyOS-side evidence loop against the Reader-Core
platform adapter contract. It is clean-room and uses local fixtures only. It does
not claim real ArkWeb, live network, login UI, file-picker permission token, ZIP,
EPUB, or host-app smoke execution.

## Core Contract Discovery

Reader-Core source of truth:

- `/Users/minliny/Documents/Reader-Core/Sources/ReaderCoreProtocols/PlatformAdapterContracts.swift`
- `/Users/minliny/Documents/Reader-Core/samples/expected/platform_adapter/harmonyos_adapter_mvp_manifest_expected.json`
- `/Users/minliny/Documents/Reader-Core/samples/expected/platform_adapter/local_book_platform_execution_expected.json`
- `/Users/minliny/Documents/Reader-Core/samples/expected/platform_adapter/feed_parser_platform_execution_expected.json`
- `/Users/minliny/Documents/Reader-Core/samples/expected/platform_adapter/release_platform_runtime_ci_coverage_expected.json`
- `/Users/minliny/Documents/Reader-Core/samples/expected/platform_adapter/host_app_integration_smoke_import_expected.json`

Required HarmonyOS adapter features:

| Kind | Required feature IDs | Current first-batch state |
| --- | --- | --- |
| `archive` | `epub.zip`, `localbook.archive`, `safe-entry-path`, `opf-manifest-baseline` | `NOT_EXECUTED` |
| `localFileAccess` | `localbook.file-picker-handoff`, `permission-token`, `permission-denied-mapping` | `NOT_EXECUTED` |
| `markupParser` | `html.css`, `html.xpath`, `xml.xpath`, `attribute-extraction` | `NOT_EXECUTED` |
| `feedParser` | `rss`, `atom`, `json-feed`, `feed-pagination-metadata`, `cookie-login-diagnostic` | `MEASURED_PASS` on local fixtures |
| `textEncodingDetector` | `txt.bom`, `txt.utf8`, `txt.gb18030`, `txt.fallback` | `MEASURED_PASS` through `TXTParser` detector path |
| `runtimeHost` | `arkWeb`, `nativeHTTP`, `cookieStore`, `sessionPersistence`, `javascript`, `snapshotWrite` | `ENV_BLOCKED`/non-passing |

Required artifact IDs exported by the first-batch builder:

- `platformAdapterContractRunReport`
- `platformAdapterExternalExecution`
- `localBookPlatformExecution`
- `feedParserPlatformExecution`
- `platformRuntimeCI`
- `hostAppIntegrationSmokeReport`
- plus `metadata`, `expected`, `matrix`, `regressionResult`

Runtime evidence IDs required by Core:

- `credential_redaction_revocation_matrix`
- `product_gated_js_bridge_release_runner`
- `runtime_rollback_audit`
- `secure_storage_platform_audit`
- `session_cookie_login_platform_runner`
- `webview_cookie_mirror_audit`
- `webview_dom_platform_smoke_runner`

Unsupported reader markers preserved:

- `harmonyos.reader.readium-equivalent`
- `harmonyos.reader.full-epub-shell`
- `harmonyos.reader.pdf`
- `harmonyos.reader.cbz`
- `harmonyos.sync.legado-equivalent`

## Current Capability/Gap Table

| Capability | Existing file(s) | Evidence result | Gap |
| --- | --- | --- | --- |
| Core manifest mirror | `entry/src/main/ets/coreAdapter/HarmonyOSCorePlatformManifest.ets` | `MEASURED_PASS` by compile + validator | None for identifier list; still must be refreshed if Core changes |
| Feed parser | `entry/src/main/ets/adapters/FeedParserAdapter.ets` | `MEASURED_PASS` for RSS/Atom/JSON Feed fixtures and pagination checksum evidence | No live feed fetch; cookie/login/JS feed only diagnostic |
| TXT detector | `entry/src/main/ets/parser/TXTParser.ets` via first-batch runner | `MEASURED_PASS` for BOM/UTF-8/GB18030 hint/fallback detector cases | Not Core-cross-validated in this batch |
| Credential boundary | `entry/src/main/ets/adapters/CookieCredentialBoundaryAdapter.ets` | Redacted opaque reference, revoke, raw export denied | Secure-storage backend is still host-required; no device secure storage smoke |
| Cookie mirror boundary | `entry/src/main/ets/adapters/CookieCredentialBoundaryAdapter.ets` | Redacted metadata/value checksums only | ArkWeb/nativeHTTP cookie stores not executed |
| Native HTTP | `entry/src/main/ets/adapters/HTTPAdapter.ets` | `ENV_BLOCKED` in first-batch evidence | Needs authorized HarmonyOS runtime request execution |
| ArkWeb DOM/JS/login | none implemented by this batch | `ENV_BLOCKED` in first-batch evidence | Needs device/simulator ArkWeb runner; repo rules still forbid pretending pass |
| Archive/local file picker/markup | existing contracts only | `NOT_EXECUTED` | Needs platform adapter and host picker smoke |
| Host app smoke | app shell exists | `NOT_EXECUTED` | Needs real bookshelf/import/reader shell smoke |

## Minimal Closed-Loop Order

1. Freeze Core manifest mirror and first-batch artifact shape.
2. Measure local fixtures: feed parser, TXT detector, redaction boundary.
3. Keep native HTTP, ArkWeb, session/cookie mirror, archive, file picker, markup, and host smoke as explicit non-passing rows.
4. Add device/simulator runner later to convert `ENV_BLOCKED` runtime rows into measured platform execution.
5. Only after all required rows pass should HarmonyOS export an accepted Core run report.

## Files Changed In This Batch

- `entry/src/main/ets/coreAdapter/HarmonyOSCorePlatformManifest.ets`
- `entry/src/main/ets/coreAdapter/HarmonyOSFirstBatchEvidenceRunner.ets`
- `entry/src/main/ets/adapters/FeedParserAdapter.ets`
- `entry/src/main/ets/adapters/CookieCredentialBoundaryAdapter.ets`
- `entry/src/main/ets/coreAdapter/HarmonyOSAdapterContractReport.ets`
- `entry/src/main/ets/__tests__/CoreAdapterEvidenceValidator.ets`
- `entry/src/main/ets/__tests__/CoreAdapterFirstBatchEvidenceValidator.ets`
- `entry/src/main/ets/__tests__/TestInfra.ets`
- `docs/core-platform-adapter/HARMONYOS_FIRST_BATCH_EVIDENCE_REPORT.md`

## Validation

Command:

```bash
./hvigorw assembleHap --mode module -p module=entry
```

Result:

```text
BUILD SUCCESSFUL in 3 s 883 ms
```

Release gate impact:

- `feedParserPlatformExecution` can pass the local fixture gate.
- `localBookPlatformExecution` remains blocked by archive and file-picker evidence.
- `platformRuntimeCI` remains blocked by ArkWeb DOM, JS, and real session/login/cookie mirror evidence.
- `hostAppIntegrationSmokeReport` remains blocked.
- `platformAdapterExternalExecution.canEnterPlatformEvidenceGate` remains `false`.

Clean-room flags:

- `cleanRoomMaintained=true`
- `externalGPLCodeCopied=false`
- `legadoSourceCopied=false`
- `externalNetworkUsed=false`
