# Index remaining ownership map — 2026-10-03

Exact audit source: `9082ed79` (`c549b5ca` only adds legacy fixture corrections). SDK AST: **7091 lines, 298 methods, 23 @Builder methods, 184 fields, 86 observed/storage fields**. Machine inventory: `INDEX_METHOD_MAP_20261003.json`; every method/field is listed with current source line, constructors, external calls and explicit protocol reads. These are syntactic facts, not an automated conclusion that every responsibility should migrate.

## Scope decision

`AUDIT_GAPS` A01/A08 remain open. Zero bookshelf direct RPC does not make Index route-only. Shared P6 receipts are now actual UI consumers, but some domain operations still own their receipts, serialization, retry and projection in Index. Domain separation and truthful operation coverage must be audited independently. No production changes were made for this map. Current UI, persistent reader tree, bookshelf actors and existing operation identity stay the baseline.

## Full family map

| Family | Current Index methods/state and actual boundary | Keep in Index | Move as one bounded domain slice | Existing implementation to reuse | Verification |
|---|---|---|---|---|---|
| Framework/route/surfaces | mount/unmount, onBackPress, 23 Builders + build, route returns, current-generation guards, native scoped alert and finite temporary Back lease | route/intent/lifecycle, actual ArkUI tree, captured presentation ownership | factories may be hosted by domain-specific composition modules; never introduce a universal executor or global overlay manager | ReaderNativeAlertOwner, typed page Hosts, ReaderRuntimeOwner.isCurrent | exact real SDK Props/Watch/callback lifecycle; existing nine-alert/three-Back/Sheet tests |
| Settings and text cache | onSettingToggled delegates SettingsHost; **clearTextCache still directly requests cache.clear and reads raw result/counters** | current cache callback and visual labels; select/restore presentation | SettingsCache operation owner/gateway: real dispatch/ACK/unknown and explicit cleanup result, platform failure independent of receipt | SettingsHost/Gateway + ReaderWriteEvidence/PersistedReceiptProjection; existing Core cache protocol only | actual Settings physical action→owner→gateway; native throw/lost ACK; clear does not touch user books/progress; query capability must come from actual Core, never an invented cache API |
| Source/tools/rules/JSON import | hosts/orchestrators already own business commands. Index still selects JSON import target, owns URL form visibility and nine scoped-result consumers. updateSourceToolsSelection/selectAll/toggle/consume selection still modifies a snapshot before dispatch | route target, selection intent, confirmation and input projection | move only canonical selection/formatting/dispatch ownership where it is duplicated; retain original editor/operation owner and finite import context | SourceHost/SourceToolsOrchestrator/RulesManagementOrchestrator, existing SourceImportHost | same draft/version/selected-source identity; confirmed write + failed read; closed import/native confirmation old callback rejection |
| RSS/Sync/Discover | current factory/runtime/route capture, RSS source/entry binding, feedPresentation/subscription metadata/date formatting, Sync page guard, Discover emitter; owners now publish real facts/receipt | route/entity scope, actual page callbacks and hidden product gates | typed domain presentation projection for RSS row metadata and feed DTO; move owner construction to existing feature Host only if it removes repeated lifecycle logic | RssOrchestrator/Editor/RouteOperationHost, SyncOrchestrator/Gateway, DiscoverOrchestrator, shared recovery | all real five RSS pages / Sync / Discover gates; hidden aggregate/query remains hidden; no stale ordinary callback update assumption |
| Bookshelf load/filter/page/projection | shelfFilter, refreshBookshelf, onBookshelfLoadFailed, loadShelfWindowPage, applyBookshelfState, hydrateShelfSourceNames, refreshSearchShelfMembership, manual source-name copy and anchor expansion; their generation/mutex/read failures are still Index fields | filter intent/scroll UI adapter; page presentation and navigation | BookshelfProjectionHost owns captured runtime/filter/request/revision, first-read/retry/readback, stable header and source-name hydration. Existing BookshelfHost explicitly covers management only | BookshelfHost, BookshelfFlowGateway, BookshelfViewState, ShelfBookPresentation and Core authoritative cursor/anchor APIs | first loading/empty/failed; refresh failed with retained value; filter/page/revision/concurrent/old Runtime; source-name durability; retained native shell/list identity |
| Bookshelf add/remove/import/reconcile | addDetailBook/cancelDetailBookAddition, remove single/batch/detail, beginShelfWrite/publish/reconcile/shelfRecovery, beginImport and AppStorage local presentation serializer; owner and latest receipt are still Index | picker dialog and result DTO rendering; route/book intent | BookshelfOperationHost + local import presentation adapter, each reusing existing gateway. Move receipt generation/mutex/accepted settlement together, then actual Index only projects snapshot/intents | BookshelfFlowGateway, LocalBookImportGateway, management Host/CoreGateway, existing import DTO parser and journal owner | actual ACK vs unknown vs cleanup; lost ACK lineage stays unknown; matching old row does not confirm; accepted late/unset; readonly retry never import/remove again; no asset finalization while pending journal |
| Shelf manual/background update | scheduleBookshelfBackgroundRefresh, refreshBookshelfCatalogBatch, startManualBookshelfUpdate, refreshOneShelfBook; own two-book batches, timers/revision fields, progress and catch/log-only failures | More action and current progress presentation | BookshelfCatalogUpdateHost: capture owner/sweep/navigation once; bounded per-book outcomes, pure-read projection recovery, honest partial results; preserve 10min automatic interval and concurrency=2 | BookAcquisitionCoordinator and BookshelfFlowGateway; its force-refresh/shared scan stays authoritative | real Core/gateway→Index→More consumer; zero/partial/all failure; close/nav/unset/new-owner; no new-owner IO after old task; confirmed catalogs vs failed final shelf read separately |
| Search/detail and acquisition projection | search intent wrappers mostly delegate SearchHost; detail selected group, warmup and **refreshDetailAcquisitionProjection raw search-book.get (102 lines)**; 24 raw data/row/facts element reads; installRemoteReadingSession performs another six raw acquisition reads | which book/route requested; native prompt intent and selected displayed snapshot | ReadingBookProjectionGateway + DetailAcquisitionHost: validate exact source/book DTO and acquisition versions; retain coordinator revision recheck, current owner/session/nav guard, verdict and cached admission owner | SearchHost, BookAcquisitionCoordinator, RemoteReadingFlowGateway/RemoteReadingEvidence; coordinator already validates search-book.get identity in openBook | real wrong/partial/null/stale JSON payload; schema/version/verification mismatch; read-during-mutation; old owner/route/session; prior readable body retained; candidate failed probe never automatically loops |
| Reading entry/admission/background refresh | openLocalBookDetail, openRemoteBookDetail (279 lines), refreshCachedSearchDetailInBackground (76), onSearchResultSelected (80), preparePersistedShelfBooks/prepareVisibleReadingBooks, source-name resolution, content probe/prompt/session installer | route origin, UI loading/verdict projection and persistent ReadingSurface callbacks | domain ReadingEntryHost/DetailAcquisitionHost owns probe/admission/session state and late outcomes; existing Runtime acquisition/preparation remains sole durable authority | ReadingEntryPreparations, BookAcquisitionCoordinator, ReadingSessionFlowGateway, RemoteReadingFlowGateway; no replacement reading engine | exact source/book/session/version; warmup/shared work; local/remote/candidate failures; first measured ready; cancel/reading-return; retain persistent reading tree/progress barriers |
| Source switch and journal seam | startSourceDiscovery (118), onPickSource (120), switchPreviewSource, preparePendingSourceSwitchForNextChoice, reconcileUnknownCommit, anchor choice, rollback/seam, reconcilePending and resolve journal; business generation/transaction currently Index | which modal/route/book is displayed; user intent and native exit destination | SourceSwitchHost owns discovery/current transaction/reconciliation/rollback through existing gateway. Move the transaction state and guards together, never only RPC wrappers | SourceSwitchGateway, ReaderRuntimeOwner coordinator, current source-switch persistent journal and Core position migration APIs | unknown/confirmed commit; readonly recovery; original book and source identity; close during committing consumes Back; old candidate/anchor/owner; retained first-page commit and rollback order |
| Directory/bookmarks/offline/prefetch | directory mutation gates/JSON target proof, perform create/delete, load/merge projections, download chapter/book/clear; rolling prefetch coalescer107 lines and near-end catalog refresher46, raw reading commit→old-source cleanup | directory route, scroll/current selection, persistent reader commit notifications | ReaderDirectoryHost/ReadingOfflineHost own typed DTO projection, operation state and scheduling. Keep current gateway/source position proof; shared native row does not own business truth | LocalReadingFlowGateway, ReadingOfflineGateway, ReaderDirectoryProjection/ControlBookmark helpers, existing bounded prefetch and Core download queue | composite book + chapter + body/processing/position proof; add/delete ACK readback; partial download; late read/prefetch/session/nav; background cancellation; release assets only from exact confirmed durable state |
| System file open and reconstruction | consumeSystemFileOpen (74 lines), Want-result queue checks, source-switch barrier, request serialized reader exit, toast result ACK; AppStorage import DTO parse/validation | actual route/reader exit intent, minimal platform notice presentation | thin SystemFileOpenNavigationHost (existing system queue remains authoritative) and local import presentation serializer adapter, explicit owner/queue/result/generation rather than more Index flags | ReaderSystemFileOpenHost, ReaderRuntimeOwner, existing source-switch and import journal recovery | bounded queue/current id/URI capability; late entry/reader exit/Want; result ACK once; unavailable alert/Toast independent of saved book; cold reconstructed current result distinct from an operation ACK |

## New gaps located by code (not yet repaired by this map)

1. **Two raw RPC boundaries remain**: clearTextCache `cache.clear`, refreshDetailAcquisitionProjection `search-book.get`. Three methods still read raw protocol shapes. `69` methods invoke `current()` somewhere; this includes necessary live getters and is not a count of 69 defects. `21` methods invoke acquisition/preparation coordinators directly; their business state ownership requires semantic review.
2. **BookshelfCatalog manual admission is incomplete**: manual refreshOneShelfBook uses `!automatic || ...`, so the manual predicate is always true; the final batch reacquires `ReaderRuntimeOwner.current()` and its projection only checks current bookshelf route. A displaced/retired sweep can start subsequent work through a replacement Runtime or publish into a newer shelf visit. Existing tests prove bounded batching/normal force refresh/automatic cancellation, but do not exercise true Runtime replacement/unset and navigation identity for this manual chain.
3. **Manual update partial truth is log-only**: refreshOneShelfBook catches a failed book, and the loop increments completed regardless; final reload failure is logged. The More consumer sees done/total, without per-book failed/partial/recovery facts. Completed attempted items must not imply every catalog succeeded. This remains a P6 contract gap even after import/removal receipts are shared.
4. **Main bookshelf first/refresh read admission lacks a captured Runtime**: refreshBookshelf/onBookshelfLoadFailed only compare their load-generation. BookshelfFlowGateway.load does not take a current guard. Runtime teardown does not increment that generation. A late retained Index promise could still project or run the automatic retry after its owner retired. P6 needs true owner retirement and retained-value refresh failure, alongside existing first-load retry behavior.
5. **Detail projection current predicate excludes captured Runtime**: refreshDetailAcquisitionProjection checks navigation/session/entity, but its predicate has no Runtime comparison; it trusts a raw cached book record without the exact identity validation already present in BookAcquisitionCoordinator.openBook. Typed read boundary and immutable captured owner are required together.

## Recommended reviewable sequence

1. Accept the completed Runtime/Back contracts independently; do not treat them as P2 close.
2. One read-projection slice: exact cached book gateway + real current owner/detail DTO consumer.
3. One shelf load/projection Host slice, including first/refresh failures and source-name/anchor consumers.
4. One catalog updater Host slice with manual/background admission and true partial result.
5. Move existing Bookshelf operation receipts/import presentation from Index as one unit, preserving all current actual consumer gates.
6. Reading/source-switch/directory/system-file domain extraction separately, never overlapping Index writers or rewriting the persistent reading tree.

Each slice closes only when original state has a single owner, Index publishes the real DTO, the real SDK callbacks consume it, old code is removed, and local/SDK/artifact/target/visual evidence remain separately named. A library is not needed for Reader-specific route/owner admission: reuse existing Core, scheduling, acquisition and ArkUI support; do not duplicate their general algorithms.

## All-method index

| Name | Line | Lines | Kind | Protocol element reads |
|---|---:|---:|---|---:|
| `aboutToAppear` | 646 | 35 | method | 0 |
| `aboutToDisappear` | 682 | 31 | method | 0 |
| `onBackPress` | 714 | 129 | method | 0 |
| `bookshelfContent` | 844 | 45 | Builder | 0 |
| `bookshelfShellContent` | 890 | 31 | Builder | 0 |
| `localImportContent` | 922 | 13 | Builder | 0 |
| `discoverPageContent` | 936 | 16 | Builder | 0 |
| `build` | 953 | 238 | method | 0 |
| `syncContent` | 1192 | 6 | Builder | 0 |
| `syncSurface` | 1199 | 16 | Builder | 0 |
| `rssPageContent` | 1216 | 8 | Builder | 0 |
| `rssPageSurface` | 1225 | 20 | Builder | 0 |
| `rssEditorContent` | 1246 | 8 | Builder | 0 |
| `rssEditorSurface` | 1255 | 17 | Builder | 0 |
| `rssSourceFeedContent` | 1273 | 8 | Builder | 0 |
| `rssSourceFeedSurface` | 1282 | 21 | Builder | 0 |
| `rssEntryDetailContent` | 1304 | 8 | Builder | 0 |
| `rssEntryDetailSurface` | 1313 | 22 | Builder | 0 |
| `rssSubscriptionManagementContent` | 1336 | 6 | Builder | 0 |
| `rssSubscriptionManagementSurface` | 1343 | 21 | Builder | 0 |
| `detailContent` | 1365 | 41 | Builder | 0 |
| `externalDirectory` | 1407 | 22 | Builder | 0 |
| `readerOwnsWindowEdges` | 1430 | 6 | method | 0 |
| `appContentTopInset` | 1437 | 8 | method | 0 |
| `openRss` | 1446 | 18 | method | 0 |
| `loadRss` | 1465 | 12 | method | 0 |
| `openDiscover` | 1478 | 11 | method | 0 |
| `getDiscoverOrchestrator` | 1490 | 12 | method | 0 |
| `openSettings` | 1503 | 9 | method | 0 |
| `openBookshelfSettings` | 1513 | 6 | method | 0 |
| `returnFromBookshelfSettings` | 1520 | 4 | method | 0 |
| `assignShelfDefaultGroup` | 1525 | 14 | method | 0 |
| `settingsContent` | 1540 | 24 | Builder | 0 |
| `sourceToolsContent` | 1565 | 27 | Builder | 0 |
| `sourceManagementContent` | 1593 | 21 | Builder | 0 |
| `bookshelfManagementContent` | 1615 | 25 | Builder | 0 |
| `rulesManagementContent` | 1641 | 24 | Builder | 0 |
| `openBookshelfManagement` | 1666 | 8 | method | 0 |
| `openBookshelfMultiSelect` | 1675 | 23 | method | 0 |
| `openRulesManagement` | 1699 | 9 | method | 0 |
| `requestRulesManagementFromReader` | 1709 | 12 | method | 0 |
| `presentRulesManagementFromReader` | 1722 | 9 | method | 0 |
| `getRulesManagementOrchestrator` | 1732 | 11 | method | 0 |
| `onSettingToggled` | 1744 | 6 | method | 0 |
| `clearTextCache` | 1751 | 18 | method | 4 |
| `onSyncSaveConfig` | 1770 | 6 | method | 0 |
| `onSyncTestConnection` | 1777 | 6 | method | 0 |
| `onSyncTriggerBackup` | 1784 | 6 | method | 0 |
| `onSyncRestoreLatest` | 1791 | 6 | method | 0 |
| `onSyncResolveRestore` | 1798 | 6 | method | 0 |
| `registerTemporaryBackBridge` | 1805 | 18 | method | 0 |
| `consumeTemporaryBackBridge` | 1824 | 16 | method | 0 |
| `isCurrentRuntime` | 1841 | 3 | method | 0 |
| `isCurrentSyncOwner` | 1845 | 4 | method | 0 |
| `isCurrentSyncPresentation` | 1850 | 3 | method | 0 |
| `getSyncOrchestrator` | 1854 | 17 | method | 0 |
| `openSourceManagement` | 1872 | 11 | method | 0 |
| `manageSourcesFromSearch` | 1885 | 6 | method | 0 |
| `getSourceToolsOrchestrator` | 1892 | 11 | method | 0 |
| `openSourceTools` | 1904 | 9 | method | 0 |
| `updateSourceToolsSelection` | 1914 | 3 | method | 0 |
| `selectAllSourceTools` | 1918 | 5 | method | 0 |
| `toggleSourceToolsSelection` | 1924 | 10 | method | 0 |
| `consumeSourceToolsSelection` | 1935 | 8 | method | 0 |
| `exportSelectedSources` | 1944 | 3 | method | 0 |
| `checkSelectedSources` | 1948 | 5 | method | 0 |
| `setSelectedSourcesEnabled` | 1954 | 3 | method | 0 |
| `returnToSourceManagement` | 1958 | 5 | method | 0 |
| `returnToSettings` | 1964 | 7 | method | 0 |
| `returnFromRulesManagement` | 1972 | 10 | method | 0 |
| `returnFromSourceManagement` | 1988 | 26 | method | 0 |
| `onSourceToggled` | 2015 | 5 | method | 0 |
| `onSourceDetectionRequested` | 2021 | 3 | method | 0 |
| `onSourceLoginRequested` | 2025 | 3 | method | 0 |
| `openJsonImport` | 2029 | 4 | method | 0 |
| `dismissJsonImport` | 2034 | 3 | method | 0 |
| `selectLocalJsonImport` | 2038 | 5 | method | 0 |
| `importOnlineJson` | 2044 | 5 | method | 0 |
| `executeJsonImport` | 2050 | 27 | method | 0 |
| `jsonImportTitle` | 2078 | 5 | method | 0 |
| `jsonImportDescription` | 2084 | 12 | method | 0 |
| `showIndexAlert` | 2097 | 23 | method | 0 |
| `showSourceImportResult` | 2121 | 13 | method | 0 |
| `showSourceImportResultFromSearch` | 2140 | 28 | method | 0 |
| `requestSourceDelete` | 2169 | 32 | method | 0 |
| `openSync` | 2202 | 12 | method | 0 |
| `refreshRss` | 2215 | 9 | method | 0 |
| `onRssManage` | 2225 | 15 | method | 0 |
| `getRssOrchestrator` | 2241 | 20 | method | 0 |
| `getRssEditorOrchestrator` | 2262 | 15 | method | 0 |
| `onRssManagementViewArticles` | 2278 | 6 | method | 0 |
| `onRssSubscriptionSelected` | 2285 | 26 | method | 0 |
| `onRssSubscriptionAddRequested` | 2312 | 8 | method | 0 |
| `onRssSubscriptionEditRequested` | 2321 | 13 | method | 0 |
| `finishRssSubscriptionEdit` | 2335 | 12 | method | 0 |
| `returnToRssSubscriptionManagement` | 2348 | 8 | method | 0 |
| `requestRssSubscriptionDelete` | 2357 | 26 | method | 0 |
| `requestRssSourceImport` | 2384 | 23 | method | 0 |
| `importRssSources` | 2408 | 15 | method | 0 |
| `exportRssSources` | 2424 | 13 | method | 0 |
| `showRssOperationResult` | 2438 | 16 | method | 0 |
| `confirmRssSubscriptionDelete` | 2455 | 12 | method | 0 |
| `isCurrentRssPresentation` | 2468 | 10 | method | 0 |
| `rssSourceBinding` | 2479 | 12 | method | 0 |
| `rssEntryBinding` | 2492 | 12 | method | 0 |
| `loadRssSourceItems` | 2505 | 8 | method | 0 |
| `refreshRssSourceFeed` | 2514 | 13 | method | 0 |
| `isCurrentRssSourceFeed` | 2528 | 4 | method | 0 |
| `applyRssSourceSnapshot` | 2533 | 8 | method | 0 |
| `onRssItemSelected` | 2542 | 15 | method | 0 |
| `onRssSourceItemSelected` | 2558 | 12 | method | 0 |
| `openRssEntryDetail` | 2571 | 28 | method | 0 |
| `onRssEntryFavoriteRequested` | 2600 | 17 | method | 0 |
| `isCurrentRssEntryDetail` | 2618 | 9 | method | 0 |
| `applyRssEntrySnapshot` | 2628 | 10 | method | 0 |
| `failRssEntryOperation` | 2639 | 9 | method | 0 |
| `returnFromRssEntryDetail` | 2649 | 10 | method | 0 |
| `returnToRssSourceFeed` | 2660 | 18 | method | 0 |
| `returnFromRssSourceFeed` | 2679 | 20 | method | 0 |
| `returnToRss` | 2700 | 14 | method | 0 |
| `openRssManagementForSubscription` | 2715 | 20 | method | 0 |
| `onRssOpenOriginalRequested` | 2736 | 12 | method | 0 |
| `onRssModeRequested` | 2749 | 13 | method | 0 |
| `feedPresentation` | 2763 | 9 | method | 0 |
| `rssSubscriptions` | 2773 | 6 | method | 0 |
| `rssRecentUnread` | 2780 | 6 | method | 0 |
| `rssSubscriptionManagementItems` | 2787 | 10 | method | 0 |
| `rssSubscriptionManagementMeta` | 2799 | 21 | method | 0 |
| `formatRssManagementTime` | 2821 | 5 | method | 0 |
| `twoDigit` | 2827 | 3 | method | 0 |
| `onSearchVisibilityChanged` | 2831 | 12 | method | 0 |
| `refreshDetailAcquisitionProjection` | 2844 | 102 | method | 24 |
| `openSearch` | 2947 | 11 | method | 0 |
| `performSearch` | 2959 | 5 | method | 0 |
| `stopSearch` | 2965 | 4 | method | 0 |
| `retrySearch` | 2970 | 4 | method | 0 |
| `clearSearchHistory` | 2975 | 5 | method | 0 |
| `resetSearchDetailWarmups` | 2981 | 3 | method | 0 |
| `scheduleSearchDetailWarmups` | 2985 | 7 | method | 0 |
| `searchAcquisitionCandidate` | 2993 | 4 | method | 0 |
| `searchDetailKey` | 2998 | 3 | method | 0 |
| `remoteSeedForSearchBook` | 3002 | 19 | method | 0 |
| `onSearchResultSelected` | 3023 | 80 | method | 0 |
| `openShelfBook` | 3104 | 25 | method | 0 |
| `preparePersistedShelfBooks` | 3130 | 25 | method | 0 |
| `prepareVisibleReadingBooks` | 3156 | 19 | method | 0 |
| `beginReadingStartupTrace` | 3177 | 4 | method | 0 |
| `traceStartupStage` | 3182 | 3 | method | 0 |
| `beginStartupStage` | 3186 | 3 | method | 0 |
| `endStartupStage` | 3190 | 3 | method | 0 |
| `traceShelfEntryPhase` | 3194 | 10 | method | 0 |
| `openShelfBookInfo` | 3205 | 16 | method | 0 |
| `openLocalBookDetail` | 3222 | 86 | method | 0 |
| `openRemoteBookDetail` | 3309 | 279 | method | 0 |
| `refreshCachedSearchDetailInBackground` | 3589 | 76 | method | 0 |
| `resolveRemoteDetailSourceName` | 3666 | 37 | method | 0 |
| `downloadDirectoryChapter` | 3704 | 33 | method | 0 |
| `downloadDirectoryBook` | 3738 | 93 | method | 0 |
| `showOfflineDownloadFeedback` | 3832 | 7 | method | 0 |
| `requestClearDirectoryBookOffline` | 3840 | 21 | method | 0 |
| `clearDirectoryBookOffline` | 3862 | 34 | method | 0 |
| `detailBookKey` | 3897 | 3 | method | 0 |
| `shelfBookKey` | 3901 | 3 | method | 0 |
| `detailBookmarkIdentity` | 3911 | 13 | method | 0 |
| `isSameDetailBook` | 3925 | 3 | method | 0 |
| `canRemoveDetailBook` | 3929 | 6 | method | 0 |
| `requestDetailShelfMutation` | 3936 | 7 | method | 0 |
| `addDetailBook` | 3944 | 61 | method | 0 |
| `cancelDetailBookAddition` | 4006 | 36 | method | 0 |
| `openBookRemovalDialog` | 4043 | 10 | method | 0 |
| `dismissBookRemovalDialog` | 4054 | 6 | method | 0 |
| `confirmBookRemovalDialog` | 4061 | 7 | method | 0 |
| `requestRemoveDetailBook` | 4069 | 14 | method | 0 |
| `requestRemoveShelfBook` | 4084 | 13 | method | 0 |
| `requestRemoveShelfBooks` | 4098 | 15 | method | 0 |
| `removeShelfBooks` | 4114 | 27 | method | 0 |
| `canRemoveShelfBook` | 4142 | 6 | method | 0 |
| `removeShelfBook` | 4149 | 23 | method | 0 |
| `applyShelfBookRemoval` | 4173 | 6 | method | 0 |
| `removeDetailBook` | 4180 | 31 | method | 0 |
| `emptyShelfRecovery` | 4212 | 3 | method | 0 |
| `hasUnknownShelfWrite` | 4216 | 4 | method | 0 |
| `shelfRecovery` | 4221 | 8 | method | 0 |
| `beginShelfWrite` | 4230 | 8 | method | 0 |
| `publishShelfWrite` | 4239 | 5 | method | 0 |
| `reconcileShelfWrite` | 4245 | 34 | method | 0 |
| `applyDetailBookRemoval` | 4280 | 15 | method | 0 |
| `openReading` | 4296 | 26 | method | 0 |
| `onDirectoryChapterSelected` | 4323 | 32 | method | 0 |
| `onReaderBookmarkSelected` | 4356 | 41 | method | 0 |
| `onDirectoryNavigationTargetSelected` | 4398 | 11 | method | 0 |
| `openFullDirectory` | 4410 | 17 | method | 0 |
| `openReaderControlDirectory` | 4428 | 9 | method | 0 |
| `readingReadyCallback` | 4438 | 8 | method | 0 |
| `scheduleNavigationBackfillAfterReady` | 4447 | 45 | method | 0 |
| `presentPreparedReading` | 4493 | 30 | method | 0 |
| `returnToReadingOrigin` | 4524 | 20 | method | 0 |
| `requestReaderBookInfo` | 4545 | 7 | method | 0 |
| `cancelReaderExitDestination` | 4553 | 7 | method | 0 |
| `onReaderExited` | 4561 | 32 | method | 0 |
| `closeDirectory` | 4594 | 18 | method | 0 |
| `deleteDirectoryBookmarks` | 4613 | 36 | method | 0 |
| `createDirectoryChapterStartBookmark` | 4650 | 40 | method | 0 |
| `toggleReaderPageBookmark` | 4691 | 44 | method | 0 |
| `directoryBookmarkMutationKey` | 4736 | 3 | method | 0 |
| `controlBookmarkProjectionMessage` | 4740 | 7 | method | 0 |
| `failDirectoryBookmarkProjection` | 4748 | 16 | method | 0 |
| `clearDirectoryBookmarkProjectionFailure` | 4765 | 5 | method | 0 |
| `beginDirectoryBookmarkMutation` | 4772 | 10 | method | 0 |
| `finishDirectoryBookmarkMutation` | 4783 | 5 | method | 0 |
| `isDirectoryBookmarkMutationCurrent` | 4789 | 4 | method | 0 |
| `performDirectoryChapterStartBookmarkCreation` | 4794 | 35 | method | 0 |
| `performReaderPageBookmarkCreation` | 4830 | 37 | method | 0 |
| `performDirectoryBookmarkDeletion` | 4868 | 38 | method | 0 |
| `loadControlBookmarks` | 4907 | 33 | method | 0 |
| `reloadDirectoryBookmarkProjection` | 4941 | 16 | method | 0 |
| `loadRemoteDirectoryProjection` | 4958 | 31 | method | 0 |
| `mergeDirectoryBookmarks` | 4990 | 19 | method | 0 |
| `updateDirectoryChapterDownloadState` | 5010 | 21 | method | 0 |
| `getSourceSwitchGateway` | 5032 | 6 | method | 0 |
| `isSourceSwitchActive` | 5039 | 3 | method | 0 |
| `openSourceSwitch` | 5043 | 22 | method | 0 |
| `openDetailSourceSwitch` | 5066 | 12 | method | 0 |
| `retrySourceSwitch` | 5079 | 9 | method | 0 |
| `refreshSourceSwitch` | 5089 | 8 | method | 0 |
| `startSourceDiscovery` | 5098 | 118 | method | 0 |
| `sourceSwitchProbeQuery` | 5217 | 31 | method | 0 |
| `knownSearchSourceCandidates` | 5249 | 12 | method | 0 |
| `onPickSource` | 5262 | 120 | method | 0 |
| `switchPreviewSource` | 5383 | 16 | method | 0 |
| `presentSourceSwitchAcquisitionFailure` | 5400 | 13 | method | 0 |
| `retryFailedSourceSwitch` | 5414 | 9 | method | 0 |
| `dismissSourceSwitchFailure` | 5424 | 5 | method | 0 |
| `preparePendingSourceSwitchForNextChoice` | 5430 | 57 | method | 0 |
| `reconcileUnknownSourceSwitchCommit` | 5488 | 35 | method | 0 |
| `resolveSourceSwitchAnchor` | 5524 | 26 | method | 0 |
| `onRollbackSourceSwitch` | 5551 | 23 | method | 0 |
| `closeSourceSwitch` | 5575 | 17 | method | 0 |
| `performSourceSwitchSeam` | 5593 | 43 | method | 0 |
| `onReadingFailure` | 5637 | 10 | method | 0 |
| `onRemoteSessionReady` | 5648 | 34 | method | 0 |
| `installRemoteReadingSession` | 5684 | 43 | method | 6 |
| `probeRemoteContentVerdict` | 5734 | 67 | method | 0 |
| `refreshCachedChapterFromPrompt` | 5802 | 43 | method | 0 |
| `remoteContentVerdictLabel` | 5846 | 19 | method | 0 |
| `showReadingFailure` | 5866 | 10 | method | 0 |
| `reconcilePendingSourceSwitches` | 5878 | 11 | method | 0 |
| `resolveReaderSourceSwitchTransaction` | 5890 | 20 | method | 0 |
| `rollbackPendingSourceSwitch` | 5911 | 47 | method | 0 |
| `reopenSwitchedBook` | 5959 | 10 | method | 0 |
| `returnFromDetail` | 5970 | 7 | method | 0 |
| `returnToSearch` | 5978 | 24 | method | 0 |
| `returnToBookshelf` | 6003 | 35 | method | 0 |
| `applyReadingCommit` | 6039 | 35 | method | 0 |
| `consumeSystemFileOpen` | 6075 | 74 | method | 0 |
| `currentSourceSwitchTransactionId` | 6150 | 9 | method | 0 |
| `readingDetailForShelf` | 6160 | 13 | method | 0 |
| `sourceDisplayName` | 6174 | 21 | method | 0 |
| `readingDetailForRemoteSeed` | 6196 | 14 | method | 0 |
| `applyDirectoryChapter` | 6211 | 7 | method | 0 |
| `prefetchReadingWindow` | 6219 | 107 | method | 0 |
| `isRemoteCatalogNearEnd` | 6327 | 5 | method | 0 |
| `updateRemoteReadableChapterOrder` | 6334 | 12 | method | 0 |
| `remoteReadableChapterPosition` | 6347 | 5 | method | 0 |
| `refreshRemoteCatalogNearEnd` | 6353 | 46 | method | 0 |
| `applyReaderDirectoryProjection` | 6400 | 51 | method | 0 |
| `shelfFilter` | 6452 | 3 | method | 0 |
| `refreshSearchShelfMembership` | 6456 | 11 | method | 0 |
| `loadNextShelfPage` | 6468 | 1 | method | 0 |
| `loadPreviousShelfPage` | 6470 | 1 | method | 0 |
| `loadShelfWindowPage` | 6472 | 28 | method | 0 |
| `refreshBookshelf` | 6501 | 25 | method | 0 |
| `onBookshelfLoadFailed` | 6533 | 29 | method | 0 |
| `isKnownDetailChapter` | 6563 | 8 | method | 0 |
| `nextNavigationGeneration` | 6572 | 8 | method | 0 |
| `isCurrentRoute` | 6581 | 3 | method | 0 |
| `applyBookshelfState` | 6585 | 79 | method | 0 |
| `hydrateShelfSourceNames` | 6665 | 41 | method | 0 |
| `copyShelfBookWithSourceName` | 6713 | 25 | method | 0 |
| `scheduleBookshelfBackgroundRefresh` | 6739 | 48 | method | 0 |
| `refreshBookshelfCatalogBatch` | 6788 | 29 | method | 0 |
| `startManualBookshelfUpdate` | 6824 | 39 | method | 0 |
| `canRunBookshelfBackgroundRefresh` | 6864 | 4 | method | 0 |
| `refreshOneShelfBook` | 6869 | 30 | method | 0 |
| `hasDeclaredCoverUrl` | 6900 | 6 | method | 0 |
| `openImportDialog` | 6907 | 6 | method | 0 |
| `closeImportDialog` | 6914 | 6 | method | 0 |
| `beginImport` | 6921 | 59 | method | 0 |
| `isCurrentImport` | 6981 | 7 | method | 0 |
| `writeImportPresentation` | 6989 | 25 | method | 0 |
| `reconcileImportPresentation` | 7015 | 6 | method | 0 |
| `hasVisibleImportDialog` | 7022 | 3 | method | 0 |
| `visibleImportDialogState` | 7026 | 4 | method | 0 |
| `visibleImportBatch` | 7031 | 4 | method | 0 |
| `currentImportPresentation` | 7036 | 23 | method | 0 |
| `parseImportBatch` | 7060 | 6 | method | 0 |
| `isValidImportBatch` | 7067 | 19 | method | 0 |
| `isNonNegativeInteger` | 7087 | 3 | method | 0 |
