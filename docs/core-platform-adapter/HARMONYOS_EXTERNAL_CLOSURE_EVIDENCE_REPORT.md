# HarmonyOS External Closure Evidence

Status: `DEVICE_RUNTIME_CI_GATE_IMPLEMENTED_CURRENT_NATIVE_HTTP_FAIL`

This report records the locally-closeable work after the HarmonyOS emulator start
attempt. It now includes a real `hdc` emulator target, app-shell smoke result,
and a CI-consumable device runtime gate. The latest CI gate run is intentionally
not marked passing: install/start/layout/screenshot succeeded, but native HTTP
and the authorized corpus chain failed at runtime network evidence. This report
does not claim HarmonyOS-mutated Reader-Core root gate artifacts, current
external nativeHTTP/corpus CI pass, or broad real-source ecosystem parity.

## Added Evidence

| Area | Status | Evidence |
| --- | --- | --- |
| Emulator toolchain preflight | `MEASURED_PASS` | DevEco Studio, `hdc`, and `Emulator` binaries are present. |
| Emulator instance start | `MEASURED_PASS` | `hdc list targets` returned `127.0.0.1:5555`; HAP install, EntryAbility foreground launch, screenshot, and layout smoke passed. |
| Runtime device runner preflight | `CI_GATE_IMPLEMENTED_FAIL_CLOSED` | `npm run ci:device-runtime` builds, installs, starts module `entry`, starts device-local HTTP/RSS/local-book fixtures, polls foreground process availability, polls the home panel for bookshelf and ReaderShell preview tokens, polls the Settings runtime panel for SourceMgmt, headless demo, and runtime tokens, captures a screenshot, writes redacted JSON/JUnit artifacts, records runtime proxy mode/source/host-hash/port/endpoint-rewrite/listen-scope/local-port-reachability/app-level-proxy-observation plus host network probe, device-local HTTP probe, device-local feed probe, device datastore probe, device local-book probe, deviceReaderUISmoke, deviceSourceManagementSmoke, and deviceHeadlessServiceDemo classes, updates `artifacts/device-runtime-smoke/latest`, validates the latest summary offline when the runner passes, and fails on hidden hdc error output. |
| Native HTTP / ArkWeb / cookie / session / secure-storage / feed / datastore / local-book / reader preview / source management / headless services / corpus device smoke | `CURRENT_CI_FAILING_EXTERNAL_NATIVE_HTTP` | Latest CI artifact `artifacts/device-runtime-smoke/20260623T141611Z/device_runtime_smoke_summary.json` recorded FAIL after layout contained `nativeHTTP FAIL 0`, `LocalHTTP PASS 2xx`, `LocalFeed PASS rss:1`, `DataStore PASS v75:3`, `LocalBook PASS epub:1`, `SourceMgmt PASS fixture`, `Headless PASS fixture`, `Download PASS 2/2`, `TTS PASS q:3`, `WebDAV PASS sync`, `FileToken PASS opaque`, `DBMig PASS v75:32`, `ArkWeb PASS`, `Cookie PASS`, `Session PASS`, `JS PASS`, `Secure PASS`, `Corpus FAIL`, `raw:false`, and `diag:native:network_error local:none feed:none store:none book:none proxy:env:<hash>:7890:app:on corpus:corpus_error`; home layout contained `ReaderShell PASS fixture` and `TOC 12`; settings layout contained `启用 2/3`, `规则 search+detail+toc+content`, `DEBUG fixture`, and `redacted:true`; runtimeNetwork recorded `proxyEndpointRewrittenForEmulator=true`, `proxyListenScope=unlisted-reachable`, `proxyLocalPortReachable=true`, and `proxyAppLevelApplied=true`; hostNetworkProbe recorded `directHttpsClass=tls_error`, `proxyHttpsClass=tls_error`, and `proxyHttpClass=http_5xx`; deviceReaderUISmoke recorded configured/mode=fixture/tocCount=12/passedInHomeLayout=true; deviceSourceManagementSmoke recorded configured/mode=fixture/sourceCount=3/enabledCount=2/debugPassed=true/redacted=true/passedInSettingsLayout=true; deviceHeadlessServiceDemo recorded configured/mode=fixture/downloadPassed=true/downloadCompletedCount=2/downloadScheduledCount=2/ttsPassed=true/ttsQueuedSegments=3/webdavPassed=true/fileTokenPassed=true/databaseMigrationPassed=true/schemaVersion=75/migrationStepCount=32/redacted=true/passedInRuntimePanel=true; deviceLocalFeedProbe recorded configured/fixtureServed/serverReachable without raw feed URL/body export; deviceDataStoreProbe recorded configured/schemaVersion=75/migrationStepCount=32/recordCount=3/passedInRuntimePanel=true without raw record export; deviceLocalBookProbe recorded configured/format=epub/tocCount=1/bookshelfCount=1/permissionHandoff=true/passedInRuntimePanel=true without raw local path export. |
| Authorized corpus runner preflight | `MEASURED_PASS` | Redacted target descriptors, authorization flags, failure taxonomy, and source-backed diff shape are ready. |
| Authorized corpus live execution | `CURRENT_CI_FAILING_CORPUS` | Historical artifact `20260623T111857Z` executed Gutendex search plus Gutenberg content fetch and exported only status/count/length-bucket/host-checksum evidence; latest CI artifact `20260623T141611Z` reports `Corpus FAIL`. |
| Release governance preflight | `MEASURED_PASS` | Evidence intake, product approval packet, candidate export, manual verification, and final consistency shapes are ready. |
| Core root gate application | `CORE_ROOT_GATE_APPLIED_PASS` | Reader-Core `RECOVERY-25_ROOT_GATE_APPLICATION_20260623.json` records `production_release` pass, unlocked true, blocker count 0. HarmonyOS still does not mutate Core root artifacts. |

## Files

| File | Purpose |
| --- | --- |
| `entry/src/main/ets/models/ExternalClosureModels.ets` | Device/corpus/release closure evidence DTOs |
| `entry/src/main/ets/coreAdapter/HarmonyOSExternalClosureEvidenceRunner.ets` | Artifact runner for emulator, corpus, runtime, and release preflight |
| `entry/src/main/ets/__tests__/ExternalClosureEvidenceValidator.ets` | Validator for redaction, readiness, and no fake execution |
| `scripts/run_device_runtime_smoke.sh` | hdc/hvigor device runtime CI runner |
| `scripts/validate_device_runtime_smoke_artifact.py` | Offline JSON/JUnit/layout/checksum artifact validator |

## Gate Outcomes

| Gate | Outcome |
| --- | --- |
| `canEnterAuthorizedCorpusGate` | `true` |
| `canEnterReleaseGovernanceGate` | `true` |
| `canEnterDeviceRuntimeGate` | `true` |
| `deviceExecutorUsed` | `true` |
| `externalNetworkUsed` | `true` |
| `latestDeviceRuntimeCIGatePassed` | `false` |
| `latestDeviceRuntimeCIFailure` | `external nativeHTTP network_error with proxy-aware launch / corpus_error; LocalHTTP PASS 2xx, LocalFeed PASS rss:1, DataStore PASS v75:3, LocalBook PASS epub:1, ReaderShell PASS fixture, SourceMgmt PASS fixture, and Headless PASS fixture with Download/TTS/WebDAV/FileToken/DBMig preserved` |
| `canMutateReaderCoreProductionReleaseGate` | `false` |
| `readerCoreRootArtifactsMutated` | `false` |

## Remaining Required Action

Fix the current HarmonyOS emulator external nativeHTTP network failure, then rerun
`HARMONYOS_DEVICE_TARGET=127.0.0.1:5557 npm run ci:device-runtime` until the
latest JSON/JUnit artifact passes. Additional external target descriptors still
require explicit authorization and must keep raw URLs, credentials, cookies,
session tokens, and response bodies redacted.
