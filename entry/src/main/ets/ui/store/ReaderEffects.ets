// ReaderEffects — async effect layer intercepting dispatch events.
//
// The reducer is a pure function (no side effects). When a search/book/chapter
// event needs real Host HTTP access, the store calls ReaderEffects.maybeRun()
// AFTER the synchronous reducer pass. The effect fires the HTTP request
// asynchronously and dispatches a success/failure event back into the store,
// which flows through the reducer again to update searchResults / currentBook /
// chapterContent.
//
// Parse strategy: Core RemoteContentPipeline. Host prefetches HTML via
// HttpHostAdapter, then passes the response + inline Legado source to Core's
// book.search / book.detail / book.toc / chapter.content commands. Core uses
// the Legado rules (ruleSearch / ruleBookInfo / ruleToc / ruleContent) to
// extract structured data, replacing the former ArkTS regex parsers.
//
// Safety: CoreRuntime may not be initialized when an early dispatch fires
// (e.g. during first UI build before EntryAbility.init). We guard with
// try/catch and the promise rejects — the caller surfaces an error state and
// the user can retry once CoreRuntime is ready.
import { ReaderUiState, UiEvent, SearchResultEntry, BookDetail, CoreSourceEntry, CoreSourceCheckResult, CoreSourceDebugResult, CoreSourceDebugStage, CoreSourceDebugLog, CoreContentSearchResult, CoreBookmark, CoreDiscoverKind, CoreDiscoverBook, ReplaceRule, CoreBookshelfBook, CoreBookGroup, CoreRssSubscription, CoreRssItem, ChapterTocEntry, CoreStorageBackupInfo, CoreStorageBackupHistoryEntry, CoreReaderCanonicalLocation, ReaderContentIdentity, CANONICAL_RESOLVER_VERSION, LocalImportDialogResult, BookshelfSelectionTarget, BookshelfRemovalReceipt, isLocalBookSourceId } from './ReaderUiState';
import { ReaderUiStore } from './ReaderUiStore';
import { CoreStorageBackupHistory } from './CoreStorageBackupHistory';
import { RouteTable } from '../../contract/generated/RouteTable';
import { CoreRuntime, CoreBookmarkCreateInput, LocalBookParseOptions, CoreSourceDebugRunProjection, ReadingProgressCoreRuntime } from '../../bridge/CoreRuntime';
import { HostHttpRequest, HostShareInvokeRequest } from '../../host/types/HostRequest';
import type { JsonObject } from '../../bridge/core/sdk/reader_core';
import window from '@ohos.window';
import fs from '@ohos.file.fs';
import util from '@ohos.util';
import promptAction from '@ohos.promptAction';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { LocalBookFormatPolicy } from '../../host/LocalBookFormatPolicy';
import { HarmonyLocalBookImportBatchFileReader, LocalBookImportBatchCoordinator, type LocalBookImportBatchFileResult } from './LocalBookImportBatchCoordinator';
import type { ReaderSelectedFile } from '../../host/adapters/FileSelectionHostAdapter';
import type { ReaderUIJSONPayload } from 'reader_ui_runtime';
import { CoreSlice10Service } from './CoreSlice10Service';

interface CoreStorageBackupEnvelope {
  manifest: JsonObject;
  payload: string;
  info: CoreStorageBackupInfo;
}

interface LocalCoreBackupHistoryLoad {
  entries: CoreStorageBackupHistoryEntry[];
  invalidFileCount: number;
}

interface ErrorMessageLike {
  message?: string;
  retryable?: boolean;
}

interface SourceSwitchProgressSnapshot {
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  chapterTitle: string;
}

interface SourceSwitchChapterTarget {
  position: number;
  matched: boolean;
}

// A source-scoped row returned by Core's `reading.progress.get`.  This is
// deliberately separate from the visible reader state: the latter is only a
// fallback while Core has no durable row for the exact book/source pair.
export interface PersistedReadingProgress {
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  locationRevision: string;
}

interface RemoteChapterLoadOptions {
  contentSearchOffset?: number;
  restoredProgress?: PersistedReadingProgress;
  bookOpenSequence?: number;
  chapterNavigationRequestId?: number;
}

// The narrow runtime view the drain uses (`ReadingProgressCoreRuntime`) is
// declared on CoreRuntime itself in bridge/CoreRuntime.ets, and imported below;
// keeping it there avoids a reverse import from CoreRuntime back into the store
// while letting ArkTS nominal typing admit both CoreRuntime and a test mock.

// Immutable snapshot queued by the real reader surface.  Keeping the Core
// identity with the measured anchor prevents a chapter change from relabeling
// an in-flight write for the chapter the reader has just left.
export interface ReadingProgressSnapshot {
  key: string;
  sessionEpoch: number;
  bookId: string;
  sourceId: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  viewportWidth: number;
  viewportHeight: number;
  fontScale: number;
  contentSearchJumpSequence?: number;
}

// One serialized Core write may unblock a navigation action only after the
// exact snapshot has made it through `reader.location.resolve` and a durable
// `reading.progress.update`.  Ordinary layout anchors carry no continuation
// and may still be coalesced; a navigation barrier is never silently replaced
// by a later background anchor.
interface QueuedReadingProgress {
  snapshot: ReadingProgressSnapshot;
  onStored: Array<() => void>;
  onFailed: Array<() => void>;
}

export class ReaderEffects {
  private static readonly slice10Core: CoreSlice10Service = new CoreSlice10Service();
  // Auto-page countdown timer handle. Non-null while the auto-page session is
  // active; cleared on session exit. Stored statically because Effects is a
  // stateless dispatcher — the timer must outlive each maybeRun() call.
  private static autoPageTimerId: number | null = null;
  // TTS uses the same single session owner as the visible Figma timer.  This
  // is deliberately a real timeout, not a decorative countdown label.
  private static ttsTimerId: number | null = null;
  // The fallback used when a window brightness request rejects. The slider
  // also supplies its pre-gesture value, but this survives non-slider callers.
  private static lastConfirmedBrightness: number = 80;
  private static brightnessRequestSequence: number = 0;
  // 主窗口引用，由 EntryAbility.onWindowStageCreate 注入。hideStatusBar 等
  // 需要 window API 的 effect 通过此引用操作系统状态栏，无需 context。
  private static mainWindow: window.Window | null = null;
  // 当前加载的章节 URL 和 bookId，用于 chapter-prev/next 和 progress-seek。
  private static currentChapterId: string = '';
  private static currentBookId: string = '';
  private static currentSourceId: string = '';
  private static currentChapterIndex: number = 0;
  private static currentSourceVariables: JsonObject | undefined = undefined;
  private static currentTocVariables: JsonObject | undefined = undefined;
  private static currentChapterToc: JsonObject[] = [];
  private static ttsChapterRef: JsonObject | null = null;
  private static ttsPlan: JsonObject | null = null;
  private static ttsCompletionInFlightIndex: number = -1;
  // Parsed local-book metadata and original bytes awaiting explicit user
  // confirmation. The confirm action materializes them in Core first, then
  // inserts the corresponding durable bookshelf entry.
  private static pendingImportedBook: JsonObject | null = null;
  private static pendingLocalBookId: string = '';
  private static pendingLocalBookOptions: LocalBookParseOptions | null = null;
  private static localImportParseEpoch: number = 0;
  private static pendingLocalImportEpoch: number = 0;
  // Production local-book imports use a durable, serial coordinator rather
  // than the obsolete single-file parse-preview flow. Keep one coordinator so
  // its batch epoch cannot restart at 1 and admit stale completions.
  private static readonly localImportBatch: LocalBookImportBatchCoordinator =
    new LocalBookImportBatchCoordinator(new HarmonyLocalBookImportBatchFileReader());
  private static localImportPickerInFlight: boolean = false;
  private static readonly LOCAL_IMPORT_PICKER_MIME_TYPES: string[] = [
    'text/plain',
    'application/epub+zip',
  ];
  // A source-package import is a sequence of Core source.import writes. The
  // state epoch is the durable UI admission token; this transient claim
  // prevents maybeRun() from replaying a reducer-rejected duplicate event.
  private static sourcePackageImportEffectEpoch: number = 0;
  // A category request can outlive a quick source/category switch.  Only the
  // newest Core response may update Discover, otherwise an old network result
  // would be displayed under a different persisted sourceId.
  private static discoverRequestSequence: number = 0;
  private static sourceCheckRequestSequence: number = 0;
  // Debugging has its own transaction/recorder lifecycle. A late source.debug
  // projection must never replace a newer source selection or running trace.
  private static sourceDebugRequestSequence: number = 0;
  // Continue-reading has its own global Core projection. It must not be
  // overwritten by a late request started under an older shelf filter/sort.
  private static continueReadingRequestSequence: number = 0;
  // A source switch can issue several Core commands (candidate search,
  // detail/TOC/content, progress + shelf replacement). Keep only the newest
  // transaction authoritative so a cancelled/obsolete response cannot replace
  // the visible book after the user has left the switch route.
  private static sourceSwitchRequestSequence: number = 0;
  private static sourceSwitchInFlight: boolean = false;
  private static sourceSwitchStateEpoch: number = -1;
  private static sourceSwitchExpectedSourceId: string = '';
  private static sourceSwitchExpectedBookId: string = '';
  private static sourceSwitchExpectedBookSourceId: string = '';
  // Shelf/detail opens are also multi-stage (detail → TOC → progress → body).
  // A slow earlier tap must never overwrite the book selected by a later tap.
  private static bookOpenRequestSequence: number = 0;
  // RSS has two independently-triggered Core reads: changing the all/unread
  // filter and returning to the tab.  A late response must not replace the
  // projection for the newer Core request.
  private static rssRequestSequence: number = 0;
  // Destructive writes are intentionally serialized per exact Core key. A
  // second tap on a visible confirmation cannot emit a duplicate delete.
  private static sourceDeleteInFlightId: string = '';
  private static rssSubscriptionDeleteInFlightId: string = '';
  private static bookshelfRemoveInFlightKey: string = '';
  private static bookGroupDeleteInFlightId: number = 0;
  private static bookGroupClearInFlightKey: string = '';
  private static replaceRuleDeleteInFlightId: string = '';
  private static bookmarkDeleteInFlightTime: number = -1;
  private static bookmarkCreateInFlightKey: string = '';
  private static searchHistoryClearInFlight: boolean = false;
  // A fast second body-search submission must never allow the first Core
  // response to overwrite its query/result projection.
  private static contentSearchRequestSequence: number = 0;
  // Progress writes must remain ordered: a slow resolve for an old page must
  // never arrive after a newer anchor and overwrite the durable location.
  // `inFlightReadingProgress` retains navigation barriers while Core is
  // writing so duplicate taps cannot start a second transition.
  private static progressWriteInFlight: boolean = false;
  private static inFlightReadingProgress: QueuedReadingProgress | null = null;
  private static pendingReadingProgress: QueuedReadingProgress[] = [];
  private static lastCompletedReadingProgressKey: string = '';
  private static pendingReadingCommitAction: string = '';
  // A reader session ends only after its exit progress barrier succeeds.  The
  // epoch lets that exit invalidate delayed layout anchors without cancelling
  // the already-confirmed durable write that made the exit admissible.
  private static readingSessionEpoch: number = 1;
  // Test seam: when non-null, drainReadingProgressQueue resolves Core via this
  // provider instead of CoreRuntime.get(), so async race tests can drive a
  // controllable-delay mock. Production leaves this null. The narrow runtime
  // interface lets a test mock implement only the two methods the drain uses.
  private static runtimeProviderForTest: (() => ReadingProgressCoreRuntime) | null = null;

  /** Test seam: inject a CoreRuntime provider (null restores the real singleton). */
  static setRuntimeProviderForTest(provider?: () => ReadingProgressCoreRuntime): void {
    ReaderEffects.runtimeProviderForTest = provider ?? null;
  }
  static acquireCoreRuntime(): ReadingProgressCoreRuntime {
    return ReaderEffects.runtimeProviderForTest !== null
      ? ReaderEffects.runtimeProviderForTest!()
      : CoreRuntime.get();
  }
  /** Test seam: bump the reading session epoch to simulate mid-resolve invalidation. */
  static bumpReadingSessionEpochForTest(): void {
    const expired = ReaderEffects.readingSessionEpoch;
    ReaderEffects.readingSessionEpoch = expired >= 2147483646 ? 1 : expired + 1;
  }
  /** Test seam: reset all reading-progress statics to a clean baseline between cases. */
  static resetReadingProgressStateForTest(): void {
    ReaderEffects.progressWriteInFlight = false;
    ReaderEffects.inFlightReadingProgress = null;
    ReaderEffects.pendingReadingProgress = [];
    ReaderEffects.lastCompletedReadingProgressKey = '';
    ReaderEffects.readingSessionEpoch = 1;
    ReaderEffects.runtimeProviderForTest = null;
    ReaderEffects.currentBookId = '';
    ReaderEffects.currentSourceId = '';
    ReaderEffects.currentChapterIndex = 0;
  }
  /** Test seam: read the current epoch so a test snapshot can carry it. */
  static readingSessionEpochForTest(): number {
    return ReaderEffects.readingSessionEpoch;
  }
  /** Test seam: observe the completed key to assert whether a write was committed. */
  static lastCompletedReadingProgressKeyForTest(): string {
    return ReaderEffects.lastCompletedReadingProgressKey;
  }
  /** Test seam: enqueue a snapshot directly with callbacks, bypassing reportReadingAnchor. */
  static enqueueReadingProgressForTest(snapshot: ReadingProgressSnapshot,
    onStored?: () => void, onFailed?: () => void): void {
    ReaderEffects.enqueueReadingProgress(snapshot, onStored, onFailed);
  }
  /** Test seam: set the current-reading identity statics so isCurrentReadingIdentity
   *  reflects a chapter that was loaded by the effects layer in production. Tests
   *  that drive the drain without a real chapter-load effect use this to seed the
   *  identity guards; pass empty strings/(-1) to clear it. */
  static setCurrentReadingIdentityForTest(bookId: string, sourceId: string, chapterIndex: number): void {
    ReaderEffects.currentBookId = bookId;
    ReaderEffects.currentSourceId = sourceId;
    ReaderEffects.currentChapterIndex = chapterIndex;
  }

  // A chapter request remains claimed from the user gesture until the target
  // body has either landed or failed. Core TOC lookup is asynchronous, so a
  // progress barrier alone would otherwise allow a fast double tap to launch
  // the same adjacent chapter twice before loading=true is projected.
  private static chapterNavigationInFlight: boolean = false;
  private static chapterNavigationSequence: number = 0;
  private static activeChapterNavigationRequestId: number = 0;
  // Bookmark V1 is scoped only by Core's (bookName, bookAuthor) filter, so a
  // late response must still be rejected when the visible title/author pair
  // changes. Search-history refreshes likewise need sequencing around clear.
  private static bookmarkRequestSequence: number = 0;
  private static searchHistoryRequestSequence: number = 0;
  private static titleSearchRequestSequence: number = 0;
  // A selected restore payload is intentionally transient.  The UI state only
  // carries manifest metadata; a process restart requires the user to select
  // the local/remote backup again instead of silently applying stale bytes.
  private static pendingCoreRestoreEnvelope: CoreStorageBackupEnvelope | null = null;
  // Legacy fixed path is read as one migration-compatible history record.
  // Newly created local snapshots use immutable Core timestamp/checksum names.
  private static readonly LOCAL_CORE_BACKUP_PATH: string = CoreStorageBackupHistory.legacyPath();
  private static readonly PRE_RESTORE_CORE_BACKUP_PATH: string = 'files://backups/pre-restore-core-storage-snapshot-v1.json';
  private static readonly REMOTE_CORE_BACKUP_FILE: string = 'core-storage-snapshot-v1.json';

  static setMainWindow(win: window.Window): void {
    ReaderEffects.mainWindow = win;
  }

  // Dispatcher: called by ReaderUiStore.dispatch after the reducer pass.
  // Routes events that need async Host work to their handlers.
  static maybeRun(event: UiEvent): void {
    // Contract events are dot-named while the generated ArkTS reducer uses
    // hyphenated names.  The reducer already normalizes this boundary; the
    // effect layer must see the same canonical form or a reducer-visible
    // action (for example source.import.apply) can silently skip its Core
    // persistence side effect.
    const eventType = event.type.replace(/\./g, '-');
    switch (eventType) {
      case 'route-push': {
        ReaderEffects.invalidateTitleSearchIfRouteLeft();
        if (event.id === 'discover' || event.id === 'discover-home') {
          ReaderEffects.loadDiscover();
        } else if (event.id === 'source-detect' || event.id === 'source-test-result') {
          ReaderEffects.runSourceCheck();
        } else if (event.id === 'source-switch') {
          // Reducer rejects the route for local books; keep the effect layer
          // fail-closed too so a stale event cannot even fetch a replacement
          // candidate list for a local file.
          if (!isLocalBookSourceId(ReaderUiStore.snapshot().currentBook?.sourceId)) {
            ReaderEffects.loadAvailableSources(true);
          }
        } else if (event.id === 'source-management' || event.id === 'source-batch' || event.id === 'source-debug') {
          ReaderEffects.loadAvailableSources(false);
        } else if (event.id === 'content-replacement') {
          ReaderEffects.loadReplaceRules();
        } else if (event.id === 'rss' || event.id === 'rss-all' || event.id === 'rss-subscription-management') {
          ReaderEffects.loadRss();
        } else if (event.id === 'book-search' || event.id === 'search-home') {
          ReaderEffects.loadSearchHistory();
        } else if (event.id === 'bookmarks-manager') {
          ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'bookmark' });
        } else if (event.id === 'book-directory' && ReaderUiStore.snapshot().tocMode === 'bookmark') {
          ReaderEffects.loadBookmarksForCurrentBook();
        } else if (event.id === 'sync-backup') {
          ReaderEffects.loadLocalCoreBackup();
          ReaderEffects.loadWebdavConfig();
        } else if (event.id === 'webdav-config') {
          ReaderEffects.loadWebdavConfig();
        }
        break;
      }
      case 'route-replace': {
        // A replace is an explicit navigation supersession. Any slow detail /
        // TOC / chapter pipeline from the former route must become stale.
        ReaderEffects.cancelBookOpen();
        ReaderEffects.invalidateTitleSearchIfRouteLeft();
        // Development initialRoute uses route-replace, so it must receive the
        // same Core-backed data as an in-app navigation into these pages.
        if (event.id === 'discover' || event.id === 'discover-home') {
          ReaderEffects.loadDiscover();
        } else if (event.id === 'source-detect' || event.id === 'source-test-result') {
          ReaderEffects.runSourceCheck();
        } else if (event.id === 'source-debug') {
          ReaderEffects.loadAvailableSources(false);
        } else if (event.id === 'book-search' || event.id === 'search-home') {
          ReaderEffects.loadSearchHistory();
        } else if (event.id === 'bookmarks-manager') {
          ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'bookmark' });
        } else if (event.id === 'book-directory' && ReaderUiStore.snapshot().tocMode === 'bookmark') {
          ReaderEffects.loadBookmarksForCurrentBook();
        } else if (event.id === 'sync-backup') {
          ReaderEffects.loadLocalCoreBackup();
          ReaderEffects.loadWebdavConfig();
        } else if (event.id === 'webdav-config') {
          ReaderEffects.loadWebdavConfig();
        }
        break;
      }
      case 'route-pop':
        // ReaderTopArea owns a plain route-pop. If it closes a running source
        // switch, invalidate the transaction so its late Core result cannot
        // replace the book after the user returned to the reader.
        ReaderEffects.cancelSourceSwitchIfActive();
        ReaderEffects.cancelBookOpenIfRouteLeft();
        ReaderEffects.invalidateTitleSearchIfRouteLeft();
        break;
      case 'switch-tab': {
        ReaderEffects.cancelBookOpen();
        ReaderEffects.titleSearchRequestSequence += 1;
        if (event.tab === 'bookshelf') {
          ReaderEffects.loadBookshelf();
        } else if (event.tab === 'discover') {
          ReaderEffects.loadDiscover();
        } else if (event.tab === 'rss') {
          ReaderEffects.loadRss();
        }
        break;
      }
      case 'set-bookshelf-group':
      case 'set-bookshelf-sort':
      case 'set-bookshelf-filter-toggle':
      case 'set-bookshelf-filter-clear': {
        ReaderEffects.loadBookshelf();
        break;
      }
      case 'settings-segment-switch':
        if (event.settingsKey === 'searchHistoryLimit') ReaderEffects.loadSearchHistory();
        break;
      case 'discover-refresh':
        ReaderEffects.loadDiscover(
          ReaderUiStore.snapshot().discoverSourceId,
          ReaderUiStore.snapshot().discoverKindUrl,
        );
        break;
      case 'discover-source-cycle':
        ReaderEffects.cycleDiscoverSource();
        break;
      case 'discover-source-select':
        ReaderEffects.loadDiscover(event.sourceId ?? '', '');
        break;
      case 'discover-kind-select':
        ReaderEffects.loadDiscover(
          ReaderUiStore.snapshot().discoverSourceId,
          event.discoverKindUrl ?? '',
        );
        break;
      case 'source-detect-run':
        ReaderEffects.runSourceCheck();
        break;
      case 'source-debug-run':
        ReaderEffects.runSourceDebug();
        break;
      case 'retry-last-operation':
        ReaderEffects.retryLastOperation();
        break;
      case 'bookshelf-book-open': {
        ReaderEffects.openBookshelfBook(event.sourceId ?? '', event.bookId ?? '');
        break;
      }
      case 'rss-item-open': {
        // H4-G: When the RSS Pilot is enabled, the coordinator's
        // dispatchRssPilot owns this event; ReaderEffects is only reached
        // when the Pilot is disabled (Shadow fallback).
        ReaderEffects.markRssItemRead(event.rssGuid ?? '', event.rssSubscriptionId ?? '');
        break;
      }
      case 'rss-subscription-add':
        // H4-G: When the RSS Pilot is enabled, the coordinator's
        // dispatchRssPilot owns this event; ReaderEffects is only reached
        // when the Pilot is disabled (Shadow fallback).
        ReaderEffects.addRssSubscription(event);
        break;
      case 'rss-subscription-update':
        // H4-G: When the RSS Pilot is enabled, the coordinator's
        // dispatchRssPilot owns this event; ReaderEffects is only reached
        // when the Pilot is disabled (Shadow fallback).
        ReaderEffects.updateRssSubscription(event);
        break;
      case 'rss-subscription-delete':
        // H4-G: When the RSS Pilot is enabled, the coordinator's
        // dispatchRssPilot owns this event; ReaderEffects is only reached
        // when the Pilot is disabled (Shadow fallback).
        ReaderEffects.rejectUnconfirmedRssSubscriptionDelete();
        break;
      case 'rss-subscription-delete-confirm':
        // H4-G: When the RSS Pilot is enabled, the coordinator's
        // dispatchRssPilot owns this event; ReaderEffects is only reached
        // when the Pilot is disabled (Shadow fallback).
        ReaderEffects.deleteConfirmedRssSubscription(event.rssSubscriptionId ?? '');
        break;
      case 'rss-refresh':
        // H4-G: When the RSS Pilot is enabled, the coordinator's
        // dispatchRssPilot owns this event; ReaderEffects is only reached
        // when the Pilot is disabled (Shadow fallback).
        ReaderEffects.refreshRss();
        break;
      case 'rss-filter-set':
      case 'rss-load':
        ReaderEffects.loadRss();
        break;
      case 'source-delete':
        ReaderEffects.rejectUnconfirmedSourceDelete();
        break;
      case 'source-delete-confirm':
        ReaderEffects.deleteConfirmedSource();
        break;
      case 'source-export':
        ReaderEffects.exportSources(event.sourceId ?? '');
        break;
      case 'source-management-refresh':
        ReaderEffects.loadAvailableSources(false);
        break;
      case 'source-package-import-json': {
        // H4-C: When the import Pilot is enabled, the coordinator's
        // dispatchImportPilot owns this event; ReaderEffects is only reached
        // when the Pilot is disabled (Shadow fallback).
        const origin = event.sourceImportOrigin ?? '手动 JSON';
        const epoch = ReaderEffects.claimSourcePackageImport(origin);
        if (epoch > 0) ReaderEffects.importSourcePackage(event.sourceImportPayload ?? '', origin, epoch);
        break;
      }
      case 'source-package-import-url': {
        // H4-C: When the import Pilot is enabled, the coordinator's
        // dispatchImportPilot owns this event; ReaderEffects is only reached
        // when the Pilot is disabled (Shadow fallback).
        const origin = event.sourceImportOrigin ?? '网络 URL';
        const epoch = ReaderEffects.claimSourcePackageImport(origin);
        if (epoch > 0) ReaderEffects.importSourcePackageFromUrl(event.sourceImportUrl ?? '', origin, epoch);
        break;
      }
      case 'source-package-import-clipboard': {
        // H4-C: When the import Pilot is enabled, the coordinator's
        // dispatchImportPilot owns this event; ReaderEffects is only reached
        // when the Pilot is disabled (Shadow fallback).
        const origin = event.sourceImportOrigin ?? '剪贴板';
        const epoch = ReaderEffects.claimSourcePackageImport(origin);
        if (epoch > 0) ReaderEffects.importSourcePackageFromClipboard(origin, epoch);
        break;
      }
      case 'book-group-create':
        ReaderEffects.createBookGroup(event.bookGroupName ?? '');
        break;
      case 'book-group-update':
        ReaderEffects.updateBookGroup(event.bookGroupId ?? 0, event.bookGroupName ?? '');
        break;
      case 'book-group-delete-confirm':
        ReaderEffects.deleteConfirmedBookGroup(event.bookGroupId ?? 0);
        break;
      case 'book-group-assign':
        if ((event.bookshelfGroup ?? '').trim().length === 0) {
          ReaderEffects.rejectUnconfirmedBookGroupClear();
        } else {
          ReaderEffects.assignBookshelfGroup(
            event.sourceId ?? '', event.bookId ?? '', event.bookshelfGroup ?? '',
          );
        }
        break;
      case 'book-group-clear-request':
      case 'book-group-clear-cancel':
        break;
      case 'book-group-clear-confirm':
        ReaderEffects.clearConfirmedBookshelfGroup(event.sourceId ?? '', event.bookId ?? '');
        break;
      case 'search-submit': {
        const q = event.query ?? '';
        if (q.length > 0) {
          ReaderEffects.runSearch(q);
        }
        break;
      }
      case 'search-history-clear-request':
      case 'search-history-clear-cancel':
        break;
      case 'search-history-clear-confirm':
        ReaderEffects.clearConfirmedSearchHistory();
        break;
      case 'search-history-clear':
        ReaderEffects.rejectUnconfirmedSearchHistoryClear();
        break;
      case 'bookmark-create':
        ReaderEffects.createCurrentBookmark();
        break;
      case 'bookmark-delete-request':
      case 'bookmark-delete-cancel':
        break;
      case 'bookmark-delete-confirm':
        ReaderEffects.deleteConfirmedBookmark(event.bookmarkTime ?? -1);
        break;
      case 'bookmark-delete':
        ReaderEffects.rejectUnconfirmedBookmarkDelete();
        break;
      case 'bookmark-open':
        ReaderEffects.openCurrentBookmark(event.bookmarkTime ?? -1);
        break;
      case 'content-search-submit':
        ReaderEffects.runContentSearch(event.query ?? '');
        break;
      case 'content-search-result-open':
        ReaderEffects.openContentSearchResult(event.contentSearchResultIndex ?? -1);
        break;
      case 'book-detail-load': {
        const bookId = event.bookId ?? '';
        if (bookId.length > 0) {
          ReaderEffects.runBookDetail(bookId, event.loadFirstChapter === true, event.sourceId ?? '');
        }
        break;
      }
      case 'chapter-load': {
        const chapterId = event.chapterId ?? '';
        const bookId = event.bookId ?? '';
        if (chapterId.length > 0) {
          ReaderEffects.runChapter(chapterId, bookId);
        }
        break;
      }
      case 'book-detail-success':
        if (ReaderUiStore.snapshot().tocMode === 'bookmark') {
          ReaderEffects.loadBookmarksForCurrentBook();
        }
        break;
      // ── Batch 1 session/TTS/auto-page effect hooks ──
      case 'auto-page-toggle': {
        // A direct auto-page start may replace TTS.  Tear down the previous
        // session before creating the timer so neither audio nor a stale timer
        // survives the handoff.
        ReaderEffects.manageSessionTransition();
        ReaderEffects.manageAutoPageTimer();
        break;
      }
      case 'tts-toggle': {
        // Starting TTS must stop an auto-page timer first.  There is no fake
        // pause/resume branch: the Figma surface has a distinct stop control.
        ReaderEffects.manageSessionTransition();
        ReaderEffects.manageTtsPlayback();
        ReaderEffects.manageTtsTimer();
        ReaderEffects.maybeVibrateForReaderInteraction();
        break;
      }
      case 'reader-tts-start': {
        ReaderEffects.manageSessionTransition();
        ReaderEffects.manageTtsPlayback();
        ReaderEffects.manageTtsTimer();
        ReaderEffects.maybeVibrateForReaderInteraction();
        break;
      }
      case 'reader-tts-stop': {
        ReaderEffects.manageSessionTransition();
        break;
      }
      case 'tts-prev':
        ReaderEffects.stepTtsQueue(-1);
        ReaderEffects.maybeVibrateForReaderInteraction();
        break;
      case 'tts-next':
        ReaderEffects.stepTtsQueue(1);
        ReaderEffects.maybeVibrateForReaderInteraction();
        break;
      case 'tts-set-rate':
        ReaderEffects.updateTtsQueueRate();
        break;
      case 'tts-set-timer':
        ReaderEffects.manageTtsTimer();
        break;
      case 'set-active-session': {
        ReaderEffects.manageSessionTransition();
        break;
      }
      // ── Batch 2 reader control effect hooks ──
      case 'chapter-prev':
        ReaderEffects.requestAdjacentChapter(-1);
        break;
      case 'chapter-next':
        ReaderEffects.requestAdjacentChapter(+1);
        break;
      case 'chapter-progress-seek': {
        const pv = event.value ?? 0;
        // Seeking to another chapter is the same durable boundary as an
        // adjacent-chapter action.  Do not replace the current body until
        // Core has acknowledged its measured anchor; otherwise a failed
        // write can make the old location unrecoverable after this seek.
        ReaderEffects.commitReadingProgressBefore('chapter-progress-seek', (): void => {
          ReaderEffects.loadChapterByProgress(pv);
          ReaderEffects.maybeVibrateForReaderInteraction();
        });
        break;
      }
      case 'reader-page-prev':
      case 'reader-page-next':
      case 'set-reader-page-index': {
        ReaderEffects.maybeVibrateForReaderInteraction();
        break;
      }
      case 'reader-location-anchor':
        ReaderEffects.persistReadingProgress(event);
        break;
      case 'set-brightness': {
        const bv = event.value ?? 80;
        ReaderEffects.applyBrightness(bv, event.previousValue);
        break;
      }
      case 'toggle-brightness-auto':
        ReaderEffects.applyBrightnessAuto(event.enabled === true, event.previousEnabled === true);
        break;
      case 'set-toc-mode':
        if (event.tocMode === 'bookmark') {
          ReaderEffects.loadBookmarksForCurrentBook();
        }
        break;
      case 'selection-action':
        ReaderEffects.runNativeSelectionAction(event.selectionAction ?? '');
        break;
      case 'toggle-reduced-motion':
        ReaderEffects.persistReducedMotion(event.enabled === true);
        break;
      case 'set-pagination-mode':
        // Compatibility callers still enter through this event. Persist the
        // normalized pair after the reducer has made pageAnimation authoritative.
        ReaderEffects.persistReaderPageTurnPreference();
        break;
      case 'set-reader-setting-option':
        if (event.optionKey === 'pageAnimation' || event.optionKey === 'pageMode') {
          ReaderEffects.persistReaderPageTurnPreference();
        }
        break;
      // `book-action/delete` only opens a target-bound confirmation sheet in
      // the reducer. The Core write is reachable solely from its confirm tap.
      case 'book-action': {
        break;
      }
      case 'bookshelf-remove-confirm': {
        ReaderEffects.removeConfirmedBookshelfBook(event.sourceId ?? '', event.bookId ?? '');
        break;
      }
      case 'reader-exit': {
        ReaderEffects.persistReadingProgress();
        ReaderEffects.cancelBookOpen();
        ReaderEffects.manageSessionTransition();
        ReaderEffects.releaseReaderHostControls();
        break;
      }
      // ── Reader setting Host/UI consumers ─────────────────────────────
      case 'set-reader-toggle': {
        const enabled = event.toggleValue === true;
        if (event.toggleKey === 'hideStatusBar') {
          ReaderEffects.applyHideStatusBar(enabled);
        } else if (event.toggleKey === 'keepScreenOn') {
          ReaderEffects.applyKeepScreenOn(enabled);
        } else if (event.toggleKey === 'autoPage') {
          ReaderEffects.syncAutoPageSetting(enabled);
        }
        break;
      }
      // ── P1.2 settings-action effect hook ──
      case 'settings-action': {
        ReaderEffects.runSettingsAction(event.settingsKey ?? '');
        break;
      }
      case 'reader-bookCache-open':
        ReaderEffects.runSlice10ContractCommand('cache.book.status', event);
        break;
      case 'download-task-retry':
        ReaderEffects.runSlice10ContractCommand('cache.book.prefetch', event);
        break;
      case 'settings-cache-clear':
      case 'storage-cleanup-confirm':
        ReaderEffects.runSlice10ContractCommand('cache.clear', event);
        break;
      case 'reader-replace-undo':
        ReaderEffects.runSlice10ContractCommand('replace.undo', event);
        break;
      case 'cache-clear-confirm':
        ReaderEffects.clearConfirmedSessionCache();
        break;
      // ── P1.3 WebDAV effect hooks ──
      case 'webdav-test': {
        ReaderEffects.runWebdavTest();
        break;
      }
      case 'webdav-save': {
        ReaderEffects.runWebdavSave();
        break;
      }
      case 'core-backup-create-local':
        ReaderEffects.createLocalCoreBackup();
        break;
      case 'core-backup-create-webdav':
        ReaderEffects.createWebdavCoreBackup();
        break;
      case 'core-backup-prepare-local':
        ReaderEffects.prepareLocalCoreRestore(event.coreBackupPath);
        break;
      case 'core-backup-prepare-remote':
        ReaderEffects.prepareRemoteCoreRestore();
        break;
      case 'core-restore-apply-request':
        ReaderEffects.applyPreparedCoreRestore();
        break;
      case 'core-restore-apply-confirm':
        // The old full-page flow emitted a second confirmation. Current Figma
        // has one Confirm action, and the reducer has already entered the
        // guarded restoring state before this effect runs. Keep this event
        // inert for one compatibility cycle rather than starting a duplicate
        // Core transaction.
        break;
      case 'core-backup-apply':
        ReaderEffects.rejectUnconfirmedCoreRestoreApply();
        break;
      case 'source-import-open':
        ReaderEffects.startLocalImportFromSystemPicker();
        break;
      case 'source-import-apply': {
        // H4-C: When the import Pilot is enabled, the coordinator's
        // dispatchImportPilot owns this event (normalized to import.apply);
        // ReaderEffects is only reached when the Pilot is disabled (Shadow
        // fallback) and commitLocalImport runs the legacy Core write path.
        ReaderEffects.commitLocalImport(event.importCount ?? 0);
        break;
      }
      // ── W3 source switch confirm effect hook ──
      case 'source-switch-confirm': {
        // H4-D: When the source switch Pilot is enabled, the coordinator's
        // dispatchSourceSwitchPilot owns this event (normalized to
        // source.switch.confirm); ReaderEffects is only reached when the Pilot
        // is disabled (Shadow fallback) and handleSourceSwitchConfirm runs the
        // legacy Core change.bookSource + shelf replacement path.
        ReaderEffects.handleSourceSwitchConfirm();
        break;
      }
      case 'source-switch-cancel':
        // H4-D: When the source switch Pilot is enabled, the coordinator's
        // dispatchSourceSwitchPilot owns this event (normalized to
        // source.switch.cancel); ReaderEffects is only reached when the Pilot
        // is disabled (Shadow fallback).
        ReaderEffects.cancelSourceSwitchIfActive();
        break;
      // ── W5 replace-rule persistence effect hooks ──
      case 'replace-rule-add': {
        // H4-E: When the replace rules Pilot is enabled, the coordinator's
        // dispatchReplaceRulePilot owns this event (normalized to
        // reader.replace.create); ReaderEffects is only reached when the Pilot
        // is disabled (Shadow fallback) and handleReplaceRuleAdd runs the
        // legacy Core replace-rule.create path.
        ReaderEffects.handleReplaceRuleAdd(event);
        break;
      }
      case 'replace-rule-edit': {
        // H4-E: When the replace rules Pilot is enabled, the coordinator's
        // dispatchReplaceRulePilot owns this event (normalized to
        // reader.replace.apply with action=update); ReaderEffects is only
        // reached when the Pilot is disabled (Shadow fallback).
        ReaderEffects.handleReplaceRuleEdit(event);
        break;
      }
      case 'replace-rule-delete-request':
      case 'replace-rule-delete-cancel':
        break;
      case 'replace-rule-delete-confirm':
        // H4-E: When the replace rules Pilot is enabled, the coordinator's
        // dispatchReplaceRulePilot owns this event (normalized to
        // reader.replace.apply with action=delete); ReaderEffects is only
        // reached when the Pilot is disabled (Shadow fallback) and
        // deleteConfirmedReplaceRule runs the legacy Core replace-rule.delete
        // path. The replaceRuleDeleteInFlightId guard below prevents duplicate
        // deletes in the Shadow fallback path.
        ReaderEffects.deleteConfirmedReplaceRule();
        break;
      case 'replace-rule-delete':
        ReaderEffects.rejectUnconfirmedReplaceRuleDelete();
        break;
      case 'replace-rule-toggle': {
        // H4-E: When the replace rules Pilot is enabled, the coordinator's
        // dispatchReplaceRulePilot owns this event (normalized to
        // reader.replace.apply with action=toggle); ReaderEffects is only
        // reached when the Pilot is disabled (Shadow fallback).
        ReaderEffects.handleReplaceRuleToggle(event);
        break;
      }
      default:
        break;
    }
  }

  // 隐藏/显示系统状态栏。hide=true 时隐藏状态栏（保留导航栏）；
  // hide=false 时恢复状态栏显示。
  static async applyHideStatusBar(hide: boolean): Promise<void> {
    const win = ReaderEffects.mainWindow;
    if (win === null) {
      ReaderEffects.revertReaderToggle('hideStatusBar', !hide,
        '状态栏设置未生效：主窗口尚未就绪。');
      return;
    }
    try {
      if (hide) {
        await win.setWindowSystemBarEnable(['navigation']);
      } else {
        await win.setWindowSystemBarEnable(['status', 'navigation']);
      }
      ReaderEffects.reportReaderHostMessage('');
    } catch (e) {
      ReaderEffects.revertReaderToggle('hideStatusBar', !hide,
        `状态栏设置未生效：${ReaderEffects.errorMessage(e)}`);
    }
  }

  // ── Session / TTS / auto-page effect handlers ────────────────────────
  // Effects run AFTER the reducer pass, so they can read the new state via
  // ReaderUiStore.snapshot() to decide whether to start or stop side effects.

  // Start or stop the per-second countdown timer based on the current
  // activeSession. Always clears any existing timer first to avoid leaks, then
  // starts a fresh 1s interval if (and only if) activeSession === 'auto-page'.
  // The interval dispatches 'session-capsule-countdown-tick' which the reducer
  // uses to decrement countdownSeconds (and loop back to intervalSeconds at 0).
  // At the boundary it also advances a visible page, or requests the next
  // Core-backed chapter once the final page is reached.
  static manageAutoPageTimer(): void {
    if (ReaderEffects.autoPageTimerId !== null) {
      clearInterval(ReaderEffects.autoPageTimerId);
      ReaderEffects.autoPageTimerId = null;
    }
    const active = ReaderUiStore.snapshot().activeSession;
    if (active === 'auto-page') {
      ReaderEffects.autoPageTimerId = setInterval(() => {
        const beforeTick = ReaderUiStore.snapshot();
        const advance = beforeTick.autoPageSession.playing &&
          beforeTick.autoPageSession.countdownSeconds <= 1;
        ReaderUiStore.dispatch({ type: 'session-capsule-countdown-tick' });
        if (!advance) return;
        if (beforeTick.readerPageIndex < beforeTick.readerPageCount - 1) {
          ReaderUiStore.dispatch({ type: 'reader-page-next' });
        } else {
          ReaderUiStore.dispatch({ type: 'chapter-next' });
        }
        // 单页模式 is intentionally one visible advance per start.  It must
        // stop the same real timer rather than merely changing an unused UI
        // label, so the next page never advances automatically again.
        if (beforeTick.autoPageMode === 'single') {
          ReaderUiStore.dispatch({ type: 'auto-page-toggle' });
        }
      }, 1000);
    }
  }

  // Core owns slicing and queue state; HarmonyOS owns app-local vocalization.
  // TextToSpeechEngine does not have a faithful pause/resume API, so a visible
  // play request either prepares a fresh queue or leaves an already-playing
  // queue alone.  The red Figma stop action owns cleanup through
  // `set-active-session: ''`.
  static manageTtsPlayback(): void {
    const playback = ReaderUiStore.snapshot().ttsSession.playback;
    if (playback !== 'playing') return;
    try {
      const runtime = CoreRuntime.get();
      if (ReaderEffects.ttsPlan === null || ReaderEffects.ttsChapterRef === null) {
        ReaderEffects.prepareAndStartTts(runtime);
      }
    } catch (e) {
      console.info(`ReaderEffects: tts host adapter error: ${(e as Error).message}`);
    }
  }

  private static prepareAndStartTts(runtime: CoreRuntime): void {
    const state = ReaderUiStore.snapshot();
    const book = state.currentBook;
    const content = state.chapterContent.join('\n');
    if (book === null || content.trim().length === 0) {
      // The button is disabled in the UI until Core content is loaded, but
      // keep this guard for route/event callers so a false Playing state never
      // survives an empty chapter.
      ReaderUiStore.dispatch({ type: 'reader-tts-stop' });
      return;
    }
    const chapter: JsonObject = {};
    chapter['sourceId'] = ReaderEffects.currentSourceId.length > 0
      ? ReaderEffects.currentSourceId : (book.sourceId ?? '');
    chapter['bookId'] = book.bookId;
    chapter['chapterIndex'] = ReaderEffects.currentChapterIndex;
    chapter['chapterTitle'] = state.currentChapterTitle.length > 0 ? state.currentChapterTitle : book.latestChapter;
    chapter['chapterUrl'] = ReaderEffects.currentChapterId;
    const sliceParams: JsonObject = {};
    sliceParams['chapter'] = chapter;
    sliceParams['content'] = content;
    sliceParams['strategy'] = 'paragraph-then-sentence';
    runtime.executeCoreMethod('tts.slice', sliceParams, 5000).then((sliceData: JsonObject): Promise<JsonObject> => {
      const fields = sliceData as Object as Record<string, Object>;
      const planValue: Object = fields['plan'];
      if (planValue === null || typeof planValue !== 'object') {
        throw new Error('Core tts.slice 未返回 plan');
      }
      ReaderEffects.ttsChapterRef = chapter;
      ReaderEffects.ttsPlan = planValue as Object as JsonObject;
      ReaderEffects.bindTtsProgress(runtime);
      const playParams: JsonObject = {};
      playParams['plan'] = ReaderEffects.ttsPlan;
      playParams['startSliceIndex'] = 0;
      return runtime.executeCoreMethod('tts.queue.play', playParams, 5000);
    }).then((playData: JsonObject): void => {
      const current = ReaderEffects.syncTtsQueueSnapshot(playData);
      ReaderEffects.speakTtsSlice(current);
    }).catch((e: Error): void => {
      ReaderEffects.ttsPlan = null;
      ReaderEffects.ttsChapterRef = null;
      console.info(`ReaderEffects: tts plan/start error: ${e.message}`);
      ReaderUiStore.dispatch({ type: 'reader-tts-stop' });
    });
  }

  // Core returns the authoritative queue cursor after play/next/prev/rate.
  // The reducer may optimistically repaint a control, but this projection puts
  // the displayed cursor back on Core truth before the next utterance starts.
  private static syncTtsQueueSnapshot(data: JsonObject): number {
    const fields = data as Object as Record<string, Object>;
    const snapshotValue = fields['snapshot'];
    const fallback = ReaderUiStore.snapshot();
    let current = fallback.ttsSession.currentSegment;
    let total = ReaderEffects.ttsSlices().length;
    if (snapshotValue !== null && typeof snapshotValue === 'object' && !Array.isArray(snapshotValue)) {
      const snapshot = snapshotValue as Record<string, Object>;
      const rawCurrent = snapshot['currentSliceIndex'];
      const rawTotal = snapshot['totalSlices'];
      if (typeof rawCurrent === 'number' && Number.isFinite(rawCurrent)) {
        current = Math.max(0, Math.round(rawCurrent));
      }
      if (typeof rawTotal === 'number' && Number.isFinite(rawTotal)) {
        total = Math.max(0, Math.round(rawTotal));
      }
    }
    if (total > 0) current = Math.min(current, total - 1);
    else current = 0;
    ReaderUiStore.dispatch({ type: 'tts-segments-loaded', ttsCurrentSegment: current, ttsTotalSegments: total });
    return current;
  }

  private static ttsSlices(): Object[] {
    if (ReaderEffects.ttsPlan === null) return [];
    const fields = ReaderEffects.ttsPlan as Object as Record<string, Object[]>;
    const slices: Object[] = fields['slices'];
    return Array.isArray(slices) ? slices : [];
  }

  private static speakTtsSlice(index: number): void {
    const slices = ReaderEffects.ttsSlices();
    if (index < 0 || index >= slices.length) return;
    const slice = slices[index] as Object as JsonObject;
    const text = ReaderEffects.getString(slice, 'text');
    if (text.length === 0) return;
    if (ReaderEffects.ttsChapterRef === null) return;
    const runtime = CoreRuntime.get();
    const state = ReaderUiStore.snapshot();
    const params: JsonObject = {};
    params['chapter'] = ReaderEffects.ttsChapterRef;
    params['sliceIndex'] = index;
    params['status'] = 'speaking';
    runtime.executeCoreMethod('tts.queue.report-status', params, 5000).then(() => {
      return runtime.getTtsAdapter().start({
        text: text,
        rate: state.ttsSession.rate,
        voice: state.ttsSession.voice,
      });
    }).then((result): void => {
      if (!result.started) {
        throw new Error('Harmony TTS Host 未确认开始朗读');
      }
    }).catch((e: Error): void => {
      console.info(`ReaderEffects: tts start error: ${e.message}`);
      ReaderUiStore.dispatch({ type: 'reader-tts-stop' });
    });
  }

  private static bindTtsProgress(runtime: CoreRuntime): void {
    runtime.getTtsAdapter().setProgressCallback((_articleId: string, current: number, max: number,
      progressType: number): void => {
      if (progressType !== 4 && (max <= 0 || current < max)) return;
      ReaderEffects.advanceTtsAfterCompletion();
    });
  }

  private static advanceTtsAfterCompletion(): void {
    if (ReaderEffects.ttsChapterRef === null || ReaderEffects.ttsPlan === null) return;
    const state = ReaderUiStore.snapshot();
    if (state.activeSession !== 'tts' || state.ttsSession.playback !== 'playing') return;
    const index = state.ttsSession.currentSegment;
    if (ReaderEffects.ttsCompletionInFlightIndex === index) return;
    ReaderEffects.ttsCompletionInFlightIndex = index;
    const total = ReaderEffects.ttsSlices().length;
    const runtime = CoreRuntime.get();
    const status: JsonObject = {};
    status['chapter'] = ReaderEffects.ttsChapterRef;
    status['sliceIndex'] = index;
    status['status'] = 'done';
    runtime.executeCoreMethod('tts.queue.report-status', status, 5000).then((): Promise<JsonObject> => {
      if (index + 1 >= total) {
        ReaderUiStore.dispatch({ type: 'reader-tts-stop' });
        const completed: JsonObject = {};
        return Promise.resolve(completed);
      }
      const next: JsonObject = {};
      next['chapter'] = ReaderEffects.ttsChapterRef;
      return runtime.executeCoreMethod('tts.queue.next', next, 5000);
    }).then((queueData: JsonObject): void => {
      if (index + 1 < total) {
        const current = ReaderEffects.syncTtsQueueSnapshot(queueData);
        ReaderEffects.ttsCompletionInFlightIndex = -1;
        ReaderEffects.speakTtsSlice(current);
      } else {
        ReaderEffects.ttsCompletionInFlightIndex = -1;
      }
    }).catch((e: Error): void => {
      ReaderEffects.ttsCompletionInFlightIndex = -1;
      console.info(`ReaderEffects: tts completion error: ${e.message}`);
    });
  }

  static stepTtsQueue(direction: number): void {
    if (ReaderEffects.ttsChapterRef === null || ReaderEffects.ttsPlan === null) return;
    const method = direction > 0 ? 'tts.queue.next' : 'tts.queue.prev';
    const params: JsonObject = {};
    params['chapter'] = ReaderEffects.ttsChapterRef;
    const visible = ReaderUiStore.snapshot().ttsSession;
    const rollback = direction > 0
      ? Math.max(0, visible.currentSegment - 1)
      : Math.min(Math.max(0, visible.totalSegments - 1), visible.currentSegment + 1);
    CoreRuntime.get().executeCoreMethod(method, params, 5000).then((queueData: JsonObject): void => {
      const current = ReaderEffects.syncTtsQueueSnapshot(queueData);
      ReaderEffects.speakTtsSlice(current);
    }).catch((e: Error): void => {
      console.info(`ReaderEffects: ${method} error: ${e.message}`);
      // Restore the last Core-confirmed cursor when a boundary/state error
      // rejects an optimistic reducer update.
      ReaderUiStore.dispatch({ type: 'tts-segments-loaded', ttsCurrentSegment: rollback, ttsTotalSegments: visible.totalSegments });
    });
  }

  static updateTtsQueueRate(): void {
    if (ReaderEffects.ttsChapterRef === null || ReaderEffects.ttsPlan === null) return;
    const params: JsonObject = {};
    params['chapter'] = ReaderEffects.ttsChapterRef;
    params['rate'] = Math.max(1, Math.min(10, Math.round(ReaderUiStore.snapshot().ttsSession.rate * 5)));
    CoreRuntime.get().executeCoreMethod('tts.queue.set-rate', params, 5000).then((queueData: JsonObject): void => {
      const current = ReaderEffects.syncTtsQueueSnapshot(queueData);
      ReaderEffects.speakTtsSlice(current);
    }).catch((e: Error): void => {
      console.info(`ReaderEffects: tts.queue.set-rate error: ${e.message}`);
    });
  }

  private static clearTtsTimer(): void {
    if (ReaderEffects.ttsTimerId !== null) {
      clearTimeout(ReaderEffects.ttsTimerId);
      ReaderEffects.ttsTimerId = null;
    }
  }

  // The Figma timer supports a fixed end time as well as "本章结束".  The
  // latter needs no synthetic timer because the real queue already ends the
  // session after its final slice; fixed choices schedule one authoritative
  // stop action and are cancelled whenever the session changes.
  static manageTtsTimer(): void {
    ReaderEffects.clearTtsTimer();
    const state = ReaderUiStore.snapshot();
    if (state.activeSession !== 'tts' || state.ttsSession.playback !== 'playing') return;
    let minutes: number = 0;
    switch (state.ttsSession.timer) {
      case '5min': minutes = 5; break;
      case '10min': minutes = 10; break;
      case '15min': minutes = 15; break;
      case '30min': minutes = 30; break;
      default: return;
    }
    const expectedTimer = state.ttsSession.timer;
    ReaderEffects.ttsTimerId = setTimeout((): void => {
      ReaderEffects.ttsTimerId = null;
      const current = ReaderUiStore.snapshot();
      if (current.activeSession === 'tts' && current.ttsSession.playback === 'playing' &&
        current.ttsSession.timer === expectedTimer) {
        ReaderUiStore.dispatch({ type: 'reader-tts-stop' });
      }
    }, minutes * 60 * 1000);
  }

  // Cleanup hook fired on explicit session switches. If the new activeSession
  // is not 'auto-page', tear down the countdown timer; if it is not 'tts',
  // signal TTS stop. This prevents timers/speech from leaking across session
  // transitions (e.g. switching from auto-page directly to tts).
  static manageSessionTransition(): void {
    const active = ReaderUiStore.snapshot().activeSession;
    if (active !== 'auto-page' && ReaderEffects.autoPageTimerId !== null) {
      clearInterval(ReaderEffects.autoPageTimerId);
      ReaderEffects.autoPageTimerId = null;
    }
    if (active !== 'tts') {
      ReaderEffects.clearTtsTimer();
      try {
        const runtime = CoreRuntime.get();
        if (ReaderEffects.ttsChapterRef !== null && ReaderEffects.ttsPlan !== null) {
          const params: JsonObject = {};
          params['chapter'] = ReaderEffects.ttsChapterRef;
          runtime.executeCoreMethod('tts.queue.stop', params, 5000).catch((e: Error): void => {
            console.info(`ReaderEffects: tts core stop error: ${e.message}`);
          });
        }
        runtime.getTtsAdapter().stop().catch((e: Error) => {
          console.info(`ReaderEffects: tts stop error: ${e.message}`);
        });
        ReaderEffects.ttsChapterRef = null;
        ReaderEffects.ttsPlan = null;
        ReaderEffects.ttsCompletionInFlightIndex = -1;
      } catch (e) {
        console.info(`ReaderEffects: tts stop error: ${(e as Error).message}`);
      }
    }
  }

  // Apply a brightness value [0, 100] to the actual Harmony window.  All
  // reader brightness rails dispatch this one event, avoiding a decorative
  // slider whose visual position diverges from the device setting.
  static applyBrightness(value: number, previousValue?: number): void {
    const requestSequence = ++ReaderEffects.brightnessRequestSequence;
    const rollback = previousValue !== undefined
      ? Math.max(0, Math.min(100, Math.round(previousValue)))
      : ReaderEffects.lastConfirmedBrightness;
    const win = ReaderEffects.mainWindow;
    if (win === null) {
      ReaderEffects.revertReaderBrightness(rollback, '亮度设置未生效：主窗口尚未就绪。', requestSequence);
      return;
    }
    // Convert UI brightness [0, 100] to HarmonyOS window brightness [0.0, 1.0].
    // brightnessAuto (-1) is handled by toggle-brightness-auto; this path is
    // manual brightness only.
    const normalized = value / 100;
    win.setWindowBrightness(normalized).then((): void => {
      if (requestSequence !== ReaderEffects.brightnessRequestSequence) return;
      ReaderEffects.lastConfirmedBrightness = Math.max(0, Math.min(100, Math.round(value)));
      ReaderEffects.reportReaderHostMessage('');
    }).catch((e: Error): void => {
      if (requestSequence !== ReaderEffects.brightnessRequestSequence) return;
      console.info(`ReaderEffects: brightness setWindowBrightness error: ${e.message}`);
      ReaderEffects.revertReaderBrightness(rollback, `亮度设置未生效：${e.message}`, requestSequence);
    });
  }

  // `setWindowBrightness(-1)` restores Harmony's normal system-managed
  // brightness.  It deliberately does not alter the user's system auto-
  // brightness preference; it merely stops this reader window overriding it.
  static applyBrightnessAuto(enabled: boolean, previousEnabled: boolean): void {
    const requestSequence = ++ReaderEffects.brightnessRequestSequence;
    const win = ReaderEffects.mainWindow;
    if (win === null) {
      ReaderEffects.revertReaderBrightnessAuto(previousEnabled, '自动亮度未生效：主窗口尚未就绪。', requestSequence);
      return;
    }
    const requested = enabled ? -1 : ReaderUiStore.snapshot().brightness / 100;
    win.setWindowBrightness(requested).then((): void => {
      if (requestSequence !== ReaderEffects.brightnessRequestSequence) return;
      if (!enabled) {
        ReaderEffects.lastConfirmedBrightness = ReaderUiStore.snapshot().brightness;
      }
      ReaderEffects.reportReaderHostMessage('');
    }).catch((e: Error): void => {
      if (requestSequence !== ReaderEffects.brightnessRequestSequence) return;
      console.info(`ReaderEffects: auto brightness setWindowBrightness error: ${e.message}`);
      ReaderEffects.revertReaderBrightnessAuto(previousEnabled, `自动亮度未生效：${e.message}`, requestSequence);
    });
  }

  private static reportReaderHostMessage(message: string): void {
    if (ReaderUiStore.snapshot().readerHostMessage === message) return;
    ReaderUiStore.dispatch({ type: 'reader-host-message', readerHostMessage: message });
  }

  private static persistReducedMotion(enabled: boolean): void {
    if (!CoreRuntime.isInitialized()) return;
    const preferences = CoreRuntime.get().getReaderUiPreferenceAdapter();
    if (preferences === null) return;
    preferences.saveReducedMotion(enabled).catch((e: Error): void => {
      console.info(`ReaderEffects: reducedMotion persistence failed: ${e.message}`);
    });
  }

  // Page turn is a single global presentation preference. The state already
  // went through the reducer's atomic animation/mode mapping before this
  // effect runs; the Host adapter validates the five stable values again.
  private static persistReaderPageTurnPreference(): void {
    if (!CoreRuntime.isInitialized()) return;
    const preferences = CoreRuntime.get().getReaderUiPreferenceAdapter();
    if (preferences === null) return;
    const options = ReaderUiStore.snapshot().readerSettingOptions;
    preferences.savePageTurnPreference(options.pageAnimation, options.pageMode).catch((e: Error): void => {
      console.info(`ReaderEffects: page-turn preference persistence failed: ${e.message}`);
    });
  }

  // ── Native reader text selection ─────────────────────────────────────
  // The Text component supplies the selection through onTextSelectionChange.
  // Do not derive it from chapterContent or from any fixture: a selection
  // action is valid only while the reducer still holds that native range.
  private static runNativeSelectionAction(action: string): void {
    const selectedText = ReaderUiStore.snapshot().selection.selectedText;
    if (selectedText.trim().length === 0) {
      ReaderEffects.showSelectionFeedback('未检测到可操作的正文选区。');
      return;
    }
    if (action === 'copy') {
      ReaderEffects.copyNativeSelection(selectedText);
    } else if (action === 'search') {
      ReaderEffects.searchNativeSelection(selectedText);
    }
  }

  private static copyNativeSelection(selectedText: string): void {
    try {
      CoreRuntime.get().getClipboardAdapter().copy({ text: selectedText }).then((result): void => {
        if (result.copied === true) {
          ReaderEffects.showSelectionFeedback('已复制到系统剪贴板。');
        } else {
          ReaderEffects.showSelectionFeedback('复制未完成，请重试。');
        }
      }).catch((e: Error): void => {
        ReaderEffects.showSelectionFeedback(`复制失败：${e.message}`);
      });
    } catch (e) {
      ReaderEffects.showSelectionFeedback(`复制不可用：${ReaderEffects.errorMessage(e)}`);
    }
  }

  private static searchNativeSelection(selectedText: string): void {
    const keyword = selectedText.trim();
    if (keyword.length === 0) {
      ReaderEffects.showSelectionFeedback('未检测到可搜索的正文选区。');
      return;
    }
    // `content-search` was retired as a RouteId. Until the independently
    // admitted quick-search overlay is active, a native selection action must
    // fail closed instead of navigating to an invented or unrelated page.
    if (ReaderUiStore.snapshot().overlay !== 'content-search') {
      ReaderEffects.showSelectionFeedback('正文搜索控制层尚未准入，未执行搜索。');
      return;
    }
    ReaderUiStore.dispatch({ type: 'content-search-submit', query: keyword });
  }

  private static showSelectionFeedback(message: string): void {
    // Copy completion is asynchronous and the native selection menu may close
    // before the Host adapter resolves, so a system toast is the truthful
    // feedback surface for both success and failure.
    try {
      promptAction.showToast({ message: message, duration: 1800 });
    } catch (e) {
      console.info(`ReaderEffects: selection feedback unavailable: ${ReaderEffects.errorMessage(e)}`);
    }
  }

  private static revertReaderBrightness(value: number, message: string, requestSequence?: number): void {
    if (requestSequence !== undefined && requestSequence !== ReaderEffects.brightnessRequestSequence) return;
    ReaderUiStore.dispatch({ type: 'reader-brightness-host-revert', value: value });
    ReaderEffects.reportReaderHostMessage(message);
  }

  private static revertReaderBrightnessAuto(enabled: boolean, message: string, requestSequence?: number): void {
    if (requestSequence !== undefined && requestSequence !== ReaderEffects.brightnessRequestSequence) return;
    // Reducer-only acknowledgement: never re-enters the Host effect after a rejection.
    ReaderUiStore.dispatch({ type: 'reader-brightness-auto-host-revert', enabled: enabled });
    ReaderEffects.reportReaderHostMessage(message);
  }

  private static revertReaderToggle(key: 'keepScreenOn' | 'hideStatusBar', value: boolean, message: string): void {
    ReaderUiStore.dispatch({ type: 'reader-toggle-host-revert', toggleKey: key, toggleValue: value });
    ReaderEffects.reportReaderHostMessage(message);
  }

  // ReaderSettingsPanel and ReaderFullSettingsPage expose the same
  // auto-page setting as the quick panel.  Synchronize the persistent toggle
  // to the real timer/session state without duplicating timer ownership in UI.
  static syncAutoPageSetting(enabled: boolean): void {
    const active = ReaderUiStore.snapshot().activeSession === 'auto-page';
    if (enabled === active) return;
    ReaderUiStore.dispatch({ type: 'auto-page-toggle' });
  }

  // `device.screen.keep-on/release` are UI-contract-only Host operations.
  // Keep the reducer flag truthful: if the UIAbility context/Host rejects an
  // enable request, switch it back off rather than showing a successful state.
  static applyKeepScreenOn(enabled: boolean): void {
    try {
      const adapter = CoreRuntime.get().getScreenAdapter();
      if (adapter === null) {
        console.info('ReaderEffects: keep-screen-on unavailable because ScreenHostAdapter has no UIAbility context');
        ReaderEffects.revertReaderToggle('keepScreenOn', !enabled,
          '屏幕常亮未生效：Screen Host 尚未获得 UIAbility 上下文。');
        return;
      }
      if (enabled) {
        adapter.keepOn({ enabled: true }).then((result): void => {
          if (!result.enabled) {
            ReaderEffects.revertReaderToggle('keepScreenOn', false, '屏幕常亮未被 Host 确认。');
            return;
          }
          ReaderEffects.reportReaderHostMessage('');
        }).catch((e: Error): void => {
          console.info(`ReaderEffects: keep-screen-on error: ${e.message}`);
          ReaderEffects.revertReaderToggle('keepScreenOn', false, `屏幕常亮未生效：${e.message}`);
        });
      } else {
        adapter.release().then((): void => {
          ReaderEffects.reportReaderHostMessage('');
        }).catch((e: Error): void => {
          console.info(`ReaderEffects: screen release error: ${e.message}`);
          ReaderEffects.revertReaderToggle('keepScreenOn', true, `屏幕常亮无法释放：${e.message}`);
        });
      }
    } catch (e) {
      console.info(`ReaderEffects: keep-screen-on error: ${(e as Error).message}`);
      ReaderEffects.revertReaderToggle('keepScreenOn', !enabled,
        `屏幕常亮未生效：${ReaderEffects.errorMessage(e)}`);
    }
  }

  // Haptic feedback is intentionally limited to user-initiated reading
  // controls.  Auto-page ticks must not vibrate once per page.
  static maybeVibrateForReaderInteraction(): void {
    const state = ReaderUiStore.snapshot();
    if (!state.readerToggles.hapticFeedback || state.activeSession === 'auto-page') return;
    try {
      CoreRuntime.get().getDeviceAdapter().vibrate({ durationMs: 15 }).catch((e: Error): void => {
        console.info(`ReaderEffects: reader haptic error: ${e.message}`);
        ReaderEffects.reportReaderHostMessage(`触摸反馈未生效：${e.message}`);
      });
    } catch (e) {
      console.info(`ReaderEffects: reader haptic error: ${(e as Error).message}`);
      ReaderEffects.reportReaderHostMessage(`触摸反馈未生效：${ReaderEffects.errorMessage(e)}`);
    }
  }

  // Reader exit is a terminal UI lifecycle boundary for direct Host controls.
  // Release keep-screen-on even if a prior Host call was delayed; the reducer
  // clears the visible setting in the same transition.
  static releaseReaderHostControls(): void {
    if (ReaderEffects.autoPageTimerId !== null) {
      clearInterval(ReaderEffects.autoPageTimerId);
      ReaderEffects.autoPageTimerId = null;
    }
    try {
      const adapter = CoreRuntime.get().getScreenAdapter();
      if (adapter !== null) {
        adapter.release().catch((e: Error): void => {
          console.info(`ReaderEffects: reader exit screen release error: ${e.message}`);
        });
      }
    } catch (e) {
      console.info(`ReaderEffects: reader exit screen release error: ${(e as Error).message}`);
    }
  }

  // ── P1.2 settings-action effect ──
  // `cache-clear` only opens its confirmation state here; the confirmed event
  // reaches Core. Search-history delegates to its own Core-backed
  // confirmation flow.
  static runSettingsAction(settingsKey: string): void {
    if (settingsKey === 'cache-clear') {
      // The reducer has only opened the visible confirmation surface. The
      // second `cache-clear-confirm` event is the sole route to Core.
      return;
    } else if (settingsKey === 'clear-search-history') {
      // Reuse the same Core-confirmed clear + refresh flow as the search page
      // so settings never reports a local-only cleanup as persisted history.
      ReaderUiStore.dispatch({ type: 'search-history-clear-request' });
    } else {
      console.info('ReaderEffects: settings-action ' + settingsKey + ' (no handler)');
    }
  }

  private static clearConfirmedSessionCache(): void {
    const state = ReaderUiStore.snapshot();
    if (state.routeId !== 'settings-general' || !state.pendingCacheClear) {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: {
          code: 'CACHE_CLEAR_CONFIRM_REQUIRED',
          message: '缓存清理确认已失效；请在当前通用设置页重新发起。',
          retryable: false,
        },
      });
      return;
    }
    if (state.coreSlice10Loading) return;
    const payload: ReaderUIJSONPayload = {};
    payload['scope'] = 'cache';
    ReaderUiStore.dispatch({ type: 'core-slice10-start', coreSlice10Method: 'cache.clear' });
    try {
      ReaderEffects.slice10Core.cacheClear(payload).then((result: JsonObject): void => {
        ReaderUiStore.dispatch({
          type: 'core-slice10-succeeded',
          coreSlice10Method: 'cache.clear',
          coreSlice10Result: result as Object as ReaderUIJSONPayload,
        });
        ReaderUiStore.dispatch({ type: 'cache-clear-complete' });
      }).catch((error: Error): void => {
        ReaderEffects.reportSlice10CommandFailure('cache.clear', error, 'CACHE_CLEAR_FAILED');
      });
    } catch (error) {
      ReaderEffects.reportSlice10CommandFailure('cache.clear', error, 'CACHE_CLEAR_FAILED');
    }
  }

  /** Execute the four Reader UI Slice 10 commands through the common Core
   * dispatcher. Canonical nested payloads are mandatory: this boundary never
   * recovers a book selector/range/undo token from fixture or visible state. */
  private static runSlice10ContractCommand(method: string, event: UiEvent): void {
    ReaderUiStore.dispatch({ type: 'core-slice10-start', coreSlice10Method: method });
    const payload = event.readerUIJSONPayload;
    if (payload === undefined) {
      ReaderEffects.reportSlice10CommandFailure(
        method,
        new Error(`${event.type} is missing canonical readerUIJSONPayload`),
        'CORE_SLICE10_PAYLOAD_MISSING',
        false,
      );
      return;
    }
    let request: Promise<JsonObject>;
    try {
      switch (method) {
        case 'cache.book.status':
          request = ReaderEffects.slice10Core.cacheBookStatus(payload);
          break;
        case 'cache.book.prefetch':
          request = ReaderEffects.slice10Core.cacheBookPrefetch(payload);
          break;
        case 'cache.clear':
          request = ReaderEffects.slice10Core.cacheClear(payload);
          break;
        case 'replace.undo':
          request = ReaderEffects.slice10Core.replaceUndo(payload);
          break;
        default:
          throw new Error(`unsupported Slice 10 Core method ${method}`);
      }
    } catch (error) {
      // DTO boundary failures are deterministic; replaying the same malformed
      // event cannot repair its selector/range/token.
      ReaderEffects.reportSlice10CommandFailure(method, error, 'CORE_SLICE10_COMMAND_FAILED', false);
      return;
    }
    request.then((result: JsonObject): void => {
      ReaderUiStore.dispatch({
        type: 'core-slice10-succeeded',
        coreSlice10Method: method,
        coreSlice10Result: result as Object as ReaderUIJSONPayload,
      });
      if (method === 'replace.undo') ReaderEffects.loadReplaceRules();
    }).catch((error: Error): void => {
      ReaderEffects.reportSlice10CommandFailure(method, error);
    });
  }

  private static reportSlice10CommandFailure(method: string, error: Object,
    code: string = 'CORE_SLICE10_COMMAND_FAILED', fallbackRetryable: boolean = true): void {
    const candidate = error as ErrorMessageLike;
    const message = `${method} 执行失败：${ReaderEffects.errorMessage(error)}`;
    ReaderUiStore.dispatch({
      type: 'core-slice10-failed',
      coreSlice10Method: method,
      coreSlice10Error: message,
      error: {
        code: code,
        message: message,
        retryable: typeof candidate.retryable === 'boolean' ? candidate.retryable : fallbackRetryable,
      },
    });
  }

  // ── P1.3 WebDAV test/save effects ──
  // 测试 WebDAV 连通性：Core 生成 PROPFIND Host 请求，HarmonyOS Host
  // 真正执行网络访问。只有服务端返回 WebDAV 207 才报告连接成功。
  private static isWebdavConfigurationRoute(routeId: string): boolean {
    return routeId === 'webdav-config' || routeId === 'sync-backup';
  }

  static runWebdavTest(): void {
    const state = ReaderUiStore.snapshot();
    if (!ReaderEffects.isWebdavConfigurationRoute(state.routeId) || state.webdavTestStatus !== 'testing') return;
    const url = state.webdavServerUrl.trim();
    if (!ReaderEffects.validWebdavBaseUrl(url)) {
      ReaderUiStore.dispatch({ type: 'webdav-test-result', success: false, message: '服务器地址必须是完整的 http(s) URL' });
      return;
    }
    if ((state.webdavUsername.trim().length > 0 || state.webdavPassword.length > 0) &&
      !url.toLowerCase().startsWith('https://')) {
      ReaderUiStore.dispatch({ type: 'webdav-test-result', success: false, message: '带凭据的 WebDAV 测试必须使用 HTTPS' });
      return;
    }
    try {
      const runtime = CoreRuntime.get();
      let auth: string | undefined = undefined;
      if (state.webdavUsername.length > 0 || state.webdavPassword.length > 0) {
        const encoder = util.TextEncoder.create('utf-8');
        const credentialBytes = encoder.encodeInto(`${state.webdavUsername}:${state.webdavPassword}`);
        const base64Helper = new util.Base64Helper();
        auth = 'Basic ' + base64Helper.encodeToStringSync(credentialBytes);
      }
      const webdavRequest: JsonObject = {};
      webdavRequest['method'] = 'PROPFIND';
      webdavRequest['path'] = state.webdavSyncDir;
      webdavRequest['headers'] = [['Content-Type', 'application/xml; charset=utf-8']] as Object;
      webdavRequest['depth'] = 0;
      webdavRequest['acceptedStatusCodes'] = [207] as Object;
      runtime.syncWebdavPlan(url, auth, [webdavRequest])
        .then(async (data: JsonObject): Promise<void> => {
          const fields = data as Object as Record<string, Object[]>;
          const rawRequests: Object[] = fields['requests'];
          if (!Array.isArray(rawRequests) || rawRequests.length !== 1) {
            throw new Error('Core 未生成 WebDAV 连接测试请求');
          }
          const request = rawRequests[0] as Object as HostHttpRequest;
          const response = await runtime.getHttpAdapter().execute(request, 'webdav-connection-test');
          if (response.status !== 207) {
            throw new Error(`WebDAV 服务返回 HTTP ${response.status}，预期 207`);
          }
          const current = ReaderUiStore.snapshot();
          if (!ReaderEffects.isWebdavConfigurationRoute(current.routeId) || current.webdavTestStatus !== 'testing') return;
          ReaderUiStore.dispatch({ type: 'webdav-test-result', success: true, message: '连接成功（HTTP 207）' });
        })
        .catch((e: Error): void => {
          const current = ReaderUiStore.snapshot();
          if (!ReaderEffects.isWebdavConfigurationRoute(current.routeId) || current.webdavTestStatus !== 'testing') return;
          ReaderUiStore.dispatch({ type: 'webdav-test-result', success: false, message: e.message });
        });
    } catch (e) {
      ReaderUiStore.dispatch({ type: 'webdav-test-result', success: false, message: (e as Error).message });
    }
  }

  // 保存 WebDAV 配置：通过 Core bridge 验证连接并持久化到 persistence。
  static runWebdavSave(): void {
    const state = ReaderUiStore.snapshot();
    if (!ReaderEffects.isWebdavConfigurationRoute(state.routeId) || state.webdavSaveStatus !== 'saving') {
      ReaderUiStore.dispatch({
        type: 'webdav-save-result', success: false,
        message: 'WebDAV 保存确认已失效；请在当前配置页重新发起保存。',
      });
      return;
    }
    const url = state.webdavServerUrl.trim();
    if (!ReaderEffects.validWebdavBaseUrl(url)) {
      ReaderUiStore.dispatch({ type: 'webdav-save-result', success: false, message: '服务器地址必须是完整的 http(s) URL' });
      return;
    }
    if (!url.toLowerCase().startsWith('https://')) {
      ReaderUiStore.dispatch({ type: 'webdav-save-result', success: false, message: '持久化 WebDAV 端点必须使用 HTTPS' });
      return;
    }
    let syncDir: string;
    try {
      syncDir = ReaderEffects.normalizedWebdavDirectory(state.webdavSyncDir);
    } catch (e) {
      ReaderUiStore.dispatch({ type: 'webdav-save-result', success: false, message: ReaderEffects.errorMessage(e as Object) });
      return;
    }
    try {
      const runtime = CoreRuntime.get();
      const credential = runtime.getCredentialAdapter();
      if (credential === null) {
        ReaderUiStore.dispatch({ type: 'webdav-save-result', success: false, message: '凭据存储不可用' });
        return;
      }
      if ((state.webdavUsername.trim().length > 0 || state.webdavPassword.length > 0) &&
        !credential.supportsProtectedSecrets()) {
        ReaderUiStore.dispatch({
          type: 'webdav-save-result', success: false,
          message: '当前 Host 未接入 HUKS，带账号或密码的 WebDAV 配置禁止持久化；仍可进行本次会话连接测试。',
        });
        return;
      }
      // Keep password out of general-purpose persistence. The credential
      // adapter currently admits anonymous endpoint persistence only. Blank
      // legacy user/password values prevent an old Preferences secret from
      // silently becoming the credential for this newly saved endpoint.
      credential.set({ key: 'webdav.url', value: url })
        .then(() => credential.set({ key: 'webdav.user', value: '' }))
        .then(() => credential.set({ key: 'webdav.password', value: '' }))
        .then(() => runtime.getCoreAdapter().persistencePut({
          namespace: 'webdav',
          key: 'config',
          value: JSON.stringify({ syncDir: syncDir }),
        }))
        .then((): void => {
          ReaderUiStore.dispatch({ type: 'webdav-save-result', success: true, message: '配置已保存' });
        })
        .catch((e: Error): void => {
          ReaderUiStore.dispatch({ type: 'webdav-save-result', success: false, message: e.message });
        });
    } catch (e) {
      ReaderUiStore.dispatch({ type: 'webdav-save-result', success: false, message: (e as Error).message });
    }
  }

  static async loadWebdavConfig(): Promise<void> {
    try {
      const runtime = CoreRuntime.get();
      const credential = runtime.getCredentialAdapter();
      if (credential === null) return;
      const url = await credential.get({ key: 'webdav.url' });
      const config = await runtime.getCoreAdapter().persistenceGet({ namespace: 'webdav', key: 'config' });
      let syncDir = '/reader/backup';
      if (config.found && config.value !== undefined && config.value.length > 0) {
        const parsed = JSON.parse(config.value) as Object as Record<string, string>;
        if (typeof parsed['syncDir'] === 'string' && parsed['syncDir'].length > 0) {
          syncDir = parsed['syncDir'];
        }
      }
      ReaderUiStore.dispatch({ type: 'webdav-field-update', field: 'serverUrl', settingsValue: url.value ?? '' });
      // Preferences-backed authentication fields are not loaded into UI
      // state. Username/password are intentionally session-only until the
      // Host provides HUKS-protected secret persistence.
      ReaderUiStore.dispatch({ type: 'webdav-field-update', field: 'username', settingsValue: '' });
      ReaderUiStore.dispatch({ type: 'webdav-field-update', field: 'password', settingsValue: '' });
      ReaderUiStore.dispatch({ type: 'webdav-field-update', field: 'syncDir', settingsValue: syncDir });
    } catch (e) {
      console.info(`ReaderEffects: load WebDAV config error: ${(e as Error).message}`);
    }
  }

  // ── Core storage backup / restore ───────────────────────────────────
  // Core owns snapshot creation, checksum validation, migration, atomic
  // replacement and persistence CAS.  Harmony owns only transport: its app
  // sandbox, a user-selected document, or an explicitly configured WebDAV
  // endpoint.  Keeping these responsibilities separate prevents a page-level
  // JSON copy from ever masquerading as a verified Core backup.

  static async loadLocalCoreBackup(): Promise<void> {
    if (!CoreRuntime.isInitialized()) return;
    ReaderUiStore.dispatch({ type: 'core-backup-status', coreBackupStatus: 'loading', coreBackupMessage: '正在读取本机 Core 备份…' });
    try {
      const history = await ReaderEffects.readLocalCoreBackupHistory();
      ReaderEffects.publishLocalCoreBackupHistory(history,
        history.entries.length > 0
          ? '已读取并校验本机 Core 备份历史；可选择其中一项进行原子恢复。'
          : '当前设备尚无本机 Core 数据备份。');
      if (history.entries.length === 0 && history.invalidFileCount > 0) {
        ReaderUiStore.dispatch({
          type: 'core-backup-status',
          coreBackupStatus: 'error',
          coreBackupMessage: '本机备份目录中没有通过校验的 Core 快照。',
        });
      }
    } catch (e) {
      if (ReaderEffects.isFileNotFound(e)) {
        ReaderUiStore.dispatch({
          type: 'core-backup-history-loaded',
          coreBackupHistory: [],
          coreBackupMessage: '当前设备尚无本机 Core 数据备份。',
        });
      } else {
        // The file list is no longer trustworthy if its directory itself
        // cannot be read. Clear the AppStorage projection instead of keeping
        // a stale restore target visible.
        ReaderUiStore.dispatch({
          type: 'core-backup-history-loaded', coreBackupHistory: [], coreBackupMessage: '',
        });
        ReaderUiStore.dispatch({
          type: 'core-backup-status',
          coreBackupStatus: 'error',
          coreBackupMessage: `读取本机 Core 备份失败：${ReaderEffects.errorMessage(e)}`,
        });
      }
    }
  }

  static async createLocalCoreBackup(): Promise<void> {
    if (!ReaderEffects.canCreateCoreBackup(false)) return;
    try {
      const runtime = CoreRuntime.get();
      const envelope = await ReaderEffects.exportCoreBackupEnvelope(runtime, '本机 Core 备份');
      await ReaderEffects.writeImmutableLocalCoreBackup(envelope);
      const history = await ReaderEffects.readLocalCoreBackupHistory();
      ReaderEffects.publishLocalCoreBackupHistory(history, '本机 Core 数据备份已创建并通过 Core 清单校验。');
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'core-backup-status',
        coreBackupStatus: 'error',
        coreBackupMessage: `创建本机 Core 备份失败：${ReaderEffects.errorMessage(e)}`,
      });
    }
  }

  static async createWebdavCoreBackup(): Promise<void> {
    if (!ReaderEffects.canCreateCoreBackup(true)) return;
    try {
      const runtime = CoreRuntime.get();
      const envelope = await ReaderEffects.exportCoreBackupEnvelope(runtime, 'WebDAV Core 备份');
      // Always retain a verified local copy before a remote transport attempt.
      await ReaderEffects.writeImmutableLocalCoreBackup(envelope);
      const history = await ReaderEffects.readLocalCoreBackupHistory();
      ReaderEffects.publishLocalCoreBackupHistory(history, '本机 Core 数据备份已创建，正在上传 WebDAV。');
      await ReaderEffects.uploadCoreBackupToWebdav(runtime, envelope);
      ReaderUiStore.dispatch({
        type: 'core-backup-status',
        coreBackupStatus: 'success',
        coreBackupMessage: 'Core 数据快照已写入本机并上传到 WebDAV。',
      });
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'core-backup-status',
        coreBackupStatus: 'error',
        coreBackupMessage: `WebDAV 备份失败：${ReaderEffects.errorMessage(e)}。本机副本如已写入仍可恢复。`,
      });
    }
  }

  private static canCreateCoreBackup(remote: boolean): boolean {
    const state = ReaderUiStore.snapshot();
    if (state.routeId === 'sync-backup' && state.coreBackupStatus === 'creating') return true;
    ReaderUiStore.dispatch({
      type: 'core-backup-status',
      coreBackupStatus: 'error',
      coreBackupMessage: `备份创建已失效；请在当前同步备份页${remote ? '重新发起 WebDAV 备份' : '重新发起本机备份'}。`,
    });
    return false;
  }

  static async prepareLocalCoreRestore(requestedPath?: string): Promise<void> {
    ReaderUiStore.dispatch({ type: 'core-backup-status', coreBackupStatus: 'loading', coreBackupMessage: '正在校验本机 Core 备份…' });
    try {
      const history = await ReaderEffects.readLocalCoreBackupHistory();
      ReaderEffects.publishLocalCoreBackupHistory(history,
        history.entries.length > 0 ? '已读取并校验本机 Core 备份历史。' : '当前设备尚无本机 Core 数据备份。');
      const selected = requestedPath === undefined || requestedPath.length === 0
        ? history.entries[0]
        : ReaderEffects.findLocalCoreBackupHistoryEntry(history.entries, requestedPath);
      if (selected === undefined) {
        throw new Error(requestedPath === undefined || requestedPath.length === 0
          ? '当前设备尚无通过校验的本机 Core 备份'
          : '所选本机 Core 备份已不存在或未通过校验');
      }
      const envelope = await ReaderEffects.readCoreBackupFile(
        selected.path,
        selected.source,
      );
      if (!CoreStorageBackupHistory.immutableFileNameMatches(selected.fileName, envelope.info) ||
        !CoreStorageBackupHistory.sameInfo(envelope.info, CoreStorageBackupHistory.info(selected))) {
        throw new Error('所选本机 Core 备份在校验后已变化');
      }
      ReaderEffects.publishPreparedCoreRestore(envelope);
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'core-backup-status',
        coreBackupStatus: 'error',
        coreBackupMessage: `无法准备本机恢复：${ReaderEffects.errorMessage(e)}`,
      });
    }
  }

  /** Called only after the user selects a document through DocumentViewPicker. */
  static async prepareCoreRestoreFromUri(uri: string, displayName: string): Promise<void> {
    ReaderUiStore.dispatch({ type: 'core-backup-status', coreBackupStatus: 'loading', coreBackupMessage: '正在读取并校验所选 Core 备份…' });
    try {
      const raw = ReaderEffects.readUtf8FileUri(uri);
      const source = displayName.length > 0 ? `外部文件：${displayName}` : '外部 Core 备份文件';
      const envelope = ReaderEffects.parseCoreBackupEnvelope(raw, source);
      ReaderEffects.publishPreparedCoreRestore(envelope);
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'core-backup-status',
        coreBackupStatus: 'error',
        coreBackupMessage: `所选备份不可用：${ReaderEffects.errorMessage(e)}`,
      });
    }
  }

  static async prepareRemoteCoreRestore(): Promise<void> {
    ReaderUiStore.dispatch({ type: 'core-backup-status', coreBackupStatus: 'loading', coreBackupMessage: '正在从 WebDAV 下载 Core 备份…' });
    try {
      const runtime = CoreRuntime.get();
      const response = await ReaderEffects.downloadCoreBackupFromWebdav(runtime);
      const envelope = ReaderEffects.parseCoreBackupEnvelope(response, 'WebDAV Core 备份');
      ReaderEffects.publishPreparedCoreRestore(envelope);
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'core-backup-status',
        coreBackupStatus: 'error',
        coreBackupMessage: `无法准备 WebDAV 恢复：${ReaderEffects.errorMessage(e)}`,
      });
    }
  }

  static async applyPreparedCoreRestore(): Promise<void> {
    const selected = ReaderEffects.pendingCoreRestoreEnvelope;
    const state = ReaderUiStore.snapshot();
    if (selected === null || !ReaderEffects.hasConfirmedPreparedCoreRestore(state, selected)) {
      ReaderUiStore.dispatch({
        type: 'core-backup-status',
        coreBackupStatus: 'error',
        coreBackupMessage: '恢复确认已失效；请重新选择并校验 Core 备份后，在确认页面再次确认。',
      });
      return;
    }
    try {
      const runtime = CoreRuntime.get();
      // A completed apply replaces the complete Core store.  Save a verified
      // pre-restore snapshot first; if that cannot be written, fail closed
      // before changing any user data.
      const before = await ReaderEffects.exportCoreBackupEnvelope(runtime, '恢复前 Core 快照');
      await ReaderEffects.writeCoreBackupFile(ReaderEffects.PRE_RESTORE_CORE_BACKUP_PATH, before);
      const applied = await runtime.applyCoreStorage(selected.manifest, selected.payload);
      const appliedFields = applied as Object as Record<string, Object>;
      if (appliedFields['applied'] !== true) {
        throw new Error('Core 未确认快照已应用');
      }
      ReaderEffects.pendingCoreRestoreEnvelope = null;
      ReaderUiStore.dispatch({ type: 'core-restore-cleared', coreBackupMessage: '' });
      ReaderUiStore.dispatch({
        type: 'core-backup-status',
        coreBackupStatus: 'success',
        coreBackupMessage: 'Core 数据已原子恢复；恢复前快照已保存在本机，可用于人工回退。',
      });
      // Re-project every visible Core-owned collection after the atomic swap.
      ReaderEffects.loadBookshelf();
      ReaderEffects.loadBookGroups();
      ReaderEffects.loadAvailableSources(false);
      ReaderEffects.loadRss();
      ReaderEffects.loadReplaceRules();
      ReaderUiStore.dispatch({ type: 'route-replace', id: 'restore-result' });
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'core-backup-status',
        coreBackupStatus: 'error',
        coreBackupMessage: `Core 恢复未完成：${ReaderEffects.errorMessage(e)}`,
      });
      // Figma has no failure terminal for Overlay/Restore Backup. Return to
      // the existing Sync Backup surface with Core's actual message instead
      // of inventing a generic error dialog or leaving a false Confirm card.
      ReaderUiStore.dispatch({ type: 'route-replace', id: 'sync-backup' });
    }
  }

  private static hasConfirmedPreparedCoreRestore(state: ReaderUiState,
    selected: CoreStorageBackupEnvelope): boolean {
    const info = state.pendingCoreRestore;
    return state.routeId === 'restore-confirm' && state.coreBackupStatus === 'restoring' &&
      info !== null && state.pendingCoreRestoreConfirmationChecksum === selected.info.checksum &&
      info.source === selected.info.source && info.schemaVersion === selected.info.schemaVersion &&
      info.bytes === selected.info.bytes && info.checksum === selected.info.checksum &&
      info.exportedAt === selected.info.exportedAt;
  }

  private static rejectUnconfirmedCoreRestoreApply(): void {
    ReaderUiStore.dispatch({
      type: 'core-backup-status',
      coreBackupStatus: 'error',
      coreBackupMessage: '请先在已校验备份的确认页面发起并再次确认恢复。',
    });
  }

  private static async exportCoreBackupEnvelope(runtime: CoreRuntime, source: string): Promise<CoreStorageBackupEnvelope> {
    const data = await runtime.exportCoreStorage();
    const fields = data as Object as Record<string, Object>;
    const manifestRaw = fields['manifest'];
    const payload = fields['payload'];
    if (manifestRaw === null || typeof manifestRaw !== 'object' || Array.isArray(manifestRaw) || typeof payload !== 'string') {
      throw new Error('Core runtime.storage.export 返回格式无效');
    }
    return ReaderEffects.makeCoreBackupEnvelope(manifestRaw as JsonObject, payload, source);
  }

  /**
   * Reads only recognized snapshot filenames, then validates each candidate
   * through the same Core envelope parser used by restore. Invalid files are
   * omitted rather than converted into guessed history rows.
   */
  private static async readLocalCoreBackupHistory(): Promise<LocalCoreBackupHistoryLoad> {
    const runtime = CoreRuntime.get();
    const file = runtime.getFileAdapter();
    if (file === null) throw new Error('当前 Host 未提供本机备份文件能力');
    const listed = await file.list({ path: CoreStorageBackupHistory.DIRECTORY_PATH });
    const entries: CoreStorageBackupHistoryEntry[] = [];
    let invalidFileCount = 0;
    for (let index = 0; index < listed.entries.length; index++) {
      const listedEntry = listed.entries[index];
      if (!listedEntry.isFile || !CoreStorageBackupHistory.isCandidateFileName(listedEntry.name)) continue;
      const path = listedEntry.name === CoreStorageBackupHistory.LEGACY_FILE_NAME
        ? ReaderEffects.LOCAL_CORE_BACKUP_PATH
        : `${CoreStorageBackupHistory.DIRECTORY_PATH}/${listedEntry.name}`;
      try {
        const envelope = await ReaderEffects.readCoreBackupFile(path, '本机 Core 备份');
        if (!CoreStorageBackupHistory.immutableFileNameMatches(listedEntry.name, envelope.info)) {
          invalidFileCount += 1;
          continue;
        }
        entries.push(CoreStorageBackupHistory.entry(path, listedEntry.name, envelope.info));
      } catch (_error) {
        // Files may be truncated, corrupt, or concurrently removed. None is
        // safe to present until a later successful full parse.
        invalidFileCount += 1;
      }
    }
    return {
      entries: CoreStorageBackupHistory.sortNewestFirst(entries),
      invalidFileCount: invalidFileCount,
    };
  }

  private static publishLocalCoreBackupHistory(history: LocalCoreBackupHistoryLoad, message: string): void {
    const suffix = history.invalidFileCount > 0
      ? `；已跳过 ${history.invalidFileCount} 个未通过校验的本机快照。`
      : '';
    ReaderUiStore.dispatch({
      type: 'core-backup-history-loaded',
      coreBackupHistory: history.entries,
      coreBackupMessage: `${message}${suffix}`,
    });
  }

  private static findLocalCoreBackupHistoryEntry(entries: CoreStorageBackupHistoryEntry[],
    path: string): CoreStorageBackupHistoryEntry | undefined {
    for (let index = 0; index < entries.length; index++) {
      if (entries[index].path === path) return entries[index];
    }
    return undefined;
  }

  /**
   * New snapshots are never written to the legacy fixed filename. A collision
   * under the immutable timestamp/checksum name must already be the identical
   * snapshot; any mismatch fails closed instead of overwriting user data.
   */
  private static async writeImmutableLocalCoreBackup(envelope: CoreStorageBackupEnvelope): Promise<void> {
    const path = CoreStorageBackupHistory.pathFor(envelope.info);
    try {
      const existing = await ReaderEffects.readCoreBackupFile(path, '本机 Core 备份');
      if (!CoreStorageBackupHistory.sameSnapshot(existing.info, envelope.info) ||
        ReaderEffects.serializeCoreBackupEnvelope(existing) !== ReaderEffects.serializeCoreBackupEnvelope(envelope)) {
        throw new Error('本机 Core 备份文件名冲突；已拒绝覆盖现有快照');
      }
      return;
    } catch (e) {
      if (!ReaderEffects.isFileNotFound(e)) throw new Error(ReaderEffects.errorMessage(e));
    }
    await ReaderEffects.writeCoreBackupFile(path, envelope);
  }

  private static async readCoreBackupFile(path: string, source: string): Promise<CoreStorageBackupEnvelope> {
    const runtime = CoreRuntime.get();
    const file = runtime.getFileAdapter();
    if (file === null) throw new Error('当前 Host 未提供本机备份文件能力');
    const result = await file.read({ path: path, encoding: 'utf-8' });
    if (typeof result.content !== 'string') throw new Error('Host 未返回备份文件内容');
    return ReaderEffects.parseCoreBackupEnvelope(result.content, source);
  }

  private static async writeCoreBackupFile(path: string, envelope: CoreStorageBackupEnvelope): Promise<void> {
    const runtime = CoreRuntime.get();
    const file = runtime.getFileAdapter();
    if (file === null) throw new Error('当前 Host 未提供本机备份文件能力');
    const content = ReaderEffects.serializeCoreBackupEnvelope(envelope);
    const result = await file.writeAtomic({ path: path, content: content, encoding: 'utf-8', createDirectories: true });
    if (result.written !== true) throw new Error('Host 未确认备份文件写入成功');
  }

  private static publishPreparedCoreRestore(envelope: CoreStorageBackupEnvelope): void {
    ReaderEffects.pendingCoreRestoreEnvelope = envelope;
    ReaderUiStore.dispatch({
      type: 'core-restore-prepared',
      coreBackupInfo: envelope.info,
      coreBackupMessage: '备份已通过格式与字节长度校验；确认后由 Core 校验 SHA-256、迁移并原子应用。',
    });
    ReaderUiStore.dispatch({ type: 'route-push', id: 'restore-confirm' });
  }

  private static makeCoreBackupEnvelope(manifest: JsonObject, payload: string, source: string): CoreStorageBackupEnvelope {
    const fields = manifest as Object as Record<string, Object>;
    const schemaVersion = fields['schemaVersion'];
    const bytes = fields['bytes'];
    const checksum = fields['checksum'];
    const exportedAt = fields['exportedAt'];
    if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 0 ||
      typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes <= 0 ||
      typeof checksum !== 'string' || !new RegExp('^[0-9a-f]{64}$').test(checksum) ||
      typeof exportedAt !== 'number' || !Number.isInteger(exportedAt) || exportedAt < 0 ||
      payload.length === 0) {
      throw new Error('Core 备份清单格式无效');
    }
    const encoder = util.TextEncoder.create('utf-8');
    const actualBytes = encoder.encodeInto(payload).length;
    if (actualBytes !== bytes) {
      throw new Error(`Core 备份字节长度不匹配（清单 ${bytes}，实际 ${actualBytes}）`);
    }
    const info: CoreStorageBackupInfo = {
      source: source,
      schemaVersion: schemaVersion,
      bytes: bytes,
      checksum: checksum,
      exportedAt: exportedAt,
    };
    return { manifest: manifest, payload: payload, info: info };
  }

  private static parseCoreBackupEnvelope(raw: string, source: string): CoreStorageBackupEnvelope {
    let value: Object;
    try {
      value = JSON.parse(raw) as Object;
    } catch (e) {
      throw new Error('备份文件不是有效 JSON');
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('备份文件根节点必须是对象');
    }
    const fields = value as Record<string, Object>;
    if (fields['format'] !== 'reader-core-storage-backup' || fields['formatVersion'] !== 1) {
      throw new Error('不是受支持的 Reader Core 备份格式');
    }
    const manifest = fields['manifest'];
    const payload = fields['payload'];
    if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest) || typeof payload !== 'string') {
      throw new Error('备份文件缺少 manifest 或 payload');
    }
    return ReaderEffects.makeCoreBackupEnvelope(manifest as JsonObject, payload, source);
  }

  private static serializeCoreBackupEnvelope(envelope: CoreStorageBackupEnvelope): string {
    const data: JsonObject = {};
    data['format'] = 'reader-core-storage-backup';
    data['formatVersion'] = 1;
    data['manifest'] = envelope.manifest;
    data['payload'] = envelope.payload;
    return JSON.stringify(data);
  }

  private static readUtf8FileUri(uri: string): string {
    const handle = fs.openSync(uri, fs.OpenMode.READ_ONLY);
    try {
      const stat = fs.statSync(handle.fd);
      if (stat.size <= 0) throw new Error('备份文件为空');
      const buffer = new ArrayBuffer(stat.size);
      fs.readSync(handle.fd, buffer);
      const decoder = util.TextDecoder.create('utf-8');
      return decoder.decodeToString(new Uint8Array(buffer));
    } finally {
      fs.closeSync(handle);
    }
  }

  private static async uploadCoreBackupToWebdav(runtime: CoreRuntime, envelope: CoreStorageBackupEnvelope): Promise<void> {
    const state = ReaderUiStore.snapshot();
    const baseUrl = state.webdavServerUrl.trim();
    if (baseUrl.length === 0) throw new Error('请先保存 WebDAV 服务器地址');
    if (!ReaderEffects.validWebdavBaseUrl(baseUrl) || !baseUrl.toLowerCase().startsWith('https://')) {
      throw new Error('WebDAV Core 备份要求不含用户信息的 HTTPS 端点');
    }
    const directory = ReaderEffects.normalizedWebdavDirectory(state.webdavSyncDir);
    const remotePath = `${directory}/${ReaderEffects.REMOTE_CORE_BACKUP_FILE}`;
    const uploadText = ReaderEffects.serializeCoreBackupEnvelope(envelope);
    const requests: JsonObject[] = [];
    if (directory.length > 0) {
      requests.push(ReaderEffects.webdavRequest('MKCOL', directory, '', [201, 405]));
    }
    requests.push(ReaderEffects.webdavRequest('PUT', remotePath, uploadText, [200, 201, 204]));
    const planned = await runtime.syncWebdavPlan(baseUrl, ReaderEffects.webdavAuthorization(), requests);
    const fields = planned as Object as Record<string, Object>;
    const rawRequests = fields['requests'];
    if (!Array.isArray(rawRequests) || rawRequests.length !== requests.length) {
      throw new Error('Core 未生成完整 WebDAV 备份请求');
    }
    for (let index = 0; index < rawRequests.length; index++) {
      const request = rawRequests[index] as HostHttpRequest;
      const response = await runtime.getHttpAdapter().execute(request, `core-backup-upload-${index}-${Date.now()}`);
      const accepted = index === 0 && directory.length > 0 ? [201, 405] : [200, 201, 204];
      if (accepted.indexOf(response.status) < 0) {
        throw new Error(`WebDAV ${request.method} 返回 HTTP ${response.status}`);
      }
    }
  }

  private static async downloadCoreBackupFromWebdav(runtime: CoreRuntime): Promise<string> {
    const state = ReaderUiStore.snapshot();
    const baseUrl = state.webdavServerUrl.trim();
    if (baseUrl.length === 0) throw new Error('请先保存 WebDAV 服务器地址');
    if (!ReaderEffects.validWebdavBaseUrl(baseUrl) || !baseUrl.toLowerCase().startsWith('https://')) {
      throw new Error('WebDAV Core 恢复要求不含用户信息的 HTTPS 端点');
    }
    const remotePath = `${ReaderEffects.normalizedWebdavDirectory(state.webdavSyncDir)}/${ReaderEffects.REMOTE_CORE_BACKUP_FILE}`;
    const descriptor = ReaderEffects.webdavRequest('GET', remotePath, '', [200]);
    const planned = await runtime.syncWebdavPlan(baseUrl, ReaderEffects.webdavAuthorization(), [descriptor]);
    const fields = planned as Object as Record<string, Object>;
    const rawRequests = fields['requests'];
    if (!Array.isArray(rawRequests) || rawRequests.length !== 1) throw new Error('Core 未生成 WebDAV 下载请求');
    const response = await runtime.getHttpAdapter().execute(rawRequests[0] as HostHttpRequest, `core-backup-download-${Date.now()}`);
    if (response.status !== 200) throw new Error(`WebDAV GET 返回 HTTP ${response.status}`);
    return response.body;
  }

  private static normalizedWebdavDirectory(value: string): string {
    let directory = value.trim();
    while (directory.endsWith('/')) directory = directory.substring(0, directory.length - 1);
    if (directory.length === 0) throw new Error('WebDAV 同步目录不能为空');
    return directory;
  }

  private static validWebdavBaseUrl(value: string): boolean {
    const normalized = value.trim();
    const lower = normalized.toLowerCase();
    if ((!lower.startsWith('https://') && !lower.startsWith('http://')) ||
      normalized.indexOf(' ') >= 0 || normalized.indexOf('\n') >= 0 || normalized.indexOf('\r') >= 0) return false;
    const schemeEnd = normalized.indexOf('://');
    const authorityStart = schemeEnd + 3;
    const authorityEndCandidate = normalized.indexOf('/', authorityStart);
    const authorityEnd = authorityEndCandidate < 0 ? normalized.length : authorityEndCandidate;
    const authority = normalized.substring(authorityStart, authorityEnd);
    return authority.length > 0 && authority.indexOf('@') < 0;
  }

  private static webdavAuthorization(): string | undefined {
    const state = ReaderUiStore.snapshot();
    if (state.webdavUsername.length === 0 && state.webdavPassword.length === 0) return undefined;
    const encoder = util.TextEncoder.create('utf-8');
    const bytes = encoder.encodeInto(`${state.webdavUsername}:${state.webdavPassword}`);
    const base64 = new util.Base64Helper();
    return 'Basic ' + base64.encodeToStringSync(bytes);
  }

  private static webdavRequest(method: string, path: string, body: string, accepted: number[]): JsonObject {
    const request: JsonObject = {};
    request['method'] = method;
    request['path'] = path;
    request['headers'] = [['Content-Type', 'application/json; charset=utf-8']] as Object;
    request['acceptedStatusCodes'] = accepted as Object;
    if (body.length > 0) {
      const bytes = util.TextEncoder.create('utf-8').encodeInto(body);
      const encoded: number[] = [];
      for (let index = 0; index < bytes.length; index++) encoded.push(bytes[index]);
      request['body'] = encoded as Object;
    }
    return request;
  }

  private static errorMessage(error: Object): string {
    const candidate = error as ErrorMessageLike;
    if (typeof candidate.message === 'string' && candidate.message.length > 0) return candidate.message;
    return String(error);
  }

  private static isFileNotFound(error: Object): boolean {
    const message = ReaderEffects.errorMessage(error).toLowerCase();
    return message.indexOf('not found') >= 0 || message.indexOf('not exist') >= 0 ||
      message.indexOf('no such file') >= 0 || message.indexOf('不存在') >= 0;
  }

  // ── W1 local import ──────────────────────────────────────────────────
  // Reads a local book file (selected via DocumentViewPicker) and passes its
  // original bytes to Core local_book.parse. The host must not UTF-8-decode a
  // TXT before Core sees it: Core owns GBK/GB18030/UTF-16 detection and the
  // enabled TxtTocRule projection. On success, dispatches Core-observed
  // format, encoding, and chapter count for the preview.
  static runLocalImport(uri: string, fileName: string): void {
    const state = ReaderUiStore.snapshot();
    if (state.routeId !== 'local-import') {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: { code: 'IMPORT_ROUTE_REQUIRED', message: '请在当前本地导入页选择文件。', retryable: false },
      });
      return;
    }
    const formatDecision = LocalBookFormatPolicy.decide(fileName);
    if (formatDecision.admission === 'unsupported') {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: {
          code: 'IMPORT_FORMAT_UNSUPPORTED',
          message: '不支持该文件格式。请选择 TXT、EPUB、PDF、MOBI 或 UMD 文件。',
          retryable: false,
        },
      });
      return;
    }
    if (formatDecision.admission === 'protocol-required') {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: {
          code: 'IMPORT_FORMAT_PROTOCOL_REQUIRED',
          message: LocalBookFormatPolicy.protocolRequiredMessage(formatDecision.format),
          retryable: false,
        },
      });
      return;
    }
    const epoch = Math.max(ReaderEffects.localImportParseEpoch + 1, state.localImportEpoch + 1);
    ReaderEffects.localImportParseEpoch = epoch;
    ReaderEffects.pendingImportedBook = null;
    ReaderEffects.pendingLocalBookId = '';
    ReaderEffects.pendingLocalBookOptions = null;
    ReaderEffects.pendingLocalImportEpoch = 0;
    ReaderUiStore.dispatch({ type: 'local-import-parse-start', localImportEpoch: epoch });
    const format = formatDecision.format;
    try {
      const file = fs.openSync(uri, fs.OpenMode.READ_ONLY);
      try {
        const stat = fs.statSync(file.fd);
        const size = stat.size;
        if (size === 0) {
          ReaderUiStore.dispatch({
            type: 'set-error',
            error: { code: 'IMPORT_EMPTY_FILE', message: '文件为空', retryable: false },
          });
          return;
        }
        const buffer = new ArrayBuffer(size);
        fs.readSync(file.fd, buffer);
        const bytes = new Uint8Array(buffer);
        const options: LocalBookParseOptions = {
          fileName: fileName,
          format: format,
        };
        // Every format, including TXT, keeps the original byte sequence.
        // `local_book.import` receives the same pending options after the
        // preview confirmation, so parse/import use the exact same encoding
        // detection and enabled TXT chapter-rule set.
        const base64Helper = new util.Base64Helper();
        options.bytesBase64 = base64Helper.encodeToStringSync(bytes);
        const runtime = CoreRuntime.get();
        const bookId = `local-${Date.now()}`;
        runtime.localBookParse(bookId, options).then((data: JsonObject): void => {
          if (!ReaderEffects.isCurrentLocalImportParse(epoch)) return;
          const fields = data as Object as Record<string, Object>;
          const parsedBookValue: Object = fields['book'];
          if (parsedBookValue === null || typeof parsedBookValue !== 'object' || Array.isArray(parsedBookValue)) {
            throw new Error('Core local_book.parse 未返回有效 book');
          }
          const parsedBook = parsedBookValue as Object as JsonObject;
          parsedBook['sourceId'] = 'local';
          ReaderEffects.pendingImportedBook = parsedBook;
          ReaderEffects.pendingLocalBookId = bookId;
          ReaderEffects.pendingLocalBookOptions = options;
          ReaderEffects.pendingLocalImportEpoch = epoch;
          const chapterCount = ReaderEffects.getNumber(data, 'chapterCount', 0);
          const parsedFormat = ReaderEffects.getString(data, 'format', format);
          const parsedEncoding = ReaderEffects.getString(data, 'encoding', '');
          ReaderUiStore.dispatch({
            type: 'source.import.preview',
            importFormat: parsedFormat,
            importEncoding: parsedEncoding,
            importCount: chapterCount,
            localImportEpoch: epoch,
          });
        }).catch((e: Error): void => {
          if (!ReaderEffects.isCurrentLocalImportParse(epoch)) return;
          ReaderUiStore.dispatch({
            type: 'set-error',
            error: { code: 'IMPORT_PARSE_FAILED', message: e.message, retryable: true },
          });
        });
      } finally {
        fs.closeSync(file);
      }
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: { code: 'IMPORT_READ_FAILED', message: (e as Error).message, retryable: false },
      });
    }
  }

  // Detect import format from file extension. The actual decision is owned by
  // LocalBookFormatPolicy above so unknown/PDF/MOBI/UMD inputs fail closed.
  // Commit the parsed book to Core's durable bookshelf. The route is popped
  // only after Core confirms the upsert, so a failed write cannot masquerade
  // as a successful import.
  static commitLocalImport(importCount: number): void {
    const book = ReaderEffects.pendingImportedBook;
    const bookId = ReaderEffects.pendingLocalBookId;
    const options = ReaderEffects.pendingLocalBookOptions;
    const epoch = ReaderUiStore.snapshot().localImportEpoch;
    if (!ReaderEffects.isCurrentLocalImportCommit(epoch, importCount, book, bookId, options)) {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: {
          code: 'IMPORT_NOT_PARSED',
          message: '本地书导入确认已失效；请在当前导入页重新解析后再提交。',
          retryable: false,
        },
      });
      return;
    }
    if (book === null || options === null) {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: {
          code: 'IMPORT_NOT_PARSED',
          message: '本地书导入确认已失效；请在当前导入页重新解析后再提交。',
          retryable: false,
        },
      });
      return;
    }
    try {
      const runtime = CoreRuntime.get();
      runtime.localBookImport(bookId, options).then((data: JsonObject): Promise<JsonObject> => {
        if (!ReaderEffects.isCurrentLocalImportCommit(epoch, importCount,
          ReaderEffects.pendingImportedBook, ReaderEffects.pendingLocalBookId, ReaderEffects.pendingLocalBookOptions)) {
          throw new Error('本地书导入已取消。');
        }
        const fields = data as Object as Record<string, Object>;
        const materializedBookValue: Object = fields['book'];
        if (materializedBookValue === null || typeof materializedBookValue !== 'object' ||
          Array.isArray(materializedBookValue)) {
          throw new Error('Core local_book.import 未返回有效 book');
        }
        const materializedBook = materializedBookValue as Object as JsonObject;
        materializedBook['sourceId'] = 'local';
        ReaderEffects.pendingImportedBook = materializedBook;
        if (!ReaderEffects.isCurrentLocalImportCommit(epoch, importCount,
          ReaderEffects.pendingImportedBook, ReaderEffects.pendingLocalBookId, ReaderEffects.pendingLocalBookOptions)) {
          throw new Error('本地书导入已取消。');
        }
        return runtime.bookshelfAdd(materializedBook);
      }).then((): void => {
        ReaderEffects.pendingImportedBook = null;
        ReaderEffects.pendingLocalBookId = '';
        ReaderEffects.pendingLocalBookOptions = null;
        ReaderEffects.pendingLocalImportEpoch = 0;
        ReaderUiStore.dispatch({ type: 'source-import-committed', importCount: importCount });
        ReaderEffects.loadBookshelf();
      }).catch((e: Error): void => {
        ReaderUiStore.dispatch({
          type: 'set-error',
          error: { code: 'IMPORT_STORE_FAILED', message: e.message, retryable: true },
        });
      });
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: { code: 'IMPORT_STORE_FAILED', message: (e as Error).message, retryable: true },
      });
    }
  }

  /**
   * Confirmed production flow: open the platform document picker with
   * multi-selection, retain the invoking screen, then show only an in-place
   * loading/result dialog. The coordinator owns Core import + bookshelf
   * persistence; this method owns picker/overlay admission only.
   */
  static startLocalImportFromSystemPicker(): void {
    const initial = ReaderUiStore.snapshot();
    if (ReaderEffects.localImportPickerInFlight || initial.overlay !== '') return;
    if (!CoreRuntime.isInitialized()) {
      ReaderEffects.showLocalImportFeedback('本地导入暂不可用，请稍后重试。');
      return;
    }
    const picker = CoreRuntime.get().getFileSelectionAdapter();
    if (picker === null) {
      ReaderEffects.showLocalImportFeedback('系统文件选择不可用，请稍后重试。');
      return;
    }
    ReaderEffects.localImportPickerInFlight = true;
    const originRoute = initial.routeId;
    ReaderEffects.runLocalImportPicker(originRoute);
  }

  private static async runLocalImportPicker(originRoute: string): Promise<void> {
    try {
      const picker = CoreRuntime.get().getFileSelectionAdapter();
      if (picker === null) {
        ReaderEffects.showLocalImportFeedback('系统文件选择不可用，请稍后重试。');
        return;
      }
      const selected = await picker.select(ReaderEffects.LOCAL_IMPORT_PICKER_MIME_TYPES, true);
      // Cancelling the system picker is not an error and must leave the
      // invoking screen unchanged.
      if (!selected.selected || selected.files.length === 0) return;
      const beforeBatch = ReaderUiStore.snapshot();
      if (beforeBatch.routeId !== originRoute || beforeBatch.overlay !== '') return;

      const onBatchStarted = (epoch: number, files: ReaderSelectedFile[]): void => {
          ReaderUiStore.dispatch({
            type: 'local-import-dialog-loading',
            localImportDialogEpoch: epoch,
            localImportDialogResults: [],
          });
      };
      // Do not surface per-file progress: the approved Importing variant has
      // one spinner only. The terminal outcomes arrive together in Result.
      const completion = ReaderEffects.localImportBatch.start(selected.files, onBatchStarted);
      const epoch = ReaderEffects.localImportBatch.currentEpoch();
      if (epoch <= 0) {
        ReaderEffects.showLocalImportFeedback('未能开始导入，请重新选择文件。');
        return;
      }
      const result = await completion;
      const current = ReaderUiStore.snapshot();
      if (result.cancelled || result.stale || current.overlay !== 'local-import' ||
        current.localImportDialogPhase !== 'loading' || current.localImportDialogEpoch !== result.epoch ||
        result.results.length === 0) {
        return;
      }
      ReaderUiStore.dispatch({
        type: 'local-import-dialog-result',
        localImportDialogEpoch: result.epoch,
        localImportDialogResults: ReaderEffects.localImportDialogResults(result.epoch, selected.files, result.results),
      });
      for (let index = 0; index < result.results.length; index += 1) {
        if (result.results[index].status === 'success') {
          ReaderEffects.loadBookshelf();
          break;
        }
      }
    } catch (e) {
      // Picker/service failures do not have a separate approved page state.
      // Reuse the app's existing transient system feedback and preserve the
      // invoking page rather than turning it into a global error screen.
      ReaderEffects.showLocalImportFeedback(`本地导入未开始：${ReaderEffects.errorMessage(e)}`);
    } finally {
      ReaderEffects.localImportPickerInFlight = false;
    }
  }

  private static localImportDialogRow(epoch: number, index: number, file: ReaderSelectedFile): LocalImportDialogResult {
    return {
      id: `local-import-${epoch}-${index}`,
      fileName: file.name,
      // This value is overwritten before Result is shown. Keeping a terminal
      // default makes the DTO valid without exposing an internal progress row.
      status: 'failure',
    };
  }

  private static localImportDialogResults(epoch: number, files: ReaderSelectedFile[],
    results: LocalBookImportBatchFileResult[]): LocalImportDialogResult[] {
    const rows: LocalImportDialogResult[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const row = ReaderEffects.localImportDialogRow(epoch, index, files[index]);
      const outcome = results[index];
      row.status = outcome !== undefined && outcome.status === 'success' ? 'success' : 'failure';
      rows.push(row);
    }
    return rows;
  }

  private static showLocalImportFeedback(message: string): void {
    try {
      promptAction.showToast({ message: message, duration: 1800 });
    } catch (e) {
      console.info(`ReaderEffects: local import feedback unavailable: ${ReaderEffects.errorMessage(e)}`);
    }
  }

  private static isCurrentLocalImportParse(epoch: number): boolean {
    const state = ReaderUiStore.snapshot();
    return state.routeId === 'local-import' && state.loading && state.localImportEpoch === epoch;
  }

  private static isCurrentLocalImportCommit(epoch: number, importCount: number, book: JsonObject | null,
    bookId: string, options: LocalBookParseOptions | null): boolean {
    const state = ReaderUiStore.snapshot();
    return state.routeId === 'local-import' && state.loading &&
      state.importPreviewFormat.trim().length > 0 && importCount >= 0 &&
      importCount === state.importPreviewCount && state.localImportEpoch === epoch &&
      ReaderEffects.pendingLocalImportEpoch === epoch && book !== null && bookId.length > 0 && options !== null;
  }

  static loadBookshelf(): void {
    // Direct VM initial-route launches can reduce before EntryAbility has
    // initialized the NAPI runtime. Startup hydration replays this load once
    // Core is live, so do not surface a false initialization error.
    if (!CoreRuntime.isInitialized()) return;
    // Keep the continue card independent of the visible shelf's current
    // group/sort. It gets its own `hasReadingProgress + lastReadAt` query.
    ReaderEffects.loadContinueReading();
    const state = ReaderUiStore.snapshot();
    const params: JsonObject = {};
    if (state.bookshelfFilter.group !== 'all') {
      params['group'] = state.bookshelfFilter.group;
    }
    switch (state.bookshelfFilter.sort) {
      case 'title':
        params['sortBy'] = 'title';
        params['sortDirection'] = 'ascending';
        break;
      case 'author':
        params['sortBy'] = 'author';
        params['sortDirection'] = 'ascending';
        break;
      case 'progress':
      case 'recent':
        params['sortBy'] = 'lastReadAt';
        params['sortDirection'] = 'descending';
        break;
      default:
        params['sortBy'] = 'manual';
        params['sortDirection'] = 'ascending';
        break;
    }
    params['offset'] = 0;
    try {
      CoreRuntime.get().executeCoreMethod('bookshelf.list', params, 5000).then((data: JsonObject): void => {
        const arrayFields = data as Object as Record<string, Object[]>;
        const rawBooks: Object[] = arrayFields['books'];
        const books: CoreBookshelfBook[] = [];
        if (Array.isArray(rawBooks)) {
          for (let i = 0; i < rawBooks.length; i++) {
            const raw = rawBooks[i] as Object as JsonObject;
            const book = ReaderEffects.mapCoreBookshelfBook(raw);
            if (book !== null) books.push(book);
          }
        }
        ReaderUiStore.dispatch({ type: 'bookshelf-list-loaded', bookshelfBooks: books });
      }).catch((e: Error): void => {
        ReaderUiStore.dispatch({
          type: 'set-error',
          error: { code: 'BOOKSHELF_LIST_FAILED', message: e.message, retryable: true },
        });
      });
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: { code: 'BOOKSHELF_LIST_FAILED', message: (e as Error).message, retryable: true },
      });
    }
  }

  private static mapCoreBookshelfBook(raw: JsonObject): CoreBookshelfBook | null {
    const sourceId = ReaderEffects.getString(raw, 'sourceId').trim();
    const bookId = ReaderEffects.getString(raw, 'bookId').trim();
    if (sourceId.length === 0 || bookId.length === 0) return null;
    const lastReadAt = ReaderEffects.getNumber(raw, 'lastReadAt', 0);
    const result: CoreBookshelfBook = {
      sourceId: sourceId,
      bookId: bookId,
      title: ReaderEffects.getString(raw, 'title', '未命名'),
      author: ReaderEffects.getString(raw, 'author', '未知作者'),
      coverUrl: ReaderEffects.getString(raw, 'coverUrl'),
      intro: ReaderEffects.getString(raw, 'intro'),
      kind: ReaderEffects.getString(raw, 'kind'),
      lastChapter: ReaderEffects.getString(raw, 'lastChapter'),
      group: ReaderEffects.getString(raw, 'group'),
    };
    if (Number.isFinite(lastReadAt) && lastReadAt > 0) result.lastReadAt = Math.floor(lastReadAt);
    return result;
  }

  // The continue card is not a visual alias for the first visible shelf row.
  // Core filters to durable progress rows and sorts globally by last read time;
  // the exact progress DTO is then rechecked by composite source/book identity.
  static loadContinueReading(): void {
    if (!CoreRuntime.isInitialized()) return;
    const sequence = ReaderEffects.continueReadingRequestSequence + 1;
    ReaderEffects.continueReadingRequestSequence = sequence;
    const params: JsonObject = {};
    params['sortBy'] = 'lastReadAt';
    params['sortDirection'] = 'descending';
    params['hasReadingProgress'] = true;
    params['offset'] = 0;
    params['limit'] = 1;
    const publish = (book: CoreBookshelfBook | null, error: string = ''): void => {
      if (sequence !== ReaderEffects.continueReadingRequestSequence) return;
      ReaderUiStore.dispatch({
        type: 'continue-reading-loaded',
        continueReadingBook: book,
        continueReadingError: error,
      });
    };
    try {
      const runtime = CoreRuntime.get();
      runtime.executeCoreMethod('bookshelf.list', params, 5000).then((data: JsonObject): Promise<CoreBookshelfBook | null> => {
        if (sequence !== ReaderEffects.continueReadingRequestSequence) return Promise.resolve(null);
        const fields = data as Object as Record<string, Object[]>;
        const rows = fields['books'];
        if (!Array.isArray(rows) || rows.length === 0) return Promise.resolve(null);
        const first = rows[0];
        if (first === null || typeof first !== 'object' || Array.isArray(first)) return Promise.resolve(null);
        const candidate = ReaderEffects.mapCoreBookshelfBook(first as JsonObject);
        if (candidate === null || (candidate.lastReadAt ?? 0) <= 0) return Promise.resolve(null);
        return runtime.readingProgressGet(candidate.bookId, candidate.sourceId).then((progressData: JsonObject): CoreBookshelfBook | null => {
          if (sequence !== ReaderEffects.continueReadingRequestSequence) return null;
          const progressFields = progressData as Object as Record<string, Object>;
          if (progressFields['found'] !== true) return null;
          const rawProgress = progressFields['progress'];
          if (rawProgress === null || rawProgress === undefined || typeof rawProgress !== 'object' ||
            Array.isArray(rawProgress)) return null;
          const progress = rawProgress as Object as JsonObject;
          if (ReaderEffects.getString(progress, 'bookId') !== candidate.bookId ||
            ReaderEffects.getString(progress, 'sourceId') !== candidate.sourceId) return null;
          return candidate;
        });
      }).then((book: CoreBookshelfBook | null): void => {
        publish(book);
      }).catch((e: Error): void => {
        publish(null, `继续阅读暂不可用：${e.message}`);
      });
    } catch (e) {
      publish(null, `继续阅读暂不可用：${(e as Error).message}`);
    }
  }

  // ── Bookmark Core vertical ──────────────────────────────────────────
  // Core Bookmark V1 intentionally filters by (bookName, bookAuthor), not
  // sourceId/bookId.  Every operation below preserves that boundary: no
  // source-local index is fabricated in ArkTS, and jumping uses the source of
  // the book currently open in the reader.

  static loadBookmarksForCurrentBook(): void {
    const state = ReaderUiStore.snapshot();
    const book = state.currentBook;
    if (book === null) {
      // This is a real empty state: no book means there is no pair that Core's
      // Bookmark V1 can filter on. Do not issue an unfiltered global query.
      ReaderUiStore.dispatch({ type: 'bookmark-list-loaded', bookmarks: [] });
      return;
    }
    const bookName = book.title;
    const bookAuthor = book.author;
    if (bookName.trim().length === 0 || bookAuthor.trim().length === 0) {
      ReaderUiStore.dispatch({
        type: 'bookmark-list-failed',
        bookmarkError: '当前书籍缺少标题或作者；Core bookmark.list 只能按完整的书名和作者对查询。',
      });
      return;
    }
    if (!CoreRuntime.isInitialized()) return;
    const sequence = ReaderEffects.bookmarkRequestSequence + 1;
    ReaderEffects.bookmarkRequestSequence = sequence;
    ReaderUiStore.dispatch({ type: 'bookmark-list-start' });
    try {
      CoreRuntime.get().bookmarkList(bookName, bookAuthor).then((data: JsonObject): void => {
        const latest = ReaderUiStore.snapshot().currentBook;
        // Bookmark DTOs lack a sourceId. The title/author pair is the exact
        // Core identity, so it is also the only safe stale-response guard.
        if (sequence !== ReaderEffects.bookmarkRequestSequence || latest === null ||
          latest.title !== book.title || latest.author !== book.author) {
          return;
        }
        ReaderUiStore.dispatch({
          type: 'bookmark-list-loaded',
          bookmarks: ReaderEffects.mapCoreBookmarks(data),
        });
      }).catch((e: Error): void => {
        if (sequence !== ReaderEffects.bookmarkRequestSequence) return;
        ReaderUiStore.dispatch({ type: 'bookmark-list-failed', bookmarkError: e.message });
      });
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'bookmark-list-failed', bookmarkError: (e as Error).message,
      });
    }
  }

  static mapCoreBookmarks(data: JsonObject): CoreBookmark[] {
    const fields = data as Object as Record<string, Object[]>;
    const rawBookmarks: Object[] = fields['bookmarks'];
    const bookmarks: CoreBookmark[] = [];
    if (!Array.isArray(rawBookmarks)) return bookmarks;
    for (let i = 0; i < rawBookmarks.length; i++) {
      const rawValue = rawBookmarks[i];
      if (rawValue === null || typeof rawValue !== 'object' || Array.isArray(rawValue)) continue;
      const raw = rawValue as JsonObject;
      const time = ReaderEffects.getNumber(raw, 'time', -1);
      const chapterIndex = ReaderEffects.getNumber(raw, 'chapterIndex', -1);
      const chapterPos = ReaderEffects.getNumber(raw, 'chapterPos', -1);
      if (!Number.isFinite(time) || time < 0 || !Number.isFinite(chapterIndex) || chapterIndex < 0 ||
        !Number.isFinite(chapterPos) || chapterPos < 0) {
        continue;
      }
      bookmarks.push({
        time: Math.floor(time),
        bookName: ReaderEffects.getString(raw, 'bookName'),
        bookAuthor: ReaderEffects.getString(raw, 'bookAuthor'),
        chapterIndex: Math.floor(chapterIndex),
        chapterPos: Math.floor(chapterPos),
        chapterName: ReaderEffects.getString(raw, 'chapterName'),
        bookText: ReaderEffects.getString(raw, 'bookText'),
        content: ReaderEffects.getString(raw, 'content'),
      });
    }
    return bookmarks;
  }

  private static createCurrentBookmark(): void {
    const state = ReaderUiStore.snapshot();
    const book = state.currentBook;
    const identity = state.activeReaderContentIdentity;
    if (!ReaderEffects.isBookmarkCreateRoute(state.routeId) || !state.bookmarksLoading || book === null ||
      identity === null || !ReaderEffects.isCurrentReadingIdentity(state, identity)) {
      ReaderEffects.reportBookmarkOperationFailure('请在当前已加载正文的阅读器中创建书签。');
      return;
    }
    const bookName = book.title;
    const bookAuthor = book.author;
    if (bookName.trim().length === 0 || bookAuthor.trim().length === 0) {
      ReaderEffects.reportBookmarkOperationFailure(
        '当前书籍缺少标题或作者；Core bookmark.create 不能建立可查询的书签。',
      );
      return;
    }
    const chapterIndex = identity.chapterIndex;
    const chapterName = ReaderEffects.currentBookmarkChapterName(state, chapterIndex);
    const chapterText = state.chapterContent.join('\n');
    if (chapterIndex < 0 || chapterName.length === 0 || chapterText.trim().length === 0) {
      ReaderEffects.reportBookmarkOperationFailure(
        '当前章节的 Core 目录或正文尚未就绪，不能用示例位置创建书签。',
      );
      return;
    }
    let chapterPos = 0;
    const location = state.canonicalReaderLocation;
    if (location !== null && location.bookId === book.bookId && location.chapterIndex === chapterIndex &&
      Number.isFinite(location.chapterOffset) && location.chapterOffset >= 0) {
      chapterPos = Math.floor(location.chapterOffset);
    }
    const input: CoreBookmarkCreateInput = {
      bookName: bookName,
      bookAuthor: bookAuthor,
      chapterIndex: chapterIndex,
      chapterPos: chapterPos,
      chapterName: chapterName,
      // `bookText` is an actual current-chapter excerpt centered around Core's
      // canonical character offset. `content` is explicitly empty because
      // this one-tap action has no user-note editor to invent a comment.
      bookText: ReaderEffects.bookmarkExcerpt(chapterText, chapterPos),
      content: '',
    };
    const inFlightKey = `${identity.bookId}|${identity.sourceId}|${chapterIndex}|${chapterPos}`;
    if (ReaderEffects.bookmarkCreateInFlightKey.length > 0) return;
    ReaderEffects.bookmarkCreateInFlightKey = inFlightKey;
    try {
      CoreRuntime.get().bookmarkCreate(input).then((): void => {
        if (ReaderEffects.bookmarkCreateInFlightKey === inFlightKey) {
          ReaderEffects.bookmarkCreateInFlightKey = '';
        }
        const latest = ReaderUiStore.snapshot().currentBook;
        const latestIdentity = ReaderUiStore.snapshot().activeReaderContentIdentity;
        if (latest !== null && latestIdentity !== null && latestIdentity.bookId === identity.bookId &&
          latestIdentity.sourceId === identity.sourceId && latest.title === book.title && latest.author === book.author) {
          ReaderEffects.loadBookmarksForCurrentBook();
        }
      }).catch((e: Error): void => {
        if (ReaderEffects.bookmarkCreateInFlightKey === inFlightKey) {
          ReaderEffects.bookmarkCreateInFlightKey = '';
        }
        ReaderEffects.reportBookmarkOperationFailure(`创建书签失败：${e.message}`);
      });
    } catch (e) {
      if (ReaderEffects.bookmarkCreateInFlightKey === inFlightKey) {
        ReaderEffects.bookmarkCreateInFlightKey = '';
      }
      ReaderEffects.reportBookmarkOperationFailure(`创建书签失败：${(e as Error).message}`);
    }
  }

  private static isBookmarkCreateRoute(routeId: string): boolean {
    return routeId === 'immersive-reading' || routeId === 'reader' || routeId === 'reader_content';
  }

  private static currentBookmarkChapterIndex(state: ReaderUiState,
    book: BookDetail): number {
    const location = state.canonicalReaderLocation;
    if (location !== null && location.bookId === book.bookId && location.chapterIndex >= 0) {
      return location.chapterIndex;
    }
    for (let i = 0; i < state.chapterToc.length; i++) {
      if (state.chapterToc[i].title === state.currentChapterTitle) return state.chapterToc[i].index;
    }
    const sourceId = book.sourceId ?? '';
    if (ReaderEffects.currentBookId === book.bookId && ReaderEffects.currentChapterIndex >= 0 &&
      (sourceId.length === 0 || ReaderEffects.currentSourceId === sourceId)) {
      return ReaderEffects.currentChapterIndex;
    }
    return -1;
  }

  private static currentBookmarkChapterName(state: ReaderUiState,
    chapterIndex: number): string {
    if (state.currentChapterTitle.trim().length > 0) return state.currentChapterTitle.trim();
    for (let i = 0; i < state.chapterToc.length; i++) {
      if (state.chapterToc[i].index === chapterIndex) return state.chapterToc[i].title;
    }
    return '';
  }

  private static bookmarkExcerpt(chapterText: string, chapterPos: number): string {
    const center = Math.max(0, Math.min(chapterText.length, chapterPos));
    const start = Math.max(0, center - 80);
    const end = Math.min(chapterText.length, center + 180);
    return chapterText.slice(start, end);
  }

  private static rejectUnconfirmedBookmarkDelete(): void {
    ReaderEffects.reportBookmarkOperationFailure(
      '请先选择当前 Core 书签，并在当前列表中再次确认删除。',
    );
  }

  private static isLiveCurrentBookmark(time: number): boolean {
    if (!Number.isSafeInteger(time) || time < 0) return false;
    const state = ReaderUiStore.snapshot();
    const book = state.currentBook;
    if (book === null) return false;
    for (let i = 0; i < state.bookmarks.length; i++) {
      const bookmark = state.bookmarks[i];
      if (bookmark.time === time && bookmark.bookName === book.title &&
        bookmark.bookAuthor === book.author) {
        return true;
      }
    }
    return false;
  }

  // The second visible confirmation is the only way to reach Core. Re-read
  // the exact bookmark identity from state rather than trusting event data.
  private static deleteConfirmedBookmark(time: number): void {
    const state = ReaderUiStore.snapshot();
    const liveRoute = state.routeId === 'bookmarks-manager';
    if (!state.bookmarksLoading || !liveRoute || state.pendingBookmarkDeleteTime !== time ||
      !ReaderEffects.isLiveCurrentBookmark(time)) {
      ReaderEffects.rejectUnconfirmedBookmarkDelete();
      return;
    }
    if (ReaderEffects.bookmarkDeleteInFlightTime === time) return;
    ReaderEffects.bookmarkDeleteInFlightTime = time;
    try {
      CoreRuntime.get().bookmarkDelete(time).then((data: JsonObject): void => {
        ReaderEffects.bookmarkDeleteInFlightTime = -1;
        const fields = data as Object as Record<string, boolean>;
        if (fields['deleted'] !== true) {
          ReaderEffects.refreshBookmarksAfterDeleteFailure(
            'Core 未删除该书签；已保留当前确认目标并重新读取书签列表。',
          );
          return;
        }
        ReaderUiStore.dispatch({ type: 'bookmark-delete-complete' });
        ReaderEffects.loadBookmarksForCurrentBook();
      }).catch((e: Error): void => {
        ReaderEffects.bookmarkDeleteInFlightTime = -1;
        ReaderEffects.refreshBookmarksAfterDeleteFailure(`删除书签失败：${e.message}`);
      });
    } catch (e) {
      ReaderEffects.bookmarkDeleteInFlightTime = -1;
      ReaderEffects.refreshBookmarksAfterDeleteFailure(`删除书签失败：${(e as Error).message}`);
    }
  }

  private static refreshBookmarksAfterDeleteFailure(message: string): void {
    const state = ReaderUiStore.snapshot();
    const book = state.currentBook;
    if (book === null || !CoreRuntime.isInitialized()) {
      ReaderEffects.reportBookmarkOperationFailure(message);
      return;
    }
    try {
      CoreRuntime.get().bookmarkList(book.title, book.author).then((data: JsonObject): void => {
        const latest = ReaderUiStore.snapshot().currentBook;
        if (latest === null || latest.title !== book.title || latest.author !== book.author) return;
        ReaderUiStore.dispatch({ type: 'bookmark-list-loaded', bookmarks: ReaderEffects.mapCoreBookmarks(data) });
        ReaderEffects.reportBookmarkOperationFailure(message);
      }).catch((e: Error): void => {
        ReaderEffects.reportBookmarkOperationFailure(`${message} 书签列表刷新失败：${e.message}`);
      });
    } catch (e) {
      ReaderEffects.reportBookmarkOperationFailure(`${message} 书签列表刷新失败：${(e as Error).message}`);
    }
  }

  private static openCurrentBookmark(time: number): void {
    const state = ReaderUiStore.snapshot();
    const book = state.currentBook;
    let bookmark: CoreBookmark | null = null;
    for (let i = 0; i < state.bookmarks.length; i++) {
      if (state.bookmarks[i].time === time) {
        bookmark = state.bookmarks[i];
        break;
      }
    }
    if (book === null || bookmark === null) {
      ReaderEffects.reportBookmarkOperationFailure('书签已失效；请重新打开当前书籍的书签列表。');
      return;
    }
    const anchor = bookmark;
    // This is intentionally title/author-only because that is Core V1's
    // persisted identity. Never imply the record is sourceId-scoped.
    if (anchor.bookName !== book.title || anchor.bookAuthor !== book.author) {
      ReaderEffects.reportBookmarkOperationFailure('书签不属于当前 Core 书名和作者，已拒绝跳转。');
      return;
    }
    const sourceId = (book.sourceId ?? ReaderEffects.currentSourceId).trim();
    if (sourceId.length === 0) {
      ReaderEffects.reportBookmarkOperationFailure('当前书籍缺少 Core sourceId，无法跳转书签。');
      return;
    }
    ReaderEffects.closeBookmarkDirectory();
    if (isLocalBookSourceId(sourceId)) {
      ReaderEffects.loadLocalBookToc(book).then((toc: ChapterTocEntry[]): void => {
        let target: ChapterTocEntry | null = null;
        for (let i = 0; i < toc.length; i++) {
          if (toc[i].index === anchor.chapterIndex) {
            target = toc[i];
            break;
          }
        }
        if (target === null) throw new Error(`Core 本地目录中没有第 ${anchor.chapterIndex + 1} 章。`);
        ReaderEffects.loadLocalBookChapter(book, target, anchor.chapterPos);
      }).catch((e: Error): void => {
        ReaderEffects.reportBookmarkOperationFailure(`书签跳转失败：${e.message}`);
      });
      return;
    }
    ReaderEffects.loadStoredSourceToc(book, sourceId).then((toc: JsonObject[]): void => {
      const position = ReaderEffects.findTocPositionByCoreIndex(toc, anchor.chapterIndex);
      if (position < 0) throw new Error(`Core 目录中没有第 ${anchor.chapterIndex + 1} 章。`);
      ReaderEffects.loadStoredSourceChapter(book, toc, position, sourceId, {
        contentSearchOffset: anchor.chapterPos,
      });
    }).catch((e: Error): void => {
      ReaderEffects.reportBookmarkOperationFailure(`书签跳转失败：${e.message}`);
    });
  }

  private static closeBookmarkDirectory(): void {
    const state = ReaderUiStore.snapshot();
    if (state.routeId === 'bookmarks-manager') {
      ReaderUiStore.dispatch({ type: 'route-pop' });
    } else if (state.overlay === 'directory') {
      ReaderUiStore.dispatch({ type: 'reader.directory.close' });
    }
  }

  private static reportBookmarkOperationFailure(message: string): void {
    ReaderUiStore.dispatch({ type: 'bookmark-operation-failed', bookmarkError: message });
  }

  // ── Book-group Core vertical ─────────────────────────────────────────
  // These pages intentionally consume only the book-group.* DTO. The former
  // fixture counts/names made an empty Core store look populated, which hid
  // both persistence failures and the real first-run state.
  static loadBookGroups(): void {
    if (!CoreRuntime.isInitialized()) return;
    ReaderUiStore.dispatch({ type: 'book-group-load-start' });
    try {
      CoreRuntime.get().executeCoreMethod('book-group.list', {}, 5000).then((data: JsonObject): void => {
        ReaderUiStore.dispatch({ type: 'book-group-list-loaded', bookGroups: ReaderEffects.mapBookGroups(data) });
      }).catch((e: Error): void => {
        ReaderUiStore.dispatch({ type: 'book-group-list-failed', message: e.message });
      });
    } catch (e) {
      ReaderUiStore.dispatch({ type: 'book-group-list-failed', message: (e as Error).message });
    }
  }

  private static createBookGroup(rawName: string): void {
    const groupName = rawName.trim();
    if (!ReaderEffects.isBookGroupManagementRoute(ReaderUiStore.snapshot().routeId)) {
      ReaderUiStore.dispatch({
        type: 'book-group-operation-failed', message: '请在当前分组管理页创建分组。',
      });
      return;
    }
    if (groupName.length === 0) {
      ReaderUiStore.dispatch({ type: 'book-group-operation-failed', message: '请输入分组名称' });
      return;
    }
    const params: JsonObject = {
      groupName: groupName,
      order: ReaderEffects.nextBookGroupOrder(),
      enableRefresh: true,
      show: true,
    };
    ReaderEffects.runBookGroupMutation('book-group.create', params);
  }

  private static updateBookGroup(groupId: number, rawName: string): void {
    const groupName = rawName.trim();
    const state = ReaderUiStore.snapshot();
    if (!ReaderEffects.isBookGroupManagementRoute(state.routeId) ||
      !ReaderEffects.hasLiveBookGroup(state, groupId)) {
      ReaderUiStore.dispatch({
        type: 'book-group-operation-failed', message: '只能编辑当前 Core 分组列表中的分组。',
      });
      return;
    }
    if (groupName.length === 0) {
      ReaderUiStore.dispatch({ type: 'book-group-operation-failed', message: '分组名称不能为空' });
      return;
    }
    const params: JsonObject = { groupId: groupId, groupName: groupName };
    ReaderEffects.runBookGroupMutation('book-group.update', params);
  }

  private static rejectUnconfirmedBookGroupDelete(): void {
    ReaderUiStore.dispatch({
      type: 'book-group-operation-failed',
      message: '请先在当前分组管理页选择一条仍由 Core 返回的分组，并再次确认删除。',
    });
  }

  private static isLiveBookGroup(groupId: number): boolean {
    if (!Number.isSafeInteger(groupId) || groupId <= 0) return false;
    const groups = ReaderUiStore.snapshot().bookGroups;
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].groupId === groupId) return true;
    }
    return false;
  }

  // The reducer binds this exact id on the first tap. Immediately before
  // Core mutation, repeat the route, pending-id, and live-list checks so a
  // stale event cannot delete a group after navigation or refresh.
  private static deleteConfirmedBookGroup(groupId: number): void {
    const state = ReaderUiStore.snapshot();
    const liveRoute = state.routeId === 'group-management' ||
      state.routeId === 'bookshelf-group-management';
    if (!state.bookGroupsLoading || !liveRoute ||
      state.pendingBookGroupDeleteId !== groupId || !ReaderEffects.isLiveBookGroup(groupId)) {
      ReaderEffects.rejectUnconfirmedBookGroupDelete();
      return;
    }
    if (ReaderEffects.bookGroupDeleteInFlightId === groupId) return;
    ReaderEffects.bookGroupDeleteInFlightId = groupId;
    const params: JsonObject = { groupId: groupId };
    try {
      CoreRuntime.get().executeCoreMethod('book-group.delete', params, 5000).then((data: JsonObject): void => {
        ReaderEffects.bookGroupDeleteInFlightId = 0;
        const fields = data as Object as Record<string, boolean>;
        if (fields['deleted'] !== true) {
          // `deleted: false` is a real no-op result, never a local success.
          // Re-read the live rows before leaving the user an actionable error.
          ReaderEffects.refreshBookGroupsAfterDeleteFailure(
            'Core 未删除该分组；已保留当前确认目标并重新读取分组列表。',
          );
          return;
        }
        ReaderUiStore.dispatch({ type: 'book-group-delete-complete' });
        ReaderEffects.loadBookGroups();
      }).catch((e: Error): void => {
        ReaderEffects.bookGroupDeleteInFlightId = 0;
        ReaderEffects.refreshBookGroupsAfterDeleteFailure(`删除分组失败：${e.message}`);
      });
    } catch (e) {
      ReaderEffects.bookGroupDeleteInFlightId = 0;
      ReaderEffects.refreshBookGroupsAfterDeleteFailure(`删除分组失败：${(e as Error).message}`);
    }
  }

  // A failed delete still re-reads Core, but the failure message is applied
  // after the list projection so the existing target stays visible and the
  // user can cancel or retry instead of seeing a false local removal.
  private static refreshBookGroupsAfterDeleteFailure(message: string): void {
    if (!CoreRuntime.isInitialized()) {
      ReaderUiStore.dispatch({ type: 'book-group-operation-failed', message: message });
      return;
    }
    ReaderUiStore.dispatch({ type: 'book-group-load-start' });
    try {
      CoreRuntime.get().executeCoreMethod('book-group.list', {}, 5000).then((data: JsonObject): void => {
        ReaderUiStore.dispatch({ type: 'book-group-list-loaded', bookGroups: ReaderEffects.mapBookGroups(data) });
        ReaderUiStore.dispatch({ type: 'book-group-operation-failed', message: message });
      }).catch((e: Error): void => {
        ReaderUiStore.dispatch({
          type: 'book-group-list-failed', message: `${message} 分组列表刷新失败：${e.message}`,
        });
      });
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'book-group-list-failed', message: `${message} 分组列表刷新失败：${(e as Error).message}`,
      });
    }
  }

  // Book group CRUD and shelf membership are intentionally different Core
  // verticals.  This one changes exactly one composite (sourceId, bookId)
  // shelf entry; it never guesses a title match or performs a fake batch move.
  private static assignBookshelfGroup(rawSourceId: string, rawBookId: string, group: string): void {
    const sourceId = rawSourceId.trim();
    const bookId = rawBookId.trim();
    const state = ReaderUiStore.snapshot();
    if (group.trim().length === 0 || !ReaderEffects.isBookGroupManagementRoute(state.routeId) ||
      !ReaderEffects.hasLiveBookshelfGroupTarget(state, sourceId, bookId, false) ||
      !ReaderEffects.hasLiveBookGroupName(state, group)) {
      ReaderUiStore.dispatch({
        type: 'book-group-operation-failed',
        message: '只能在当前分组管理页为仍由 Core 返回的书架条目分配当前分组。',
      });
      return;
    }
    try {
      CoreRuntime.get().bookshelfGroupAssign(sourceId, bookId, group).then((): void => {
        // Re-read both Core projections.  The command returns a book row, but
        // refreshing avoids locally merging an incomplete DTO or leaving a
        // stale group filter on the bookshelf.
        ReaderEffects.loadBookshelf();
        ReaderEffects.loadBookGroups();
      }).catch((e: Error): void => {
        ReaderUiStore.dispatch({ type: 'book-group-operation-failed', message: e.message });
      });
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'book-group-operation-failed', message: (e as Error).message,
      });
    }
  }

  private static clearConfirmedBookshelfGroup(rawSourceId: string, rawBookId: string): void {
    const sourceId = rawSourceId.trim();
    const bookId = rawBookId.trim();
    const state = ReaderUiStore.snapshot();
    if (!ReaderEffects.isBookGroupManagementRoute(state.routeId) ||
      sourceId !== state.pendingBookGroupClearSourceId || bookId !== state.pendingBookGroupClearBookId ||
      !ReaderEffects.hasLiveBookshelfGroupTarget(state, sourceId, bookId, true)) {
      ReaderEffects.rejectUnconfirmedBookGroupClear();
      return;
    }
    const key = `${sourceId}\n${bookId}`;
    if (ReaderEffects.bookGroupClearInFlightKey === key) return;
    ReaderEffects.bookGroupClearInFlightKey = key;
    try {
      CoreRuntime.get().bookshelfGroupAssign(sourceId, bookId, '').then((): void => {
        ReaderEffects.bookGroupClearInFlightKey = '';
        ReaderUiStore.dispatch({ type: 'book-group-clear-complete' });
        ReaderEffects.loadBookshelf();
        ReaderEffects.loadBookGroups();
      }).catch((e: Error): void => {
        ReaderEffects.bookGroupClearInFlightKey = '';
        ReaderUiStore.dispatch({
          type: 'book-group-operation-failed', message: `清空分组失败：${e.message}`,
        });
        ReaderEffects.loadBookshelf();
        ReaderEffects.loadBookGroups();
      });
    } catch (e) {
      ReaderEffects.bookGroupClearInFlightKey = '';
      ReaderUiStore.dispatch({
        type: 'book-group-operation-failed', message: `清空分组失败：${(e as Error).message}`,
      });
    }
  }

  private static rejectUnconfirmedBookGroupClear(): void {
    ReaderUiStore.dispatch({
      type: 'book-group-operation-failed',
      message: '请先选择当前 Core 书架中的已分组书籍，并在可见确认区再次确认清空。',
    });
  }

  private static isBookGroupManagementRoute(routeId: string): boolean {
    return routeId === 'group-management' || routeId === 'bookshelf-group-management';
  }

  private static hasLiveBookshelfGroupTarget(state: ReaderUiState, sourceId: string,
    bookId: string, requireAssignedGroup: boolean): boolean {
    if (sourceId.length === 0 || bookId.length === 0) return false;
    for (let i = 0; i < state.bookshelfBooks.length; i++) {
      const book = state.bookshelfBooks[i];
      if (book.sourceId === sourceId && book.bookId === bookId) {
        return !requireAssignedGroup || book.group.trim().length > 0;
      }
    }
    return false;
  }

  private static hasLiveBookGroupName(state: ReaderUiState, rawName: string): boolean {
    const name = rawName.trim();
    for (let i = 0; i < state.bookGroups.length; i++) {
      if (state.bookGroups[i].groupName === name) return true;
    }
    return false;
  }

  private static hasLiveBookGroup(state: ReaderUiState, groupId: number): boolean {
    if (!Number.isSafeInteger(groupId) || groupId <= 0) return false;
    for (let i = 0; i < state.bookGroups.length; i++) {
      if (state.bookGroups[i].groupId === groupId) return true;
    }
    return false;
  }

  private static runBookGroupMutation(method: string, params: JsonObject): void {
    try {
      CoreRuntime.get().executeCoreMethod(method, params, 5000).then((): void => {
        ReaderEffects.loadBookGroups();
      }).catch((e: Error): void => {
        ReaderUiStore.dispatch({ type: 'book-group-operation-failed', message: e.message });
      });
    } catch (e) {
      ReaderUiStore.dispatch({ type: 'book-group-operation-failed', message: (e as Error).message });
    }
  }

  private static nextBookGroupOrder(): number {
    const groups = ReaderUiStore.snapshot().bookGroups;
    let maxOrder = -1;
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].order > maxOrder) maxOrder = groups[i].order;
    }
    return maxOrder + 1;
  }

  // Extract a durable, UI-safe projection from the Core book-group.list DTO.
  // Unknown/malformed rows are excluded rather than rendered as fixture data.
  static mapBookGroups(data: JsonObject): CoreBookGroup[] {
    const fields = data as Object as Record<string, Object[]>;
    const rawGroups: Object[] = fields['groups'];
    const groups: CoreBookGroup[] = [];
    if (!Array.isArray(rawGroups)) return groups;
    for (let i = 0; i < rawGroups.length; i++) {
      const rawValue = rawGroups[i];
      if (rawValue === null || typeof rawValue !== 'object' || Array.isArray(rawValue)) continue;
      const raw = rawValue as JsonObject;
      const groupId = ReaderEffects.getNumber(raw, 'groupId', -1);
      if (groupId < 0) continue;
      const booleans = raw as Object as Record<string, boolean>;
      groups.push({
        groupId: groupId,
        groupName: ReaderEffects.getString(raw, 'groupName', '未命名分组'),
        cover: ReaderEffects.getString(raw, 'cover'),
        order: ReaderEffects.getNumber(raw, 'order'),
        enableRefresh: booleans['enableRefresh'] === true,
        show: booleans['show'] === true,
      });
    }
    return groups;
  }

  static loadRss(): void {
    if (!CoreRuntime.isInitialized()) {
      ReaderUiStore.dispatch({ type: 'rss-load-failed', rssLoadError: 'Core 尚未初始化，无法读取 RSS 条目。' });
      return;
    }
    const requestSequence = ++ReaderEffects.rssRequestSequence;
    const unreadOnly = ReaderUiStore.snapshot().rssItemFilter === 'unread';
    ReaderUiStore.dispatch({ type: 'rss-load-start' });
    try {
      const runtime = CoreRuntime.get();
      runtime.executeCoreMethod('rss.subscription.list', {}, 5000).then((data: JsonObject): Promise<void> => {
        if (requestSequence !== ReaderEffects.rssRequestSequence) return Promise.resolve();
        return ReaderEffects.loadCachedRssItems(
          runtime,
          ReaderEffects.parseRssSubscriptions(data),
          0,
          [],
          unreadOnly,
          requestSequence,
          '',
        );
      }).catch((e: Error): void => {
        if (requestSequence === ReaderEffects.rssRequestSequence) {
          ReaderUiStore.dispatch({ type: 'rss-load-failed', rssLoadError: e.message });
        }
      });
    } catch (e) {
      if (requestSequence === ReaderEffects.rssRequestSequence) {
        ReaderUiStore.dispatch({ type: 'rss-load-failed', rssLoadError: (e as Error).message });
      }
    }
  }

  private static parseRssSubscriptions(data: JsonObject): CoreRssSubscription[] {
    const arrayFields = data as Object as Record<string, Object[]>;
    const rawSubscriptions: Object[] = arrayFields['subscriptions'];
    const subscriptions: CoreRssSubscription[] = [];
    if (!Array.isArray(rawSubscriptions)) return subscriptions;
    for (let i = 0; i < rawSubscriptions.length; i++) {
      const rawValue = rawSubscriptions[i];
      if (rawValue === null || typeof rawValue !== 'object' || Array.isArray(rawValue)) continue;
      const raw = rawValue as JsonObject;
      const booleans = raw as Object as Record<string, boolean>;
      const subscriptionId = ReaderEffects.getString(raw, 'subscriptionId');
      if (subscriptionId.length === 0) continue;
      const feedUrl = ReaderEffects.getString(raw, 'feedUrl');
      subscriptions.push({
        subscriptionId: subscriptionId,
        feedUrl: feedUrl,
        title: ReaderEffects.getString(raw, 'title', feedUrl),
        enabled: booleans['enabled'] === true,
        unreadCount: ReaderEffects.getNumber(raw, 'unreadCount'),
      });
    }
    return subscriptions;
  }

  // Core owns feed retrieval, XML parsing, redirect/304 handling and the
  // subscription-scoped cache. Entering the RSS page therefore only reads
  // that cache; it must not issue its own HTTP request or parse XML in ArkTS.
  // `unreadOnly` is sent to Core for every subscription. In particular, the
  // all-items route omits a limit and sends false, so a read article remains
  // present in the returned Core projection rather than being hidden locally.
  private static loadCachedRssItems(runtime: CoreRuntime, subscriptions: CoreRssSubscription[], index: number,
    items: CoreRssItem[], unreadOnly: boolean, requestSequence: number, firstFailure: string): Promise<void> {
    if (index >= subscriptions.length) {
      if (requestSequence === ReaderEffects.rssRequestSequence) {
        ReaderUiStore.dispatch({ type: 'rss-data-loaded', rssSubscriptions: subscriptions, rssItems: items });
        if (firstFailure.length > 0) {
          ReaderUiStore.dispatch({ type: 'rss-load-failed', rssLoadError: firstFailure });
        }
      }
      return Promise.resolve();
    }
    const subscription = subscriptions[index];
    const params: JsonObject = {};
    params['subscriptionId'] = subscription.subscriptionId;
    params['unreadOnly'] = unreadOnly;
    // Do not send a limit here. Core's omitted limit means every cached item
    // for the subscription, which is the only truthful backing for "全部条目".
    return runtime.executeCoreMethod('rss.subscription.items', params, 5000).then((data: JsonObject): Promise<void> => {
      const arrayFields = data as Object as Record<string, Object[]>;
      const rawItems: Object[] = arrayFields['items'];
      if (Array.isArray(rawItems)) {
        for (let i = 0; i < rawItems.length; i++) {
          const rawValue = rawItems[i];
          if (rawValue === null || typeof rawValue !== 'object' || Array.isArray(rawValue)) continue;
          const raw = rawValue as JsonObject;
          const booleans = raw as Object as Record<string, boolean>;
          items.push({
            subscriptionId: ReaderEffects.getString(raw, 'subscriptionId', subscription.subscriptionId),
            guid: ReaderEffects.getString(raw, 'guid'),
            title: ReaderEffects.getString(raw, 'title', '未命名文章'),
            description: ReaderEffects.getString(raw, 'description'),
            author: ReaderEffects.getString(raw, 'author'),
            pubDate: ReaderEffects.getString(raw, 'pubDate'),
            link: ReaderEffects.getString(raw, 'link'),
            sourceTitle: subscription.title,
            read: booleans['read'] === true,
          });
        }
      }
      return ReaderEffects.loadCachedRssItems(
        runtime, subscriptions, index + 1, items, unreadOnly, requestSequence, firstFailure,
      );
    }).catch((e: Error): Promise<void> => {
      console.info(`ReaderEffects: rss subscription cache ${subscription.subscriptionId} error: ${e.message}`);
      const failure = firstFailure.length > 0 ? firstFailure : `${subscription.title}：${e.message}`;
      return ReaderEffects.loadCachedRssItems(
        runtime, subscriptions, index + 1, items, unreadOnly, requestSequence, failure,
      );
    });
  }

  static markRssItemRead(guid: string, subscriptionId: string): void {
    const state = ReaderUiStore.snapshot();
    if (state.routeId !== 'rss-detail' ||
      !ReaderEffects.hasLiveUnreadRssItem(state, guid, subscriptionId)) {
      ReaderUiStore.dispatch({
        type: 'rss-load-failed',
        rssLoadError: 'RSS 条目已读更新已失效；请从当前 Core 条目列表重新打开。',
      });
      return;
    }
    if (!CoreRuntime.isInitialized()) {
      ReaderUiStore.dispatch({ type: 'rss-load-failed', rssLoadError: 'Core 尚未初始化，无法更新 RSS 已读状态。' });
      return;
    }
    const params: JsonObject = {};
    params['guid'] = guid;
    params['read'] = true;
    params['subscriptionId'] = subscriptionId;
    try {
      CoreRuntime.get().executeCoreMethod('rss.item.read', params, 5000).then((): void => {
        ReaderUiStore.dispatch({
          type: 'rss-item-read-confirmed',
          rssGuid: guid,
          rssSubscriptionId: subscriptionId,
        });
        // The immediate reducer update retains the all-items read row (or
        // removes it from the unread-only projection). Re-read Core so the
        // source of truth wins if another device/action changed the record.
        ReaderEffects.loadRss();
      }).catch((e: Error): void => {
        ReaderUiStore.dispatch({ type: 'rss-load-failed', rssLoadError: `更新已读状态失败：${e.message}` });
      });
    } catch (e) {
      ReaderUiStore.dispatch({ type: 'rss-load-failed', rssLoadError: `更新已读状态失败：${(e as Error).message}` });
    }
  }

  private static addRssSubscription(event: UiEvent): void {
    const feedUrl = (event.rssFeedUrl ?? '').trim();
    if (ReaderUiStore.snapshot().routeId !== 'rss-subscription-management') {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: {
          code: 'RSS_SUBSCRIPTION_ADD_TARGET_REQUIRED',
          message: '请在当前 RSS 订阅管理页添加订阅。',
          retryable: false,
        },
      });
      return;
    }
    if (feedUrl.length === 0) {
      ReaderUiStore.dispatch({ type: 'set-error', error: { code: 'RSS_FEED_URL_REQUIRED', message: '订阅地址不能为空', retryable: false } });
      return;
    }
    const params: JsonObject = {};
    params['subscriptionId'] = (event.rssSubscriptionId ?? '').trim().length > 0
      ? (event.rssSubscriptionId ?? '').trim() : `rss-${Date.now()}`;
    params['feedUrl'] = feedUrl;
    params['title'] = (event.rssTitle ?? '').trim();
    params['enabled'] = event.rssEnabled !== false;
    try {
      CoreRuntime.get().executeCoreMethod('rss.subscription.add', params, 5000).then((): void => {
        ReaderEffects.refreshRss();
      }).catch((e: Error): void => {
        ReaderUiStore.dispatch({ type: 'set-error', error: { code: 'RSS_SUBSCRIPTION_ADD_FAILED', message: e.message, retryable: true } });
      });
    } catch (e) {
      ReaderUiStore.dispatch({ type: 'set-error', error: { code: 'RSS_SUBSCRIPTION_ADD_FAILED', message: (e as Error).message, retryable: true } });
    }
  }

  private static updateRssSubscription(event: UiEvent): void {
    const subscriptionId = (event.rssSubscriptionId ?? '').trim();
    const state = ReaderUiStore.snapshot();
    if (state.routeId !== 'rss-subscription-management' ||
      !ReaderEffects.hasLiveRssSubscription(state, subscriptionId)) {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: {
          code: 'RSS_SUBSCRIPTION_UPDATE_TARGET_REQUIRED',
          message: '只能编辑当前 Core 订阅列表中的订阅。',
          retryable: false,
        },
      });
      return;
    }
    const params: JsonObject = {};
    params['subscriptionId'] = subscriptionId;
    if (event.rssFeedUrl !== undefined) params['feedUrl'] = event.rssFeedUrl.trim();
    if (event.rssTitle !== undefined) params['title'] = event.rssTitle.trim();
    if (event.rssEnabled !== undefined) params['enabled'] = event.rssEnabled;
    try {
      CoreRuntime.get().executeCoreMethod('rss.subscription.update', params, 5000).then((): void => {
        ReaderEffects.refreshRss();
      }).catch((e: Error): void => {
        ReaderUiStore.dispatch({ type: 'set-error', error: { code: 'RSS_SUBSCRIPTION_UPDATE_FAILED', message: e.message, retryable: true } });
      });
    } catch (e) {
      ReaderUiStore.dispatch({ type: 'set-error', error: { code: 'RSS_SUBSCRIPTION_UPDATE_FAILED', message: (e as Error).message, retryable: true } });
    }
  }

  private static hasLiveRssSubscription(state: ReaderUiState, subscriptionId: string): boolean {
    if (subscriptionId.length === 0) return false;
    for (let i = 0; i < state.rssSubscriptions.length; i++) {
      if (state.rssSubscriptions[i].subscriptionId === subscriptionId) return true;
    }
    return false;
  }

  private static hasLiveUnreadRssItem(state: ReaderUiState, guid: string, subscriptionId: string): boolean {
    if (guid.length === 0 || subscriptionId.length === 0) return false;
    for (let i = 0; i < state.rssItems.length; i++) {
      const item = state.rssItems[i];
      if (item.guid === guid && item.subscriptionId === subscriptionId) return !item.read;
    }
    return false;
  }

  private static rejectUnconfirmedRssSubscriptionDelete(): void {
    ReaderUiStore.dispatch({
      type: 'set-error',
      error: {
        code: 'RSS_SUBSCRIPTION_DELETE_CONFIRM_REQUIRED',
        message: '请先在当前订阅的删除确认页确认，未执行 Core 删除。',
        retryable: false,
      },
    });
  }

  private static deleteConfirmedRssSubscription(subscriptionId: string): void {
    const id = subscriptionId.trim();
    const state = ReaderUiStore.snapshot();
    let found = false;
    for (let i = 0; i < state.rssSubscriptions.length; i++) {
      if (state.rssSubscriptions[i].subscriptionId === id) {
        found = true;
        break;
      }
    }
    if (state.routeId !== 'rss-source-delete-confirm' ||
      state.pendingRssSubscriptionDeleteId !== id || !found) {
      ReaderEffects.rejectUnconfirmedRssSubscriptionDelete();
      return;
    }
    if (ReaderEffects.rssSubscriptionDeleteInFlightId === id) return;
    ReaderEffects.rssSubscriptionDeleteInFlightId = id;
    const params: JsonObject = {};
    params['subscriptionId'] = id;
    try {
      CoreRuntime.get().executeCoreMethod('rss.subscription.delete', params, 5000).then((): void => {
        ReaderEffects.rssSubscriptionDeleteInFlightId = '';
        ReaderUiStore.dispatch({ type: 'rss-subscription-delete-complete' });
        ReaderEffects.loadRss();
      }).catch((e: Error): void => {
        ReaderEffects.rssSubscriptionDeleteInFlightId = '';
        ReaderUiStore.dispatch({ type: 'set-error', error: { code: 'RSS_SUBSCRIPTION_DELETE_FAILED', message: e.message, retryable: true } });
      });
    } catch (e) {
      ReaderEffects.rssSubscriptionDeleteInFlightId = '';
      ReaderUiStore.dispatch({ type: 'set-error', error: { code: 'RSS_SUBSCRIPTION_DELETE_FAILED', message: (e as Error).message, retryable: true } });
    }
  }

  private static refreshRss(): void {
    if (!CoreRuntime.isInitialized()) {
      ReaderUiStore.dispatch({ type: 'rss-refresh-failed', rssRefreshMessage: 'Core 尚未初始化，无法刷新 RSS。' });
      return;
    }
    ReaderUiStore.dispatch({ type: 'rss-refresh-start' });
    try {
      const runtime = CoreRuntime.get();
      runtime.executeCoreMethod('rss.subscription.list', {}, 5000).then((data: JsonObject): Promise<string> => {
        return ReaderEffects.refreshRssSubscriptions(runtime, ReaderEffects.parseRssSubscriptions(data), 0, '');
      }).then((firstFailure: string): void => {
        ReaderEffects.loadRss();
        if (firstFailure.length > 0) {
          ReaderUiStore.dispatch({
            type: 'rss-refresh-failed',
            rssRefreshMessage: firstFailure,
          });
        } else {
          ReaderUiStore.dispatch({
            type: 'rss-refresh-success',
            rssRefreshMessage: 'RSS 刷新完成，已重新读取 Core 缓存。',
          });
        }
      }).catch((e: Error): void => {
        ReaderUiStore.dispatch({
          type: 'rss-refresh-failed',
          rssRefreshMessage: e.message,
        });
      });
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'rss-refresh-failed',
        rssRefreshMessage: (e as Error).message,
      });
    }
  }

  private static refreshRssSubscriptions(runtime: CoreRuntime, subscriptions: CoreRssSubscription[], index: number,
    firstFailure: string): Promise<string> {
    if (index >= subscriptions.length) return Promise.resolve(firstFailure);
    const subscription = subscriptions[index];
    if (!subscription.enabled || subscription.feedUrl.length === 0) {
      return ReaderEffects.refreshRssSubscriptions(runtime, subscriptions, index + 1, firstFailure);
    }
    const params: JsonObject = {};
    params['subscriptionId'] = subscription.subscriptionId;
    params['evaluatedAt'] = 0;
    return runtime.executeCoreMethod('rss.subscription.refresh', params, 20000).then((): Promise<string> => {
      return ReaderEffects.refreshRssSubscriptions(runtime, subscriptions, index + 1, firstFailure);
    }).catch((e: Error): Promise<string> => {
      const failure = firstFailure.length > 0 ? firstFailure : `${subscription.title}：${e.message}`;
      console.info(`ReaderEffects: rss subscription refresh ${subscription.subscriptionId} error: ${e.message}`);
      return ReaderEffects.refreshRssSubscriptions(runtime, subscriptions, index + 1, failure);
    });
  }

  static openBookshelfBook(sourceId: string, bookId: string): void {
    if (sourceId.length === 0 || bookId.length === 0) return;
    const state = ReaderUiStore.snapshot();
    const shelf = state.bookshelfBooks;
    let selected: CoreBookshelfBook | null = null;
    for (let i = 0; i < shelf.length; i++) {
      if (shelf[i].sourceId === sourceId && shelf[i].bookId === bookId) {
        selected = shelf[i];
        break;
      }
    }
    // Continue Reading is deliberately projected from its own exact Core
    // progress query, not from a filtered shelf list. A local book must still
    // open when the shelf is loading, reordered, or filtered away.
    if (selected === null) {
      const continueBook = state.continueReadingBook;
      if (continueBook !== null && continueBook.sourceId === sourceId && continueBook.bookId === bookId) {
        selected = continueBook;
      }
    }
    if (selected === null) return;
    ReaderEffects.cancelSourceSwitchIfActive();
    const sequence = ReaderEffects.bookOpenRequestSequence + 1;
    ReaderEffects.bookOpenRequestSequence = sequence;
    if (isLocalBookSourceId(sourceId)) {
      ReaderEffects.openLocalBookshelfBook(selected, sequence);
      return;
    }
    ReaderUiStore.dispatch({ type: 'set-loading', loading: true });
    try {
      // Opening an existing remote shelf entry is not a source switch.  Keep
      // its durable key intact and restore its own Core progress instead of
      // routing it through the source-switch replacement transaction.
      const route = ReaderUiStore.snapshot().routeId;
      const shouldRestoreForReader = route === 'immersive-reading' || route === 'reader' || route === 'reader_content';
      ReaderEffects.runBookDetailFromPersistedSource(bookId, shouldRestoreForReader, sourceId, sequence).catch((e: Error): void => {
        if (!ReaderEffects.isCurrentBookOpen(sequence)) return;
        ReaderUiStore.dispatch({
          type: 'set-error',
          error: { code: 'BOOK_OPEN_FAILED', message: e.message, retryable: true },
        });
      });
    } catch (e) {
      if (!ReaderEffects.isCurrentBookOpen(sequence)) return;
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: { code: 'BOOK_OPEN_FAILED', message: (e as Error).message, retryable: true },
      });
    }
  }

  private static isCurrentBookOpen(sequence: number): boolean {
    return ReaderEffects.bookOpenRequestSequence === sequence;
  }

  private static cancelBookOpen(): void {
    ReaderEffects.bookOpenRequestSequence += 1;
  }

  // Reader modules are semantic overlays and no longer add route entries.
  // This runs after a real route-pop, so the destination route is authoritative.
  private static cancelBookOpenIfRouteLeft(): void {
    const route = ReaderUiStore.snapshot().routeId;
    switch (route) {
      case 'book-detail':
      case 'book-detail-toc-preview':
      case 'book-directory':
      case 'reader':
      case 'immersive-reading':
      case 'reader_content':
      case 'source-switch':
      case 'reader-full-directory':
      case 'reader-full-tts':
      case 'reader-full-appearance':
      case 'reader-full-settings':
        return;
      default:
        ReaderEffects.cancelBookOpen();
    }
  }

  private static localBookDetail(book: CoreBookshelfBook): BookDetail {
    return {
      bookId: book.bookId,
      sourceId: 'local',
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl,
      summary: book.intro,
      sourceName: '本地导入',
      sourceUrl: '',
      latestChapter: book.lastChapter,
      chapterListUrl: book.bookId,
    };
  }

  // The local-book path intentionally bypasses remote source parsing.  Core
  // already materialized the file on explicit import, so this opens its durable
  // TOC/body rather than presenting an optimistic shelf entry that cannot read.
  private static openLocalBookshelfBook(book: CoreBookshelfBook, sequence: number): void {
    if (!ReaderEffects.isCurrentBookOpen(sequence)) return;
    const detail = ReaderEffects.localBookDetail(book);
    ReaderUiStore.dispatch({ type: 'book-detail-success', book: detail });
    ReaderEffects.loadLocalBookToc(detail, sequence).then((toc: ChapterTocEntry[]): void => {
      if (!ReaderEffects.isCurrentBookOpen(sequence)) return;
      const route = ReaderUiStore.snapshot().routeId;
      if (toc.length > 0 && (route === 'immersive-reading' || route === 'reader' || route === 'reader_content')) {
        // Local imports use the same durable Core progress contract as remote
        // shelf entries.  `chapterIndex` is Core identity, not a TOC array
        // offset, so a sparse local TOC cannot reopen the wrong chapter.
        ReaderEffects.readPersistedReadingProgress(CoreRuntime.get(), detail.bookId, 'local').then(
          (progress: PersistedReadingProgress | null): void => {
            if (!ReaderEffects.isCurrentBookOpen(sequence)) return;
            const target = ReaderEffects.localPersistedProgressTocEntry(toc, progress);
            const restored = progress !== null && target.index === progress.chapterIndex
              ? progress : undefined;
            ReaderEffects.loadLocalBookChapter(detail, target, undefined, restored, sequence);
          },
        );
      }
    }).catch((e: Error): void => {
      if (!ReaderEffects.isCurrentBookOpen(sequence)) return;
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: { code: 'LOCAL_BOOK_TOC_FAILED', message: e.message, retryable: true },
      });
    });
  }

  private static loadLocalBookToc(book: BookDetail, sequence?: number): Promise<ChapterTocEntry[]> {
    return CoreRuntime.get().localBookToc(book.bookId).then((data: JsonObject): ChapterTocEntry[] => {
      if (sequence !== undefined && !ReaderEffects.isCurrentBookOpen(sequence)) return [];
      const toc = ReaderEffects.mapChapterToc(data);
      if (toc.length === 0) {
        throw new Error('本地书籍没有可阅读的章节');
      }
      ReaderEffects.currentSourceId = 'local';
      ReaderEffects.currentBookId = book.bookId;
      ReaderEffects.currentChapterToc = ReaderEffects.coreTocForEffect(data);
      ReaderEffects.currentTocVariables = undefined;
      ReaderUiStore.dispatch({ type: 'chapter-toc-loaded', chapterToc: toc });
      return toc;
    });
  }

  // Pure Core-identity selection policy shared by the direct continue-reading
  // path and its regression coverage. `toc` already contains only readable
  // local rows, so its first entry is the deterministic no-progress fallback.
  static localPersistedProgressTocEntry(toc: ChapterTocEntry[],
    progress: PersistedReadingProgress | null): ChapterTocEntry {
    if (progress !== null) {
      for (let index = 0; index < toc.length; index += 1) {
        if (toc[index].index === progress.chapterIndex) return toc[index];
      }
      // The saved Core identity no longer exists in this imported file. Never
      // reinterpret it as an array index; opening the deterministic first
      // readable chapter makes the fallback explicit and safe.
      console.info(`ReaderEffects: persisted local chapter ${progress.chapterIndex} no longer exists in this TOC`);
    }
    return toc[0];
  }

  private static loadLocalBookChapter(book: BookDetail, entry: ChapterTocEntry,
    contentSearchOffset?: number, restoredProgress?: PersistedReadingProgress, sequence?: number,
    chapterNavigationRequestId?: number): void {
    if (sequence !== undefined && !ReaderEffects.isCurrentBookOpen(sequence)) {
      ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
      return;
    }
    ReaderEffects.currentSourceId = 'local';
    ReaderEffects.currentBookId = book.bookId;
    ReaderEffects.currentChapterId = entry.chapterId;
    ReaderEffects.currentChapterIndex = entry.index;
    ReaderEffects.currentSourceVariables = undefined;
    ReaderUiStore.dispatch({ type: 'set-loading', loading: true });
    try {
      CoreRuntime.get().localBookChapterContent(book.bookId, entry.index).then((data: JsonObject): void => {
        if (sequence !== undefined && !ReaderEffects.isCurrentBookOpen(sequence)) {
          ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
          return;
        }
        if (!ReaderEffects.isCurrentChapterLoad(book.bookId, 'local', entry.index, entry.chapterId)) {
          ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
          return;
        }
        ReaderUiStore.dispatch({
          type: 'chapter-success',
          chapterParagraphs: ReaderEffects.mapChapterContent(data),
          chapterTitle: ReaderEffects.getString(data, 'chapterTitle', entry.title),
          bookId: book.bookId,
          sourceId: 'local',
          chapterIndex: entry.index,
        });
        ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
        if (restoredProgress !== undefined) {
          // Dispatch only after chapter-success, which clears the previous
          // renderer state. ReadingTextFlow then restores the exact Core
          // offset rather than treating a visual page index as a character
          // position.
          ReaderUiStore.dispatch({
            type: 'reader-location-resolved',
            canonicalReaderLocation: {
              bookId: book.bookId,
              chapterIndex: entry.index,
              chapterOffset: restoredProgress.chapterOffset,
              chapterProgress: restoredProgress.chapterProgress,
              locationRevision: restoredProgress.locationRevision,
              resolverVersion: '',
            },
          });
        }
        if (contentSearchOffset !== undefined) {
          ReaderEffects.persistContentSearchAnchor(book, 'local', entry.index, contentSearchOffset, sequence);
        }
      }).catch((e: Error): void => {
        if (sequence !== undefined && !ReaderEffects.isCurrentBookOpen(sequence)) {
          ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
          return;
        }
        if (!ReaderEffects.isCurrentChapterLoad(book.bookId, 'local', entry.index, entry.chapterId)) {
          ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
          return;
        }
        ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
        if (contentSearchOffset !== undefined) {
          ReaderUiStore.dispatch({
            type: 'content-search-jump-status',
            contentSearchMessage: `正文搜索跳转失败：${e.message}`,
          });
        }
        ReaderUiStore.dispatch({
          type: 'set-error',
          error: { code: 'LOCAL_BOOK_CHAPTER_FAILED', message: e.message, retryable: true },
        });
      });
    } catch (e) {
      if (sequence !== undefined && !ReaderEffects.isCurrentBookOpen(sequence)) {
        ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
        return;
      }
      ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: { code: 'LOCAL_BOOK_CHAPTER_FAILED', message: (e as Error).message, retryable: true },
      });
    }
  }

  private static removeConfirmedBookshelfBook(sourceId: string, bookId: string): void {
    const source = sourceId.trim();
    const book = bookId.trim();
    const state = ReaderUiStore.snapshot();
    const epoch = state.bookshelfRemovalEpoch;
    const isBatch = state.bookshelfRemovalScope === 'batch';
    const targets: BookshelfSelectionTarget[] = isBatch
      ? state.pendingBookshelfRemovalTargets.slice()
      : [{ sourceId: source, bookId: book }];
    if (targets.length === 0 || !ReaderEffects.targetsAreLive(state, targets)) return;
    // The reducer has already projected the explicit confirmation into the
    // Figma Loading variant. Effects only consumes that exact transaction;
    // an old/forged event is ignored rather than replacing the page with a
    // global error view.
    if (!ReaderEffects.isCurrentBookshelfRemoval(source, book, epoch)) return;
    const key = ReaderEffects.removalTargetKey(targets);
    if (ReaderEffects.bookshelfRemoveInFlightKey === key) return;
    ReaderEffects.bookshelfRemoveInFlightKey = key;
    try {
      const request = isBatch
        ? CoreRuntime.get().bookshelfRemoveBatch(targets)
        : CoreRuntime.get().bookshelfRemove(source, book);
      request.then((data: JsonObject): void => {
        ReaderEffects.bookshelfRemoveInFlightKey = '';
        if (!ReaderEffects.isCurrentBookshelfRemoval(source, book, epoch)) return;
        const receipt: BookshelfRemovalReceipt | null = isBatch
          ? ReaderEffects.bookshelfRemovalReceipt(data, targets) : null;
        ReaderUiStore.dispatch({ type: 'bookshelf-remove-complete', sourceId: source, bookId: book,
          bookshelfRemovalEpoch: epoch, bookshelfRemovalReceipt: receipt });
        ReaderEffects.loadBookshelf();
        ReaderUiStore.dispatch({ type: 'route-replace', id: 'bookshelf' });
      }).catch((e: Error): void => {
        ReaderEffects.bookshelfRemoveInFlightKey = '';
        if (!ReaderEffects.isCurrentBookshelfRemoval(source, book, epoch)) return;
        ReaderUiStore.dispatch({ type: 'bookshelf-remove-failed', sourceId: source, bookId: book,
          bookshelfRemovalEpoch: epoch, bookshelfRemovalError: e.message });
      });
    } catch (e) {
      ReaderEffects.bookshelfRemoveInFlightKey = '';
      if (!ReaderEffects.isCurrentBookshelfRemoval(source, book, epoch)) return;
      ReaderUiStore.dispatch({ type: 'bookshelf-remove-failed', sourceId: source, bookId: book,
        bookshelfRemovalEpoch: epoch, bookshelfRemovalError: (e as Error).message });
    }
  }

  private static isCurrentBookshelfRemoval(sourceId: string, bookId: string, epoch: number): boolean {
    const state = ReaderUiStore.snapshot();
    if (state.overlay !== 'dialog' || state.bookshelfRemovalDialogPhase !== 'loading' ||
      state.bookshelfRemovalEpoch !== epoch) return false;
    if (state.bookshelfRemovalScope === 'batch') {
      return sourceId.length === 0 && bookId.length === 0 && state.pendingBookshelfRemovalTargets.length > 0;
    }
    return state.pendingBookshelfRemovalSourceId === sourceId && state.pendingBookshelfRemovalBookId === bookId;
  }

  private static targetsAreLive(state: ReaderUiState, targets: BookshelfSelectionTarget[]): boolean {
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      let found = false;
      for (let shelfIndex = 0; shelfIndex < state.bookshelfBooks.length; shelfIndex += 1) {
        const shelf = state.bookshelfBooks[shelfIndex];
        if (shelf.sourceId === target.sourceId && shelf.bookId === target.bookId) {
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  }

  private static removalTargetKey(targets: BookshelfSelectionTarget[]): string {
    let key = 'bookshelf-remove';
    for (let index = 0; index < targets.length; index += 1) {
      key = `${key}\u0000${targets[index].sourceId}\u0000${targets[index].bookId}`;
    }
    return key;
  }

  private static bookshelfRemovalReceipt(data: JsonObject,
    requested: BookshelfSelectionTarget[]): BookshelfRemovalReceipt {
    const fields = data as Object as Record<string, Object>;
    const requestedCount = ReaderEffects.getNumber(data, 'requestedCount', requested.length);
    const uniqueCount = ReaderEffects.getNumber(data, 'uniqueCount', requested.length);
    return {
      requestedCount: requestedCount,
      uniqueCount: uniqueCount,
      removedTargets: ReaderEffects.receiptTargets(fields['removedTargets']),
      missingTargets: ReaderEffects.receiptTargets(fields['missingTargets']),
      duplicateTargets: ReaderEffects.receiptTargets(fields['duplicateTargets']),
    };
  }

  private static receiptTargets(value: Object | undefined): BookshelfSelectionTarget[] {
    const result: BookshelfSelectionTarget[] = [];
    if (!Array.isArray(value)) return result;
    const values = value as JsonObject[];
    for (let index = 0; index < values.length; index += 1) {
      const target: JsonObject = values[index];
      if (target === null || Array.isArray(target)) continue;
      const sourceId = ReaderEffects.getString(target, 'sourceId');
      const bookId = ReaderEffects.getString(target, 'bookId');
      if (sourceId.length === 0 || bookId.length === 0) continue;
      result.push({ sourceId: sourceId, bookId: bookId });
    }
    return result;
  }

  private static retryLastOperation(): void {
    const state = ReaderUiStore.snapshot();
    const route = state.routeId;
    if (route === 'discover' || route === 'discover-home') {
      ReaderEffects.loadDiscover(state.discoverSourceId, state.discoverKindUrl);
      return;
    }
    if (route === 'source-detect' || route === 'source-test-result') {
      ReaderEffects.runSourceCheck();
      return;
    }
    if (route === 'bookshelf' || route === 'bookshelf-cover-mode' || route === 'bookshelf-list-mode') {
      ReaderEffects.loadBookshelf();
      return;
    }
    if (route === 'rss' || route === 'rss-all' || route === 'rss-subscription-management') {
      ReaderEffects.loadRss();
      return;
    }
    if (route === 'source-switch' && !isLocalBookSourceId(state.currentBook?.sourceId)) {
      ReaderEffects.loadAvailableSources(true);
      return;
    }
    if (route === 'source-management' || route === 'source-batch') {
      ReaderEffects.loadAvailableSources(false);
      return;
    }
    if (route === 'book-search' || route === 'search-home' || route === 'search-results') {
      if (state.searchQuery.length > 0) ReaderEffects.runSearch(state.searchQuery);
      return;
    }
    if (state.overlay === 'content-search') {
      if (state.contentSearchQuery.length > 0) ReaderEffects.runContentSearch(state.contentSearchQuery);
      return;
    }
    if (route === 'book-detail' || route === 'book-detail-toc-preview') {
      const book = state.currentBook;
      if (book !== null) {
        // Search/detail results need not be on the bookshelf yet. Retrying
        // them must retain their Core sourceId instead of treating the shelf
        // as an implicit source resolver.
        ReaderEffects.runBookDetail(book.bookId, false, book.sourceId ?? '');
      }
      return;
    }
    if (route === 'reader' || route === 'immersive-reading' || route === 'reader_content') {
      if (ReaderEffects.currentChapterId.length > 0 && ReaderEffects.currentBookId.length > 0) {
        ReaderEffects.runChapter(ReaderEffects.currentChapterId, ReaderEffects.currentBookId);
      }
    }
  }

  // ── Chapter navigation ────────────────────────────────────────────────
  // Load the previous or next chapter relative to the current one.
  // Re-fetches the book detail/TOC page, parses it via Core book.toc, finds
  // the current chapter index, then loads the adjacent chapter.
  static loadAdjacentChapter(direction: number, chapterNavigationRequestId?: number): void {
    const state = ReaderUiStore.snapshot();
    const book = state.currentBook;
    if (book === null || ReaderEffects.currentChapterId.length === 0) {
      ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
      return;
    }
    const sourceId = book.sourceId ?? ReaderEffects.currentSourceId;
    if (isLocalBookSourceId(sourceId)) {
      ReaderEffects.loadLocalBookToc(book).then((toc: ChapterTocEntry[]): void => {
        let currentIndex = ReaderEffects.currentChapterIndex;
        for (let i = 0; i < toc.length; i++) {
          if (toc[i].chapterId === ReaderEffects.currentChapterId) {
            currentIndex = i;
            break;
          }
        }
        const targetIndex = currentIndex + direction;
        if (targetIndex >= 0 && targetIndex < toc.length) {
          ReaderEffects.loadLocalBookChapter(book, toc[targetIndex], undefined, undefined, undefined,
            chapterNavigationRequestId);
        } else {
          ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
        }
      }).catch((e: Error): void => {
        ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
        ReaderUiStore.dispatch({
          type: 'set-error',
          error: { code: 'LOCAL_BOOK_TOC_FAILED', message: e.message, retryable: true },
        });
      });
      return;
    }
    // Remote chapter navigation never recreates a demo URL. The source must
    // still exist in Core storage and Core constructs the request itself.
    ReaderEffects.loadRemoteAdjacentChapter(book, sourceId, direction, chapterNavigationRequestId).then((started: boolean): void => {
      if (!started) ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
    }).catch((e: Error): void => {
      ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
      ReaderEffects.surfaceRemoteSourceError('CHAPTER_NAVIGATION_FAILED', e);
    });
  }

  // Load a chapter at a specific progress percentage [0, 100].
  static loadChapterByProgress(progress: number): void {
    const state = ReaderUiStore.snapshot();
    const book = state.currentBook;
    if (book === null) {
      return;
    }
    const sourceId = book.sourceId ?? ReaderEffects.currentSourceId;
    if (isLocalBookSourceId(sourceId)) {
      ReaderEffects.loadLocalBookToc(book).then((toc: ChapterTocEntry[]): void => {
        if (toc.length === 0) return;
        const targetIndex = Math.min(Math.floor((progress / 100) * toc.length), toc.length - 1);
        ReaderEffects.loadLocalBookChapter(book, toc[targetIndex]);
      }).catch((e: Error): void => {
        ReaderUiStore.dispatch({
          type: 'set-error',
          error: { code: 'LOCAL_BOOK_TOC_FAILED', message: e.message, retryable: true },
        });
      });
      return;
    }
    ReaderEffects.loadRemoteChapterByProgress(book, sourceId, progress).catch((e: Error): void => {
      ReaderEffects.surfaceRemoteSourceError('CHAPTER_NAVIGATION_FAILED', e);
    });
  }

  // ── Search ────────────────────────────────────────────────────────────
  static runSearch(query: string): void {
    const keyword = query.trim();
    const state = ReaderUiStore.snapshot();
    if (keyword.length === 0 || !ReaderEffects.isTitleSearchRoute(state.routeId)) return;
    const sequence = ReaderEffects.titleSearchRequestSequence + 1;
    ReaderEffects.titleSearchRequestSequence = sequence;
    // A title search may proceed even when history persistence fails.  The
    // Core history write is deliberately isolated so it cannot turn a real
    // multi-source search result into a fabricated failure screen.
    if (state.settingsToggles.enableSearchHistory) {
      ReaderEffects.addSearchHistory(keyword, sequence);
    }
    ReaderEffects.runSearchFromPersistedSources(keyword, sequence).catch((e: Error): void => {
      if (!ReaderEffects.isCurrentTitleSearch(sequence, keyword)) return;
      ReaderUiStore.dispatch({
        type: 'search-failure',
        error: { code: 'SEARCH_FAILED', message: e.message, retryable: true },
      });
    });
  }

  // ── Core search.history vertical ─────────────────────────────────────

  static loadSearchHistory(): void {
    if (!CoreRuntime.isInitialized()) return;
    const sequence = ReaderEffects.searchHistoryRequestSequence + 1;
    ReaderEffects.searchHistoryRequestSequence = sequence;
    ReaderUiStore.dispatch({ type: 'search-history-load-start' });
    try {
      const requestedLimit = ReaderUiStore.snapshot().searchHistoryLimit;
      CoreRuntime.get().searchHistoryList(requestedLimit).then((data: JsonObject): void => {
        if (sequence !== ReaderEffects.searchHistoryRequestSequence) return;
        ReaderUiStore.dispatch({
          type: 'search-history-loaded',
          searchHistory: ReaderEffects.mapCoreSearchHistory(data),
        });
      }).catch((e: Error): void => {
        if (sequence !== ReaderEffects.searchHistoryRequestSequence) return;
        ReaderUiStore.dispatch({ type: 'search-history-failed', searchHistoryError: e.message });
      });
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'search-history-failed', searchHistoryError: (e as Error).message,
      });
    }
  }

  static mapCoreSearchHistory(data: JsonObject): string[] {
    const fields = data as Object as Record<string, Object[]>;
    const rawKeywords: Object[] = fields['keywords'];
    const keywords: string[] = [];
    if (!Array.isArray(rawKeywords)) return keywords;
    for (let i = 0; i < rawKeywords.length; i++) {
      const value = rawKeywords[i];
      if (typeof value !== 'string') continue;
      const keyword = value.trim();
      if (keyword.length > 0) keywords.push(keyword);
    }
    return keywords;
  }

  private static addSearchHistory(keyword: string, sequence: number): void {
    if (!ReaderEffects.isCurrentTitleSearch(sequence, keyword)) return;
    try {
      CoreRuntime.get().searchHistoryAdd(keyword).then((): void => {
        // Re-read instead of appending optimistically: Core decides duplicate
        // and ordering semantics (usage/lastUseTime) shared across platforms.
        if (!ReaderEffects.isCurrentTitleSearch(sequence, keyword)) return;
        ReaderEffects.loadSearchHistory();
      }).catch((e: Error): void => {
        console.info(`ReaderEffects: search-history-add error: ${e.message}`);
      });
    } catch (e) {
      console.info(`ReaderEffects: search-history-add error: ${(e as Error).message}`);
    }
  }

  private static isTitleSearchRoute(routeId: string): boolean {
    return routeId === 'book-search' || routeId === 'search-home' || routeId === 'search-results';
  }

  private static isCurrentTitleSearch(sequence: number, keyword: string): boolean {
    const state = ReaderUiStore.snapshot();
    return sequence === ReaderEffects.titleSearchRequestSequence &&
      ReaderEffects.isTitleSearchRoute(state.routeId) && state.searchQuery.trim() === keyword;
  }

  private static invalidateTitleSearchIfRouteLeft(): void {
    if (!ReaderEffects.isTitleSearchRoute(ReaderUiStore.snapshot().routeId)) {
      ReaderEffects.titleSearchRequestSequence += 1;
    }
  }

  private static rejectUnconfirmedSearchHistoryClear(): void {
    ReaderUiStore.dispatch({
      type: 'search-history-clear-not-applied',
      searchHistoryError: '请先在搜索历史页确认清空 Core 中的全部历史记录。',
    });
  }

  private static clearConfirmedSearchHistory(): void {
    const state = ReaderUiStore.snapshot();
    if (state.routeId !== 'book-search' || !state.searchHistoryLoading ||
      !state.pendingSearchHistoryClear || !state.searchHistoryLoaded || state.searchHistory.length === 0) {
      ReaderEffects.rejectUnconfirmedSearchHistoryClear();
      return;
    }
    if (ReaderEffects.searchHistoryClearInFlight) return;
    if (!CoreRuntime.isInitialized()) {
      ReaderUiStore.dispatch({
        type: 'search-history-clear-not-applied',
        searchHistoryError: 'Reader-Core 尚未就绪，无法清除搜索历史。',
      });
      return;
    }
    ReaderEffects.searchHistoryClearInFlight = true;
    const sequence = ReaderEffects.searchHistoryRequestSequence + 1;
    ReaderEffects.searchHistoryRequestSequence = sequence;
    try {
      CoreRuntime.get().searchHistoryClear().then((data: JsonObject): void => {
        ReaderEffects.searchHistoryClearInFlight = false;
        if (sequence !== ReaderEffects.searchHistoryRequestSequence) return;
        const cleared = ReaderEffects.getNumber(data, 'cleared', -1);
        if (!Number.isFinite(cleared) || cleared <= 0) {
          ReaderEffects.refreshSearchHistoryAfterClearFailure(
            'Core 未清空搜索历史；已重新读取当前记录。', sequence,
          );
          return;
        }
        ReaderUiStore.dispatch({ type: 'search-history-clear-complete' });
        ReaderEffects.loadSearchHistory();
      }).catch((e: Error): void => {
        ReaderEffects.searchHistoryClearInFlight = false;
        if (sequence !== ReaderEffects.searchHistoryRequestSequence) return;
        ReaderEffects.refreshSearchHistoryAfterClearFailure(`清空搜索历史失败：${e.message}`, sequence);
      });
    } catch (e) {
      ReaderEffects.searchHistoryClearInFlight = false;
      ReaderEffects.refreshSearchHistoryAfterClearFailure(
        `清空搜索历史失败：${(e as Error).message}`, sequence,
      );
    }
  }

  private static refreshSearchHistoryAfterClearFailure(message: string, sequence: number): void {
    if (!CoreRuntime.isInitialized()) {
      ReaderUiStore.dispatch({ type: 'search-history-clear-not-applied', searchHistoryError: message });
      return;
    }
    const state = ReaderUiStore.snapshot();
    const limit = state.searchHistoryLimit;
    try {
      CoreRuntime.get().searchHistoryList(limit).then((data: JsonObject): void => {
        if (sequence !== ReaderEffects.searchHistoryRequestSequence) return;
        ReaderUiStore.dispatch({ type: 'search-history-loaded', searchHistory: ReaderEffects.mapCoreSearchHistory(data) });
        ReaderUiStore.dispatch({ type: 'search-history-clear-not-applied', searchHistoryError: message });
      }).catch((e: Error): void => {
        if (sequence !== ReaderEffects.searchHistoryRequestSequence) return;
        ReaderUiStore.dispatch({
          type: 'search-history-clear-not-applied',
          searchHistoryError: `${message} 搜索历史刷新失败：${e.message}`,
        });
      });
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'search-history-clear-not-applied',
        searchHistoryError: `${message} 搜索历史刷新失败：${(e as Error).message}`,
      });
    }
  }

  // ── Core cached-body search ─────────────────────────────────────────
  // This is intentionally distinct from `book.search`: Core searches only
  // chapter_cache rows for the one book+source that is presently open. The UI
  // must not fall back to the rendered chapter text or a default source.
  static runContentSearch(query: string): void {
    const keyword = query.trim();
    const state = ReaderUiStore.snapshot();
    if (!ReaderEffects.isContentSearchSurface(state)) {
      ReaderUiStore.dispatch({
        type: 'content-search-failure',
        contentSearchMessage: '请在当前阅读器的正文搜索面板中执行搜索。',
      });
      return;
    }
    const book = state.currentBook;
    if (keyword.length === 0) {
      ReaderUiStore.dispatch({
        type: 'content-search-failure',
        contentSearchMessage: '请输入正文搜索关键词。',
      });
      return;
    }
    if (book === null) {
      ReaderUiStore.dispatch({
        type: 'content-search-failure',
        contentSearchMessage: '尚未打开书籍，无法搜索正文。',
      });
      return;
    }
    const sourceId = (book.sourceId ?? ReaderEffects.currentSourceId).trim();
    if (sourceId.length === 0 || book.bookId.trim().length === 0) {
      ReaderUiStore.dispatch({
        type: 'content-search-failure',
        contentSearchMessage: '当前书籍缺少 Core sourceId 或 bookId，无法搜索已缓存正文。',
      });
      return;
    }
    const requestSequence = ++ReaderEffects.contentSearchRequestSequence;
    try {
      const runtime = CoreRuntime.get();
      runtime.searchContent(keyword, sourceId, book.bookId, 50).then((data: JsonObject): void => {
        // Search results are valid only for the exact book/source that issued
        // this request. A late result must not appear after a source switch.
        const latest = ReaderUiStore.snapshot();
        const latestBook = latest.currentBook;
        const latestSourceId = latestBook === null ? '' :
          (latestBook.sourceId ?? ReaderEffects.currentSourceId).trim();
        if (requestSequence !== ReaderEffects.contentSearchRequestSequence || latestBook === null ||
          latestBook.bookId !== book.bookId || latestSourceId !== sourceId) {
          return;
        }
        ReaderUiStore.dispatch({
          type: 'content-search-success',
          contentSearchResults: ReaderEffects.mapContentSearchResults(data, sourceId, book.bookId),
        });
      }).catch((e: Error): void => {
        if (requestSequence !== ReaderEffects.contentSearchRequestSequence) return;
        ReaderUiStore.dispatch({
          type: 'content-search-failure',
          contentSearchMessage: `Core 正文搜索失败：${e.message}`,
        });
      });
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'content-search-failure',
        contentSearchMessage: `Core 正文搜索不可用：${(e as Error).message}`,
      });
    }
  }

  static openContentSearchResult(resultIndex: number): void {
    const state = ReaderUiStore.snapshot();
    const book = state.currentBook;
    if (!ReaderEffects.isContentSearchSurface(state) || state.contentSearchLoading ||
      !state.contentSearchLoaded || book === null || resultIndex < 0 ||
      resultIndex >= state.contentSearchResults.length) {
      ReaderUiStore.dispatch({
        type: 'content-search-jump-status',
        contentSearchMessage: '正文搜索结果已失效，请重新搜索。',
      });
      return;
    }
    const result = state.contentSearchResults[resultIndex];
    const sourceId = (book.sourceId ?? ReaderEffects.currentSourceId).trim();
    if (sourceId.length === 0 || result.sourceId !== sourceId || result.bookId !== book.bookId) {
      ReaderUiStore.dispatch({
        type: 'content-search-jump-status',
        contentSearchMessage: '结果不属于当前打开的 Core 书籍或书源，已拒绝跳转。',
      });
      return;
    }
    ReaderUiStore.dispatch({
      type: 'content-search-jump-status',
      contentSearchMessage: `正在打开 Core 目录第 ${result.chapterIndex + 1} 章…`,
    });
    // This supersedes every older detail/TOC/content callback. The panel may
    // pop synchronously below, but reader routes deliberately preserve the
    // transaction; leaving the reader invalidates it through cancelBookOpen.
    const sequence = ReaderEffects.bookOpenRequestSequence + 1;
    ReaderEffects.bookOpenRequestSequence = sequence;
    ReaderEffects.closeContentSearchPanel();
    if (isLocalBookSourceId(sourceId)) {
      ReaderEffects.openLocalContentSearchResult(book, result, sequence);
      return;
    }
    ReaderEffects.openRemoteContentSearchResult(book, sourceId, result, sequence);
  }

  private static openLocalContentSearchResult(book: BookDetail, result: CoreContentSearchResult,
    sequence: number): void {
    ReaderEffects.loadLocalBookToc(book, sequence).then((toc: ChapterTocEntry[]): void => {
      if (!ReaderEffects.isCurrentBookOpen(sequence)) return;
      let target: ChapterTocEntry | null = null;
      for (let i = 0; i < toc.length; i++) {
        if (toc[i].index === result.chapterIndex) {
          target = toc[i];
          break;
        }
      }
      if (target === null) {
        throw new Error(`Core 本地目录中没有第 ${result.chapterIndex + 1} 章。`);
      }
      ReaderEffects.loadLocalBookChapter(book, target, result.chapterOffset, undefined, sequence);
    }).catch((e: Error): void => {
      if (!ReaderEffects.isCurrentBookOpen(sequence)) return;
      ReaderEffects.surfaceContentSearchJumpError(e);
    });
  }

  private static openRemoteContentSearchResult(book: BookDetail, sourceId: string,
    result: CoreContentSearchResult, sequence: number): void {
    ReaderEffects.loadStoredSourceToc(book, sourceId, sequence).then((toc: JsonObject[]): void => {
      if (!ReaderEffects.isCurrentBookOpen(sequence)) return;
      const position = ReaderEffects.findTocPositionByCoreIndex(toc, result.chapterIndex);
      if (position < 0) {
        throw new Error(`Core 目录中没有第 ${result.chapterIndex + 1} 章。`);
      }
      ReaderEffects.loadStoredSourceChapter(book, toc, position, sourceId, {
        contentSearchOffset: result.chapterOffset,
        bookOpenSequence: sequence,
      });
    }).catch((e: Error): void => {
      if (!ReaderEffects.isCurrentBookOpen(sequence)) return;
      ReaderEffects.surfaceContentSearchJumpError(e);
    });
  }

  private static closeContentSearchPanel(): void {
    if (ReaderUiStore.snapshot().overlay === 'content-search') {
      ReaderUiStore.dispatch({ type: 'set-overlay', overlay: '' });
    }
  }

  private static isContentSearchSurface(state: ReaderUiState): boolean {
    const readerRoute = state.routeId === 'immersive-reading' ||
      state.routeId === 'reader' || state.routeId === 'reader_content';
    return readerRoute && state.overlay === 'content-search';
  }

  private static surfaceContentSearchJumpError(error: Error): void {
    const message = `正文搜索跳转失败：${error.message}`;
    ReaderUiStore.dispatch({ type: 'content-search-jump-status', contentSearchMessage: message });
    ReaderUiStore.dispatch({
      type: 'set-error',
      error: { code: 'CONTENT_SEARCH_JUMP_FAILED', message: message, retryable: true },
    });
  }

  // ── Book detail ───────────────────────────────────────────────────────
  // bookId from search results is a relative path like '/book/123'.
  // On success, callers may explicitly request first-chapter loading. This is
  // for reader-entry flows such as ContinueReadingCard; plain book-detail
  // navigation must stay on the detail page without starting chapter loading.
  //
  // Core resolves the selected persisted source and owns all remote HTTP
  // request construction. `preferredSourceId` must come from a Core search
  // row or bookshelf entry; source-less fixture routes surface a recoverable
  // error instead of silently choosing a demo/default source.
  static runBookDetail(bookId: string, loadFirstChapter: boolean = false,
    preferredSourceId: string = ''): void {
    ReaderEffects.cancelSourceSwitchIfActive();
    const sequence = ReaderEffects.bookOpenRequestSequence + 1;
    ReaderEffects.bookOpenRequestSequence = sequence;
    ReaderEffects.runBookDetailFromPersistedSource(bookId, loadFirstChapter, preferredSourceId, sequence).catch((e: Error): void => {
      if (!ReaderEffects.isCurrentBookOpen(sequence)) return;
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: { code: 'BOOK_DETAIL_FAILED', message: e.message, retryable: true },
      });
    });
  }

  // ── Chapter content ───────────────────────────────────────────────────
  // chapterId is a full relative path (e.g. '/book/123/ch1.html') from
  // book.toc's first chapter URL.
  static runChapter(chapterId: string, bookId: string): void {
    ReaderEffects.currentChapterId = chapterId;
    ReaderEffects.currentBookId = bookId;
    const state = ReaderUiStore.snapshot();
    const currentBook = state.currentBook;
    const sourceId = currentBook?.sourceId ?? ReaderEffects.currentSourceId;
    ReaderEffects.currentSourceId = sourceId;
    if (currentBook !== null && ReaderEffects.currentSourceId === 'local') {
      ReaderEffects.loadLocalBookToc(currentBook).then((toc: ChapterTocEntry[]): void => {
        let selected: ChapterTocEntry | null = null;
        for (let i = 0; i < toc.length; i++) {
          if (toc[i].chapterId === chapterId) {
            selected = toc[i];
            break;
          }
        }
        if (selected === null) {
          throw new Error('本地目录中找不到目标章节');
        }
        ReaderEffects.loadLocalBookChapter(currentBook, selected);
      }).catch((e: Error): void => {
        ReaderUiStore.dispatch({
          type: 'set-error',
          error: { code: 'LOCAL_BOOK_CHAPTER_FAILED', message: e.message, retryable: true },
        });
      });
      return;
    }
    if (currentBook === null) {
      ReaderEffects.surfaceRemoteSourceError('CHAPTER_FAILED',
        new Error('当前章节没有关联书籍。请先从已导入书源的搜索结果或书架打开书籍。'));
      return;
    }
    ReaderEffects.runRemoteChapter(currentBook, sourceId, chapterId).catch((e: Error): void => {
      ReaderEffects.surfaceRemoteSourceError('CHAPTER_FAILED', e);
    });
  }

  // Remote reading has one authoritative source selector: persisted Core
  // source.list rows.  UI-local availableSources is intentionally not trusted
  // here because it can be stale after a delete/disable or a process restart.
  private static coreSourceEntries(data: JsonObject): CoreSourceEntry[] {
    const fields = data as Object as Record<string, Object[]>;
    const rawSources: Object[] = fields['sources'];
    const sources: CoreSourceEntry[] = [];
    if (!Array.isArray(rawSources)) return sources;
    for (let i = 0; i < rawSources.length; i++) {
      const raw = rawSources[i] as Object as JsonObject;
      const sourceId = ReaderEffects.getString(raw, 'sourceId').trim();
      if (sourceId.length === 0) continue;
      const booleans = raw as Object as Record<string, boolean>;
      sources.push({
        sourceId: sourceId,
        name: ReaderEffects.getString(raw, 'name', sourceId),
        baseUrl: ReaderEffects.getString(raw, 'baseUrl'),
        enabled: booleans['enabled'] === true,
        enabledExplore: booleans['enabledExplore'] === true,
      });
    }
    return sources;
  }

  // source.check.run owns the L1–L5 diagnostic transaction.  Core resolves
  // the persisted BookSource and emits its own http.execute continuations;
  // Harmony only routes those Host requests.  The UI therefore never creates
  // a local L1 success or an inferred network verdict.
  private static runSourceCheck(): void {
    const sequence = ReaderEffects.sourceCheckRequestSequence + 1;
    ReaderEffects.sourceCheckRequestSequence = sequence;
    const selectedSourceId = (ReaderUiStore.snapshot().selectedSourceId ?? '').trim();
    ReaderUiStore.dispatch({ type: 'source-check-start', sourceCheckSourceId: selectedSourceId });
    ReaderEffects.runSourceCheckFromCore(sequence, selectedSourceId).catch((e: Error): void => {
      if (sequence !== ReaderEffects.sourceCheckRequestSequence) return;
      ReaderUiStore.dispatch({
        type: 'source-check-failed',
        sourceCheckError: e.message.length > 0 ? e.message : '读取 Core 书源失败。',
      });
    });
  }

  private static async runSourceCheckFromCore(sequence: number, sourceId: string): Promise<void> {
    if (sourceId.length === 0) {
      if (sequence === ReaderEffects.sourceCheckRequestSequence) {
        ReaderUiStore.dispatch({
          type: 'source-check-empty',
          sourceCheckMessage: '未选择书源。请先在书源管理中打开一个由 Core 返回的书源。',
        });
      }
      return;
    }

    const runtime = CoreRuntime.get();
    const listData = await runtime.sourceList(false);
    if (sequence !== ReaderEffects.sourceCheckRequestSequence) return;
    const sources = ReaderEffects.coreSourceEntries(listData);
    let source: CoreSourceEntry | null = null;
    for (let i = 0; i < sources.length; i++) {
      if (sources[i].sourceId === sourceId) {
        source = sources[i];
        break;
      }
    }
    if (source === null) {
      ReaderUiStore.dispatch({
        type: 'source-check-empty',
        sourceCheckSourceId: sourceId,
        sourceCheckMessage: `Core source.list 未找到已选择的书源“${sourceId}”。该源可能已被删除，请返回书源管理重新选择。`,
      });
      return;
    }

    // Preserve the Core-owned display identity before the asynchronous
    // diagnostic begins, so a disabled/network failure remains attached to
    // the actual selected source rather than an anonymous UI row.
    ReaderUiStore.dispatch({
      type: 'source-check-source-resolved',
      sourceCheckSourceId: source.sourceId,
      sourceCheckSourceName: source.name,
    });

    // Core also rejects disabled sources, but fail before opening any Host
    // transport so a source deliberately stopped in source.list cannot ever
    // be rendered as a successful online diagnostic by this frontend.
    if (!source.enabled) {
      ReaderUiStore.dispatch({
        type: 'source-check-failed',
        sourceCheckError: `书源“${source.name}”已停用。请先在书源管理中启用后再运行检测。`,
      });
      return;
    }

    const runData = await runtime.sourceCheckRun(
      [source.sourceId],
      '我的',
      ['L1', 'L2', 'L3', 'L4', 'L5'],
      90000,
    );
    if (sequence !== ReaderEffects.sourceCheckRequestSequence) return;
    const rawResult = ReaderEffects.mapSourceCheckResult(runData, source.sourceId);
    if (rawResult === null) {
      ReaderUiStore.dispatch({
        type: 'source-check-failed',
        sourceCheckError: 'Core source.check.run 未返回当前书源的诊断 verdict。请重试；若持续发生，请检查 Core 与应用包版本是否一致。',
      });
      return;
    }
    const result = ReaderEffects.validateFullSourceCheckRunResult(rawResult);
    ReaderUiStore.dispatch({
      // This event means Core delivered a verdict, not that the verdict is
      // positive.  `result.available` remains false for a Host/network error,
      // every failed stage, or an incomplete/malformed L1–L5 result.
      type: 'source-check-success',
      sourceCheckResult: result,
      sourceCheckMessage: result.available
        ? 'Core 已通过 Host http.execute 完成 L1–L5 真实书源诊断。'
        : 'Core 已返回未通过的真实书源诊断 verdict；请查看失败阶段后重试。',
    });
  }

  // Source debugging deliberately reuses Core's real `source.check.run`
  // chain, but asks CoreRuntime to attach an in-memory recorder to the
  // annotated Host completions and feed the captured response bodies straight
  // into `source.debug`.  ReaderEffects receives only the sanitized projection
  // and can therefore never display response text as a faux persistent log.
  private static runSourceDebug(): void {
    const sequence = ReaderEffects.sourceDebugRequestSequence + 1;
    ReaderEffects.sourceDebugRequestSequence = sequence;
    const selectedSourceId = (ReaderUiStore.snapshot().selectedSourceId ?? '').trim();
    ReaderUiStore.dispatch({ type: 'source-debug-start', sourceDebugSourceId: selectedSourceId });
    ReaderEffects.runSourceDebugFromCore(sequence, selectedSourceId).catch((e: Error): void => {
      if (sequence !== ReaderEffects.sourceDebugRequestSequence) return;
      ReaderUiStore.dispatch({
        type: 'source-debug-failed',
        sourceDebugError: e.message.length > 0 ? e.message : '读取 Core 书源或执行调测失败。',
      });
    });
  }

  private static async runSourceDebugFromCore(sequence: number, sourceId: string): Promise<void> {
    if (sourceId.length === 0) {
      if (sequence === ReaderEffects.sourceDebugRequestSequence) {
        ReaderUiStore.dispatch({
          type: 'source-debug-empty',
          sourceDebugMessage: '未选择书源。请选择一个由 Core source.list 返回且处于启用状态的书源后再调测。',
        });
      }
      return;
    }

    const runtime = CoreRuntime.get();
    const listData = await runtime.sourceList(false);
    if (sequence !== ReaderEffects.sourceDebugRequestSequence) return;
    const sources = ReaderEffects.coreSourceEntries(listData);
    let source: CoreSourceEntry | null = null;
    for (let i = 0; i < sources.length; i++) {
      if (sources[i].sourceId === sourceId) {
        source = sources[i];
        break;
      }
    }
    if (source === null) {
      ReaderUiStore.dispatch({
        type: 'source-debug-empty',
        sourceDebugSourceId: sourceId,
        sourceDebugMessage: `Core source.list 未找到“${sourceId}”；该书源可能已被删除，请重新选择。`,
      });
      return;
    }
    if (!source.enabled) {
      ReaderUiStore.dispatch({
        type: 'source-debug-empty',
        sourceDebugSourceId: source.sourceId,
        sourceDebugMessage: `书源“${source.name}”已停用。调测不会对停用书源伪造请求或成功结果。`,
      });
      return;
    }

    ReaderUiStore.dispatch({
      type: 'source-debug-source-resolved',
      sourceDebugSourceId: source.sourceId,
      sourceDebugSourceName: source.name,
    });
    const projection = await runtime.sourceDebugRun(source.sourceId, '我的', 90000);
    if (sequence !== ReaderEffects.sourceDebugRequestSequence) return;
    const result = ReaderEffects.mapSourceDebugResult(projection);
    ReaderUiStore.dispatch({
      type: 'source-debug-success',
      sourceDebugResult: result,
      sourceDebugMessage: ReaderEffects.sourceDebugSummary(result),
    });
    // When launched from the primary action, move the running route to the
    // actual result projection. Deep-linked result routes remain useful and
    // render the same state without creating another Core request.
    if (ReaderUiStore.snapshot().routeId === 'source-debug-running') {
      ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-debug-result' });
    }
  }

  private static async enabledPersistedSources(): Promise<CoreSourceEntry[]> {
    const data = await CoreRuntime.get().sourceList(true);
    const sources = ReaderEffects.coreSourceEntries(data);
    if (sources.length === 0) {
      throw new Error('没有已启用的 Core 书源。请先前往“设置 > 书源管理 > 导入书源”导入并启用书源，再重试。');
    }
    return sources;
  }

  private static async resolvePersistedRemoteSource(preferredSourceId: string = ''): Promise<CoreSourceEntry> {
    const sources = await ReaderEffects.enabledPersistedSources();
    const preferred = preferredSourceId.trim();
    if (preferred.length === 0) {
      throw new Error('当前书籍没有关联的 Core sourceId。请从已导入书源的搜索结果或书架重新打开书籍。');
    }
    for (let i = 0; i < sources.length; i++) {
      if (sources[i].sourceId === preferred) return sources[i];
    }
    throw new Error(`书源“${preferred}”已不存在或未启用。请前往“设置 > 书源管理”重新导入或启用书源。`);
  }

  private static surfaceRemoteSourceError(code: string, error: Error): void {
    ReaderUiStore.dispatch({
      type: 'set-error',
      error: { code: code, message: error.message, retryable: true },
    });
  }

  // ── Discover (persisted Core source.explore*) ─────────────────────────
  // Discover is intentionally a single-source view.  Its visible source,
  // parsed category and result rows all originate from the same `sourceId`,
  // so tapping a row can enter book.detail without an implicit default source.
  private static loadDiscover(preferredSourceId: string = '', preferredKindUrl: string = ''): void {
    const sequence = ReaderEffects.discoverRequestSequence + 1;
    ReaderEffects.discoverRequestSequence = sequence;
    ReaderUiStore.dispatch({ type: 'discover-load-start' });
    ReaderEffects.loadDiscoverFromCore(sequence, preferredSourceId, preferredKindUrl).catch((e: Error): void => {
      if (sequence !== ReaderEffects.discoverRequestSequence) return;
      const message = e.message.length > 0 ? e.message : 'Core 发现请求失败';
      ReaderUiStore.dispatch({ type: 'discover-failed', discoverError: message });
    });
  }

  private static async loadDiscoverFromCore(
    sequence: number,
    preferredSourceId: string,
    preferredKindUrl: string,
  ): Promise<void> {
    const runtime = CoreRuntime.get();
    // `enabledOnly` filters the persisted source list at Core.  Discovery then
    // applies the separate Core `enabledExplore` flag; a search-only source
    // must never become a fabricated discovery source.
    const sourceData = await runtime.sourceList(true);
    const persisted = ReaderEffects.coreSourceEntries(sourceData);
    const sources: CoreSourceEntry[] = [];
    for (let i = 0; i < persisted.length; i++) {
      const source = persisted[i];
      if (source.enabled && source.enabledExplore === true) {
        sources.push(source);
      }
    }
    if (sequence !== ReaderEffects.discoverRequestSequence) return;

    if (sources.length === 0) {
      ReaderUiStore.dispatch({
        type: 'discover-data-loaded',
        discoverSources: [],
        discoverSourceId: '',
        discoverKinds: [],
        discoverKindUrl: '',
        discoverKindTitle: '',
        discoverBooks: [],
      });
      return;
    }

    const requestedSourceId = preferredSourceId.trim();
    let source = sources[0];
    for (let i = 0; i < sources.length; i++) {
      if (sources[i].sourceId === requestedSourceId) {
        source = sources[i];
        break;
      }
    }

    ReaderUiStore.dispatch({
      type: 'discover-source-resolved',
      discoverSources: sources,
      discoverSourceId: source.sourceId,
    });

    const kindsData = await runtime.sourceExploreKinds(source.sourceId);
    if (sequence !== ReaderEffects.discoverRequestSequence) return;
    const kinds = ReaderEffects.mapDiscoverKinds(kindsData);
    const requestedKindUrl = preferredKindUrl.trim();
    let selectedKind: CoreDiscoverKind | null = null;
    for (let i = 0; i < kinds.length; i++) {
      if (kinds[i].url.length > 0 && kinds[i].url === requestedKindUrl) {
        selectedKind = kinds[i];
        break;
      }
    }
    if (selectedKind === null) {
      for (let i = 0; i < kinds.length; i++) {
        if (kinds[i].url.length > 0) {
          selectedKind = kinds[i];
          break;
        }
      }
    }

    // A source can legitimately publish only grouping headers or no explore
    // rule at all.  Preserve that exact Core result and render the no-category
    // recovery state instead of substituting a ranking/category fixture.
    if (selectedKind === null) {
      ReaderUiStore.dispatch({
        type: 'discover-data-loaded',
        discoverSources: sources,
        discoverSourceId: source.sourceId,
        discoverKinds: kinds,
        discoverKindUrl: '',
        discoverKindTitle: '',
        discoverBooks: [],
      });
      return;
    }

    const exploreData = await runtime.sourceExplore(source.sourceId, selectedKind.url, 1);
    if (sequence !== ReaderEffects.discoverRequestSequence) return;
    ReaderUiStore.dispatch({
      type: 'discover-data-loaded',
      discoverSources: sources,
      discoverSourceId: source.sourceId,
      discoverKinds: kinds,
      discoverKindUrl: selectedKind.url,
      discoverKindTitle: selectedKind.title,
      discoverBooks: ReaderEffects.mapDiscoverBooks(exploreData, source),
    });
  }

  private static cycleDiscoverSource(): void {
    const state = ReaderUiStore.snapshot();
    const sources = state.discoverSources;
    if (sources.length === 0) {
      ReaderEffects.loadDiscover();
      return;
    }
    let currentIndex = -1;
    for (let i = 0; i < sources.length; i++) {
      if (sources[i].sourceId === state.discoverSourceId) {
        currentIndex = i;
        break;
      }
    }
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % sources.length;
    ReaderEffects.loadDiscover(sources[nextIndex].sourceId, '');
  }

  private static async runSearchFromPersistedSources(keyword: string, sequence: number): Promise<void> {
    if (keyword.length === 0) {
      throw new Error('请输入搜索关键词。');
    }
    const sources = await ReaderEffects.enabledPersistedSources();
    if (!ReaderEffects.isCurrentTitleSearch(sequence, keyword)) return;
    const runtime = CoreRuntime.get();
    const results: SearchResultEntry[] = [];
    // This is a presentation preference only: every result still originates
    // from Core and the retained item keeps its exact sourceId/bookId.
    const mergedKeys: Map<string, boolean> = new Map<string, boolean>();
    const mergeSameBooks = ReaderUiStore.snapshot().settingsToggles.mergeSameBooks;
    const failures: string[] = [];
    let completedSources = 0;
    for (let i = 0; i < sources.length; i++) {
      if (!ReaderEffects.isCurrentTitleSearch(sequence, keyword)) return;
      const source = sources[i];
      try {
        const data = await runtime.bookSearchFromSource(source.sourceId, keyword, 1);
        if (!ReaderEffects.isCurrentTitleSearch(sequence, keyword)) return;
        completedSources += 1;
        const mapped = ReaderEffects.mapSearchResults(data, source);
        for (let j = 0; j < mapped.length && results.length < 20; j++) {
          const result = mapped[j];
          const mergeKey = `${result.title.trim().toLowerCase()}\u0000${result.author.trim().toLowerCase()}`;
          if (mergeSameBooks && mergedKeys.has(mergeKey)) continue;
          if (mergeSameBooks) mergedKeys.set(mergeKey, true);
          results.push(result);
        }
      } catch (e) {
        if (!ReaderEffects.isCurrentTitleSearch(sequence, keyword)) return;
        failures.push(`${source.name}：${(e as Error).message}`);
      }
    }
    if (completedSources === 0) {
      const detail = failures.length > 0 ? failures.slice(0, 2).join('；') : '未知错误';
      throw new Error(`所有已启用书源的 Core 搜索均失败：${detail}`);
    }
    if (!ReaderEffects.isCurrentTitleSearch(sequence, keyword)) return;
    ReaderUiStore.dispatch({ type: 'search-success', searchResults: results });
  }

  private static async runBookDetailFromPersistedSource(bookId: string, loadFirstChapter: boolean,
    preferredSourceId: string, sequence: number): Promise<void> {
    const source = await ReaderEffects.resolvePersistedRemoteSource(preferredSourceId);
    if (!ReaderEffects.isCurrentBookOpen(sequence)) return;
    const runtime = CoreRuntime.get();
    const baseBook: JsonObject = {};
    baseBook['bookId'] = bookId;
    const detailData = await runtime.bookDetailFromSource(source.sourceId, bookId, baseBook);
    if (!ReaderEffects.isCurrentBookOpen(sequence)) return;
    const detail = ReaderEffects.mapBookDetail(detailData, bookId, source);
    ReaderUiStore.dispatch({ type: 'book-detail-success', book: detail });
    const variables = ReaderEffects.getVariables(detailData);
    const tocUrl = detail.chapterListUrl.length > 0 ? detail.chapterListUrl : bookId;
    const tocData = await runtime.bookTocFromSource(source.sourceId, detail.bookId, tocUrl, variables);
    if (!ReaderEffects.isCurrentBookOpen(sequence)) return;
    const tocEntries = ReaderEffects.mapChapterToc(tocData);
    ReaderEffects.currentSourceId = source.sourceId;
    ReaderEffects.currentBookId = detail.bookId;
    ReaderEffects.currentTocVariables = variables;
    ReaderEffects.currentChapterToc = ReaderEffects.coreTocForEffect(tocData);
    ReaderUiStore.dispatch({ type: 'chapter-toc-loaded', chapterToc: tocEntries });
    if (loadFirstChapter) {
      if (ReaderEffects.currentChapterToc.length === 0 || tocEntries.length === 0) {
        throw new Error('Core 未返回可阅读章节目录。');
      }
      // This is a source-scoped lookup.  A remote book id alone is not enough
      // because the same logical book can have independent progress rows in
      // different sources.
      const persisted = await ReaderEffects.readPersistedReadingProgress(
        runtime, detail.bookId, source.sourceId,
      );
      if (!ReaderEffects.isCurrentBookOpen(sequence)) return;
      const targetPosition = ReaderEffects.persistedProgressTocPosition(
        ReaderEffects.currentChapterToc, persisted,
      );
      if (targetPosition < 0) {
        throw new Error('Core 目录中没有可恢复的阅读章节。');
      }
      const targetCoreIndex = ReaderEffects.getNumber(
        ReaderEffects.currentChapterToc[targetPosition], 'index', targetPosition,
      );
      if (persisted !== null && targetCoreIndex === persisted.chapterIndex) {
        const restoredProgress: PersistedReadingProgress = persisted as PersistedReadingProgress;
        ReaderEffects.loadStoredSourceChapter(
          detail, ReaderEffects.currentChapterToc, targetPosition, source.sourceId, {
            restoredProgress: restoredProgress,
            bookOpenSequence: sequence,
          },
        );
      } else {
        // The durable chapter identity disappeared from the updated TOC. We
        // can still open the first readable entry, but must not apply that
        // former chapter's offset to a different body.
        ReaderEffects.loadStoredSourceChapter(
          detail, ReaderEffects.currentChapterToc, targetPosition, source.sourceId, {
            bookOpenSequence: sequence,
          },
        );
      }
    }
  }

  private static async runRemoteChapter(book: BookDetail, preferredSourceId: string,
    chapterId: string): Promise<void> {
    const source = await ReaderEffects.resolvePersistedRemoteSource(preferredSourceId);
    ReaderEffects.currentSourceId = source.sourceId;
    const toc = await ReaderEffects.loadStoredSourceToc(book, source.sourceId);
    const index = ReaderEffects.findChapterIndex(toc, chapterId);
    if (index === -1) {
      throw new Error('Core 目录中找不到目标章节。请返回书籍详情重新加载目录。');
    }
    ReaderEffects.loadStoredSourceChapter(book, toc, index, source.sourceId);
  }

  private static async loadRemoteAdjacentChapter(book: BookDetail, preferredSourceId: string,
    direction: number, chapterNavigationRequestId?: number): Promise<boolean> {
    const source = await ReaderEffects.resolvePersistedRemoteSource(preferredSourceId);
    const toc = await ReaderEffects.loadStoredSourceToc(book, source.sourceId);
    const currentIndex = ReaderEffects.findChapterIndex(toc, ReaderEffects.currentChapterId);
    if (currentIndex === -1) {
      throw new Error('Core 目录中找不到当前章节。请返回书籍详情重新加载目录。');
    }
    const targetIndex = currentIndex + direction;
    if (targetIndex >= 0 && targetIndex < toc.length) {
      ReaderEffects.loadStoredSourceChapter(book, toc, targetIndex, source.sourceId, {
        chapterNavigationRequestId: chapterNavigationRequestId,
      });
      return true;
    }
    return false;
  }

  private static async loadRemoteChapterByProgress(book: BookDetail, preferredSourceId: string,
    progress: number): Promise<void> {
    const source = await ReaderEffects.resolvePersistedRemoteSource(preferredSourceId);
    const toc = await ReaderEffects.loadStoredSourceToc(book, source.sourceId);
    if (toc.length === 0) {
      throw new Error('Core 未返回可阅读章节。请检查已导入书源的目录规则。');
    }
    const clamped = Math.max(0, Math.min(100, progress));
    const targetIndex = Math.min(Math.floor((clamped / 100) * toc.length), toc.length - 1);
    ReaderEffects.loadStoredSourceChapter(book, toc, targetIndex, source.sourceId);
  }

  private static findChapterIndex(toc: JsonObject[], chapterId: string): number {
    for (let i = 0; i < toc.length; i++) {
      if (ReaderEffects.getString(toc[i], 'url') === chapterId) return i;
    }
    return -1;
  }

  // `search.content` returns Core's chapter-index identity, while the raw TOC
  // is an array whose position is not guaranteed to equal that identity. Keep
  // the distinction so a sparse/non-zero-based TOC cannot open the wrong row.
  private static findTocPositionByCoreIndex(toc: JsonObject[], chapterIndex: number): number {
    for (let i = 0; i < toc.length; i++) {
      if (ReaderEffects.getNumber(toc[i], 'index', i) === chapterIndex) return i;
    }
    return -1;
  }

  private static async readPersistedReadingProgress(runtime: CoreRuntime, bookId: string,
    sourceId: string): Promise<PersistedReadingProgress | null> {
    try {
      const data = await runtime.readingProgressGet(bookId, sourceId);
      return ReaderEffects.parsePersistedReadingProgress(data, bookId, sourceId);
    } catch (e) {
      // Rolling upgrades can temporarily pair the UI with an older Core NAPI
      // binary.  Falling back to an explicit chapter start is safer than
      // inventing a page-derived character offset.
      console.info(`ReaderEffects: persisted reading progress unavailable: ${(e as Error).message}`);
      return null;
    }
  }

  // Keep DTO validation independent of the async Core bridge so malformed,
  // foreign, or incomplete durable rows can be tested without pretending a
  // fake runtime proves NAPI behavior.
  static parsePersistedReadingProgress(data: JsonObject, bookId: string,
    sourceId: string): PersistedReadingProgress | null {
    const fields = data as Object as Record<string, Object>;
    if (fields['found'] !== true) return null;
    const rawProgress = fields['progress'];
    if (rawProgress === null || rawProgress === undefined || typeof rawProgress !== 'object' ||
      Array.isArray(rawProgress)) {
      return null;
    }
    const progress = rawProgress as Object as JsonObject;
    // A malformed or foreign payload must never relocate the visible reader.
    const returnedBookId = ReaderEffects.getString(progress, 'bookId');
    const returnedSourceId = ReaderEffects.getString(progress, 'sourceId');
    if (returnedBookId !== bookId || returnedSourceId !== sourceId) {
      return null;
    }
    const chapterIndex = ReaderEffects.getNumber(progress, 'chapterIndex', -1);
    const chapterOffset = ReaderEffects.getNumber(progress, 'chapterOffset', -1);
    const chapterProgress = ReaderEffects.getNumber(progress, 'chapterProgress', -1);
    if (!Number.isFinite(chapterIndex) || chapterIndex < 0 || !Number.isFinite(chapterOffset) ||
      chapterOffset < 0 || !Number.isFinite(chapterProgress) || chapterProgress < 0 || chapterProgress > 1) {
      return null;
    }
    return {
      chapterIndex: Math.floor(chapterIndex),
      chapterOffset: Math.floor(chapterOffset),
      chapterProgress: chapterProgress,
      locationRevision: ReaderEffects.getString(progress, 'locationRevision'),
    };
  }

  // Pure Core-identity selection policy for persisted remote rows. The return
  // value is a raw TOC position only after the progress chapter identity has
  // matched a readable Core row; it is never an interpretation of the Core
  // chapter index as an array position.
  static persistedProgressTocPosition(toc: JsonObject[],
    progress: PersistedReadingProgress | null): number {
    if (progress !== null) {
      const exactPosition = ReaderEffects.findTocPositionByCoreIndex(toc, progress.chapterIndex);
      if (exactPosition >= 0 && ReaderEffects.getString(toc[exactPosition], 'url').length > 0) {
        return exactPosition;
      }
      // Do not reinterpret a Core chapter identity as a raw array position.
      // A changed/sparse TOC cannot safely prove an equivalent chapter, so use
      // the first readable entry rather than silently opening an arbitrary one.
      console.info(`ReaderEffects: persisted chapter ${progress.chapterIndex} no longer exists in this TOC`);
    }
    for (let i = 0; i < toc.length; i++) {
      if (ReaderEffects.getString(toc[i], 'url').length > 0) return i;
    }
    return -1;
  }

  private static loadStoredSourceToc(book: BookDetail, sourceId: string,
    bookOpenSequence?: number): Promise<JsonObject[]> {
    if (bookOpenSequence !== undefined && !ReaderEffects.isCurrentBookOpen(bookOpenSequence)) {
      return Promise.resolve([]);
    }
    if (sourceId.trim().length === 0) {
      return Promise.reject(new Error('缺少已持久化的 Core sourceId。请先导入书源后重试。'));
    }
    if (ReaderEffects.currentChapterToc.length > 0 && ReaderEffects.currentBookId === book.bookId &&
      ReaderEffects.currentSourceId === sourceId) {
      return Promise.resolve(ReaderEffects.currentChapterToc);
    }
    const tocUrl = book.chapterListUrl.length > 0 ? book.chapterListUrl : book.bookId;
    return CoreRuntime.get().bookTocFromSource(sourceId, book.bookId, tocUrl,
      ReaderEffects.currentTocVariables).then((data: JsonObject): JsonObject[] => {
        if (bookOpenSequence !== undefined && !ReaderEffects.isCurrentBookOpen(bookOpenSequence)) return [];
        const value = data['toc'] as Object;
        if (!Array.isArray(value)) return [];
        const raw = value as Object[];
        const toc: JsonObject[] = [];
        for (let i = 0; i < raw.length; i++) {
          toc.push(raw[i] as Object as JsonObject);
        }
        ReaderEffects.currentChapterToc = toc;
        ReaderEffects.currentBookId = book.bookId;
        ReaderEffects.currentSourceId = sourceId;
        return toc;
      });
  }

  private static loadStoredSourceChapter(book: BookDetail, toc: JsonObject[], targetIndex: number,
    sourceId: string, options?: RemoteChapterLoadOptions): void {
    if (targetIndex < 0 || targetIndex >= toc.length) {
      if (options !== undefined) ReaderEffects.completeChapterNavigation(options.chapterNavigationRequestId);
      return;
    }
    let contentSearchOffset: number | undefined = undefined;
    let restoredProgress: PersistedReadingProgress | undefined = undefined;
    let bookOpenSequence: number | undefined = undefined;
    let chapterNavigationRequestId: number | undefined = undefined;
    if (options !== undefined) {
      contentSearchOffset = options.contentSearchOffset;
      restoredProgress = options.restoredProgress;
      bookOpenSequence = options.bookOpenSequence;
      chapterNavigationRequestId = options.chapterNavigationRequestId;
    }
    if (bookOpenSequence !== undefined && !ReaderEffects.isCurrentBookOpen(bookOpenSequence)) {
      ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
      return;
    }
    const entry = toc[targetIndex];
    const chapterUrl = ReaderEffects.getString(entry, 'url');
    if (chapterUrl.length === 0) {
      ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
      return;
    }
    const coreChapterIndex = ReaderEffects.getNumber(entry, 'index', targetIndex);
    const entryVariablesValue = entry['variables'] as Object;
    const entryVariables = entryVariablesValue !== null && typeof entryVariablesValue === 'object' &&
      !Array.isArray(entryVariablesValue)
      ? entryVariablesValue as Object as JsonObject : ReaderEffects.currentTocVariables;
    ReaderEffects.currentBookId = book.bookId;
    ReaderEffects.currentSourceId = sourceId;
    ReaderEffects.currentChapterId = chapterUrl;
    ReaderEffects.currentChapterIndex = coreChapterIndex;
    ReaderEffects.currentSourceVariables = entryVariables;
    ReaderUiStore.dispatch({ type: 'set-loading', loading: true });
    CoreRuntime.get().chapterContentFromSource(sourceId, book.bookId, chapterUrl,
      ReaderEffects.getString(entry, 'title'), coreChapterIndex, entryVariables).then((data: JsonObject): void => {
        if (bookOpenSequence !== undefined && !ReaderEffects.isCurrentBookOpen(bookOpenSequence)) {
          ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
          return;
        }
        if (!ReaderEffects.isCurrentChapterLoad(book.bookId, sourceId, coreChapterIndex, chapterUrl)) {
          ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
          return;
        }
        ReaderUiStore.dispatch({
          type: 'chapter-success',
          chapterParagraphs: ReaderEffects.mapChapterContent(data),
          chapterTitle: ReaderEffects.getString(entry, 'title'),
          bookId: book.bookId,
          sourceId: sourceId,
          chapterIndex: coreChapterIndex,
        });
        ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
        if (restoredProgress !== undefined) {
          // Publish the exact durable location only after chapter-success:
          // that reducer transition clears the previous chapter's renderer
          // state. ReadingTextFlow watches canonicalReaderLocation to restore
          // visually, while the renderer remains the owner of the layout work.
          ReaderUiStore.dispatch({
            type: 'reader-location-resolved',
            canonicalReaderLocation: {
              bookId: book.bookId,
              chapterIndex: coreChapterIndex,
              chapterOffset: restoredProgress.chapterOffset,
              chapterProgress: restoredProgress.chapterProgress,
              locationRevision: restoredProgress.locationRevision,
              resolverVersion: '',
            },
          });
        }
        if (contentSearchOffset !== undefined) {
          ReaderEffects.persistContentSearchAnchor(book, sourceId, coreChapterIndex, contentSearchOffset,
            bookOpenSequence);
        }
      }).catch((e: Error): void => {
        if (bookOpenSequence !== undefined && !ReaderEffects.isCurrentBookOpen(bookOpenSequence)) {
          ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
          return;
        }
        if (!ReaderEffects.isCurrentChapterLoad(book.bookId, sourceId, coreChapterIndex, chapterUrl)) {
          ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
          return;
        }
        ReaderEffects.completeChapterNavigation(chapterNavigationRequestId);
        if (contentSearchOffset !== undefined) {
          ReaderUiStore.dispatch({
            type: 'content-search-jump-status',
            contentSearchMessage: `正文搜索跳转失败：${e.message}`,
          });
        }
        ReaderUiStore.dispatch({
          type: 'set-error',
          error: { code: 'CHAPTER_FAILED', message: e.message, retryable: true },
        });
      });
  }

  // The renderer currently measures pages rather than individual text glyph
  // coordinates. We therefore leave its visual page at the newly loaded
  // chapter start, but persist the exact Core-provided character anchor so a
  // future/reflow-aware renderer restores the canonical location instead of a
  // made-up local paragraph index.
  private static persistContentSearchAnchor(book: BookDetail, sourceId: string,
    chapterIndex: number, chapterOffset: number, bookOpenSequence?: number): void {
    if (chapterOffset < 0 || (bookOpenSequence !== undefined && !ReaderEffects.isCurrentBookOpen(bookOpenSequence))) return;
    const state = ReaderUiStore.snapshot();
    const identity: ReaderContentIdentity = {
      bookId: book.bookId,
      sourceId: sourceId,
      chapterIndex: chapterIndex,
    };
    if (!ReaderEffects.isCurrentReadingIdentity(state, identity)) return;
    const viewportWidth = AppStorage.get<number>(ViewportAdapter.K_WIDTH) ?? ViewportAdapter.DEFAULT_WIDTH;
    const viewportHeight = AppStorage.get<number>(ViewportAdapter.K_HEIGHT) ?? ViewportAdapter.DEFAULT_HEIGHT;
    const snapshot: ReadingProgressSnapshot = {
      key: `${book.bookId}|${sourceId}|${chapterIndex}|${Math.floor(chapterOffset)}|0.000000|${viewportWidth}|${viewportHeight}|${(state.fontSize / 17).toFixed(4)}`,
      sessionEpoch: ReaderEffects.readingSessionEpoch,
      bookId: book.bookId,
      sourceId: sourceId,
      chapterIndex: chapterIndex,
      chapterOffset: Math.floor(chapterOffset),
      chapterProgress: 0,
      viewportWidth: viewportWidth,
      viewportHeight: viewportHeight,
      fontScale: state.fontSize / 17,
      contentSearchJumpSequence: bookOpenSequence,
    };
    ReaderEffects.enqueueReadingProgress(snapshot);
  }

  private static isCurrentChapterLoad(bookId: string, sourceId: string,
    chapterIndex: number, chapterId: string): boolean {
    return ReaderEffects.currentBookId === bookId && ReaderEffects.currentSourceId === sourceId &&
      ReaderEffects.currentChapterIndex === chapterIndex && ReaderEffects.currentChapterId === chapterId;
  }

  // Request a chapter transition only after the current measured position has
  // become durable.  The reducer deliberately keeps chapter-next/prev as
  // no-ops, so this is the one transition owner rather than a second route or
  // state authority.
  static requestAdjacentChapter(direction: number): void {
    if ((direction !== -1 && direction !== 1) || ReaderUiStore.snapshot().loading ||
      ReaderEffects.chapterNavigationInFlight) return;
    const action = direction > 0 ? 'chapter-next' : 'chapter-prev';
    const requestId = ReaderEffects.chapterNavigationSequence + 1;
    ReaderEffects.chapterNavigationSequence = requestId;
    ReaderEffects.activeChapterNavigationRequestId = requestId;
    ReaderEffects.chapterNavigationInFlight = true;
    ReaderEffects.commitReadingProgressBefore(action, (): void => {
      ReaderEffects.loadAdjacentChapter(direction, requestId);
      ReaderEffects.maybeVibrateForReaderInteraction();
    }, (): void => {
      ReaderEffects.completeChapterNavigation(requestId);
    });
  }

  // The visible Reader back affordance and system Back both call this helper.
  // Keeping the existing `reader-exit` event as the final dispatch preserves
  // its route/session teardown semantics while preventing an optimistic pop.
  static requestReaderExit(): void {
    ReaderEffects.commitReadingProgressBefore('reader-exit', (): void => {
      ReaderEffects.invalidateExitedReadingSession();
      ReaderUiStore.dispatchCommittedReaderExit();
    });
  }

  // `set-error` is global: source/import/search errors may arrive while a
  // chapter TOC is still resolving.  Only the exact request which claimed the
  // guard may release it, otherwise an unrelated error re-admits a duplicate
  // next/previous gesture into the same asynchronous window.
  private static completeChapterNavigation(requestId?: number): void {
    if (requestId === undefined || ReaderEffects.activeChapterNavigationRequestId !== requestId) return;
    ReaderEffects.activeChapterNavigationRequestId = 0;
    ReaderEffects.chapterNavigationInFlight = false;
  }

  // The exit barrier itself is already durable when this runs.  Its older
  // queued layout reports are not: discard them so an unmounted reader cannot
  // overwrite the confirmed exit anchor after the visible route has changed.
  private static invalidateExitedReadingSession(): void {
    const expiredEpoch = ReaderEffects.readingSessionEpoch;
    ReaderEffects.readingSessionEpoch = expiredEpoch >= 2147483646 ? 1 : expiredEpoch + 1;
    const retained: QueuedReadingProgress[] = [];
    for (let index = 0; index < ReaderEffects.pendingReadingProgress.length; index += 1) {
      const queued = ReaderEffects.pendingReadingProgress[index];
      if (queued.snapshot.sessionEpoch === expiredEpoch) {
        ReaderEffects.runReadingProgressCallbacks(queued.onFailed);
      } else {
        retained.push(queued);
      }
    }
    ReaderEffects.pendingReadingProgress = retained;
  }

  // Resolve and persist the canonical reading location after the rendered
  // surface publishes its actual Unicode scalar anchor. A page index is not a
  // chapter offset: horizontal page models and vertical paragraph anchors own
  // the measurement and feed it through ReaderUiStore.reportReadingAnchor().
  static persistReadingProgress(anchorEvent?: UiEvent): void {
    const snapshot = ReaderEffects.readingProgressSnapshot(anchorEvent);
    if (snapshot === null) return;
    ReaderEffects.enqueueReadingProgress(snapshot);
  }

  // A navigation barrier shares the single progress writer with ordinary
  // anchor updates. It intentionally fails closed: a Core failure keeps the
  // current body/route visible and leaves the same gesture available to retry.
  private static commitReadingProgressBefore(action: string, continuation: () => void,
    onFailure?: () => void): void {
    if (ReaderEffects.pendingReadingCommitAction.length > 0) return;
    ReaderEffects.pendingReadingCommitAction = action;
    const snapshot = ReaderEffects.readingProgressSnapshot();
    const release = (): void => {
      if (ReaderEffects.pendingReadingCommitAction === action) {
        ReaderEffects.pendingReadingCommitAction = '';
      }
    };
    if (snapshot === null) {
      release();
      continuation();
      return;
    }
    ReaderEffects.enqueueReadingProgress(snapshot, (): void => {
      release();
      continuation();
    }, (): void => {
      release();
      if (onFailure !== undefined) onFailure();
    });
  }

  private static readingProgressSnapshot(anchorEvent?: UiEvent): ReadingProgressSnapshot | null {
    const state = ReaderUiStore.snapshot();
    const book = state.currentBook;
    const identity = state.activeReaderContentIdentity;
    if (book === null || identity === null || !ReaderEffects.isCurrentReadingIdentity(state, identity)) return null;
    if (anchorEvent !== undefined && (anchorEvent.bookId !== identity.bookId ||
      anchorEvent.sourceId !== identity.sourceId || anchorEvent.chapterIndex !== identity.chapterIndex)) {
      return null;
    }
    const chapterOffset = Math.max(0, Math.floor(state.readerChapterOffset));
    const chapterProgress = Math.max(0, Math.min(1, state.readerChapterProgress));
    const viewportWidth = AppStorage.get<number>(ViewportAdapter.K_WIDTH) ?? ViewportAdapter.DEFAULT_WIDTH;
    const viewportHeight = AppStorage.get<number>(ViewportAdapter.K_HEIGHT) ?? ViewportAdapter.DEFAULT_HEIGHT;
    return {
      key: `${identity.bookId}|${identity.sourceId}|${identity.chapterIndex}|${chapterOffset}|${chapterProgress.toFixed(6)}|${viewportWidth}|${viewportHeight}|${(state.fontSize / 17).toFixed(4)}`,
      sessionEpoch: ReaderEffects.readingSessionEpoch,
      bookId: identity.bookId,
      sourceId: identity.sourceId,
      chapterIndex: identity.chapterIndex,
      chapterOffset: chapterOffset,
      chapterProgress: chapterProgress,
      viewportWidth: viewportWidth,
      viewportHeight: viewportHeight,
      fontScale: state.fontSize / 17,
    };
  }

  private static enqueueReadingProgress(snapshot: ReadingProgressSnapshot,
    onStored?: () => void, onFailed?: () => void): void {
    if (!ReaderEffects.progressWriteInFlight && ReaderEffects.lastCompletedReadingProgressKey === snapshot.key) {
      if (onStored !== undefined) onStored();
      return;
    }
    const inFlight = ReaderEffects.inFlightReadingProgress;
    if (inFlight !== null && inFlight.snapshot.key === snapshot.key) {
      if (onStored !== undefined) inFlight.onStored.push(onStored);
      if (onFailed !== undefined) inFlight.onFailed.push(onFailed);
      return;
    }
    for (let index = 0; index < ReaderEffects.pendingReadingProgress.length; index += 1) {
      const pending = ReaderEffects.pendingReadingProgress[index];
      if (pending.snapshot.key !== snapshot.key) continue;
      if (onStored !== undefined) pending.onStored.push(onStored);
      if (onFailed !== undefined) pending.onFailed.push(onFailed);
      return;
    }
    const next: QueuedReadingProgress = {
      snapshot: snapshot,
      onStored: onStored === undefined ? [] : [onStored],
      onFailed: onFailed === undefined ? [] : [onFailed],
    };
    const lastIndex = ReaderEffects.pendingReadingProgress.length - 1;
    const last = lastIndex >= 0 ? ReaderEffects.pendingReadingProgress[lastIndex] : null;
    // Background layout reports may coalesce, but never replace a queued
    // barrier whose continuation would otherwise be lost.
    if (onStored === undefined && onFailed === undefined && last !== null &&
      last.onStored.length === 0 && last.onFailed.length === 0) {
      ReaderEffects.pendingReadingProgress[lastIndex] = next;
    } else if (onStored !== undefined && last !== null && last.onStored.length === 0 && last.onFailed.length === 0) {
      // A pending background anchor is stale once a user gesture asks to
      // navigate. Upgrade it into this barrier rather than writing both.
      ReaderEffects.pendingReadingProgress[lastIndex] = next;
    } else {
      ReaderEffects.pendingReadingProgress.push(next);
    }
    if (!ReaderEffects.progressWriteInFlight) {
      ReaderEffects.drainReadingProgressQueue();
    }
  }

  private static isCurrentReadingIdentity(state: ReaderUiState, identity: ReaderContentIdentity): boolean {
    const book = state.currentBook;
    return RouteTable.shellOf(state.routeId) === 'ReaderShell' && book !== null && state.chapterContent.length > 0 &&
      book.bookId === identity.bookId &&
      (book.sourceId ?? '') === identity.sourceId && ReaderEffects.currentBookId === identity.bookId &&
      ReaderEffects.currentSourceId === identity.sourceId && ReaderEffects.currentChapterIndex === identity.chapterIndex;
  }

  private static drainReadingProgressQueue(): void {
    if (ReaderEffects.progressWriteInFlight) return;
    let entry: QueuedReadingProgress | undefined = undefined;
    while (ReaderEffects.pendingReadingProgress.length > 0 && entry === undefined) {
      const candidate = ReaderEffects.pendingReadingProgress.shift();
      if (candidate === undefined) break;
      if (candidate.snapshot.sessionEpoch !== ReaderEffects.readingSessionEpoch) {
        ReaderEffects.runReadingProgressCallbacks(candidate.onFailed);
        continue;
      }
      entry = candidate;
    }
    if (entry === undefined) return;
    // ArkTS does not retain the preceding undefined guard through Promise
    // closures, so capture the admitted queue item as a concrete value.
    const activeEntry: QueuedReadingProgress = entry;
    const snapshot = activeEntry.snapshot;
    ReaderEffects.progressWriteInFlight = true;
    ReaderEffects.inFlightReadingProgress = activeEntry;
    try {
      const runtime = ReaderEffects.acquireCoreRuntime();
      runtime.readerLocationResolve(snapshot.bookId, snapshot.chapterIndex, snapshot.chapterOffset,
        snapshot.chapterProgress, snapshot.viewportWidth, snapshot.viewportHeight, snapshot.fontScale,
        snapshot.sourceId).then((location: JsonObject): Promise<void> => {
        const canonical = ReaderEffects.parseCanonicalReadingLocation(
          location, snapshot.bookId, snapshot.chapterIndex, snapshot.chapterOffset, snapshot.chapterProgress,
        );
        // The session was checked at dequeue, but the resolve was async: the reader
        // may have since navigated to another chapter or had its session
        // invalidated. Re-validate BEFORE writing the progress row so an in-flight
        // resolve cannot persist a location for an anchor the user has left.
        // Throwing here routes to the .catch below (onFailed); it does not set the
        // completed key or invoke onStored, so the write can be retried.
        if (snapshot.sessionEpoch !== ReaderEffects.readingSessionEpoch ||
          !ReaderEffects.isCurrentReadingIdentity(ReaderUiStore.snapshot(), {
            bookId: snapshot.bookId,
            sourceId: snapshot.sourceId,
            chapterIndex: snapshot.chapterIndex,
          })) {
          throw new Error('reading-progress session changed during resolve');
        }
        return runtime.readingProgressUpdate(snapshot.bookId, snapshot.sourceId, snapshot.chapterIndex,
          snapshot.chapterOffset, snapshot.chapterProgress, canonical.locationRevision).then((result: JsonObject): void => {
          ReaderEffects.requireStoredReadingProgress(result, snapshot);
          ReaderEffects.lastCompletedReadingProgressKey = snapshot.key;
          if (snapshot.contentSearchJumpSequence !== undefined &&
            ReaderEffects.isCurrentBookOpen(snapshot.contentSearchJumpSequence) &&
            ReaderEffects.isCurrentReadingIdentity(ReaderUiStore.snapshot(), {
              bookId: snapshot.bookId,
              sourceId: snapshot.sourceId,
              chapterIndex: snapshot.chapterIndex,
            })) {
            ReaderUiStore.dispatch({
              type: 'content-search-jump-status',
              contentSearchMessage: `已跳转到 Core 目录第 ${snapshot.chapterIndex + 1} 章；正文偏移 ${snapshot.chapterOffset} 已写入阅读位置。`,
            });
          }
          // Write the Core-confirmed canonical back into the reducer so a later
          // horizontal/vertical reflow is anchored to the position Core just
          // stored, not the stale local anchor left by reader-location-anchor.
          // Guard: only when the reader is still on this chapter and still at the
          // offset this resolve was for. If the user has since measured a new
          // offset, the progress row is already written; do not overwrite the
          // visible canonical with a now-stale one.
          const current = ReaderUiStore.snapshot();
          if (ReaderEffects.isCurrentReadingIdentity(current, {
            bookId: snapshot.bookId,
            sourceId: snapshot.sourceId,
            chapterIndex: snapshot.chapterIndex,
          }) && current.readerChapterOffset === snapshot.chapterOffset &&
            Math.abs(current.readerChapterProgress - snapshot.chapterProgress) <= 0.000001) {
            ReaderUiStore.dispatch({
              type: 'reader-location-resolved',
              canonicalReaderLocation: canonical,
            });
          }
          ReaderEffects.loadContinueReading();
          ReaderEffects.runReadingProgressCallbacks(activeEntry.onStored);
          ReaderEffects.finishReadingProgressWrite();
        });
      }).catch((e: Error): void => {
        console.info(`ReaderEffects: reading-progress error: ${e.message}`);
        if (snapshot.contentSearchJumpSequence !== undefined &&
          ReaderEffects.isCurrentBookOpen(snapshot.contentSearchJumpSequence)) {
          ReaderUiStore.dispatch({
            type: 'content-search-jump-status',
            contentSearchMessage: `已打开目标章节，但 Core 阅读位置写入失败：${e.message}`,
          });
        }
        ReaderEffects.runReadingProgressCallbacks(activeEntry.onFailed);
        ReaderEffects.finishReadingProgressWrite();
      });
    } catch (e) {
      console.info(`ReaderEffects: reading-progress error: ${(e as Error).message}`);
      if (snapshot.contentSearchJumpSequence !== undefined &&
        ReaderEffects.isCurrentBookOpen(snapshot.contentSearchJumpSequence)) {
        ReaderUiStore.dispatch({
          type: 'content-search-jump-status',
          contentSearchMessage: `已打开目标章节，但 Core 阅读位置不可用：${(e as Error).message}`,
        });
      }
      ReaderEffects.runReadingProgressCallbacks(activeEntry.onFailed);
      ReaderEffects.finishReadingProgressWrite();
    }
  }

  private static requireStoredReadingProgress(data: JsonObject, snapshot: ReadingProgressSnapshot): void {
    if (data['stored'] !== true || ReaderEffects.getString(data, 'bookId') !== snapshot.bookId ||
      ReaderEffects.getString(data, 'sourceId') !== snapshot.sourceId ||
      ReaderEffects.getNumber(data, 'chapterIndex', -1) !== snapshot.chapterIndex ||
      ReaderEffects.getNumber(data, 'chapterOffset', -1) !== snapshot.chapterOffset ||
      Math.abs(ReaderEffects.getNumber(data, 'chapterProgress', -1) - snapshot.chapterProgress) > 0.000001) {
      throw new Error('reading.progress.update did not confirm the requested durable reading location');
    }
  }

  private static runReadingProgressCallbacks(callbacks: Array<() => void>): void {
    for (let index = 0; index < callbacks.length; index += 1) {
      try {
        callbacks[index]();
      } catch (e) {
        console.info(`ReaderEffects: post-progress continuation failed: ${(e as Error).message}`);
      }
    }
  }

  private static finishReadingProgressWrite(): void {
    ReaderEffects.inFlightReadingProgress = null;
    ReaderEffects.progressWriteInFlight = false;
    if (ReaderEffects.pendingReadingProgress.length > 0) {
      ReaderEffects.drainReadingProgressQueue();
    }
  }

  // ── HTTP helper ───────────────────────────────────────────────────────
  // Used only for explicit source-package URL import. Normal remote reading
  // (search/detail/toc/chapter) must go through Core's sourceId-backed
  // http.execute continuation instead of making a UI-owned direct request.
  private static httpGet(url: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let runtime: CoreRuntime;
      try {
        runtime = CoreRuntime.get();
      } catch (e) {
        reject(new Error('runtime not ready'));
        return;
      }
      const req: HostHttpRequest = {
        url: url,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; HarmonyOS) Reader/1.0',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        },
        followRedirects: true,
        maxRedirects: 5,
        usePlatformCookieJar: true,
      };
      runtime.getHttpAdapter().execute(req).then((resp) => {
        if (resp.status >= 200 && resp.status < 300) {
          resolve(resp.body);
        } else {
          reject(new Error(`http ${resp.status}`));
        }
      }).catch((e: Error) => {
        reject(e);
      });
    });
  }

  // ── Result mappers (Core JsonObject → ArkTS state types) ──────────────
  // Public so the pure-function mappers can be unit-tested directly in
  // ReaderEffects.test.ets (no Host HTTP / Core runtime needed).

  static mapSourceCheckResult(data: JsonObject, expectedSourceId: string): CoreSourceCheckResult | null {
    const resultsValue = data['results'] as Object;
    if (!Array.isArray(resultsValue)) return null;
    const results = resultsValue as Object[];
    for (let i = 0; i < results.length; i++) {
      const raw = results[i] as JsonObject;
      const sourceId = ReaderEffects.getString(raw, 'sourceId').trim();
      if (sourceId.length === 0 || sourceId !== expectedSourceId) continue;
      const levelsValue = raw['levelsPassed'] as Object;
      const levelsPassed: string[] = [];
      if (Array.isArray(levelsValue)) {
        const levels = levelsValue as Object[];
        for (let j = 0; j < levels.length; j++) {
          if (typeof levels[j] === 'string') levelsPassed.push(levels[j] as string);
        }
      }
      const boolFields = raw as Object as Record<string, boolean>;
      return {
        sourceId: sourceId,
        available: boolFields['available'] === true,
        levelsPassed: levelsPassed,
        failureReason: ReaderEffects.getString(raw, 'failureReason'),
        durationMs: ReaderEffects.getNumber(raw, 'durationMs'),
      };
    }
    return null;
  }

  /**
   * The Harmony source-detect screen always asks Core for L1–L5.  Treat a
   * claimed success as successful only when the returned verdict explicitly
   * contains all five passes and no failure reason.  This is deliberately a
   * fail-closed projection: an old/malformed native library cannot turn a
   * missing Host result, a skipped stage, or an inconsistent payload into a
   * green diagnostic card.
   */
  static validateFullSourceCheckRunResult(result: CoreSourceCheckResult): CoreSourceCheckResult {
    const requiredLevels: string[] = ['L1', 'L2', 'L3', 'L4', 'L5'];
    const levelsPassed: string[] = [];
    for (let i = 0; i < result.levelsPassed.length; i++) {
      const level = result.levelsPassed[i];
      let isRequired = false;
      for (let j = 0; j < requiredLevels.length; j++) {
        if (level === requiredLevels[j]) {
          isRequired = true;
          break;
        }
      }
      if (!isRequired) continue;
      let alreadyAdded = false;
      for (let j = 0; j < levelsPassed.length; j++) {
        if (levelsPassed[j] === level) {
          alreadyAdded = true;
          break;
        }
      }
      if (!alreadyAdded) levelsPassed.push(level);
    }

    const missing: string[] = [];
    for (let i = 0; i < requiredLevels.length; i++) {
      let passed = false;
      for (let j = 0; j < levelsPassed.length; j++) {
        if (levelsPassed[j] === requiredLevels[i]) {
          passed = true;
          break;
        }
      }
      if (!passed) missing.push(requiredLevels[i]);
    }

    const coreReason = result.failureReason.trim();
    const completePass = result.available && coreReason.length === 0 && missing.length === 0;
    if (completePass) {
      return {
        sourceId: result.sourceId,
        available: true,
        levelsPassed: levelsPassed,
        failureReason: '',
        durationMs: result.durationMs >= 0 ? result.durationMs : 0,
      };
    }

    let failureReason = coreReason;
    if (failureReason.length === 0 && missing.length > 0) {
      failureReason = `Core 未返回完整 L1–L5 verdict；缺少 ${missing.join('、')}。`;
    }
    if (failureReason.length === 0) {
      failureReason = 'Core 返回 unavailable verdict，但未提供失败原因。';
    }
    return {
      sourceId: result.sourceId,
      available: false,
      levelsPassed: levelsPassed,
      failureReason: failureReason,
      durationMs: result.durationMs >= 0 ? result.durationMs : 0,
    };
  }

  /** Convert the bridge-only recorder result into a body-free UI projection. */
  static mapSourceDebugResult(projection: CoreSourceDebugRunProjection): CoreSourceDebugResult {
    let sourceCheck: CoreSourceCheckResult | null = null;
    if (projection.sourceCheckData !== null) {
      const rawCheck = ReaderEffects.mapSourceCheckResult(projection.sourceCheckData, projection.sourceId);
      if (rawCheck !== null) sourceCheck = ReaderEffects.validateFullSourceCheckRunResult(rawCheck);
    }
    const stages: CoreSourceDebugStage[] = [];
    for (let i = 0; i < projection.stages.length; i++) {
      const raw = projection.stages[i];
      const stage: CoreSourceDebugStage = {
        stage: raw.stage,
        requestCount: raw.requestCount >= 0 ? raw.requestCount : 0,
        responseCount: raw.responseCount >= 0 ? raw.responseCount : 0,
        selectedResponseIndex: raw.selectedResponseIndex >= -1 ? raw.selectedResponseIndex : -1,
        statusCode: raw.statusCode >= 0 ? raw.statusCode : 0,
        failed: raw.failed,
        failureMessage: raw.failureMessage,
        replayLimited: raw.replayLimited,
      };
      stages.push(stage);
    }

    let logs: CoreSourceDebugLog[] = [];
    let finalState = 0;
    let durationMs = 0;
    if (projection.sourceDebugData !== null) {
      logs = ReaderEffects.mapSourceDebugLogs(projection.sourceDebugData);
      const rawFinalState = ReaderEffects.getNumber(projection.sourceDebugData, 'finalState');
      const rawDuration = ReaderEffects.getNumber(projection.sourceDebugData, 'durationMs');
      finalState = Number.isInteger(rawFinalState) ? rawFinalState : 0;
      durationMs = Number.isInteger(rawDuration) && rawDuration >= 0 ? rawDuration : 0;
    }
    const result: CoreSourceDebugResult = {
      sourceId: projection.sourceId,
      sourceCheck,
      sourceCheckError: projection.sourceCheckError,
      logs,
      finalState,
      durationMs,
      sourceDebugError: projection.sourceDebugError,
      replayAttempted: projection.replayAttempted,
      replayLimited: projection.replayLimited,
      replayNotice: projection.replayNotice,
      stages,
    };
    return result;
  }

  /** Keep only Core's structured log fields. Raw HTTP transcript data is not a UI DTO. */
  static mapSourceDebugLogs(data: JsonObject): CoreSourceDebugLog[] {
    const rawLogs = data['logs'] as Object;
    const logs: CoreSourceDebugLog[] = [];
    if (!Array.isArray(rawLogs)) return logs;
    const rows = rawLogs as Object[];
    for (let i = 0; i < rows.length; i++) {
      const rawValue = rows[i];
      if (rawValue === null || typeof rawValue !== 'object' || Array.isArray(rawValue)) continue;
      const raw = rawValue as JsonObject;
      const state = ReaderEffects.getNumber(raw, 'state');
      const timestampMs = ReaderEffects.getNumber(raw, 'timestampMs');
      const message = ReaderEffects.getString(raw, 'msg');
      if (!Number.isInteger(state) || !Number.isInteger(timestampMs) || timestampMs < 0 || message.length === 0) {
        continue;
      }
      const extractedCountValue = ReaderEffects.getNumber(raw, 'extractedCount', -1);
      const log: CoreSourceDebugLog = {
        state,
        message,
        timestampMs,
        step: ReaderEffects.getString(raw, 'step'),
        rule: ReaderEffects.getString(raw, 'rule'),
        extractedCount: Number.isInteger(extractedCountValue) && extractedCountValue >= 0
          ? extractedCountValue : -1,
        errorKind: ReaderEffects.getString(raw, 'errorKind'),
      };
      logs.push(log);
    }
    return logs;
  }

  static sourceDebugSummary(result: CoreSourceDebugResult): string {
    let summary = '';
    if (result.sourceCheck === null) {
      summary = result.sourceCheckError.length > 0
        ? `Core source.check.run 未返回可验证 verdict：${result.sourceCheckError}`
        : 'Core source.check.run 未返回当前书源的可验证 verdict。';
    } else if (!result.sourceCheck.available) {
      summary = `Core L1–L5 真实诊断未通过：${result.sourceCheck.failureReason}`;
      if (result.replayAttempted) {
        summary += ' 调测日志仅重放已收集响应，不代表书源可用。';
      }
    } else if (result.sourceDebugError.length > 0) {
      summary = `Core L1–L5 已通过，但 source.debug 回放失败：${result.sourceDebugError}`;
    } else if (!result.replayAttempted) {
      summary = 'Core L1–L5 已通过，但未收集到可供 source.debug 重放的响应。';
    } else if (result.finalState === 1000) {
      summary = `Core source.debug 已完成结构化回放 · ${result.durationMs}ms。`;
    } else if (result.finalState === -1) {
      summary = 'Core source.debug 返回真实错误收尾；请查看结构化日志。';
    } else {
      summary = 'Core source.debug 未返回可识别的完成状态；不会标记为成功。';
    }
    if (result.replayNotice.length > 0) summary += ` ${result.replayNotice}`;
    return summary;
  }

  // Map Core book.search result → SearchResultEntry[].
  // Core returns: { sourceId, books: [{ bookId, title, author?, ... }] }
  static mapSearchResults(data: JsonObject, source: CoreSourceEntry): SearchResultEntry[] {
    const results: SearchResultEntry[] = [];
    const booksValue = data['books'] as Object;
    if (!Array.isArray(booksValue)) return results;
    const books = booksValue as Object[];
    for (const bookObj of books) {
      const book = bookObj as JsonObject;
      const title = ReaderEffects.getString(book, 'title');
      const bookId = ReaderEffects.getString(book, 'bookId');
      if (title.length === 0 || bookId.length === 0) continue;
      const latestChapter = ReaderEffects.getString(book, 'lastChapter');
      const entry: SearchResultEntry = {
        title: title,
        author: ReaderEffects.getString(book, 'author', '未知作者'),
        bookId: bookId,
        sourceId: source.sourceId,
        sourceName: source.name,
        sourceUrl: source.baseUrl,
        latestChapter: latestChapter,
        coverUrl: ReaderEffects.getString(book, 'coverUrl'),
        intro: ReaderEffects.getString(book, 'intro'),
      };
      results.push(entry);
      if (results.length >= 20) break;
    }
    return results;
  }

  // Map `search.content` data without widening its scope. A malformed or
  // cross-book row is discarded instead of being shown under the current
  // reader surface; the caller's sourceId+bookId form one composite identity.
  static mapContentSearchResults(data: JsonObject, expectedSourceId: string,
    expectedBookId: string): CoreContentSearchResult[] {
    const value = data['results'] as Object;
    if (!Array.isArray(value)) return [];
    const rawResults = value as Object[];
    const results: CoreContentSearchResult[] = [];
    for (let i = 0; i < rawResults.length; i++) {
      const rawValue = rawResults[i];
      if (rawValue === null || typeof rawValue !== 'object' || Array.isArray(rawValue)) continue;
      const raw = rawValue as JsonObject;
      const sourceId = ReaderEffects.getString(raw, 'sourceId').trim();
      const bookId = ReaderEffects.getString(raw, 'bookId').trim();
      const chapterIndex = ReaderEffects.getNumber(raw, 'chapterIndex', -1);
      const chapterOffset = ReaderEffects.getNumber(raw, 'chapterOffset', -1);
      const matchLength = ReaderEffects.getNumber(raw, 'matchLength', -1);
      const snippetStart = ReaderEffects.getNumber(raw, 'snippetStart', -1);
      if (sourceId !== expectedSourceId || bookId !== expectedBookId ||
        chapterIndex < 0 || Math.floor(chapterIndex) !== chapterIndex ||
        chapterOffset < 0 || matchLength < 0 || snippetStart < 0) {
        continue;
      }
      results.push({
        sourceId: sourceId,
        bookId: bookId,
        bookName: ReaderEffects.getString(raw, 'bookName'),
        chapterIndex: chapterIndex,
        chapterOffset: chapterOffset,
        matchLength: matchLength,
        snippetStart: snippetStart,
        chapterTitle: ReaderEffects.getString(raw, 'chapterTitle'),
        snippet: ReaderEffects.getString(raw, 'snippet'),
      });
    }
    return results;
  }

  // Map Core source.exploreKinds data.  Empty URLs are retained because they
  // are valid grouping headers in Legado's exploreUrl grammar; UI code uses
  // their presence to disable an unexecutable chip rather than inventing one.
  static mapDiscoverKinds(data: JsonObject): CoreDiscoverKind[] {
    const result: CoreDiscoverKind[] = [];
    const kindsValue = data['kinds'] as Object;
    if (!Array.isArray(kindsValue)) return result;
    const kinds = kindsValue as Object[];
    for (let i = 0; i < kinds.length; i++) {
      const raw = kinds[i] as JsonObject;
      const title = ReaderEffects.getString(raw, 'title').trim();
      const url = ReaderEffects.getString(raw, 'url').trim();
      if (title.length === 0 && url.length === 0) continue;
      result.push({ title: title, url: url });
    }
    return result;
  }

  // Map Core source.explore books.  Never derive a URL or source identity in
  // the UI: the bookUrl/sourceId pair is exactly what Core returned/resolved
  // for this request and is reused by book.detail on tap.
  static mapDiscoverBooks(data: JsonObject, source: CoreSourceEntry): CoreDiscoverBook[] {
    const result: CoreDiscoverBook[] = [];
    const booksValue = data['books'] as Object;
    if (!Array.isArray(booksValue)) return result;
    const books = booksValue as Object[];
    for (let i = 0; i < books.length; i++) {
      const raw = books[i] as JsonObject;
      let title = ReaderEffects.getString(raw, 'title').trim();
      if (title.length === 0) title = ReaderEffects.getString(raw, 'name').trim();
      let bookUrl = ReaderEffects.getString(raw, 'bookUrl').trim();
      if (bookUrl.length === 0) bookUrl = ReaderEffects.getString(raw, 'bookId').trim();
      if (title.length === 0 || bookUrl.length === 0) continue;
      let intro = ReaderEffects.getString(raw, 'intro');
      if (intro.length === 0) intro = ReaderEffects.getString(raw, 'summary');
      let kind = ReaderEffects.getString(raw, 'kind');
      if (kind.length === 0) kind = ReaderEffects.getString(raw, 'type');
      let lastChapter = ReaderEffects.getString(raw, 'lastChapter');
      if (lastChapter.length === 0) lastChapter = ReaderEffects.getString(raw, 'latestChapter');
      result.push({
        sourceId: source.sourceId,
        bookUrl: bookUrl,
        title: title,
        author: ReaderEffects.getString(raw, 'author', '未知作者'),
        coverUrl: ReaderEffects.getString(raw, 'coverUrl'),
        intro: intro,
        kind: kind,
        lastChapter: lastChapter,
      });
      if (result.length >= 50) break;
    }
    return result;
  }

  // Map Core book.detail result → BookDetail.
  // Core returns: { sourceId, book: { bookId, title, author, ... }, tocUrl?, variables? }
  static mapBookDetail(data: JsonObject, bookId: string, source: CoreSourceEntry): BookDetail {
    const bookObj = data['book'] as Object;
    const book: JsonObject = (bookObj !== null && bookObj !== undefined && typeof bookObj === 'object')
      ? bookObj as JsonObject
      : {} as JsonObject;
    const coverUrl = ReaderEffects.getString(book, 'coverUrl');
    const detail: BookDetail = {
      bookId: ReaderEffects.getString(book, 'bookId', bookId),
      sourceId: source.sourceId,
      title: ReaderEffects.getString(book, 'title', '未知书名'),
      author: ReaderEffects.getString(book, 'author', '未知作者'),
      coverUrl: coverUrl,
      summary: ReaderEffects.getString(book, 'intro', ''),
      sourceName: source.name,
      sourceUrl: source.baseUrl,
      latestChapter: ReaderEffects.getString(book, 'lastChapter', ''),
      chapterListUrl: ReaderEffects.getString(data, 'tocUrl', ''),
    };
    return detail;
  }

  // Extract first chapter URL from Core book.toc result.
  // Core returns: { sourceId, bookId, toc: [{ index, title, url, variables? }] }
  static getFirstChapterUrl(data: JsonObject): string {
    const tocValue = data['toc'] as Object;
    if (!Array.isArray(tocValue)) return '';
    const toc = tocValue as Object[];
    if (toc.length === 0) return '';
    const firstEntry = toc[0] as JsonObject;
    return ReaderEffects.getString(firstEntry, 'url', '');
  }

  static mapChapterToc(data: JsonObject): ChapterTocEntry[] {
    const value = data['toc'] as Object;
    if (!Array.isArray(value)) return [];
    const raw = value as Object[];
    const toc: ChapterTocEntry[] = [];
    for (let i = 0; i < raw.length; i++) {
      const entry = raw[i] as Object as JsonObject;
      const chapterId = ReaderEffects.getString(entry, 'url');
      if (chapterId.length === 0) continue;
      toc.push({
        index: ReaderEffects.getNumber(entry, 'index', i),
        title: ReaderEffects.getString(entry, 'title', `第 ${i + 1} 章`),
        chapterId: chapterId,
      });
    }
    return toc;
  }

  private static coreTocForEffect(data: JsonObject): JsonObject[] {
    const value = data['toc'] as Object;
    if (!Array.isArray(value)) return [];
    const raw = value as Object[];
    const toc: JsonObject[] = [];
    for (let i = 0; i < raw.length; i++) {
      toc.push(raw[i] as Object as JsonObject);
    }
    return toc;
  }

  private static chapterTitleFor(chapterId: string): string {
    const state = ReaderUiStore.snapshot();
    for (let i = 0; i < state.chapterToc.length; i++) {
      if (state.chapterToc[i].chapterId === chapterId) return state.chapterToc[i].title;
    }
    return state.currentChapterTitle;
  }

  // Extract variables from Core book.detail result for passing to book.toc.
  static getVariables(data: JsonObject): JsonObject | undefined {
    const v = data['variables'] as Object;
    if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
      return v as JsonObject;
    }
    return undefined;
  }

  // Map Core chapter.content result → paragraphs[].
  // Core returns: { sourceId, bookId, chapterTitle, content (string), via }
  // Content may be clean text with \n separators, or HTML with <p>/<br> tags.
  static mapChapterContent(data: JsonObject): string[] {
    const contentRaw = data['content'] as Object;
    const contentStr: string = typeof contentRaw === 'string' ? contentRaw : '';
    if (contentStr.length === 0) return [];
    const normalized = contentStr
      .replace(/<br\s*\/?>(\s*<br\s*\/?>)+/g, '\n')
      .replace(/<\/p>\s*<p[^>]*>/g, '\n')
      .replace(/<p[^>]*>/g, '')
      .replace(/<\/p>/g, '\n');
    const lines = normalized.split('\n');
    const paragraphs: string[] = [];
    for (const line of lines) {
      const text = line.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
      if (text.length > 0) {
        paragraphs.push(text);
      }
    }
    return paragraphs;
  }

  // ── W5 replace rule application ────────────────────────────────────────
  // Applies all enabled replace rules to chapter paragraphs. Rules with
  // invalid regex patterns are silently skipped. Called after mapChapterContent
  // so the reader sees the post-replacement text.
  static applyReplaceRules(paragraphs: string[]): string[] {
    const rules = ReaderUiStore.snapshot().replaceRules;
    if (rules.length === 0) return paragraphs;
    const result: string[] = [];
    for (let i = 0; i < paragraphs.length; i++) {
      let text = paragraphs[i];
      for (let j = 0; j < rules.length; j++) {
        const rule = rules[j];
        if (rule.enabled && rule.pattern.length > 0) {
          try {
            const regex = new RegExp(rule.pattern, 'g');
            text = text.replace(regex, rule.replacement);
          } catch (e) {
            // Invalid regex pattern — skip this rule.
          }
        }
      }
      result.push(text);
    }
    return result;
  }

  // ── JsonObject helpers ────────────────────────────────────────────────
  // A progress row may only retain a revision produced for that exact Core
  // anchor. `resolverVersion` names the algorithm; it is not a location
  // revision and must never be written into reading.progress.update.
  // Parses the Core resolve response into the full CoreReaderCanonicalLocation
  // (carrying the real resolverVersion), validating it matches the requested
  // reading anchor. The returned canonical feeds the reader-location-resolved
  // writeback in drainReadingProgressQueue so a later horizontal/vertical reflow
  // is anchored to the position Core just stored instead of a stale local one.
  private static parseCanonicalReadingLocation(data: JsonObject, bookId: string,
    chapterIndex: number, chapterOffset: number, chapterProgress: number): CoreReaderCanonicalLocation {
    if (data['resolved'] !== true) {
      throw new Error('reader.location.resolve did not confirm a canonical location');
    }
    const raw = data['canonicalLocation'] as Object;
    if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('reader.location.resolve did not return canonicalLocation');
    }
    const canonical = raw as Object as JsonObject;
    const returnedBookId = ReaderEffects.getString(canonical, 'bookId');
    const returnedChapterIndex = ReaderEffects.getNumber(canonical, 'chapterIndex', -1);
    const returnedChapterOffset = ReaderEffects.getNumber(canonical, 'chapterOffset', -1);
    const returnedChapterProgress = ReaderEffects.getNumber(canonical, 'chapterProgress', -1);
    // Strict identity + safe-integer checks (no Math.floor coercion): a fractional
    // offset or a location for another anchor must be rejected here, BEFORE the
    // progress row is written to Core. The reducer's setCanonicalReaderLocation
    // applies the same strictness, so a canonical that passes here is guaranteed
    // reducer-valid and cannot be "persisted then rejected".
    if (!Number.isSafeInteger(chapterIndex) || !Number.isSafeInteger(chapterOffset) ||
      !Number.isFinite(chapterProgress) || chapterProgress < 0 || chapterProgress > 1 ||
      returnedBookId !== bookId ||
      !Number.isSafeInteger(returnedChapterIndex) || returnedChapterIndex !== chapterIndex ||
      !Number.isSafeInteger(returnedChapterOffset) || returnedChapterOffset !== chapterOffset ||
      !Number.isFinite(returnedChapterProgress) || returnedChapterProgress < 0 || returnedChapterProgress > 1 ||
      Math.abs(returnedChapterProgress - chapterProgress) > 0.000001) {
      throw new Error('reader.location.resolve returned a location for another reading anchor');
    }
    const revision = ReaderEffects.getString(canonical, 'locationRevision').trim();
    if (revision.length === 0) {
      throw new Error('reader.location.resolve returned an empty locationRevision');
    }
    const resolverVersion = ReaderEffects.getString(data, 'resolverVersion');
    if (resolverVersion !== CANONICAL_RESOLVER_VERSION) {
      throw new Error(
        `reader.location.resolve returned resolverVersion ${resolverVersion}, expected ${CANONICAL_RESOLVER_VERSION}`);
    }
    return {
      bookId: bookId,
      chapterIndex: chapterIndex,
      chapterOffset: chapterOffset,
      chapterProgress: returnedChapterProgress,
      locationRevision: revision,
      resolverVersion: resolverVersion,
    };
  }

  static getString(data: JsonObject, key: string, defaultValue: string = ''): string {
    const fields = data as Object as Record<string, string>;
    const v: string = fields[key];
    return typeof v === 'string' ? v : defaultValue;
  }

  static getNumber(data: JsonObject, key: string, defaultValue: number = 0): number {
    const fields = data as Object as Record<string, number>;
    const v: number = fields[key];
    return typeof v === 'number' ? v : defaultValue;
  }

  // ── Core-backed book-source package import ───────────────────────────
  // A package is a JSON object or array of raw Legado BookSource objects.
  // We submit each object separately so Core remains the authority for
  // validation, storage, duplicate/upsert policy and the `imported` result.
  private static async importSourcePackage(payload: string, origin: string, epoch: number): Promise<void> {
    if (!ReaderEffects.isCurrentSourcePackageImport(epoch, origin)) {
      ReaderEffects.releaseSourcePackageImportClaim(epoch);
      return;
    }
    const trimmed = payload.trim();
    if (trimmed.length === 0) {
      await ReaderEffects.finishSourcePackageImport(epoch, origin, 0, 0, 0, 0, '没有可导入的 JSON 内容。');
      return;
    }

    let parsed: Object;
    try {
      parsed = JSON.parse(trimmed) as Object;
    } catch (e) {
      await ReaderEffects.finishSourcePackageImport(epoch,
        origin, 0, 0, 0, 0, `JSON 解析失败：${(e as Error).message}`,
      );
      return;
    }

    let entries: Object[] = [];
    if (Array.isArray(parsed)) {
      entries = parsed as Object[];
    } else if (parsed !== null && typeof parsed === 'object') {
      entries = [parsed];
    } else {
      await ReaderEffects.finishSourcePackageImport(epoch,
        origin, 0, 0, 0, 0, 'JSON 顶层必须是一个 Legado BookSource 对象或对象数组。',
      );
      return;
    }

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const notes: string[] = [];
    let runtime: CoreRuntime;
    try {
      runtime = CoreRuntime.get();
    } catch (e) {
      await ReaderEffects.finishSourcePackageImport(epoch,
        origin, entries.length, 0, 0, entries.length,
        `Reader-Core 未就绪：${(e as Error).message}`,
      );
      return;
    }

    // Sequential requests preserve per-entry accounting and avoid reporting a
    // package as complete while the native request queue is still draining.
    for (let i = 0; i < entries.length; i++) {
      if (!ReaderEffects.isCurrentSourcePackageImport(epoch, origin)) {
        ReaderEffects.releaseSourcePackageImportClaim(epoch);
        return;
      }
      const bookSource = ReaderEffects.legadoBookSourceFromPackageEntry(entries[i]);
      if (bookSource === null) {
        skipped += 1;
        notes.push(`第 ${i + 1} 项缺少非空 bookSourceName，已跳过`);
        continue;
      }
      try {
        const data = await runtime.sourceImport(bookSource);
        if (!ReaderEffects.isCurrentSourcePackageImport(epoch, origin)) {
          ReaderEffects.releaseSourcePackageImportClaim(epoch);
          return;
        }
        const resultFields = data as Object as Record<string, boolean>;
        if (resultFields['imported'] === true) {
          imported += 1;
        } else {
          skipped += 1;
          notes.push(`第 ${i + 1} 项未被 Core 标记为已导入`);
        }
      } catch (e) {
        if (!ReaderEffects.isCurrentSourcePackageImport(epoch, origin)) {
          ReaderEffects.releaseSourcePackageImportClaim(epoch);
          return;
        }
        failed += 1;
        const name = ReaderEffects.getString(bookSource, 'bookSourceName', `第 ${i + 1} 项`);
        notes.push(`${name}：${(e as Error).message}`);
      }
    }

    if (entries.length === 0) {
      notes.push('JSON 数组为空，没有可导入的书源。');
    }
    const message = notes.length > 0
      ? notes.slice(0, 3).join('；')
      : (imported > 0 ? 'Core 已确认写入书源。' : '没有书源被 Core 写入。');
    await ReaderEffects.finishSourcePackageImport(epoch,
      origin, entries.length, imported, skipped, failed, message,
    );
  }

  private static async importSourcePackageFromUrl(urlValue: string, origin: string, epoch: number): Promise<void> {
    if (!ReaderEffects.isCurrentSourcePackageImport(epoch, origin)) {
      ReaderEffects.releaseSourcePackageImportClaim(epoch);
      return;
    }
    const url = urlValue.trim();
    if (url.length === 0) {
      await ReaderEffects.finishSourcePackageImport(epoch, origin, 0, 0, 0, 0, '请输入书源包 URL。');
      return;
    }
    try {
      // httpGet goes through Harmony's registered Host HTTP adapter.
      const payload = await ReaderEffects.httpGet(url);
      if (!ReaderEffects.isCurrentSourcePackageImport(epoch, origin)) {
        ReaderEffects.releaseSourcePackageImportClaim(epoch);
        return;
      }
      await ReaderEffects.importSourcePackage(payload, origin, epoch);
    } catch (e) {
      if (!ReaderEffects.isCurrentSourcePackageImport(epoch, origin)) {
        ReaderEffects.releaseSourcePackageImportClaim(epoch);
        return;
      }
      await ReaderEffects.finishSourcePackageImport(epoch,
        origin, 0, 0, 0, 0, `下载书源包失败：${(e as Error).message}`,
      );
    }
  }

  private static async importSourcePackageFromClipboard(origin: string, epoch: number): Promise<void> {
    if (!ReaderEffects.isCurrentSourcePackageImport(epoch, origin)) {
      ReaderEffects.releaseSourcePackageImportClaim(epoch);
      return;
    }
    try {
      const runtime = CoreRuntime.get();
      const permission = runtime.getPermissionAdapter();
      if (permission === null) {
        await ReaderEffects.finishSourcePackageImport(epoch,
          origin, 0, 0, 0, 0, '当前环境不能检查剪贴板权限。请改用手动 JSON 或网络 URL。',
        );
        return;
      }
      const scope = 'ohos.permission.READ_PASTEBOARD';
      const checked = await permission.check({ scope: scope });
      let granted = checked.granted;
      if (!granted) {
        // Permission is requested only after the user explicitly chose the
        // clipboard-import business action. No onboarding/preflight prompt.
        const requested = await permission.request({ scope: scope });
        granted = requested.granted;
      }
      if (!ReaderEffects.isCurrentSourcePackageImport(epoch, origin)) {
        ReaderEffects.releaseSourcePackageImportClaim(epoch);
        return;
      }
      if (!granted) {
        await ReaderEffects.finishSourcePackageImport(epoch,
          origin, 0, 0, 0, 0, '未授予读取剪贴板权限。可返回后重试，或改用手动 JSON / 网络 URL。',
        );
        return;
      }
      const result = await runtime.getClipboardAdapter().paste();
      if (!ReaderEffects.isCurrentSourcePackageImport(epoch, origin)) {
        ReaderEffects.releaseSourcePackageImportClaim(epoch);
        return;
      }
      if (result.text.trim().length === 0) {
        await ReaderEffects.finishSourcePackageImport(epoch,
          origin, 0, 0, 0, 0, '剪贴板为空，或尚未授予读取剪贴板权限。',
        );
        return;
      }
      await ReaderEffects.importSourcePackage(result.text, origin, epoch);
    } catch (e) {
      if (!ReaderEffects.isCurrentSourcePackageImport(epoch, origin)) {
        ReaderEffects.releaseSourcePackageImportClaim(epoch);
        return;
      }
      await ReaderEffects.finishSourcePackageImport(epoch,
        origin, 0, 0, 0, 0, `读取剪贴板失败：${(e as Error).message}`,
      );
    }
  }

  private static legadoBookSourceFromPackageEntry(entry: Object): JsonObject | null {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return null;
    }
    const bookSource = entry as Object as JsonObject;
    const name = ReaderEffects.getString(bookSource, 'bookSourceName').trim();
    return name.length > 0 ? bookSource : null;
  }

  private static async finishSourcePackageImport(
    epoch: number,
    origin: string,
    total: number,
    imported: number,
    skipped: number,
    failed: number,
    message: string,
  ): Promise<void> {
    if (!ReaderEffects.isCurrentSourcePackageImport(epoch, origin)) {
      ReaderEffects.releaseSourcePackageImportClaim(epoch);
      return;
    }
    const refreshMessage = await ReaderEffects.refreshSourceListAfterPackageImport(epoch, origin);
    if (!ReaderEffects.isCurrentSourcePackageImport(epoch, origin)) {
      ReaderEffects.releaseSourcePackageImportClaim(epoch);
      return;
    }
    const completedMessage = refreshMessage.length > 0
      ? (message.length > 0 ? `${message}；${refreshMessage}` : refreshMessage)
      : message;
    ReaderUiStore.dispatch({
      type: 'source-package-import-result',
      sourceImportOrigin: origin,
      sourceImportTotal: total,
      sourceImportImported: imported,
      sourceImportSkipped: skipped,
      sourceImportFailed: failed,
      sourceImportMessage: completedMessage,
      sourceImportEpoch: epoch,
    });
    const applied = ReaderUiStore.snapshot();
    const completed = applied.sourceImportEpoch === epoch && !applied.sourceImportRunning &&
      ReaderEffects.isSourcePackageImportRoute(applied.routeId);
    ReaderEffects.releaseSourcePackageImportClaim(epoch);
    // The generated route keeps its historical "preview" id, but its body
    // now renders recorded Core results rather than synthetic candidates.
    if (completed) ReaderUiStore.dispatch({ type: 'route-push', id: 'source-import-preview' });
  }

  private static async refreshSourceListAfterPackageImport(epoch: number, origin: string): Promise<string> {
    try {
      const data = await CoreRuntime.get().sourceList(false);
      if (!ReaderEffects.isCurrentSourcePackageImport(epoch, origin)) return '';
      const arrayFields = data as Object as Record<string, Object[]>;
      const rawSources: Object[] = arrayFields['sources'];
      const sources: CoreSourceEntry[] = [];
      if (Array.isArray(rawSources)) {
        for (let i = 0; i < rawSources.length; i++) {
          const raw = rawSources[i] as Object as JsonObject;
          const sourceId = ReaderEffects.getString(raw, 'sourceId');
          if (sourceId.length === 0) continue;
          const booleanFields = raw as Object as Record<string, boolean>;
          sources.push({
            sourceId: sourceId,
            name: ReaderEffects.getString(raw, 'name', sourceId),
            baseUrl: ReaderEffects.getString(raw, 'baseUrl'),
            enabled: booleanFields['enabled'] === true,
            enabledExplore: booleanFields['enabledExplore'] === true,
          });
        }
      }
      if (!ReaderEffects.isCurrentSourcePackageImport(epoch, origin)) return '';
      ReaderUiStore.dispatch({ type: 'source-list-loaded', sources: sources });
      return '已重新读取 Core 书源列表。';
    } catch (e) {
      return `导入后刷新 Core 书源列表失败：${(e as Error).message}`;
    }
  }

  private static claimSourcePackageImport(origin: string): number {
    const state = ReaderUiStore.snapshot();
    const epoch = state.sourceImportEpoch;
    if (!ReaderEffects.isSourcePackageImportRoute(state.routeId) || !state.sourceImportRunning ||
      state.sourceImportOrigin !== origin || !Number.isSafeInteger(epoch) || epoch <= 0 ||
      ReaderEffects.sourcePackageImportEffectEpoch === epoch) {
      return -1;
    }
    ReaderEffects.sourcePackageImportEffectEpoch = epoch;
    return epoch;
  }

  private static isCurrentSourcePackageImport(epoch: number, origin: string): boolean {
    const state = ReaderUiStore.snapshot();
    return ReaderEffects.sourcePackageImportEffectEpoch === epoch && epoch > 0 &&
      ReaderEffects.isSourcePackageImportRoute(state.routeId) && state.sourceImportRunning &&
      state.sourceImportEpoch === epoch && state.sourceImportOrigin === origin;
  }

  private static releaseSourcePackageImportClaim(epoch: number): void {
    if (ReaderEffects.sourcePackageImportEffectEpoch === epoch) {
      ReaderEffects.sourcePackageImportEffectEpoch = 0;
    }
  }

  private static isSourcePackageImportRoute(routeId: string): boolean {
    return routeId === 'source-import-options' || routeId === 'source-add';
  }

  static loadAvailableSources(enabledOnly: boolean = false): void {
    if (!CoreRuntime.isInitialized()) return;
    ReaderUiStore.dispatch({ type: 'set-loading', loading: true });
    try {
      CoreRuntime.get().sourceList(enabledOnly).then((data: JsonObject): void => {
        const arrayFields = data as Object as Record<string, Object[]>;
        const rawSources: Object[] = arrayFields['sources'];
        const sources: CoreSourceEntry[] = [];
        if (Array.isArray(rawSources)) {
          for (let i = 0; i < rawSources.length; i++) {
            const raw = rawSources[i] as Object as JsonObject;
            const sourceId = ReaderEffects.getString(raw, 'sourceId');
            if (sourceId.length === 0) continue;
            const booleanFields = raw as Object as Record<string, boolean>;
            sources.push({
              sourceId: sourceId,
              name: ReaderEffects.getString(raw, 'name', sourceId),
              baseUrl: ReaderEffects.getString(raw, 'baseUrl'),
              enabled: booleanFields['enabled'] === true,
              enabledExplore: booleanFields['enabledExplore'] === true,
            });
          }
        }
        ReaderUiStore.dispatch({ type: 'source-list-loaded', sources: sources });
      }).catch((e: Error): void => {
        ReaderUiStore.dispatch({
          type: 'set-error',
          error: { code: 'SOURCE_LIST_FAILED', message: e.message, retryable: true },
        });
      });
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: { code: 'SOURCE_LIST_FAILED', message: (e as Error).message, retryable: true },
      });
    }
  }

  // Source storage is Core-owned. A normal list/detail delete tap enters the
  // route-bound confirmation; a raw event must never reach Core directly.
  private static rejectUnconfirmedSourceDelete(): void {
    ReaderUiStore.dispatch({
      type: 'set-error',
      error: {
        code: 'SOURCE_DELETE_CONFIRM_REQUIRED',
        message: '请先在当前书源的删除确认页确认，未执行 Core 删除。',
        retryable: false,
      },
    });
  }

  private static deleteConfirmedSource(): void {
    const state = ReaderUiStore.snapshot();
    const id = (state.selectedSourceId ?? '').trim();
    let found = false;
    for (let i = 0; i < state.availableSources.length; i++) {
      if (state.availableSources[i].sourceId === id) {
        found = true;
        break;
      }
    }
    if (state.routeId !== 'source-delete-confirm' || !found) {
      ReaderEffects.rejectUnconfirmedSourceDelete();
      return;
    }
    if (ReaderEffects.sourceDeleteInFlightId === id) return;
    ReaderEffects.sourceDeleteInFlightId = id;
    try {
      CoreRuntime.get().sourceDelete([id]).then((): void => {
        ReaderEffects.sourceDeleteInFlightId = '';
        ReaderEffects.loadAvailableSources(false);
        ReaderUiStore.dispatch({ type: 'route-replace', id: 'source-management' });
      }).catch((e: Error): void => {
        ReaderEffects.sourceDeleteInFlightId = '';
        ReaderUiStore.dispatch({
          type: 'set-error',
          error: { code: 'SOURCE_DELETE_FAILED', message: e.message, retryable: true },
        });
      });
    } catch (e) {
      ReaderEffects.sourceDeleteInFlightId = '';
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: { code: 'SOURCE_DELETE_FAILED', message: (e as Error).message, retryable: true },
      });
    }
  }

  private static exportSources(sourceId: string): void {
    const params: JsonObject = {};
    const id = sourceId.trim();
    if (id.length > 0) params['sourceIds'] = [id];
    params['format'] = 'json';
    try {
      const runtime = CoreRuntime.get();
      runtime.executeCoreMethod('source.export', params, 10000).then((data: JsonObject): void => {
        const payload = ReaderEffects.getString(data, 'data');
        if (payload.length === 0) {
          ReaderUiStore.dispatch({
            type: 'set-error',
            error: { code: 'SOURCE_EXPORT_EMPTY', message: 'Core 未返回可导出的书源数据', retryable: true },
          });
          return;
        }
        const share = runtime.getShareAdapter();
        if (share === null) {
          ReaderUiStore.dispatch({
            type: 'set-error',
            error: { code: 'SOURCE_EXPORT_SHARE_UNAVAILABLE', message: '当前环境不能打开系统分享面板', retryable: true },
          });
          return;
        }
        const count = ReaderEffects.getNumber(data, 'count', id.length > 0 ? 1 : 0);
        const request: HostShareInvokeRequest = {
          title: `Reader 书源导出（${count} 个）`,
          text: payload,
        };
        share.invoke(request).then((result): void => {
          if (!result.shared) {
            ReaderUiStore.dispatch({
              type: 'set-error',
              error: { code: 'SOURCE_EXPORT_SHARE_FAILED', message: '系统分享面板未能完成导出', retryable: true },
            });
          }
        }).catch((e: Error): void => {
          ReaderUiStore.dispatch({
            type: 'set-error',
            error: { code: 'SOURCE_EXPORT_SHARE_FAILED', message: e.message, retryable: true },
          });
        });
      }).catch((e: Error): void => {
        ReaderUiStore.dispatch({
          type: 'set-error',
          error: { code: 'SOURCE_EXPORT_FAILED', message: e.message, retryable: true },
        });
      });
    } catch (e) {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: { code: 'SOURCE_EXPORT_FAILED', message: (e as Error).message, retryable: true },
      });
    }
  }

  static loadReplaceRules(): void {
    if (!CoreRuntime.isInitialized()) return;
    try {
      CoreRuntime.get().replaceRuleList().then((data: JsonObject): void => {
        const arrayFields = data as Object as Record<string, Object[]>;
        const rawRules: Object[] = arrayFields['rules'];
        if (!Array.isArray(rawRules)) return;
        const rules: ReplaceRule[] = [];
        for (let i = 0; i < rawRules.length; i++) {
          const raw = rawRules[i] as Object as JsonObject;
          const booleanFields = raw as Object as Record<string, boolean>;
          const rule: ReplaceRule = {
            id: `rule-${ReaderEffects.getNumber(raw, 'id')}`,
            pattern: ReaderEffects.getString(raw, 'pattern'),
            replacement: ReaderEffects.getString(raw, 'replacement'),
            scope: ReaderEffects.getString(raw, 'scope', 'chapter'),
            enabled: booleanFields['isEnabled'] === true,
          };
          rules.push(rule);
        }
        ReaderUiStore.dispatch({ type: 'replace-rule-list-loaded', replaceRules: rules });
      }).catch((e: Error): void => {
        console.info(`ReaderEffects: replace-rule-list error: ${e.message}`);
      });
    } catch (e) {
      console.info(`ReaderEffects: replace-rule-list error: ${(e as Error).message}`);
    }
  }

  // ── Source switch confirm ────────────────────────────────────────────
  // The UI chooses one persisted source. Core searches that source, while
  // Harmony owns the explicit final shelf/progress replacement only after a
  // detail, TOC and chapter have been verified for the selected candidate.
  static handleSourceSwitchConfirm(): void {
    const state = ReaderUiStore.snapshot();
    // A route transition invalidates the state epoch. If an old async request
    // is still marked in-flight, cancel it before accepting a fresh attempt.
    if (ReaderEffects.sourceSwitchInFlight &&
      ReaderEffects.sourceSwitchStateEpoch !== state.sourceSwitchEpoch) {
      ReaderEffects.sourceSwitchRequestSequence += 1;
      ReaderEffects.sourceSwitchInFlight = false;
    }
    if (state.routeId !== 'source-switch' || !state.loading) {
      ReaderEffects.surfaceSourceSwitchFailure('换源确认已失效；请从当前阅读器重新进入换源页面。');
      return;
    }
    const book = state.currentBook;
    if (state.sourceSelection.length !== 1) {
      ReaderEffects.surfaceSourceSwitchFailure('请先选择一个书源，再确认换源。');
      return;
    }
    if (book === null) {
      ReaderEffects.surfaceSourceSwitchFailure('当前没有可换源的书籍。');
      return;
    }
    if (isLocalBookSourceId(book.sourceId)) {
      ReaderEffects.surfaceSourceSwitchFailure('本地书籍没有可更换的书源。');
      return;
    }
    const newSourceId = state.sourceSelection[0].trim();
    if (!ReaderEffects.isEnabledSourceForSwitch(state.availableSources, newSourceId)) {
      ReaderEffects.surfaceSourceSwitchFailure('所选书源已不可用，请重新选择。');
      return;
    }
    if (ReaderEffects.sourceSwitchInFlight) {
      ReaderEffects.surfaceSourceSwitchFailure('换源正在进行中，请等待当前请求完成。');
      return;
    }
    const sequence = ReaderEffects.sourceSwitchRequestSequence + 1;
    ReaderEffects.sourceSwitchRequestSequence = sequence;
    ReaderEffects.sourceSwitchInFlight = true;
    ReaderEffects.sourceSwitchStateEpoch = state.sourceSwitchEpoch;
    ReaderEffects.sourceSwitchExpectedSourceId = newSourceId;
    ReaderEffects.sourceSwitchExpectedBookId = book.bookId;
    ReaderEffects.sourceSwitchExpectedBookSourceId = (book.sourceId ?? '').trim();
    // A source replacement supersedes any ordinary shelf/detail open that is
    // still awaiting Core. Its late result must not put the old source back.
    ReaderEffects.bookOpenRequestSequence += 1;
    try {
      const runtime = CoreRuntime.get();
      ReaderEffects.runSourceSwitch(runtime, state, book, newSourceId, sequence).then((): void => {
        if (!ReaderEffects.isCurrentSourceSwitch(sequence)) return;
        ReaderEffects.sourceSwitchInFlight = false;
        ReaderEffects.loadBookshelf();
        ReaderUiStore.dispatch({ type: 'source-switch-completed' });
      }).catch((e: Error): void => {
        if (!ReaderEffects.isCurrentSourceSwitch(sequence)) return;
        ReaderEffects.sourceSwitchInFlight = false;
        ReaderEffects.surfaceSourceSwitchFailure(e.message);
      });
    } catch (e) {
      if (ReaderEffects.isCurrentSourceSwitch(sequence)) {
        ReaderEffects.sourceSwitchInFlight = false;
        ReaderEffects.surfaceSourceSwitchFailure((e as Error).message);
      }
    }
  }

  private static cancelSourceSwitchIfActive(): void {
    if (!ReaderEffects.sourceSwitchInFlight || ReaderUiStore.snapshot().routeId !== 'source-switch') return;
    ReaderEffects.sourceSwitchRequestSequence += 1;
    ReaderEffects.sourceSwitchInFlight = false;
  }

  private static isCurrentSourceSwitch(sequence: number): boolean {
    const state = ReaderUiStore.snapshot();
    const currentBook = state.currentBook;
    return ReaderEffects.sourceSwitchRequestSequence === sequence &&
      state.routeId === 'source-switch' &&
      state.sourceSwitchEpoch === ReaderEffects.sourceSwitchStateEpoch &&
      state.sourceSelection.length === 1 &&
      state.sourceSelection[0] === ReaderEffects.sourceSwitchExpectedSourceId &&
      currentBook !== null && currentBook.bookId === ReaderEffects.sourceSwitchExpectedBookId &&
      (currentBook.sourceId ?? '').trim() === ReaderEffects.sourceSwitchExpectedBookSourceId;
  }

  private static surfaceSourceSwitchFailure(message: string): void {
    ReaderUiStore.dispatch({
      type: 'source-switch-failed',
      message: message.length > 0 ? message : '换源失败，请检查所选书源后重试。',
    });
  }

  private static isEnabledSourceForSwitch(sources: CoreSourceEntry[], sourceId: string): boolean {
    for (let i = 0; i < sources.length; i++) {
      if (sources[i].sourceId === sourceId && sources[i].enabled) return true;
    }
    return false;
  }

  private static async runSourceSwitch(runtime: CoreRuntime, state: ReaderUiState,
    previousBook: BookDetail, selectedSourceId: string, sequence: number): Promise<void> {
    const previousSourceId = (previousBook.sourceId ?? ReaderEffects.currentSourceId).trim();
    if (previousSourceId.length === 0) {
      throw new Error('当前书籍缺少已持久化的 Core sourceId，不能安全替换书架来源。');
    }
    const progress = await ReaderEffects.captureSourceSwitchProgress(
      runtime, state, previousBook, previousSourceId,
    );
    if (!ReaderEffects.isCurrentSourceSwitch(sequence)) return;
    const data = await runtime.changeBookSource(previousBook.bookId, [selectedSourceId], previousBook.title);
    if (!ReaderEffects.isCurrentSourceSwitch(sequence)) return;
    const candidate = ReaderEffects.selectSourceSwitchCandidate(data, selectedSourceId, previousBook);
    await ReaderEffects.loadSourceSwitchCandidate(
      runtime, candidate, state.availableSources, state.bookshelfBooks, previousBook,
      previousSourceId, progress, sequence,
    );
  }

  private static selectSourceSwitchCandidate(data: JsonObject, selectedSourceId: string,
    previousBook: BookDetail): JsonObject {
    const fields = data as Object as Record<string, Object[]>;
    const rawCandidates: Object[] = fields['candidates'];
    if (!Array.isArray(rawCandidates) || rawCandidates.length === 0) {
      throw new Error('所选书源没有匹配到同名书籍。');
    }
    const candidates: JsonObject[] = [];
    let titleMatch: JsonObject | null = null;
    let titleMatchCount = 0;
    const expectedTitle = ReaderEffects.normalizedSourceSwitchText(previousBook.title);
    const expectedAuthor = ReaderEffects.normalizedSourceSwitchText(previousBook.author);
    for (let i = 0; i < rawCandidates.length; i++) {
      const value = rawCandidates[i];
      if (value === null || typeof value !== 'object' || Array.isArray(value)) continue;
      const candidate = value as Object as JsonObject;
      if (ReaderEffects.getString(candidate, 'sourceId') !== selectedSourceId) continue;
      candidates.push(candidate);
      const candidateTitle = ReaderEffects.normalizedSourceSwitchText(
        ReaderEffects.getString(candidate, 'bookName'),
      );
      const candidateAuthor = ReaderEffects.normalizedSourceSwitchText(
        ReaderEffects.getString(candidate, 'author'),
      );
      if (candidateTitle === expectedTitle) {
        if (expectedAuthor.length > 0 && candidateAuthor === expectedAuthor) return candidate;
        titleMatch = candidate;
        titleMatchCount += 1;
      }
    }
    if (candidates.length === 0) {
      throw new Error('Core 未返回所选书源的换源候选。');
    }
    if (titleMatch !== null && titleMatchCount === 1) return titleMatch;
    if (candidates.length === 1) return candidates[0];
    throw new Error('所选书源返回多个同名候选；当前界面无法安全替你选择，请缩小搜索范围后重试。');
  }

  private static normalizedSourceSwitchText(value: string): string {
    return value.trim().toLowerCase();
  }

  private static async captureSourceSwitchProgress(runtime: CoreRuntime, state: ReaderUiState,
    book: BookDetail, sourceId: string): Promise<SourceSwitchProgressSnapshot> {
    // The rendered page is presentation state only.  A Core chapter offset is
    // a Unicode-scalar anchor published by the reader surface, so never turn a
    // page number into an offset when an older Core binary cannot read progress.
    const fallback: SourceSwitchProgressSnapshot = {
      chapterIndex: ReaderEffects.currentBookId === book.bookId && ReaderEffects.currentSourceId === sourceId
        ? Math.max(0, ReaderEffects.currentChapterIndex) : 0,
      chapterOffset: Math.max(0, Math.floor(state.readerChapterOffset)),
      chapterProgress: Math.max(0, Math.min(1, state.readerChapterProgress)),
      chapterTitle: state.currentChapterTitle,
    };
    const persisted = await ReaderEffects.readPersistedReadingProgress(runtime, book.bookId, sourceId);
    if (persisted === null) return fallback;
    return {
      chapterIndex: persisted.chapterIndex,
      chapterOffset: persisted.chapterOffset,
      chapterProgress: persisted.chapterProgress,
      chapterTitle: fallback.chapterTitle,
    };
  }

  private static async loadSourceSwitchCandidate(runtime: CoreRuntime, candidate: JsonObject,
    sources: CoreSourceEntry[], shelfBooks: CoreBookshelfBook[], previousBook: BookDetail,
    previousSourceId: string, progress: SourceSwitchProgressSnapshot, sequence: number): Promise<void> {
    const sourceId = ReaderEffects.getString(candidate, 'sourceId');
    const bookUrl = ReaderEffects.getString(candidate, 'bookUrl');
    if (sourceId.length === 0 || bookUrl.length === 0) {
      throw new Error('Core 换源候选缺少 sourceId/bookUrl。');
    }
    let sourceName = sourceId;
    for (let i = 0; i < sources.length; i++) {
      if (sources[i].sourceId === sourceId) {
        sourceName = sources[i].name;
        break;
      }
    }
    const baseBook: JsonObject = {};
    baseBook['bookId'] = bookUrl;
    baseBook['title'] = ReaderEffects.getString(candidate, 'bookName');
    baseBook['author'] = ReaderEffects.getString(candidate, 'author');
    const detailData = await runtime.bookDetailFromSource(sourceId, bookUrl, baseBook);
    if (!ReaderEffects.isCurrentSourceSwitch(sequence)) return;
    const detailFields = detailData as Object as Record<string, Object>;
    const detailBookValue: Object = detailFields['book'];
    const detailBook = detailBookValue !== null && typeof detailBookValue === 'object' &&
      !Array.isArray(detailBookValue) ? detailBookValue as Object as JsonObject : baseBook;
    const detail: BookDetail = {
      bookId: ReaderEffects.getString(detailBook, 'bookId', bookUrl),
      sourceId: sourceId,
      title: ReaderEffects.getString(detailBook, 'title', ReaderEffects.getString(candidate, 'bookName', '未知书名')),
      author: ReaderEffects.getString(detailBook, 'author', ReaderEffects.getString(candidate, 'author', '未知作者')),
      coverUrl: ReaderEffects.getString(detailBook, 'coverUrl'),
      summary: ReaderEffects.getString(detailBook, 'intro'),
      sourceName: sourceName,
      sourceUrl: sourceId,
      latestChapter: ReaderEffects.getString(detailBook, 'lastChapter'),
      chapterListUrl: ReaderEffects.getString(detailData, 'tocUrl', bookUrl),
    };
    const detailVariables = ReaderEffects.getVariables(detailData);
    const tocData = await runtime.bookTocFromSource(sourceId, detail.bookId,
      detail.chapterListUrl.length > 0 ? detail.chapterListUrl : bookUrl, detailVariables);
    if (!ReaderEffects.isCurrentSourceSwitch(sequence)) return;
    const tocFields = tocData as Object as Record<string, Object[]>;
    const tocValue: Object[] = tocFields['toc'];
    if (!Array.isArray(tocValue) || tocValue.length === 0) {
      throw new Error('新书源未返回章节目录。');
    }
    const chapterTarget = ReaderEffects.sourceSwitchChapterTarget(tocValue, progress);
    const targetPosition = chapterTarget.position;
    const target = tocValue[targetPosition] as Object as JsonObject;
    const chapterUrl = ReaderEffects.getString(target, 'url');
    if (chapterUrl.length === 0) {
      throw new Error('新书源目标章节缺少 URL。');
    }
    const coreChapterIndex = ReaderEffects.getNumber(target, 'index', targetPosition);
    const chapterTitle = ReaderEffects.getString(target, 'title', `第 ${targetPosition + 1} 章`);
    const targetFields = target as Object as Record<string, Object>;
    const targetVariablesValue: Object = targetFields['variables'];
    const chapterVariables = targetVariablesValue !== null && typeof targetVariablesValue === 'object' &&
      !Array.isArray(targetVariablesValue)
      ? targetVariablesValue as Object as JsonObject : detailVariables;
    const targetProgress: SourceSwitchProgressSnapshot = chapterTarget.matched ? progress : {
      chapterIndex: coreChapterIndex,
      chapterOffset: 0,
      chapterProgress: 0,
      chapterTitle: chapterTitle,
    };
    const canonicalLocation = await ReaderEffects.persistSourceSwitchStorage(
      runtime, detail, previousBook, previousSourceId, shelfBooks, coreChapterIndex,
      targetProgress.chapterOffset, targetProgress.chapterProgress, chapterTitle, sequence,
    );
    if (!ReaderEffects.isCurrentSourceSwitch(sequence)) return;
    ReaderEffects.currentSourceId = sourceId;
    ReaderEffects.currentBookId = detail.bookId;
    ReaderEffects.currentChapterId = chapterUrl;
    ReaderEffects.currentChapterIndex = coreChapterIndex;
    ReaderEffects.currentSourceVariables = chapterVariables;
    ReaderEffects.currentTocVariables = detailVariables;
    ReaderEffects.currentChapterToc = [];
    for (let i = 0; i < tocValue.length; i++) {
      ReaderEffects.currentChapterToc.push(tocValue[i] as Object as JsonObject);
    }
    // The durable replacement is complete at this point. Advance the bound
    // visible identity before publishing the new Core detail so the terminal
    // completion callback still belongs to this same transaction.
    ReaderEffects.sourceSwitchExpectedBookId = detail.bookId;
    ReaderEffects.sourceSwitchExpectedBookSourceId = (detail.sourceId ?? '').trim();
    ReaderUiStore.dispatch({ type: 'book-detail-success', book: detail });
    ReaderUiStore.dispatch({ type: 'chapter-toc-loaded', chapterToc: ReaderEffects.mapChapterToc(tocData) });
    ReaderUiStore.dispatch({ type: 'set-loading', loading: true });
    const chapterData = await runtime.chapterContentFromSource(sourceId, detail.bookId, chapterUrl,
      chapterTitle, coreChapterIndex, chapterVariables);
    if (!ReaderEffects.isCurrentSourceSwitch(sequence)) return;
    if (!ReaderEffects.isCurrentChapterLoad(detail.bookId, sourceId, coreChapterIndex, chapterUrl)) return;
    ReaderUiStore.dispatch({
      type: 'chapter-success',
      chapterParagraphs: ReaderEffects.mapChapterContent(chapterData),
      chapterTitle: chapterTitle,
      bookId: detail.bookId,
      sourceId: sourceId,
      chapterIndex: coreChapterIndex,
    });
    // Source replacement writes the durable target progress before showing the
    // body.  Publish that same canonical coordinate after chapter-success so
    // ReadingTextFlow can restore it visually instead of restarting at page 1.
    ReaderUiStore.dispatch({
      type: 'reader-location-resolved',
      canonicalReaderLocation: canonicalLocation,
    });
  }

  private static sourceSwitchChapterTarget(toc: Object[],
    progress: SourceSwitchProgressSnapshot): SourceSwitchChapterTarget {
    const expectedTitle = ReaderEffects.normalizedSourceSwitchText(progress.chapterTitle);
    if (expectedTitle.length > 0) {
      for (let i = 0; i < toc.length; i++) {
        const entry = toc[i] as Object as JsonObject;
        if (ReaderEffects.normalizedSourceSwitchText(ReaderEffects.getString(entry, 'title')) === expectedTitle) {
          return { position: i, matched: true };
        }
      }
    }
    for (let i = 0; i < toc.length; i++) {
      const entry = toc[i] as Object as JsonObject;
      if (ReaderEffects.getNumber(entry, 'index', i) === progress.chapterIndex) {
        return { position: i, matched: true };
      }
    }
    return {
      position: Math.max(0, Math.min(toc.length - 1, progress.chapterIndex)),
      matched: false,
    };
  }

  private static parseSourceSwitchCanonicalLocation(data: JsonObject, expectedBookId: string,
    expectedChapterIndex: number, expectedChapterOffset: number,
    expectedChapterProgress: number): CoreReaderCanonicalLocation {
    const fields = data as Object as Record<string, Object>;
    if (fields['resolved'] !== true) {
      throw new Error('Core 未确认换源后的阅读位置。');
    }
    const rawCanonical = fields['canonicalLocation'];
    if (rawCanonical === null || rawCanonical === undefined || typeof rawCanonical !== 'object' ||
      Array.isArray(rawCanonical)) {
      throw new Error('Core 换源阅读位置缺少 canonicalLocation。');
    }
    const canonical = rawCanonical as Object as JsonObject;
    const bookId = ReaderEffects.getString(canonical, 'bookId');
    const chapterIndex = ReaderEffects.getNumber(canonical, 'chapterIndex', -1);
    const chapterOffset = ReaderEffects.getNumber(canonical, 'chapterOffset', -1);
    const chapterProgress = ReaderEffects.getNumber(canonical, 'chapterProgress', -1);
    const locationRevision = ReaderEffects.getString(canonical, 'locationRevision');
    const resolverVersion = ReaderEffects.getString(data, 'resolverVersion');
    const expectedIndex = Math.floor(expectedChapterIndex);
    const expectedOffset = Math.floor(expectedChapterOffset);
    if (bookId !== expectedBookId || !Number.isSafeInteger(chapterIndex) ||
      chapterIndex !== expectedIndex || !Number.isSafeInteger(chapterOffset) ||
      chapterOffset !== expectedOffset || !Number.isFinite(chapterProgress) ||
      chapterProgress < 0 || chapterProgress > 1 ||
      Math.abs(chapterProgress - expectedChapterProgress) > 0.000001 ||
      locationRevision.length === 0 || resolverVersion.length === 0) {
      throw new Error('Core 返回的换源阅读位置与请求不一致。');
    }
    return {
      bookId: bookId,
      chapterIndex: expectedIndex,
      chapterOffset: expectedOffset,
      chapterProgress: chapterProgress,
      locationRevision: locationRevision,
      resolverVersion: resolverVersion,
    };
  }

  private static async persistSourceSwitchStorage(runtime: CoreRuntime, detail: BookDetail,
    previousBook: BookDetail, previousSourceId: string, shelfBooks: CoreBookshelfBook[],
    chapterIndex: number, chapterOffset: number, chapterProgress: number,
    chapterTitle: string, sequence: number): Promise<CoreReaderCanonicalLocation> {
    ReaderEffects.requireCurrentSourceSwitch(sequence);
    const state = ReaderUiStore.snapshot();
    const viewportWidth = AppStorage.get<number>(ViewportAdapter.K_WIDTH) ?? ViewportAdapter.DEFAULT_WIDTH;
    const viewportHeight = AppStorage.get<number>(ViewportAdapter.K_HEIGHT) ?? ViewportAdapter.DEFAULT_HEIGHT;
    const location = await runtime.readerLocationResolve(
      detail.bookId, chapterIndex, chapterOffset, chapterProgress, viewportWidth, viewportHeight,
      state.fontSize / 17, detail.sourceId ?? '', chapterTitle,
    );
    ReaderEffects.requireCurrentSourceSwitch(sequence);
    const canonicalLocation = ReaderEffects.parseSourceSwitchCanonicalLocation(
      location, detail.bookId, chapterIndex, chapterOffset, chapterProgress,
    );
    await runtime.readingProgressUpdate(
      detail.bookId, detail.sourceId ?? '', chapterIndex, chapterOffset, chapterProgress,
      canonicalLocation.locationRevision,
    );
    ReaderEffects.requireCurrentSourceSwitch(sequence);
    const shelf: JsonObject = {};
    shelf['sourceId'] = detail.sourceId ?? '';
    shelf['bookId'] = detail.bookId;
    shelf['title'] = detail.title;
    shelf['author'] = detail.author;
    shelf['coverUrl'] = detail.coverUrl ?? '';
    shelf['intro'] = detail.summary;
    shelf['lastChapter'] = detail.latestChapter;
    const group = ReaderEffects.sourceSwitchGroup(shelfBooks, previousSourceId, previousBook.bookId);
    if (group.length > 0) shelf['group'] = group;
    const targetAlreadyOnShelf = ReaderEffects.sourceSwitchShelfContains(
      shelfBooks, detail.sourceId ?? '', detail.bookId,
    );
    // Store the target before removing the old key. This makes a failed Core
    // write fail safe: the original shelf entry remains available.
    await runtime.bookshelfAdd(shelf);
    if (!ReaderEffects.isCurrentSourceSwitch(sequence)) {
      // A cancellation after add must never proceed to delete the old key. If
      // this transaction introduced the target entry, best-effort remove it so
      // cancellation does not leave a duplicate shelf book behind.
      if (!targetAlreadyOnShelf) {
        try {
          await runtime.bookshelfRemove(detail.sourceId ?? '', detail.bookId);
        } catch (e) {
          console.info(`ReaderEffects: cancelled source-switch target cleanup failed: ${(e as Error).message}`);
        }
      }
      throw new Error('换源已取消。');
    }
    if (previousSourceId !== (detail.sourceId ?? '') || previousBook.bookId !== detail.bookId) {
      ReaderEffects.requireCurrentSourceSwitch(sequence);
      await runtime.bookshelfRemove(previousSourceId, previousBook.bookId);
    }
    return canonicalLocation;
  }

  private static requireCurrentSourceSwitch(sequence: number): void {
    if (!ReaderEffects.isCurrentSourceSwitch(sequence)) {
      throw new Error('换源已取消。');
    }
  }

  private static sourceSwitchShelfContains(shelfBooks: CoreBookshelfBook[], sourceId: string,
    bookId: string): boolean {
    for (let i = 0; i < shelfBooks.length; i++) {
      if (shelfBooks[i].sourceId === sourceId && shelfBooks[i].bookId === bookId) return true;
    }
    return false;
  }

  private static sourceSwitchGroup(shelfBooks: CoreBookshelfBook[], sourceId: string, bookId: string): string {
    for (let i = 0; i < shelfBooks.length; i++) {
      const entry = shelfBooks[i];
      if (entry.sourceId === sourceId && entry.bookId === bookId) return entry.group;
    }
    return '';
  }

  // ── Replace rule persistence ──────────────────────────────────────────
  // The reducer updates local state optimistically (UI reflects the change
  // immediately). Create is owned by the native production path and uses the
  // strict replace.persist DTO so Core can issue the one-time undo token. The
  // whole Reader-UI replace Pilot remains Shadow; update/delete keep their
  // existing native owners until their typed promotion boundary is closed.

  static handleReplaceRuleAdd(event: UiEvent): void {
    const pattern = event.replaceRulePattern ?? '';
    if (ReaderUiStore.snapshot().routeId !== 'content-replacement' || pattern.trim().length === 0) {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: {
          code: 'REPLACE_RULE_CREATE_TARGET_REQUIRED',
          message: '请在当前阅读器替换面板填写规则后再创建。',
          retryable: false,
        },
      });
      ReaderEffects.loadReplaceRules();
      return;
    }
    const replacement = event.replaceRuleReplacement ?? '';
    const scope = event.replaceRuleScope ?? 'chapter';
    try {
      const ruleParams: ReaderUIJSONPayload = {};
      ruleParams['name'] = pattern;
      ruleParams['pattern'] = pattern;
      ruleParams['replacement'] = replacement;
      ruleParams['scope'] = scope;
      ruleParams['scopeTitle'] = scope === 'title';
      ruleParams['scopeContent'] = scope !== 'title';
      ruleParams['isEnabled'] = true;
      ruleParams['isRegex'] = true;
      const payload: ReaderUIJSONPayload = {};
      payload['operation'] = 'create';
      payload['params'] = ruleParams;
      ReaderUiStore.dispatch({ type: 'core-slice10-start', coreSlice10Method: 'replace.persist' });
      ReaderEffects.slice10Core.replacePersistCreate(payload).then((result: JsonObject): void => {
        const resultPayload = result as Object as ReaderUIJSONPayload;
        const token = resultPayload['undoToken'] as Object as ReaderUIJSONPayload;
        ReaderUiStore.dispatch({
          type: 'core-slice10-succeeded',
          coreSlice10Method: 'replace.persist',
          coreSlice10Result: resultPayload,
        });
        ReaderUiStore.dispatch({
          type: 'core-slice10-undo-token-captured',
          lastUndoToken: token,
        });
        ReaderEffects.loadReplaceRules();
      }).catch((e: Error): void => {
        ReaderEffects.reportSlice10CommandFailure(
          'replace.persist', e, 'CORE_SLICE10_REPLACE_PERSIST_FAILED', false,
        );
        ReaderEffects.loadReplaceRules();
      });
    } catch (e) {
      ReaderEffects.reportSlice10CommandFailure(
        'replace.persist', e, 'CORE_SLICE10_REPLACE_PERSIST_FAILED', false,
      );
      ReaderEffects.loadReplaceRules();
    }
  }

  static handleReplaceRuleEdit(event: UiEvent): void {
    const id = event.replaceRuleId ?? '';
    if (id.length === 0) {
      ReaderEffects.rejectInvalidReplaceRuleMutation();
      return;
    }
    const state = ReaderUiStore.snapshot();
    if (state.routeId !== 'content-replacement' ||
      !ReaderEffects.hasCurrentPersistentReplaceRule(id)) {
      ReaderEffects.rejectInvalidReplaceRuleMutation();
      ReaderEffects.loadReplaceRules();
      return;
    }
    // Look up the rule in local state to preserve its enabled flag.
    let enabled = true;
    let found = false;
    for (let i = 0; i < state.replaceRules.length; i++) {
      if (state.replaceRules[i].id === id) {
        enabled = state.replaceRules[i].enabled;
        found = true;
        break;
      }
    }
    if (!found) {
      ReaderEffects.rejectInvalidReplaceRuleMutation();
      ReaderEffects.loadReplaceRules();
      return;
    }
    try {
      const runtime = CoreRuntime.get();
      const rule: JsonObject = {};
      rule['id'] = id;
      rule['pattern'] = event.replaceRulePattern ?? '';
      rule['replacement'] = event.replaceRuleReplacement ?? '';
      rule['scope'] = event.replaceRuleScope ?? 'chapter';
      rule['enabled'] = enabled;
      runtime.replaceRuleUpdate(rule).then((): void => {
        ReaderEffects.loadReplaceRules();
      }).catch((e: Error): void => {
        ReaderEffects.loadReplaceRules();
        console.info(`ReaderEffects: replace-rule-update error: ${e.message}`);
      });
    } catch (e) {
      console.info(`ReaderEffects: replace-rule-update error: ${(e as Error).message}`);
    }
  }

  private static rejectUnconfirmedReplaceRuleDelete(): void {
    ReaderUiStore.dispatch({
      type: 'set-error',
      error: {
        code: 'REPLACE_RULE_DELETE_CONFIRM_REQUIRED',
        message: '请先选择一条已保存的规则，并在当前阅读器中再次确认删除。',
        retryable: false,
      },
    });
  }

  private static rejectInvalidReplaceRuleMutation(): void {
    ReaderUiStore.dispatch({
      type: 'set-error',
      error: {
        code: 'REPLACE_RULE_UPDATE_TARGET_REQUIRED',
        message: '只能在当前阅读器中更新一条仍由 Core 保存的规则。',
        retryable: false,
      },
    });
  }

  private static hasCurrentPersistentReplaceRule(id: string): boolean {
    if (!id.startsWith('rule-') || id.length <= 'rule-'.length) return false;
    for (let i = 'rule-'.length; i < id.length; i++) {
      const code = id.charCodeAt(i);
      if (code < 48 || code > 57) return false;
    }
    const rules = ReaderUiStore.snapshot().replaceRules;
    for (let i = 0; i < rules.length; i++) {
      if (rules[i].id === id) return true;
    }
    return false;
  }

  // Only the second tap in the visible replacement panel reaches Core. The
  // identity is read from state rather than the event so a caller cannot swap
  // a target between selection and confirmation.
  private static deleteConfirmedReplaceRule(): void {
    const state = ReaderUiStore.snapshot();
    const id = state.pendingReplaceRuleDeleteId;
    if (state.routeId !== 'content-replacement' ||
      !ReaderEffects.hasCurrentPersistentReplaceRule(id)) {
      ReaderEffects.rejectUnconfirmedReplaceRuleDelete();
      return;
    }
    if (ReaderEffects.replaceRuleDeleteInFlightId === id) return;
    ReaderEffects.replaceRuleDeleteInFlightId = id;
    try {
      CoreRuntime.get().replaceRuleDelete(id).then((data: JsonObject): void => {
        ReaderEffects.replaceRuleDeleteInFlightId = '';
        const fields = data as Object as Record<string, boolean>;
        if (fields['deleted'] !== true) {
          ReaderEffects.loadReplaceRules();
          ReaderUiStore.dispatch({
            type: 'set-error',
            error: {
              code: 'REPLACE_RULE_DELETE_NOT_APPLIED',
              message: 'Core 未删除该规则；已保留当前确认目标并重新读取规则列表。',
              retryable: true,
            },
          });
          return;
        }
        ReaderUiStore.dispatch({ type: 'replace-rule-delete-complete' });
        ReaderEffects.loadReplaceRules();
      }).catch((e: Error): void => {
        ReaderEffects.replaceRuleDeleteInFlightId = '';
        ReaderEffects.loadReplaceRules();
        ReaderUiStore.dispatch({
          type: 'set-error',
          error: { code: 'REPLACE_RULE_DELETE_FAILED', message: e.message, retryable: true },
        });
      });
    } catch (e) {
      ReaderEffects.replaceRuleDeleteInFlightId = '';
      ReaderEffects.loadReplaceRules();
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: { code: 'REPLACE_RULE_DELETE_FAILED', message: (e as Error).message, retryable: true },
      });
    }
  }

  // Toggle is persisted as an update with the new enabled value (reducer
  // already flipped the flag in local state, so we read it back here).
  static handleReplaceRuleToggle(event: UiEvent): void {
    const id = event.replaceRuleId ?? '';
    if (id.length === 0) {
      ReaderEffects.rejectInvalidReplaceRuleMutation();
      return;
    }
    const state = ReaderUiStore.snapshot();
    if (state.routeId !== 'content-replacement' ||
      !ReaderEffects.hasCurrentPersistentReplaceRule(id)) {
      ReaderEffects.rejectInvalidReplaceRuleMutation();
      ReaderEffects.loadReplaceRules();
      return;
    }
    let pattern = '';
    let replacement = '';
    let scope = 'chapter';
    let enabled = true;
    let found = false;
    for (let i = 0; i < state.replaceRules.length; i++) {
      if (state.replaceRules[i].id === id) {
        const r = state.replaceRules[i];
        pattern = r.pattern;
        replacement = r.replacement;
        scope = r.scope;
        enabled = r.enabled;
        found = true;
        break;
      }
    }
    if (!found) {
      ReaderEffects.rejectInvalidReplaceRuleMutation();
      ReaderEffects.loadReplaceRules();
      return;
    }
    try {
      const runtime = CoreRuntime.get();
      const rule: JsonObject = {};
      rule['id'] = id;
      rule['pattern'] = pattern;
      rule['replacement'] = replacement;
      rule['scope'] = scope;
      rule['enabled'] = enabled;
      runtime.replaceRuleUpdate(rule).then((): void => {
        ReaderEffects.loadReplaceRules();
      }).catch((e: Error): void => {
        ReaderEffects.loadReplaceRules();
        console.info(`ReaderEffects: replace-rule-toggle error: ${e.message}`);
      });
    } catch (e) {
      console.info(`ReaderEffects: replace-rule-toggle error: ${(e as Error).message}`);
    }
  }
}
