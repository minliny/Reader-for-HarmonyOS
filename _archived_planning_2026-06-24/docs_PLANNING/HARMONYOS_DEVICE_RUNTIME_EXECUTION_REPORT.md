# HarmonyOS Device Runtime Execution Report

Date: 2026-06-23

## Scope

- Device target: historical PASS `127.0.0.1:5555`; current CI target `127.0.0.1:5557`.
- HAP: `entry/build/default/outputs/default/entry-default-unsigned.hap`.
- Runtime slice: native HTTP, device-local RSS feed fetch/parse, preferences-backed datastore smoke, device-local EPUB fixture/permission handoff smoke, temporary headless download/TTS/WebDAV/file-token/DB migration demo, fixture-bound reader preview home-layout smoke, fixture-bound source management settings-layout smoke, ArkWeb DOM, ArkWeb JavaScript, WebCookieManager cookie mirror, session persistence, HUKS secure-storage entitlement, and redacted authorized corpus live execution.
- Clean-room status: no external GPL implementation copied, translated, or adapted.

## Commands

```bash
npm run smoke:device-runtime
npm run ci:device-runtime
```

The repeatable runner expands to `./hvigorw assembleHap`, HAP install, `aa start
-a EntryAbility -b com.reader.harmonyos -m entry`, optional proxy-aware
`readerRuntimeProxy` launch injection, device-local HTTP fixture startup,
device-local RSS fixture serving,
preferences-backed datastore write/reopen smoke,
device-local EPUB fixture and opaque permission handoff smoke,
temporary headless service demo for download, TTS, WebDAV, file-token, and DB migration,
foreground `pidof` polling, home panel polling with ReaderShell preview tokens,
Settings tab navigation with SourceMgmt fixture tokens,
runtime-panel polling, host network probe, screenshot capture,
redacted summary generation, JUnit generation, and latest artifact pointer
update. The CI command additionally validates the latest artifact summary,
redaction flags, layout tokens, and checksums offline when the runner passes.

## Evidence

| Check | Result | Observed Evidence |
| --- | --- | --- |
| Build | PASS | `./hvigorw assembleHap` completed successfully; only unsigned HAP warning remained. |
| Install | PASS | `install bundle successfully` for `entry-default-unsigned.hap`. |
| nativeHTTP | CURRENT CI FAIL | Current runtime panel layout contained `nativeHTTP FAIL 0`; service uses `@ohos.net.http`, supports explicit runtime proxy injection plus app-level proxy application, and omits raw body output. Historical artifact `20260623T111857Z` contained `PASS 2xx`. |
| LocalHTTP | PASS | Current runtime panel layout contained `LocalHTTP PASS 2xx`; the runner started a device-local fixture and exported only redacted host hash/port reachability metadata. This proves adapter-level device-to-host nativeHTTP 2xx, not external source parity. |
| LocalFeed | PASS | Current runtime panel layout contained `LocalFeed PASS rss:1`; the runner served a device-local RSS fixture, the app fetched it through nativeHTTP with proxy bypass, and `FeedParserAdapter` parsed one item. This proves device-local feed fetch/parse only, not external live feed, subscription, cookie/login feed, JS-rendered feed, or background refresh parity. |
| DataStore | PASS | Current runtime panel layout contained `DataStore PASS v75:3`; the app wrote schema version 75, migration count 32, and three redacted durable-record checksums to HarmonyOS preferences, reopened the same store, and verified the values. This proves device persistence smoke only, not Room/DAO production database parity. |
| LocalBook | PASS | Current runtime panel layout contained `LocalBook PASS epub:1`; the app produced a device-visible EPUB fixture evidence record with one TOC item, one bookshelf record, safe entry-path checks, and opaque permission handoff. This proves local-book fixture/permission handoff smoke only, not real-file corpus, file-picker UX, reader rendering, or reader integration parity. |
| Headless service demo | PASS | Current runtime panel layout contained `Headless PASS fixture`, `Download PASS 2/2`, `TTS PASS q:3`, `WebDAV PASS sync`, `FileToken PASS opaque`, and `DBMig PASS v75:32`; summary recorded `deviceHeadlessServiceDemo configured=true mode=fixture downloadPassed=true ttsPassed=true webdavPassed=true fileTokenPassed=true databaseMigrationPassed=true schemaVersion=75 migrationStepCount=32 redacted=true passedInRuntimePanel=true`. This proves temporary fixture-bound service seams only, not production WebDAV, background download workers, native/HTTP TTS playback, media-session integration, production database, or file-picker UX parity. |
| Reader preview UI | PASS | Current home layout contained `阅读器`, `ReaderShell PASS fixture`, `章节 6/12`, `正文`, and `TOC 12`; summary recorded `deviceReaderUISmoke configured=true mode=fixture tocCount=12 passedInHomeLayout=true`. This proves a fixture-bound home preview only, not full reader rendering, pagination, gestures, TOC navigation, or reader shell parity. |
| Source management UI | PASS | Current settings layout contained `书源管理`, `SourceMgmt PASS fixture`, `启用 2/3`, `规则 search+detail+toc+content`, `DEBUG fixture`, and `redacted:true`; summary recorded `deviceSourceManagementSmoke configured=true mode=fixture sourceCount=3 enabledCount=2 debugPassed=true redacted=true passedInSettingsLayout=true`. This proves a fixture-bound source management/debug summary only, not live source debugger, import/export, login, or broad live-source parity. |
| ArkWeb DOM | PASS | Runtime panel layout contained `ArkWeb` and `PASS`; Web component loaded `runtime_smoke.html`. |
| ArkWeb JavaScript | PASS | Runtime panel layout contained `JS` and `PASS`; controller executed `document.title` and DOM count checks. |
| Cookie mirror | PASS | Runtime panel layout contained `Cookie` and `PASS`; WebCookieManager config/fetch/save executed with raw value redacted. |
| Session persistence | PASS | Runtime panel layout contained `Session` and `PASS`; WebCookieManager save/fetch path provided session persistence evidence. |
| Secure storage entitlement | PASS | Runtime panel layout contained `Secure` and `PASS`; HUKS generate/exist/export-denied/delete runner executed with only alias checksum/status recorded. |
| Authorized corpus live execution | CURRENT CI FAIL | Current runtime panel layout contained `Corpus FAIL` with `corpus:corpus_error`; historical artifact `20260623T111857Z` recorded the public-domain chain as PASS with only status/count/length-bucket/host checksums. |
| Redaction | PASS | Runtime panel layout contained `raw:false`; no raw cookie, credential, session token, or response body was exported. |
| Host network probe | FAIL CLASSIFIED | Current summary recorded only classes: `directHttpsClass=tls_error`, `proxyHttpsClass=tls_error`, `proxyHttpClass=http_5xx`; raw probe URLs, headers, bodies, cookies, and credentials were not exported. |

## Failure Reason Bound

Before this slice, HarmonyOS had device app-shell smoke and local runtime fallback evidence, but no HAP-visible device execution for native HTTP, ArkWeb DOM/JS, cookie mirror, session persistence, or HUKS secure-storage entitlement.

## Expected Change

- `HTTPAdapter` is device-executed, proxy-configurable, and evidence-bound for the runtime smoke target; device-local nativeHTTP now has PASS evidence, while current external-network pass remains open.
- `FeedParserAdapter` is now exercised by a device-local nativeHTTP RSS fetch with `LocalFeed PASS rss:1`; external live feeds, subscriptions, login/cookie feeds, JS-rendered feeds, and background refresh remain open.
- Data layer now has a device-visible preferences-backed schema/migration/record smoke with `DataStore PASS v75:3`; production database queries, transactions, migrations, and recovery behavior remain open.
- Local book import now has a device-visible EPUB fixture and opaque permission handoff smoke with `LocalBook PASS epub:1`; real-file corpus coverage, file-picker permission-token UX, rendering depth, and reader integration remain open.
- Download/TTS/WebDAV/file-token/DB migration now have a device-visible temporary headless demo with `Headless PASS fixture`, `Download PASS 2/2`, `TTS PASS q:3`, `WebDAV PASS sync`, `FileToken PASS opaque`, and `DBMig PASS v75:32`; production services, media session, background workers, production database, and file-picker UX remain open.
- Reader preview now has a device-visible, fixture-bound home-layout smoke with `ReaderShell PASS fixture` and `TOC 12`; full reader shell rendering/navigation remains open.
- Source management now has a device-visible, fixture-bound settings-layout smoke with `SourceMgmt PASS fixture` and `启用 2/3`; live source debugger/import/export/login flows remain open.
- ArkWeb and JS runtime rows move to device runtime verified for the local rawfile DOM/JS slice.
- Cookie/session rows move to WebCookieManager-backed device runtime verified with redacted metadata only.
- Secure-storage entitlement row moves to HUKS-backed device runtime verified with no raw key material or credential export.
- Authorized corpus live execution has historical measured-pass evidence, but current CI remains fail-closed until external nativeHTTP/corpus execution passes again.
- Broader real book-source ecosystem execution and Reader-Core root gate mutation remain separate Core evidence concerns.

## Regression Result

- `npm run smoke:device-runtime`: last-known PASS on `127.0.0.1:5555`.
- Historical PASS artifact summary: `artifacts/device-runtime-smoke/20260623T111857Z/device_runtime_smoke_summary.json`.
- `HARMONYOS_DEVICE_TARGET=127.0.0.1:5557 npm run ci:device-runtime`: current FAIL, with fail-closed JSON/JUnit artifact output.
- Current FAIL artifact summary: `artifacts/device-runtime-smoke/20260623T141611Z/device_runtime_smoke_summary.json`.
- CI artifact contract: `device_runtime_smoke_summary.json`, `device_runtime_smoke.junit.xml`, home/runtime layout dumps, screenshot, and log.
- Offline PASS validator: `scripts/validate_device_runtime_smoke_artifact.py` checks summary state, required tokens, rejected tokens, redaction flags, and checksums.
- Offline fail-closed validator: `scripts/validate_device_runtime_smoke_fail_artifact.py` validates the current external nativeHTTP/corpus failure artifact while preserving LocalHTTP PASS evidence and without treating it as runtime parity.
- Runtime wait policy: 240 seconds max, polled every 5 seconds. The device runtime HTTP clients use 60 second request timeouts so slow emulator external-network paths fail by evidence instead of timing out prematurely.
- Current process wait policy: PASS; the runner polls `pidof` for up to 30 seconds at 2 second intervals before layout capture.
- Current HAP install/start: PASS; `aa start` used module `entry`, injected proxy-aware launch parameter `readerRuntimeProxy`, injected device-local probe parameter `readerRuntimeLocalHTTP`, and `pidof com.reader.harmonyos` returned `16304` in the latest device log.
- Current home layout smoke: PASS; `home_layout.json` contained `书架`, `藏书`, `在读`, `未读`, `阅读器`, `ReaderShell PASS fixture`, `章节 6/12`, `正文`, and `TOC 12`; summary recorded `deviceReaderUISmoke configured=true mode=fixture tocCount=12 passedInHomeLayout=true`.
- Current settings source-management smoke: PASS; `runtime_layout.json` contained `书源管理`, `SourceMgmt PASS fixture`, `启用 2/3`, `规则 search+detail+toc+content`, `DEBUG fixture`, and `redacted:true`; summary recorded `deviceSourceManagementSmoke configured=true mode=fixture sourceCount=3 enabledCount=2 debugPassed=true redacted=true passedInSettingsLayout=true`.
- Current runtime layout smoke: FAIL; `runtime_layout.json` contained `nativeHTTP`, `FAIL 0`, `LocalHTTP`, `PASS 2xx`, `LocalFeed`, `PASS rss:1`, `DataStore`, `PASS v75:3`, `LocalBook`, `PASS epub:1`, `ArkWeb`, `Cookie`, `Session`, `JS`, `Secure`, `Corpus`, `Corpus FAIL`, and `raw:false`; the gate failed on the remaining `FAIL` token, not on missing local 2xx, local RSS, datastore, or local-book evidence.
- Current runtime diagnostic: `diag:native:network_error local:none feed:none store:none book:none proxy:env:<hash>:7890:app:on corpus:corpus_error`.
- Current runtime network summary: `runtimeNetwork.proxyEnabled=true`, `proxySource=env`, proxy host values redacted to hashes, `proxyPort=7890`, `proxyEndpointRewrittenForEmulator=true`, `proxyListenScope=unlisted-reachable`, `proxyLocalPortReachable=true`, `proxyAppLevelApplied=true`, and `proxyAppLevelStatus=on`.
- Current host network probe summary: `hostNetworkProbe.executed=true`, `directHttpsClass=tls_error`, `proxyHttpsClass=tls_error`, and `proxyHttpClass=http_5xx`.
- Current device-local HTTP probe summary: `deviceLocalHTTPProbe.configured=true`, `serverStarted=true`, `serverReachable=true`; the server log recorded a redacted fixture GET and the UI recorded `LocalHTTP PASS 2xx`.
- Current device-local feed probe summary: `deviceLocalFeedProbe.configured=true`, `fixtureServed=true`, `serverReachable=true`; the server log recorded `GET /reader-runtime-feed.xml` and the UI recorded `LocalFeed PASS rss:1`.
- Current device datastore probe summary: `deviceDataStoreProbe.configured=true`, `schemaVersion=75`, `migrationStepCount=32`, `recordCount=3`, `passedInRuntimePanel=true`; the UI recorded `DataStore PASS v75:3`.
- Current device local-book probe summary: `deviceLocalBookProbe.configured=true`, `format=epub`, `tocCount=1`, `bookshelfCount=1`, `permissionHandoff=true`, `passedInRuntimePanel=true`; the UI recorded `LocalBook PASS epub:1`.
- Current device headless service demo summary: `deviceHeadlessServiceDemo.configured=true`, `mode=fixture`, `downloadCompletedCount=2`, `downloadScheduledCount=2`, `ttsQueuedSegments=3`, `webdavPassed=true`, `fileTokenPassed=true`, `databaseMigrationPassed=true`, `schemaVersion=75`, `migrationStepCount=32`, `redacted=true`, `passedInRuntimePanel=true`; the UI recorded `Headless PASS fixture`, `Download PASS 2/2`, `TTS PASS q:3`, `WebDAV PASS sync`, `FileToken PASS opaque`, and `DBMig PASS v75:32`.
- Current runtime screenshot: PASS as an artifact capture; it records the failed runtime panel rather than a passing runtime panel.
- Historical Runtime corpus layout smoke: PASS; `artifacts/device-runtime-smoke/20260623T111857Z/runtime_layout.json` contained `Corpus` and `PASS`.
- Historical Runtime corpus screenshot: PASS; `artifacts/device-runtime-smoke/20260623T111857Z/runtime_panel.jpeg` captured the Settings runtime panel after authorized corpus live execution completed.
