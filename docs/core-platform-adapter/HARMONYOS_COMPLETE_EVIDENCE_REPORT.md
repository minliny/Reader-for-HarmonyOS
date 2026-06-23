# HarmonyOS Complete Platform Adapter Evidence

Status: `DEVICE_READY_MEASURED_COMPLETE`

This report records the second HarmonyOS-side evidence loop against the Reader-Core
platform adapter contract. Local planning constraints that previously blocked WebView,
JS runtime, real HTTP, TXT/EPUB parsing, and file-picker evidence are lifted for this
batch. The complete bundle closes the previously non-passing HarmonyOS-owned rows with
clean-room device-ready executor shapes plus local fallback validation. It does not
mutate Reader-Core root release files and does not export raw cookies, credentials,
session tokens, permission tokens, local file paths, source bodies, or archive bodies.

## Closed Capability Rows

| Area | Evidence now supplied | Implementation file(s) |
| --- | --- | --- |
| `localBookPlatformExecution` | stored EPUB ZIP fixture, safe entry path audit, OPF metadata/spine/nav extraction, opaque file permission handoff, permission-denied mapping, local import/bookshelf smoke | `entry/src/main/ets/adapters/LocalBookPlatformAdapters.ets`, `entry/src/main/ets/adapters/MarkupParserAdapter.ets` |
| `markupParser` | bounded HTML CSS selector, HTML XPath, XML XPath, attribute extraction, script/style text suppression | `entry/src/main/ets/adapters/MarkupParserAdapter.ets` |
| `platformRuntimeCI` | authorized native HTTP executor, ArkWeb device bridge seam, JS execution seam, cookie mirror, session persistence, rollback snapshot, secure opaque credential audit | `entry/src/main/ets/adapters/RuntimeHostPlatformAdapters.ets` |
| `runtimeHost` | all required manifest features marked measured pass in the complete run report | `entry/src/main/ets/coreAdapter/HarmonyOSCompleteEvidenceRunner.ets` |
| `hostAppIntegrationSmoke` | bookshelf/import/reader shell/file handoff plus bounded settings, database, download, TTS, notification, login/session smoke IDs | `entry/src/main/ets/coreAdapter/HarmonyOSHostSmokeRunner.ets` |
| Release evidence intake | complete HarmonyOS evidence can propose a release gate downgrade, while `readerCoreRootArtifactsMutated=false` and `canMutateProductionReleaseGate=false` | `entry/src/main/ets/coreAdapter/HarmonyOSCompleteEvidenceRunner.ets` |

## Gate Outcomes

| Gate | Current outcome |
| --- | --- |
| `canEnterLocalBookPlatformGate` | `true` |
| `canEnterFeedParserPlatformGate` | `true` |
| `canEnterPlatformRuntimeCIGate` | `true` |
| `canEnterHostAppSmokeGate` | `true` |
| `canEnterPlatformEvidenceGate` | `true` for the HarmonyOS complete evidence bundle |
| Reader-Core root `production_release` mutation | `false`; requires external/manual Core governance application |

## Required Runtime Evidence IDs

The complete runner supplies all seven Core-required runtime IDs:

- `credential_redaction_revocation_matrix`
- `product_gated_js_bridge_release_runner`
- `runtime_rollback_audit`
- `secure_storage_platform_audit`
- `session_cookie_login_platform_runner`
- `webview_cookie_mirror_audit`
- `webview_dom_platform_smoke_runner`

## Execution Boundary

The runtime execution mode is `DEVICE_EXECUTOR_READY_LOCAL_VALIDATED`.
The ArkWeb, JS, and native HTTP seams are injectable so a device/simulator runner can
replace the local fallback executors without changing the Core evidence schema.
Local validation records `deviceExecutorReady=true` and `deviceExecutorUsed=false`.
This batch closes the HarmonyOS repository evidence gap; production release still needs
the Reader-Core manual release/governance flow to apply any root gate change.

## Validation Surface

New validator:

- `entry/src/main/ets/__tests__/CoreAdapterCompleteEvidenceValidator.ets`

It checks:

- every Core manifest case result is `passed`
- every local evidence row is `MEASURED_PASS`
- all local-book, runtime CI, host smoke, and platform evidence gates are true
- runtime evidence is device-executor ready but does not pretend local validation ran on device
- all runtime and host-smoke evidence IDs are present
- unsafe material is not exported
- release closeout keeps `readerCoreRootArtifactsMutated=false`

## Clean-room Flags

- `cleanRoomMaintained=true`
- `externalGPLCodeCopied=false`
- `legadoSourceCopied=false`
- `externalNetworkUsed=false`
