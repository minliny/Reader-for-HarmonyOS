// DestructiveFlow.test — truthfulness fences for Core-backed destructive UI.
// These tests intentionally stop before Core I/O: they prove that a request
// first binds a live target and enters a confirmation surface.
import { describe, it, expect } from '@ohos/hypium';
import { ReaderReducer } from '../main/ets/ui/store/ReaderReducer';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';
import { BookDetail, CoreBookmark, CoreBookGroup, CoreBookshelfBook, CoreRssSubscription, CoreSourceEntry, CoreStorageBackupInfo, ReplaceRule } from '../main/ets/ui/store/ReaderUiState';

function source(sourceId: string): CoreSourceEntry {
  return {
    sourceId: sourceId,
    name: `源 ${sourceId}`,
    baseUrl: `https://${sourceId}.example`,
    enabled: true,
    enabledExplore: true,
  };
}

function shelfBook(sourceId: string, bookId: string, group: string = ''): CoreBookshelfBook {
  return {
    sourceId: sourceId,
    bookId: bookId,
    title: '真实书架书籍',
    author: '作者',
    coverUrl: '',
    intro: '',
    kind: '',
    lastChapter: '',
    group: group,
  };
}

function bookDetail(sourceId: string, bookId: string): BookDetail {
  return {
    sourceId: sourceId,
    bookId: bookId,
    title: '真实书架书籍',
    author: '作者',
    summary: '',
    sourceName: '真实书源',
    sourceUrl: 'https://source.example',
    latestChapter: '',
    chapterListUrl: '',
  };
}

function subscription(subscriptionId: string): CoreRssSubscription {
  return {
    subscriptionId: subscriptionId,
    feedUrl: `https://${subscriptionId}.example/feed.xml`,
    title: `订阅 ${subscriptionId}`,
    enabled: true,
    unreadCount: 0,
  };
}

function persistedReplaceRule(id: string): ReplaceRule {
  return { id: id, pattern: '旧称', replacement: '新称', scope: 'chapter', enabled: true };
}

function bookmark(time: number): CoreBookmark {
  return {
    time: time, bookName: '真实书架书籍', bookAuthor: '作者', chapterIndex: 0,
    chapterPos: 0, chapterName: '第一章', bookText: '正文', content: '',
  };
}

function bookGroup(groupId: number, groupName: string): CoreBookGroup {
  return { groupId: groupId, groupName: groupName, cover: '', order: 0, enableRefresh: true, show: true };
}

function restoreInfo(): CoreStorageBackupInfo {
  return {
    source: '已校验本机备份', schemaVersion: 1, bytes: 128,
    checksum: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', exportedAt: 1,
  };
}

export default function DestructiveFlowTests(): void {
  describe('DestructiveFlow', () => {
    it('sourceDeleteRequestBindsLiveCoreSourceBeforeConfirmRoute', 0, () => {
      const ready = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'source-list-loaded', sources: [source('source-a')],
      });
      const after = ReaderReducer.reduce(ready, { type: 'source-delete-request', sourceId: 'source-a' });
      expect(after.routeId).assertEqual('source-delete-confirm');
      expect(after.selectedSourceId ?? '').assertEqual('source-a');
      expect(after.stack.length).assertEqual(2);
    });

    it('sourceDeleteRequestRejectsUnknownTargetWithoutEnteringConfirmRoute', 0, () => {
      const ready = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'source-list-loaded', sources: [source('source-a')],
      });
      const after = ReaderReducer.reduce(ready, { type: 'source-delete-request', sourceId: 'source-missing' });
      expect(after.routeId).assertEqual('bookshelf');
      expect(after.stack.length).assertEqual(1);
    });

    it('sourceDeleteConfirmRequiresTheBoundConfirmationRoute', 0, () => {
      const ready = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'source-list-loaded', sources: [source('source-a')],
      });
      const after = ReaderReducer.reduce(ready, { type: 'source-delete-confirm' });
      expect(after.error !== null).assertTrue();
      if (after.error !== null) expect(after.error.code).assertEqual('SOURCE_DELETE_CONFIRM_REQUIRED');
    });

    it('bookshelfDeleteUsesExactLiveShelfTargetAndConfirmationSheet', 0, () => {
      let state = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'bookshelf-list-loaded', bookshelfBooks: [shelfBook('source-a', '/book/a')],
      });
      state = ReaderReducer.reduce(state, {
        type: 'book-detail-success', book: bookDetail('source-a', '/book/a'),
      });
      const after = ReaderReducer.reduce(state, { type: 'book-action', bookAction: 'delete' });
      expect(after.overlay).assertEqual('dialog');
      expect(after.pendingBookshelfRemovalSourceId).assertEqual('source-a');
      expect(after.pendingBookshelfRemovalBookId).assertEqual('/book/a');
      expect(after.bookshelfRemovalDialogPhase).assertEqual('default');
    });

    it('bookshelfDeleteProjectsFigmaDefaultLoadingFailedWithEpochGuards', 0, () => {
      let state = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'bookshelf-list-loaded', bookshelfBooks: [shelfBook('source-a', '/book/a')],
      });
      state = ReaderReducer.reduce(state, {
        type: 'book-detail-success', book: bookDetail('source-a', '/book/a'),
      });
      const dialog = ReaderReducer.reduce(state, { type: 'book-action', bookAction: 'delete' });
      const loading = ReaderReducer.reduce(dialog, {
        type: 'bookshelf-remove-confirm', sourceId: 'source-a', bookId: '/book/a',
      });
      expect(loading.bookshelfRemovalDialogPhase).assertEqual('loading');
      const loadingEpoch = loading.bookshelfRemovalEpoch;
      // Core bookshelf.remove cannot be cancelled. A backdrop/system-back
      // projection must preserve the current exact transaction while loading.
      const blockedCancel = ReaderReducer.reduce(loading, { type: 'bookshelf-remove-cancel' });
      expect(blockedCancel.bookshelfRemovalDialogPhase).assertEqual('loading');
      expect(blockedCancel.bookshelfRemovalEpoch).assertEqual(loadingEpoch);
      const failed = ReaderReducer.reduce(loading, {
        type: 'bookshelf-remove-failed', sourceId: 'source-a', bookId: '/book/a',
        bookshelfRemovalEpoch: loadingEpoch, bookshelfRemovalError: 'network unavailable',
      });
      expect(failed.bookshelfRemovalDialogPhase).assertEqual('failed');
      expect(failed.error === null).assertTrue();
      const retry = ReaderReducer.reduce(failed, {
        type: 'bookshelf-remove-confirm', sourceId: 'source-a', bookId: '/book/a',
      });
      expect(retry.bookshelfRemovalDialogPhase).assertEqual('loading');
      expect(retry.bookshelfRemovalEpoch > loadingEpoch).assertTrue();
      const staleFailure = ReaderReducer.reduce(retry, {
        type: 'bookshelf-remove-failed', sourceId: 'source-a', bookId: '/book/a',
        bookshelfRemovalEpoch: loadingEpoch, bookshelfRemovalError: 'stale callback',
      });
      expect(staleFailure.bookshelfRemovalDialogPhase).assertEqual('loading');
      const complete = ReaderReducer.reduce(retry, {
        type: 'bookshelf-remove-complete', sourceId: 'source-a', bookId: '/book/a',
        bookshelfRemovalEpoch: retry.bookshelfRemovalEpoch,
      });
      expect(complete.overlay).assertEqual('');
      expect(complete.bookshelfRemovalDialogPhase).assertEqual('idle');
      expect(complete.pendingBookshelfRemovalSourceId).assertEqual('');
      expect(complete.pendingBookshelfRemovalBookId).assertEqual('');
    });

    it('bookshelfDeleteRefusesStaleCurrentBookNotReturnedByCoreShelf', 0, () => {
      let state = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'bookshelf-list-loaded', bookshelfBooks: [shelfBook('source-b', '/book/b')],
      });
      state = ReaderReducer.reduce(state, {
        type: 'book-detail-success', book: bookDetail('source-a', '/book/a'),
      });
      const after = ReaderReducer.reduce(state, { type: 'book-action', bookAction: 'delete' });
      expect(after.overlay).assertEqual('');
      expect(after.pendingBookshelfRemovalSourceId).assertEqual('');
      expect(after.pendingBookshelfRemovalBookId).assertEqual('');
      expect(after.error !== null).assertTrue();
      if (after.error !== null) expect(after.error.code).assertEqual('BOOKSHELF_REMOVE_TARGET_REQUIRED');
    });

    it('bookshelfMultiSelectKeepsExactLiveTargetsAndUsesOneBatchConfirmation', 0, () => {
      const first = shelfBook('source-a', '/book/a');
      const second = shelfBook('source-b', '/book/b');
      const listed = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'bookshelf-list-loaded', bookshelfBooks: [first, second],
      });
      const selected = ReaderReducer.reduce(listed, {
        type: 'bookshelf-multiselect-open', sourceId: first.sourceId, bookId: first.bookId,
      });
      expect(selected.overlay).assertEqual('bookshelf-multiselect');
      expect(selected.bookshelfSelectedTargets.length).assertEqual(1);
      expect(selected.bookshelfSelectedTargets[0].sourceId).assertEqual(first.sourceId);
      const toggled = ReaderReducer.reduce(selected, {
        type: 'bookshelf-multiselect-toggle', sourceId: second.sourceId, bookId: second.bookId,
      });
      expect(toggled.bookshelfSelectedTargets.length).assertEqual(2);
      const dialog = ReaderReducer.reduce(toggled, { type: 'bookshelf-multiselect-remove-request' });
      expect(dialog.overlay).assertEqual('dialog');
      expect(dialog.bookshelfRemovalScope).assertEqual('batch');
      expect(dialog.pendingBookshelfRemovalTargets.length).assertEqual(2);
      const loading = ReaderReducer.reduce(dialog, { type: 'bookshelf-remove-confirm' });
      expect(loading.bookshelfRemovalDialogPhase).assertEqual('loading');
      const stale = ReaderReducer.reduce(loading, {
        type: 'bookshelf-remove-complete', bookshelfRemovalEpoch: loading.bookshelfRemovalEpoch - 1,
      });
      expect(stale.bookshelfRemovalDialogPhase).assertEqual('loading');
      const failed = ReaderReducer.reduce(loading, {
        type: 'bookshelf-remove-failed', bookshelfRemovalEpoch: loading.bookshelfRemovalEpoch,
        bookshelfRemovalError: 'Core unavailable',
      });
      expect(failed.bookshelfRemovalDialogPhase).assertEqual('failed');
      const retried = ReaderReducer.reduce(failed, { type: 'bookshelf-remove-confirm' });
      expect(retried.bookshelfRemovalEpoch > loading.bookshelfRemovalEpoch).assertTrue();
      const complete = ReaderReducer.reduce(retried, {
        type: 'bookshelf-remove-complete', bookshelfRemovalEpoch: retried.bookshelfRemovalEpoch,
      });
      expect(complete.overlay).assertEqual('');
      expect(complete.bookshelfSelectedTargets.length).assertEqual(0);
      expect(complete.pendingBookshelfRemovalTargets.length).assertEqual(0);
    });

    it('rssDeleteRequestUsesRealConfirmRouteAndExactSubscription', 0, () => {
      let ready = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'rss-data-loaded', rssSubscriptions: [subscription('rss-a')], rssItems: [],
      });
      ready = ReaderReducer.reduce(ready, { type: 'route-push', id: 'rss-subscription-management' });
      const after = ReaderReducer.reduce(ready, {
        type: 'rss-subscription-delete-request', rssSubscriptionId: 'rss-a',
      });
      expect(after.routeId).assertEqual('rss-source-delete-confirm');
      expect(after.pendingRssSubscriptionDeleteId).assertEqual('rss-a');
    });

    it('rssDeleteConfirmRejectsMissingOrUnboundSubscription', 0, () => {
      const ready = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'rss-data-loaded', rssSubscriptions: [subscription('rss-a')], rssItems: [],
      });
      const after = ReaderReducer.reduce(ready, {
        type: 'rss-subscription-delete-confirm', rssSubscriptionId: 'rss-a',
      });
      expect(after.error !== null).assertTrue();
      if (after.error !== null) expect(after.error.code).assertEqual('RSS_SUBSCRIPTION_DELETE_CONFIRM_REQUIRED');
    });

    it('replaceRuleDeleteRequiresPersistedTargetThenSecondConfirmTap', 0, () => {
      let ready = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'route-push', id: 'reader-replace-overlay-v2',
      });
      ready = ReaderReducer.reduce(ready, {
        type: 'replace-rule-list-loaded', replaceRules: [persistedReplaceRule('rule-7')],
      });
      const requested = ReaderReducer.reduce(ready, {
        type: 'replace-rule-delete-request', replaceRuleId: 'rule-7',
      });
      expect(requested.pendingReplaceRuleDeleteId).assertEqual('rule-7');
      const confirmed = ReaderReducer.reduce(requested, { type: 'replace-rule-delete-confirm' });
      expect(confirmed.pendingReplaceRuleDeleteId).assertEqual('rule-7');
      expect(confirmed.replaceRules.length).assertEqual(1);
      const cancelled = ReaderReducer.reduce(confirmed, { type: 'replace-rule-delete-cancel' });
      expect(cancelled.pendingReplaceRuleDeleteId).assertEqual('');
      expect(cancelled.replaceRules.length).assertEqual(1);
    });

    it('replaceRuleDeleteRejectsPendingAndDirectDeleteEvents', 0, () => {
      let ready = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'route-push', id: 'reader-replace-overlay-v2',
      });
      ready = ReaderReducer.reduce(ready, {
        type: 'replace-rule-list-loaded', replaceRules: [persistedReplaceRule('pending-rule-1')],
      });
      const pending = ReaderReducer.reduce(ready, {
        type: 'replace-rule-delete-request', replaceRuleId: 'pending-rule-1',
      });
      expect(pending.pendingReplaceRuleDeleteId).assertEqual('');
      expect(pending.error !== null).assertTrue();
      const direct = ReaderReducer.reduce(ready, {
        type: 'replace-rule-delete', replaceRuleId: 'pending-rule-1',
      });
      expect(direct.replaceRules.length).assertEqual(1);
      expect(direct.error !== null).assertTrue();
      if (direct.error !== null) expect(direct.error.code).assertEqual('REPLACE_RULE_DELETE_CONFIRM_REQUIRED');
    });

    it('bookmarkDeleteBindsCurrentCoreBookmarkAndRequiresSecondTap', 0, () => {
      let ready = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'book-detail-success', book: bookDetail('source-a', '/book/a'),
      });
      ready = ReaderReducer.reduce(ready, { type: 'route-push', id: 'toc-bookmarks' });
      ready = ReaderReducer.reduce(ready, { type: 'bookmark-list-loaded', bookmarks: [bookmark(42)] });
      const requested = ReaderReducer.reduce(ready, {
        type: 'bookmark-delete-request', bookmarkTime: 42,
      });
      expect(requested.pendingBookmarkDeleteTime).assertEqual(42);
      const confirmed = ReaderReducer.reduce(requested, {
        type: 'bookmark-delete-confirm', bookmarkTime: 42,
      });
      expect(confirmed.bookmarksLoading).assertTrue();
      const direct = ReaderReducer.reduce(ready, { type: 'bookmark-delete', bookmarkTime: 42 });
      expect(direct.bookmarks.length).assertEqual(1);
      expect(direct.bookmarksError.length > 0).assertTrue();
    });

    it('searchHistoryClearRequiresVisibleSecondConfirmation', 0, () => {
      let ready = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'book-search' });
      ready = ReaderReducer.reduce(ready, {
        type: 'search-history-loaded', searchHistory: ['真实关键词'],
      });
      const requested = ReaderReducer.reduce(ready, { type: 'search-history-clear-request' });
      expect(requested.pendingSearchHistoryClear).assertTrue();
      const confirmed = ReaderReducer.reduce(requested, { type: 'search-history-clear-confirm' });
      expect(confirmed.searchHistoryLoading).assertTrue();
      const direct = ReaderReducer.reduce(ready, { type: 'search-history-clear' });
      expect(direct.searchHistory.length).assertEqual(1);
      expect(direct.searchHistoryError.length > 0).assertTrue();
    });

    it('groupClearBindsAnExactGroupedShelfRowAndRequiresSecondTap', 0, () => {
      // 'group-management' is a retired user-declined route: set routeId directly.
      const base = DemoUiState.initial();
      base.routeId = 'group-management';
      let ready = base;
      ready = ReaderReducer.reduce(ready, {
        type: 'bookshelf-list-loaded', bookshelfBooks: [shelfBook('source-a', '/book/a', '已读')],
      });
      ready = ReaderReducer.reduce(ready, {
        type: 'book-group-list-loaded', bookGroups: [bookGroup(1, '已读')],
      });
      const requested = ReaderReducer.reduce(ready, {
        type: 'book-group-clear-request', sourceId: 'source-a', bookId: '/book/a',
      });
      expect(requested.pendingBookGroupClearSourceId).assertEqual('source-a');
      expect(requested.pendingBookGroupClearBookId).assertEqual('/book/a');
      const confirmed = ReaderReducer.reduce(requested, {
        type: 'book-group-clear-confirm', sourceId: 'source-a', bookId: '/book/a',
      });
      expect(confirmed.bookGroupsLoading).assertTrue();
      const direct = ReaderReducer.reduce(ready, {
        type: 'book-group-assign', sourceId: 'source-a', bookId: '/book/a', bookshelfGroup: '',
      });
      expect(direct.bookGroupsError.length > 0).assertTrue();
    });

    it('cacheClearNeedsSecondConfirmationButCoreRestoreUsesItsOneFigmaConfirmation', 0, () => {
      let settings = ReaderReducer.reduce(DemoUiState.initial(), { type: 'switch-tab', tab: 'settings' });
      settings = ReaderReducer.reduce(settings, { type: 'route-push', id: 'settings-general' });
      const requestedCache = ReaderReducer.reduce(settings, { type: 'settings-action', settingsKey: 'cache-clear' });
      expect(requestedCache.pendingCacheClear).assertTrue();
      const confirmedCache = ReaderReducer.reduce(requestedCache, { type: 'cache-clear-confirm' });
      expect(confirmedCache.pendingCacheClear).assertTrue();
      const rawCache = ReaderReducer.reduce(settings, { type: 'cache-clear-confirm' });
      expect(rawCache.error !== null).assertTrue();

      let restore = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'core-restore-prepared', coreBackupInfo: restoreInfo(), coreBackupMessage: '已校验',
      });
      restore = ReaderReducer.reduce(restore, { type: 'route-push', id: 'restore-confirm' });
      const requestedRestore = ReaderReducer.reduce(restore, { type: 'core-restore-apply-request' });
      expect(requestedRestore.pendingCoreRestoreConfirmationChecksum).assertEqual(restoreInfo().checksum);
      expect(requestedRestore.coreBackupStatus).assertEqual('restoring');
      const legacyConfirm = ReaderReducer.reduce(requestedRestore, { type: 'core-restore-apply-confirm' });
      expect(legacyConfirm.coreBackupStatus).assertEqual('restoring');
      const rawRestore = ReaderReducer.reduce(restore, { type: 'core-backup-apply' });
      expect(rawRestore.coreBackupStatus).assertEqual('error');
    });

    it('sourceSwitchConfirmationCannotSurviveLeavingTheSwitchRoute', 0, () => {
      let ready = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'book-detail-success', book: bookDetail('source-a', '/book/a'),
      });
      ready = ReaderReducer.reduce(ready, { type: 'source-list-loaded', sources: [source('source-b')] });
      ready = ReaderReducer.reduce(ready, { type: 'route-push', id: 'source-switch' });
      ready = ReaderReducer.reduce(ready, { type: 'source-toggle', sourceId: 'source-b' });
      const left = ReaderReducer.reduce(ready, { type: 'route-pop' });
      expect(left.sourceSelection.length).assertEqual(0);
      const forged = ReaderReducer.reduce(left, { type: 'source-switch-confirm' });
      expect(forged.routeId).assertEqual('bookshelf');
      expect(forged.loading).assertFalse();
    });

    it('replaceRuleUpdateAndToggleRejectNonPersistentOrOffRouteRows', 0, () => {
      const offRoute = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'replace-rule-edit', replaceRuleId: 'rule-9', replaceRulePattern: 'a', replaceRuleReplacement: 'b',
      });
      expect(offRoute.error !== null).assertTrue();
      let ready = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'route-push', id: 'reader-replace-overlay-v2',
      });
      ready = ReaderReducer.reduce(ready, {
        type: 'replace-rule-list-loaded', replaceRules: [persistedReplaceRule('pending-rule-1')],
      });
      const pendingToggle = ReaderReducer.reduce(ready, { type: 'replace-rule-toggle', replaceRuleId: 'pending-rule-1' });
      expect(pendingToggle.error !== null).assertTrue();
    });

    it('groupAndRssUpdatesRequireTheirVisibleLiveManagementRows', 0, () => {
      const groupOffRoute = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'book-group-update', bookGroupId: 1, bookGroupName: '新名称',
      });
      expect(groupOffRoute.bookGroupsError.length > 0).assertTrue();
      // 'group-management' is a retired user-declined route: set routeId directly.
      const groupBase = DemoUiState.initial();
      groupBase.routeId = 'group-management';
      let groupReady = groupBase;
      groupReady = ReaderReducer.reduce(groupReady, {
        type: 'book-group-list-loaded', bookGroups: [bookGroup(1, '旧名称')],
      });
      const groupUpdate = ReaderReducer.reduce(groupReady, {
        type: 'book-group-update', bookGroupId: 1, bookGroupName: '新名称',
      });
      expect(groupUpdate.bookGroupsLoading).assertTrue();

      let rssReady = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'rss-data-loaded', rssSubscriptions: [subscription('rss-a')], rssItems: [],
      });
      const rssOffRoute = ReaderReducer.reduce(rssReady, {
        type: 'rss-subscription-update', rssSubscriptionId: 'rss-a', rssEnabled: false,
      });
      expect(rssOffRoute.error !== null).assertTrue();
      rssReady = ReaderReducer.reduce(rssReady, { type: 'route-push', id: 'rss-subscription-management' });
      const rssUpdate = ReaderReducer.reduce(rssReady, {
        type: 'rss-subscription-update', rssSubscriptionId: 'rss-a', rssEnabled: false,
      });
      expect(rssUpdate.error).assertNull();
    });

    it('sourcePackageImportBindsOneVisibleRouteEpochAndRejectsLateResult', 0, () => {
      const offRoute = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'source-package-import-json', sourceImportOrigin: '手动 JSON',
      });
      expect(offRoute.sourceImportRunning).assertFalse();
      expect(offRoute.error !== null).assertTrue();

      let ready = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'source-import-options' });
      ready = ReaderReducer.reduce(ready, { type: 'source-package-import-json', sourceImportOrigin: '手动 JSON' });
      expect(ready.sourceImportRunning).assertTrue();
      expect(ready.sourceImportEpoch).assertEqual(1);
      const duplicate = ReaderReducer.reduce(ready, {
        type: 'source-package-import-json', sourceImportOrigin: '手动 JSON',
      });
      expect(duplicate.sourceImportEpoch).assertEqual(1);

      const left = ReaderReducer.reduce(duplicate, { type: 'route-pop' });
      expect(left.sourceImportRunning).assertFalse();
      expect(left.sourceImportEpoch).assertEqual(2);
      const stale = ReaderReducer.reduce(left, {
        type: 'source-package-import-result', sourceImportOrigin: '手动 JSON',
        sourceImportTotal: 1, sourceImportImported: 1, sourceImportEpoch: 1,
      });
      expect(stale.sourceImportImported).assertEqual(0);
    });

    it('bookmarkCreateAndReaderAnchorRequireTheActiveChapterIdentity', 0, () => {
      let ready = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'book-detail-success', book: bookDetail('source-a', '/book/a'),
      });
      ready = ReaderReducer.reduce(ready, { type: 'route-push', id: 'reader' });
      ready = ReaderReducer.reduce(ready, {
        type: 'chapter-success', chapterParagraphs: ['真实正文'], chapterTitle: '第一章',
        bookId: '/book/a', sourceId: 'source-a', chapterIndex: 3,
      });
      const bookmarkCreate = ReaderReducer.reduce(ready, { type: 'bookmark-create' });
      expect(bookmarkCreate.bookmarksLoading).assertTrue();

      const staleAnchor = ReaderReducer.reduce(ready, {
        type: 'reader-location-anchor', readerChapterOffset: 88, readerChapterProgress: 0.5,
        bookId: '/book/a', sourceId: 'other-source', chapterIndex: 3,
      });
      expect(staleAnchor.readerChapterOffset).assertEqual(0);
      const liveAnchor = ReaderReducer.reduce(ready, {
        type: 'reader-location-anchor', readerChapterOffset: 88, readerChapterProgress: 0.5,
        bookId: '/book/a', sourceId: 'source-a', chapterIndex: 3,
      });
      expect(liveAnchor.readerChapterOffset).assertEqual(88);

      const offRoute = ReaderReducer.reduce(ready, { type: 'route-pop' });
      const denied = ReaderReducer.reduce(offRoute, { type: 'bookmark-create' });
      expect(denied.bookmarksLoading).assertFalse();
      expect(denied.bookmarksError.length > 0).assertTrue();
    });

    it('titleSearchSubmitOnlyStartsOnAVisibleSearchRoute', 0, () => {
      const offRoute = ReaderReducer.reduce(DemoUiState.initial(), { type: 'search-submit', query: '三体' });
      expect(offRoute.searchQuery).assertEqual('');
      const route = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'book-search' });
      const accepted = ReaderReducer.reduce(route, { type: 'search-submit', query: '三体' });
      expect(accepted.searchQuery).assertEqual('三体');
      expect(accepted.loading).assertTrue();
    });
  });
}
