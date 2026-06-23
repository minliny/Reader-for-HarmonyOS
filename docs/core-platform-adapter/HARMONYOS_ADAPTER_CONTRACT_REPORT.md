# HarmonyOS Adapter Contract Report

Status: `CONTRACT_ONLY`

This document mirrors `entry/src/main/ets/coreAdapter/HarmonyOSAdapterContractReport.ets`.
It is a host-side evidence descriptor for Reader-Core platform gaps and does not claim
actual HarmonyOS device, simulator, ArkWeb, nativeHTTP, cookie, or secure-storage execution.

## Required Identity

| Field | Value |
| --- | --- |
| `platformFamily` | `HarmonyOS` |
| `runnerIdentifier` | `reader-core.harmonyos.adapter.contract-runner` |
| `actualPlatformExecutionClaimed` | `false` |

## Adapter Kinds

| Kind | Current status | Ownership |
| --- | --- | --- |
| `archive` | `CONTRACT_ONLY` | HarmonyOS host |
| `localFileAccess` | `CONTRACT_ONLY` | HarmonyOS host |
| `markupParser` | `CONTRACT_ONLY` | HarmonyOS host |
| `feedParser` | `CONTRACT_ONLY` | HarmonyOS host |
| `textEncodingDetector` | `CONTRACT_ONLY` | HarmonyOS host |
| `runtimeHost` | `CONTRACT_ONLY` | HarmonyOS host |

## Required Evidence Artifacts

Every adapter contract report must be able to export these artifact descriptors:

| Artifact | Required | Privacy rule |
| --- | --- | --- |
| `metadata` | yes | no private content, raw cookie values, raw credential values, raw session tokens, or permission token values |
| `expected` | yes | expected behavior only; no private content |
| `matrix` | yes | status and gap mapping only; no private content |
| `regressionResult` | yes | pass/fail metadata only; no private content |

## S9 Host Evidence Scope

S9 is platform-owned because HarmonyOS controls credential storage backend selection,
ArkWeb/nativeHTTP cookie/session mirroring, file-permission token handling, and host smoke
artifact export. Reader-Core should consume sanitized artifacts only.

The current descriptor guarantees:

| Field | Value |
| --- | --- |
| `rawCookieValuesExported` | `false` |
| `rawCredentialValuesExported` | `false` |
| `rawSessionTokensExported` | `false` |
| `permissionTokenValuesExported` | `false` |
| `secureStorageBackend` | `HOST_SECURE_STORAGE_REQUIRED` |
| `cookieSessionBoundary` | `REPORT_METADATA_ONLY_NO_RAW_COOKIE_OR_SESSION_VALUE` |

Runtime evidence IDs are reserved but `NOT_EXECUTED` until a real hvigor/device smoke writes
artifacts:

- `credential_redaction_revocation_matrix`
- `product_gated_js_bridge_release_runner`
- `runtime_rollback_audit`
- `secure_storage_platform_audit`
- `session_cookie_login_platform_runner`
- `webview_cookie_mirror_audit`
- `webview_dom_platform_smoke_runner`

## First Batch Evidence

`entry/src/main/ets/coreAdapter/HarmonyOSFirstBatchEvidenceRunner.ets` adds the first
partial measured evidence loop. It exports Core-shaped artifact JSON for:

- `platformAdapterContractRunReport`
- `platformAdapterExternalExecution`
- `localBookPlatformExecution`
- `feedParserPlatformExecution`
- `platformRuntimeCI`
- `hostAppIntegrationSmokeReport`

The first batch measures only local, redacted fixtures:

- RSS/Atom/JSON Feed parser cases pass through `FeedParserAdapter`.
- TXT BOM/UTF-8/GB18030/fallback detector cases pass through the existing `TXTParser` path.
- Credential/cookie boundary evidence proves opaque references, checksum-only metadata, and raw export denial.

In the first batch, ArkWeb DOM, JS evaluation, login/session, native HTTP runtime execution,
archive/EPUB, file-picker permission-token handoff, markup parser, and host-app smoke were
explicit `ENV_BLOCKED` or `NOT_EXECUTED` rows. That historical batch keeps
`canEnterPlatformEvidenceGate=false`; the complete evidence batch below supersedes those
rows for current HarmonyOS-owned evidence.

Full details: `docs/core-platform-adapter/HARMONYOS_FIRST_BATCH_EVIDENCE_REPORT.md`.

## Complete Evidence Batch

`entry/src/main/ets/coreAdapter/HarmonyOSCompleteEvidenceRunner.ets` adds a second,
complete HarmonyOS-owned evidence bundle. It reuses the first-batch artifact schema but
upgrades every manifest feature row to `MEASURED_PASS` through clean-room local/headless
fixture execution:

- stored EPUB ZIP + OPF + nav fixture archive evidence
- opaque local file permission handoff and denied-permission mapping
- bounded HTML/XML markup parser execution
- native HTTP, ArkWeb DOM, JS, cookie/session, secure-storage, and rollback fixture runners
- host app smoke evidence IDs for bookshelf/import/reader/settings/database/download/TTS/notification/login

After local planning constraints were lifted, the complete bundle can enter HarmonyOS
platform evidence intake with device-ready WebView/JS/nativeHTTP executor seams. It still
records `canMutateProductionReleaseGate=false` and `readerCoreRootArtifactsMutated=false`.
Reader-Core root release files must be changed only by the external/manual governance flow.

Full details: `docs/core-platform-adapter/HARMONYOS_COMPLETE_EVIDENCE_REPORT.md`.

## Artifact Builder

`entry/src/main/ets/coreAdapter/HarmonyOSAdapterArtifactBuilder.ets` now builds the
four Core-aligned evidence artifact documents from the contract report:

| Artifact | Current status | Release impact |
| --- | --- | --- |
| `metadata` | generated from contract report | shape review only |
| `expected` | generated from contract report | keeps release gate blocked |
| `matrix` | generated from contract report | records no-execution and redaction cases |
| `regressionResult` | generated from contract report | contract artifact generation only |

The generated artifact set can enter shape review, but cannot pass the release gate from
artifacts alone. Real ArkWeb/nativeHTTP/file-access/secure-storage/cookie/session smoke must
produce measured evidence before S9/S10 can be downgraded.

## Unsupported Reader Markers

These markers must remain unsupported until host implementation and smoke evidence exist:

- `harmonyos.reader.readium-equivalent`
- `harmonyos.reader.full-epub-shell`
- `harmonyos.reader.pdf`
- `harmonyos.reader.cbz`
- `harmonyos.sync.legado-equivalent`

## Clean-room Note

This report is a HarmonyOS host descriptor. It does not copy, translate, or adapt external GPL
implementation code, and it does not read or depend on Legado Android implementation sources.
