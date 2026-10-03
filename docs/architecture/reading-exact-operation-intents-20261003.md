# Bookmarks and cache.clear: exact persistent Host intents

Source candidate branch: `codex/p6-reading-durable-receipts-20261003`, Host base `9358a026`, matching Core domain contract `9e191aaf` + corruption correction `7ac5153b` (schema 34 / protocol 1). This is the finite Host side of those two named Core domains. No generic task store, error bus, new hashing/IO engine, UI redesign or deployment.

## Actual outcomes

- A new bookmark create/delete or cache clear obtains the domain head, captures one complete UUID/safe-sequence/original DTO and original entity, and receives an AtomicFile/base/parent-sync acknowledgement before admission to Core. Bookmark create/delete share ordering. Settings, Offline and retired-source clear share one cache-clear intent, IO/RPC lane and Core sequence.
- `ReaderRuntimeOwner.requestDirect` already owns final startup/preparation/send admission. The intent uses its existing `canDispatch` and `onDispatch` hooks; no UI `shouldCancel` controls a write which has entered Core. Qualified result ACKs survive route/Runtime retirement. An actual pre-send rejection can clean up a new local intent; that same rejection on continuation cannot erase uncertainty about the older call.
- Opening/refreshing first reads the exact Core receipt with original full expected DTO. A missing receipt/head before the expected sequence remains unknown. It does not dispatch another mutation, clear the intent, infer success from a list/count or allocate a new ID.
- Only the explicit user action **继续原操作** reuses the same persistent complete ID/sequence/DTO after a valid null/head observation. A failed/malformed/conflicting query or a head which has passed the operation blocks continuation. An acknowledged/confirmed intent never becomes an automatic write retry.
- Exact receipt qualification → exact metadata settlement ACK (or pure query proving that settlement) → AtomicFile local-clear ACK. Until these finish, the same original intent blocks replacement. Unknown, confirmed-but-unsettled and local-clear ACK loss remain distinct. Existing Core settled receipts/head persist independently of the Host file.
- A batch delete persists requested count and previously qualified count with each individual intent. Cold recovery confirms only that exact item, preserves partial completion, and does not launch the remaining batch.
- Directory readback failure retains the last usable bookmark projection, marks it stale and rejects mutation/toggle from that stale view until canonical refresh. Exact receipt confirmation does not come from matching bookmarks.
- Core cache-clear confirmation and Host image cleanup remain separate. A pure receipt/status refresh never runs image cleanup or clears another book. Materialization failure/reason survives a later successful cache-status read. A retained unknown shared clear also bars overlapping new manual downloads.
- Recreated Index owners in the same Runtime retain Directory/Offline mutex and facts, including readonly-first owners subsequently receiving the durable authority. SettingsCacheCleanupOwner now uses the same finite exact-Runtime retention; only an admitted current presentation rebinds its publisher. A retired lookup cannot replace the current owner.

## Consumer interface for the sole Index writer

```ts
ReaderDirectoryHost.forRuntime(owner, ownsRuntime, reportFailure,
  new BookmarkOperationIntentStore(owner, ownsRuntime));
ReadingOfflineHost.forRuntime(owner, ownsRuntime, reportFailure,
  new CacheClearOperationIntentStore(owner, ownsRuntime));
```

All production mutation factories must pass these authorities. The optional raw Gateway path preserves the old non-UI API/test contract; it is not a production UI exemption. readonly ReadingEntry may create the Host first; the later mutation factory installs the same authority into that retained Host.

`operation.canContinueOriginal` and `continueOriginal(operation.generation, exactBinding)` are bounded explicit continuation. `load`/`reconcile` remain receipt/canonical reads plus receipt metadata settlement. Preserve Runtime/navigation/session/entity and generation admission, including obsolete physical V1 callbacks; key only the small action actor if its callback identity changes.

SettingsHost thin methods:

```ts
reconcileCacheCleanup(owner, currentPresentation)
continueOriginalCacheCleanup(owner, generation, currentPresentation)
cacheCleanupSnapshot(owner)
```

Settings must initiate the pure reconciliation on opening the surface; replace the obsolete statement that the current protocol cannot query this clear. Use **继续原操作** only when `canContinueOriginal === true`; a general retry button must not become a second destructive command. Leaf implementation does not alter current typography, dimensions or layout. Index/Page wiring remains a separate single-writer commit.

## Capacity and protection

Host: exactly two fixed intent files and two named warm/IO lanes, one complete intent per domain, no TTL/pruning, no new byte cap. Variable original bookmark notes/DTOs retain existing valid capacity; transient JSON/file bytes remain proportional to the original DTO, not a claimed small constant. Domain counts, byte budget and target RSS/performance remain separate evidence.

Core: one unsettled receipt + at most eight terminal receipts + permanent head per domain, no arbitrary byte cap. Exact original mutation/result/receipt is atomic in SQLite. The authority is protected from ordinary cache.clear and portable export/restore; internal exact-before-image rollback retains its original semantics. Host intent files are app-private and are not portable Core configuration/snapshot payloads. The shared AtomicFile helper is only an existing platform primitive adapter; controlled desktop IO does not prove HarmonyOS crash durability.

## Actual verification and limits

`tools/test-reading-operation-durable-intents.mjs` executes the complete production intent/Gateway/Owner sources, actual shared AtomicFile adapter with real desktop file writes/rename/fsync, and the built Reader Core CLI opening real SQLite cold for each request. It repeats the same cases with installed Harmony SDK whole-source TypeScript parsing/emission. The fixture controls only platform transport/IO faults and Runtime identity, not the receipt algorithm.

Required binary: matching `Reader-Core-Native/target/debug/reader-cli` (or `READER_READING_RECEIPT_CORE_ROOT` pointing at a paired Core checkout). Build with `cargo build -p reader-cli --offline` before the integration test. The test is classified integration because Node-only isolated Host checks cannot supply that cross-repository binary/SDK. It must fail for a missing or incompatible binary, not silently skip.

Coverage includes lost write ACK before/after real Core effect; cold exact query without second write; explicit same-ID continuation and double taps; stale generation; old delayed RPC vs cold continuation applying once; first-attempt and prior-unknown nonExecution; failed/malformed exact query; cold partial batch deletion; lost settle/local-clear/Atomic finish ACK; shared Settings/Offline head; independent image failure; readonly-first factory; recreated SettingsHost joins original busy owner; durably retained qualified ACK survives later query failure; actual Runtime startup/send admission rejection.

Existing actual SettingsHost → Index → decorated SDK SettingsPage/CategoryRow physical consumer matrix remains intact with the additive exact query/settle transport fixture. Existing Directory/Offline complete owner emission, legacy Gateway, retired-source cleanup, SettingsHost wiring and Runtime dispatch probes are retained.

During probe development, an old fake ACK pause was found before the newly real admission hook, although its scenario claimed an in-flight ACK; it was moved after `onDispatch`. A query fixture also returned `undefined` instead of protocol-required `null`; it was corrected without weakening qualification. A guessed test filename did not exist; actual registered Gateway tests were located and run. These were test harness/command failures, not omitted results or production acceptance.

Logs: `/private/tmp/reader-reading-durable-host-final7.log`, `/private/tmp/reader-settings-cache-durable-consumer-final6.log`; earlier logs preserve intermediate failures. Code/local Core SQLite and installed SDK emitter/physical consumers are distinct from full-project ArkTS, paired Native/HAP/signing, HarmonyOS crash/process-kill behavior, device performance, visual and user acceptance. Those target/artifact tiers are not claimed here. Root owns final pairing/build/deployment; P5 owns Index/Page final recovery wiring. Source/RSS/Rules cold CRUD receipt gaps are not closed by these two domains.
