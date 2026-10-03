# Directory bookmarks and manual offline owners

Base: Host 7f3c3a99091ed3e3d55935970e70e75656eb7c0c, isolated branch codex/p6-directory-offline-host-20261003. Production UI/Index untouched in this candidate. No Native/HAP/target actions.

## Actual defects and ownership

The original Index performed three bookmark writes, canonical-list reload, partial delete counting, download progress/cache-clear scheduling and UI publication. It supplied UI lifetime `shouldCancel` to durable requests and counted delete ACK only after the post-await UI guard. A late successful write could therefore be erased or presented as cancelled. The original offline failure path could mark a chapter failed while Core already retained its body.

ReaderDirectoryHost now owns immutable captured book, mutation generation/mutex, three actual Gateway mutations, canonical-list recovery and one finite retained operation. Binding owns captured Runtime/nav/exact entity/session identity; page keeps the current TOC and navigation. Only bookmarks are merged into latest TOC, preserving titles/levels/offline facts. Projected delete primary keys must belong to the current book. Position scope and Unicode-scalar coordinates remain the existing Gateway/Core contract.

ReadingOfflineHost owns manual chapter/book/clear mutex, progress and receipt; it preserves actual Core durable queue/materialization lease algorithm and bounded workers. It merges only downloadState into latest TOC, preserving title/level/bookmarks. A Core queue/cache ACK is separate from materialization/Host image cleanup. Partial cached bodies survive failures. Retirement still terminally reports every granted lease, blocks later slice dispatch and old UI publication, and never uses an old clear callback to clean successor images.

Per-call ReaderWriteEvidence is marked immediately at actual Gateway request invocation and only confirmed after response identity/shape qualification. Generic failures after invocation remain unknown. It is not a claim that native execution started before request admission; there is no typed nonexecution witness here. No UI `shouldCancel` is passed by new manual owner after a durable request was submitted. Existing background rolling prefetch uses its original admission options and terminal reports.

## Exact interfaces for Index integrator

Use each feature-local `Host.forRuntime(runtime, ownsRuntime, deliveryFailed?)` factory (returns Host or undefined), with `ownsRuntime: () => ReaderRuntimeOwner.isCurrent(owner)`; never call throwing `current()` inside boolean admission. The finite static factory retains one exact Runtime/Host pair: recreated Index shares accepted mutation/mutex; an obsolete Runtime lookup returns undefined and cannot replace the successor. It constructs the actual Gateway, does not add owners to GodRuntime. No parallel local mutex in Index.

Directory binding: `{book,current,currentEntries,emitEntries,emitOperation?,failed?,onSettled?}`. `current` checks captured Runtime/nav/session/book sourceId+bookId+title+author; callback errors are delivery failures only. Public async methods: `createChapterStart(chapterIndex,binding)`, `createPosition(LocalReadingPositionBookmarkInput,binding)`, `deleteBookmarks(times,binding)`, `load(binding)`, `reconcile(writeGeneration,binding)`, `busy()`, `snapshot()`.

The physical page toggle retains its existing admitted bookmarkTimes/position proof and selects delete vs create in Index; business writes/reads happen solely in Host. `onSettled` only publishes to the current binding and proves all requested writes ACKed, independent of read failure. Operation includes requestedCount, confirmedCount and completion (`notDispatched/partial/complete/unknown`); do not display a whole batch as complete merely because all *dispatched* subwrites ACKed. A retirement can leave some intended subwrites undispatched. `load` is canonical read only; callers may catch genuine current read failure for existing load callback semantics. Stale read failures return without publication.

Offline binding: `{session,current,currentEntries,emitEntries,emitOperation?,onProgress?,failed?}`. `current` checks exact session pointer/generation + Runtime/nav/product admission. Methods: `downloadChapter(index,binding)`, `downloadBook(binding)`, `clearBook(binding)`, `load(binding)`, `reconcile(writeGeneration,binding)`, `busy()`, `snapshot()`. Existing presentation/toast/native-confirmation remains Index. The new owner has no automatic write retry. Recovery uses `loadDirectoryProjection` (`cache.book.status`) only, never prefetch/cache.clear/Host image cleanup. `materialization` reports lifecycle, not whole-book completion; actual completed/cached/failed counts remain progress facts.

No callbacks from an obsolete binding may update UI or show an alert. UI recovery identity must capture operation generation, route/nav and exact owner; V1 regular callback fields require actual retained-actor/keyed action validation in integrator SDK tests. Do not remount entire reader/page.

## Honest unresolved protocol boundaries

Bookmark create/delete and cache.clear have no exact per-operation durable receipt in current Core. Matching fresh bookmark/cache status cannot confirm a lost ACK or establish nondispatch. Directory retains one unknown and blocks new writes from overwriting/replaying it. Offline unknown clear similarly blocks subsequent mutation that could race a late clear. Pure reads can update current data while preserving pendingReconciliation. These are current implementation/protocol gaps, not OS limitations; cold restart confirmation is NOT provided by this finite in-memory owner. Explicit new/resume download still delegates to existing Core durable queue, never invents a second queue or automatically retries a failed operation. This candidate does not assert cross-restart receipt closure.

Core directory/body reads may be current even if Host image cleanup remains failed; a successful status read cannot change `materialization=failed` into complete. Legacy API callers remain compatible with additive optional evidence parameters. No global TaskStore, generic matching engine, alternate bookmark coordinates or cache store was added.

## Evidence

- `test-reader-directory-host.mjs`: actual production LocalReadingFlowGateway -> ReaderDirectoryHost, ACK/read failure, lost ACK negative matching read, partial delete, foreign keys/volume guards, late ACK+route or Runtime retirement, stop next dispatch, UI exception isolation.
- `test-reading-offline-host.mjs`: actual production ReadingOfflineGateway -> ReadingOfflineHost, queue/materialization separation, clear ACK+cleanup failure, unknown clear barrier, body cached after lost queue ACK, pure read reconciliation, mutex, route/Runtime retirement, unguarded terminal lease report, old-owner image cleanup refusal.
- `test-reading-owner-sdk.mjs`: same complete fault matrix with both complete owner classes emitted by installed Harmony SDK TypeScript emitter. This is SDK-emitted JS behavior, not complete-project ArkTS typecheck, ArkUI integration, artifact/target/visual acceptance.
- Existing Gateway, control bookmark-load/mutation-recovery, offline completion and source tier-registration gates rerun. Index integration and actual decorated SDK consumers are the next P5 handoff; no device acceptance claimed.
