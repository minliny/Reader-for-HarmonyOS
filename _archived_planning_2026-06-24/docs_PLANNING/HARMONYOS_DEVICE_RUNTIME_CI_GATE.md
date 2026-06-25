# HarmonyOS Device Runtime CI Gate

Date: 2026-06-23

## Scope

- Gate id: `harmonyos_device_runtime_ci`.
- Command: `npm run ci:device-runtime`.
- Device target default: `127.0.0.1:5555`.
- Bundle/module/ability: `com.reader.harmonyos` / `entry` / `EntryAbility`.
- Clean-room status: no external GPL implementation copied, translated, or adapted.

## Gate Contract

`npm run ci:device-runtime` runs the device smoke and then validates the latest
artifact summary offline:

```bash
bash scripts/run_device_runtime_smoke.sh
python3 scripts/validate_device_runtime_smoke_artifact.py artifacts/device-runtime-smoke/latest/device_runtime_smoke_summary.json
```

The runner must:

- build `entry-default-unsigned.hap` with hvigor;
- install and start `EntryAbility` with `-m entry`;
- verify the app process is foreground-reachable through `pidof`;
- poll the bookshelf home layout and require `书架`, `藏书`, `在读`, `未读`,
  `阅读器`, `ReaderShell PASS fixture`, `章节`, `正文`, and `TOC`;
- open the Settings runtime panel and poll until it has no `RUNNING` token;
- start a device-local HTTP fixture and pass its redacted host/port descriptor
  to the app for adapter-level nativeHTTP diagnostics;
- serve a device-local RSS fixture through the same local HTTP server and require
  the app-side feed parser path to report `LocalFeed PASS rss:1`;
- require a device datastore smoke that reports `DataStore PASS v75:3`;
- require a device local-book fixture smoke that reports `LocalBook PASS epub:1`;
- require a temporary headless service demo that reports
  `deviceHeadlessServiceDemo configured=true mode=fixture`,
  `Download PASS 2/2`, `TTS PASS q:3`, `WebDAV PASS sync`,
  `FileToken PASS opaque`, `DBMig PASS v75:32`, `redacted=true`, and
  `passedInRuntimePanel=true`;
- require a fixture-bound reader preview smoke that reports
  `deviceReaderUISmoke configured=true mode=fixture`, a positive `tocCount`, and
  `passedInHomeLayout=true`, with the same `TOC <tocCount>` visible in
  `home_layout.json`;
- require a fixture-bound source management smoke that reports
  `deviceSourceManagementSmoke configured=true mode=fixture`,
  `sourceCount=3`, `enabledCount=2`, `debugPassed=true`, `redacted=true`, and
  `passedInSettingsLayout=true`, with `SourceMgmt PASS fixture`, `启用 2/3`,
  `规则 search+detail+toc+content`, `DEBUG fixture`, and `redacted:true` visible
  in `runtime_layout.json`;
- require `nativeHTTP`, `LocalHTTP`, `LocalFeed`, `DataStore`, `LocalBook`,
  `Headless`, `Download`, `TTS`, `WebDAV`, `FileToken`, `DBMig`, `PASS 2xx`,
  `PASS rss:1`, `PASS v75:3`, `PASS epub:1`, `PASS fixture`, `PASS 2/2`,
  `PASS q:3`, `PASS sync`, `PASS opaque`, `PASS v75:32`, `ArkWeb`, `Cookie`,
  `Session`, `JS`, `Secure`, `Corpus`, and `raw:false`;
- reject `FAIL` and `RUNNING`;
- write redacted JSON summary and JUnit XML;
- auto-detect or accept explicit runtime proxy settings for emulator network
  smoke and record only proxy mode/source/host hashes/port/endpoint-rewrite/listen-scope/local-port-reachability/app-level-application state in the summary;
- run a host-side network probe that records only class values for direct HTTPS,
  proxy HTTPS, and proxy HTTP, without exporting target URLs or response data;
- avoid exporting raw URLs, cookie values, credential values, session tokens, or
  response bodies;
- record that Reader-Core root artifacts were not mutated.

Two offline validators exist:

- `scripts/validate_device_runtime_smoke_artifact.py` validates a true PASS
  artifact and is used by `npm run ci:device-runtime` after the runner passes.
- `scripts/validate_device_runtime_smoke_fail_artifact.py` validates the current
  fail-closed external nativeHTTP/corpus artifact without treating it as runtime parity.

## Artifact Schema

| Artifact | Purpose |
| --- | --- |
| `device_runtime_smoke_summary.json` | CI gate summary, redaction flags, runtime network proxy state, reachability classification, app-level proxy observation, host network probe classes, device-local HTTP/feed/datastore/local-book probe state, fixture-bound reader UI smoke state, fixture-bound source management smoke state, temporary headless service demo state, process wait policy, checksum map, artifact paths |
| `device_runtime_smoke.junit.xml` | CI test report with one fail-closed testcase |
| `home_layout.json` | Bookshelf/app-shell smoke proof |
| `runtime_layout.json` | Runtime panel proof for nativeHTTP, ArkWeb, JS, cookie/session, secure storage, corpus |
| `runtime_panel.jpeg` | Human-readable runtime panel screenshot |
| `device_runtime_smoke.log` | hdc/hvigor command log |

`artifacts/device-runtime-smoke/latest` points to the latest run directory.

## Current Evidence

The current CI gate implementation is active and fail-closed. The latest local
run on the current HarmonyOS target produced:

- summary: `artifacts/device-runtime-smoke/20260623T141611Z/device_runtime_smoke_summary.json`;
- JUnit: `artifacts/device-runtime-smoke/20260623T141611Z/device_runtime_smoke.junit.xml`;
- status: `FAIL`;
- target: `127.0.0.1:5557`;
- hdc/install/start/pidof/home-layout/screenshot: passed;
- process wait: `processWaitSeconds=30`, `processPollIntervalSeconds=2`;
- runtimeNetwork: `proxyEnabled=true`, `proxySource=env`, host redacted as hash,
  `proxyPort=7890`, `proxyEndpointRewrittenForEmulator=true`,
  `proxyListenScope=unlisted-reachable`, `proxyLocalPortReachable=true`,
  `proxyAppLevelApplied=true`, `proxyAppLevelStatus=on`;
- hostNetworkProbe: `executed=true`, `directHttpsClass=tls_error`,
  `proxyHttpsClass=tls_error`, `proxyHttpClass=http_5xx`;
- deviceLocalHTTPProbe: `configured=true`, `serverStarted=true`,
  `serverReachable=true`; runtime panel records `LocalHTTP PASS 2xx`;
- deviceLocalFeedProbe: `configured=true`, `fixtureServed=true`,
  `serverReachable=true`; runtime panel records `LocalFeed PASS rss:1`;
- deviceDataStoreProbe: `configured=true`, `schemaVersion=75`,
  `migrationStepCount=32`, `recordCount=3`, `passedInRuntimePanel=true`;
  runtime panel records `DataStore PASS v75:3`;
- deviceLocalBookProbe: `configured=true`, `format=epub`, `tocCount=1`,
  `bookshelfCount=1`, `permissionHandoff=true`, `passedInRuntimePanel=true`;
  runtime panel records `LocalBook PASS epub:1`;
- deviceHeadlessServiceDemo: `configured=true`, `mode=fixture`,
  `downloadPassed=true`, `downloadCompletedCount=2`,
  `downloadScheduledCount=2`, `ttsPassed=true`, `ttsQueuedSegments=3`,
  `webdavPassed=true`, `fileTokenPassed=true`,
  `databaseMigrationPassed=true`, `schemaVersion=75`,
  `migrationStepCount=32`, `redacted=true`, `passedInRuntimePanel=true`;
  runtime panel records `Headless PASS fixture`, `Download PASS 2/2`,
  `TTS PASS q:3`, `WebDAV PASS sync`, `FileToken PASS opaque`, and
  `DBMig PASS v75:32`;
- deviceReaderUISmoke: `configured=true`, `mode=fixture`, `tocCount=12`,
  `passedInHomeLayout=true`; home layout records `ReaderShell PASS fixture`,
  `章节 6/12`, `正文`, and `TOC 12`;
- deviceSourceManagementSmoke: `configured=true`, `mode=fixture`,
  `sourceCount=3`, `enabledCount=2`, `debugPassed=true`, `redacted=true`,
  `passedInSettingsLayout=true`; settings layout records
  `SourceMgmt PASS fixture`, `启用 2/3`, `规则 search+detail+toc+content`,
  `DEBUG fixture`, and `redacted:true`;
- runtime panel: `nativeHTTP FAIL 0`, `LocalHTTP PASS 2xx`, `LocalFeed PASS rss:1`,
  `DataStore PASS v75:3`, `LocalBook PASS epub:1`, `ArkWeb PASS`, `Cookie PASS`,
  `Session PASS`, `JS PASS`, `Secure PASS`, `Corpus FAIL`;
- diagnostic: `diag:native:network_error local:none feed:none store:none book:none proxy:env:<hash>:7890:app:on corpus:corpus_error`;
- redaction: all raw URL/cookie/credential/session/response-body export flags are `false`;
- Core boundary: `readerCoreRootArtifactsMutated=false`.
- fail-closed artifact validation:
  `npm run ci:device-runtime:validate-fail` / `device-runtime-smoke-fail-artifact-ok`.

The app-level HarmonyOS proxy API was applied successfully in the latest runtime
layout (`app:on`). The gate still fails because nativeHTTP does not produce a
2xx response under the current host proxy/external network path. The
device-local `LocalHTTP PASS 2xx` result proves the nativeHTTP adapter can
complete a device-to-host 2xx request, `LocalFeed PASS rss:1` proves the
device-local RSS fetch plus parser path, `DataStore PASS v75:3` proves a
preferences-backed schema/migration/record write and reopen smoke, and
`LocalBook PASS epub:1` proves a device-visible EPUB fixture plus opaque
permission handoff smoke. `Headless PASS fixture` proves only a temporary
fixture-bound download/TTS/WebDAV/file-token/DB migration service demo.
`ReaderShell PASS fixture` proves only a home-layout,
fixture-bound reader preview. `SourceMgmt PASS fixture` proves only a
fixture-bound source management/debug summary over redacted local source
descriptors. These local results are not treated as external
nativeHTTP/corpus parity, external live feed parity, Room/DAO production database
parity, real-file corpus parity, file-picker UX parity, live source debugger
parity, or reader UI parity.

The earlier one-off device smoke `artifacts/device-runtime-smoke/20260623T111857Z`
recorded `nativeHTTP PASS 2xx` and `Corpus PASS`, but it predates the CI schema,
JUnit output, hdc hidden-failure detection, and latest-pointer validator. It is
kept as historical runtime evidence, not as the current CI gate pass.

## Remaining Legado Gap

This gate closes the repeatable HarmonyOS device runtime runner gap, proves the
device-local nativeHTTP adapter path with `LocalHTTP PASS 2xx`, proves a
device-local RSS fetch/parse path with `LocalFeed PASS rss:1`, proves a
device datastore smoke with `DataStore PASS v75:3`, proves a device local-book
fixture/permission handoff smoke with `LocalBook PASS epub:1`, and proves a
fixture-bound reader preview with `ReaderShell PASS fixture` / `TOC 12`, and
proves a fixture-bound source management panel with `SourceMgmt PASS fixture` /
`启用 2/3`. It still does not
close the external nativeHTTP/corpus runtime parity gap, external live feed
parity, production Room/DAO database parity, real-file corpus/file-picker/reader
parity, live source debugger parity, or Legado-like product parity for broad live
source coverage, default JS parser-chain enablement, long-tail host bindings, login UX, reader UI,
production WebDAV, background download workers, native/HTTP TTS playback,
media session integration, or production release signing.
