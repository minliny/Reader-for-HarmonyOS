// BookshelfViewState.test — regression guard for the contract-first bookshelf
// layout on the HarmonyOS-generated ViewStateTable. Mirrors the Reader UI
// contract test (contracts/tests/contract.test.mjs) so a contract regen that
// re-introduces ShelfChipGroup or drops BookshelfShelfSection fails locally
// before reaching a device build.
// B2-B4: 追加 bookshelf reducer 事件验证（view/sort/filter）+ MotionAdapter motionId。
import { describe, it, expect } from '@ohos/hypium';
import { ViewStateTable, ViewStateComponent } from '../main/ets/contract/generated/ViewStateTable';
import { ReaderReducer } from '../main/ets/ui/store/ReaderReducer';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';
import { MotionSpecRegistry } from '../main/ets/ui/motion/MotionSpecRegistry';
import { CoreBookGroup, CoreBookshelfBook } from '../main/ets/ui/store/ReaderUiState';
import {
  shouldEmbedContinueReadingForBookshelfRoute,
  shouldRenderContinueReadingForShelf,
} from '../main/ets/ui/components/BookshelfComponents';

function collectTypes(components: ViewStateComponent[], sink: string[]): void {
  for (let i = 0; i < components.length; i++) {
    sink.push(components[i].type);
    if (components[i].children.length > 0) {
      collectTypes(components[i].children, sink);
    }
  }
}

function countOccurrences(types: string[], target: string): number {
  let n = 0;
  for (let i = 0; i < types.length; i++) {
    if (types[i] === target) n++;
  }
  return n;
}

export default function BookshelfViewStateTests(): void {
  describe('BookshelfViewState', () => {
    it('bookshelfDefaultBodyExcludesShelfChipGroup', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('bookshelf', 'default');
      const types: string[] = [];
      collectTypes(body, types);
      expect(countOccurrences(types, 'ShelfChipGroup') === 0).assertTrue();
    });

    it('bookshelfDefaultBodyHasContinueReadingAndShelfSection', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('bookshelf', 'default');
      const topTypes: string[] = [];
      for (let i = 0; i < body.length; i++) topTypes.push(body[i].type);
      expect(topTypes.indexOf('ContinueReadingCard') >= 0).assertTrue();
      expect(topTypes.indexOf('BookshelfShelfSection') >= 0).assertTrue();
    });

    it('bookshelfDefaultTreeHasShelfSectionWithBookGridAndThreeBookCards', 0, () => {
      // bodyComponentsFor already filters AppTopBar/BackTopBar/BottomNav.
      // bookshelf/default body = [ContinueReadingCard, BookshelfShelfSection],
      // BookshelfShelfSection nests ShelfSectionHeader + BookGrid(3 BookCard).
      const body = ViewStateTable.bodyComponentsFor('bookshelf', 'default');
      const allTypes: string[] = [];
      collectTypes(body, allTypes);
      expect(allTypes.indexOf('BookshelfShelfSection') >= 0).assertTrue();
      expect(allTypes.indexOf('BookGrid') >= 0).assertTrue();
      expect(countOccurrences(allTypes, 'BookCard') >= 3).assertTrue();
    });

    it('bookshelfCoverModeExcludesShelfChipGroup', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('bookshelf', 'cover-mode');
      const types: string[] = [];
      collectTypes(body, types);
      expect(countOccurrences(types, 'ShelfChipGroup') === 0).assertTrue();
    });

    // ── Reducer: set-bookshelf-view（视图模式切换） ──
    it('reducerSetBookshelfViewToCover', 0, () => {
      const s = DemoUiState.initial();
      expect(s.bookshelfFilter.view).assertEqual('cover');
      const after = ReaderReducer.reduce(s, { type: 'set-bookshelf-view', bookshelfView: 'list' });
      expect(after.bookshelfFilter.view).assertEqual('list');
      const cover = ReaderReducer.reduce(after, { type: 'set-bookshelf-view', bookshelfView: 'cover' });
      expect(cover.bookshelfFilter.view).assertEqual('cover');
    });

    // ── Reducer: set-bookshelf-sort（排序切换） ──
    it('reducerSetBookshelfSort', 0, () => {
      const s = DemoUiState.initial();
      expect(s.bookshelfFilter.sort).assertEqual('recent');
      const after = ReaderReducer.reduce(s, { type: 'set-bookshelf-sort', bookshelfSort: 'title' });
      expect(after.bookshelfFilter.sort).assertEqual('title');
      // 其他字段不受影响
      expect(after.bookshelfFilter.view).assertEqual(s.bookshelfFilter.view);
      expect(after.bookshelfFilter.group).assertEqual(s.bookshelfFilter.group);
    });

    // ── Reducer: set-bookshelf-filter-toggle（标签筛选增删） ──
    it('reducerToggleBookshelfFilterAddsAndRemoves', 0, () => {
      const s = DemoUiState.initial();
      expect(s.bookshelfFilter.filters.length === 0).assertTrue();
      const added = ReaderReducer.reduce(s, { type: 'set-bookshelf-filter-toggle', bookshelfFilterToggle: '完结' });
      expect(added.bookshelfFilter.filters.length === 1).assertTrue();
      expect(added.bookshelfFilter.filters[0]).assertEqual('完结');
      const removed = ReaderReducer.reduce(added, { type: 'set-bookshelf-filter-toggle', bookshelfFilterToggle: '完结' });
      expect(removed.bookshelfFilter.filters.length === 0).assertTrue();
    });

    // ── Reducer: set-bookshelf-group（分组切换） ──
    it('reducerSetBookshelfGroup', 0, () => {
      const s = DemoUiState.initial();
      expect(s.bookshelfFilter.group).assertEqual('all');
      const after = ReaderReducer.reduce(s, { type: 'set-bookshelf-group', bookshelfGroup: 'local' });
      expect(after.bookshelfFilter.group).assertEqual('local');
    });

    it('continueReadingProjectionIsIndependentFromFilteredShelfRows', 0, () => {
      const book: CoreBookshelfBook = {
        sourceId: 'source-a', bookId: '/book/a', title: '真实阅读记录', author: '作者',
        coverUrl: '', intro: '', kind: '', lastChapter: '', group: '', lastReadAt: 12,
      };
      const shelfOnly = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'bookshelf-list-loaded', bookshelfBooks: [book],
      });
      expect(shelfOnly.continueReadingBook === null).assertTrue();
      const after = ReaderReducer.reduce(shelfOnly, {
        type: 'continue-reading-loaded', continueReadingBook: book,
      });
      expect(after.continueReadingLoaded).assertTrue();
      expect(after.continueReadingBook !== null).assertTrue();
      if (after.continueReadingBook !== null) {
        expect(after.continueReadingBook.sourceId).assertEqual('source-a');
        expect(after.continueReadingBook.bookId).assertEqual('/book/a');
      }
    });

    it('anEmptyLoadedShelfViewNeverReservesContinueReading', 0, () => {
      const book: CoreBookshelfBook = {
        sourceId: 'source-a', bookId: '/book/a', title: '真实阅读记录', author: '作者',
        coverUrl: '', intro: '', kind: '', lastChapter: '', group: '', lastReadAt: 12,
      };
      expect(shouldRenderContinueReadingForShelf(true, [], 'all')).assertFalse();
      // Figma binds only the populated ContinueReadingCard. While the shelf
      // is unresolved, do not reserve a speculative skeleton/empty card slot.
      expect(shouldRenderContinueReadingForShelf(false, [], 'all')).assertFalse();
      expect(shouldRenderContinueReadingForShelf(true, [book], 'all')).assertTrue();
      // The current Core response is group-scoped. Without a verified global
      // count, a loaded empty group must be rendered as empty rather than
      // inventing a hidden recent-reading record from another group.
      expect(shouldRenderContinueReadingForShelf(true, [], 'local')).assertFalse();
    });

    it('coverAndListPresentationRoutesEmbedTheSameContinueReadingComponent', 0, () => {
      expect(shouldEmbedContinueReadingForBookshelfRoute('bookshelf-cover-mode')).assertTrue();
      expect(shouldEmbedContinueReadingForBookshelfRoute('bookshelf-list-mode')).assertTrue();
      // The default and filter routes already own the card through their
      // generated ViewState tree; embedding it again would duplicate it.
      expect(shouldEmbedContinueReadingForBookshelfRoute('bookshelf')).assertFalse();
      expect(shouldEmbedContinueReadingForBookshelfRoute('sort-filter')).assertFalse();
    });

    it('longPressActionMenuBindsOneLiveShelfBookInsteadOfCurrentReadingBook', 0, () => {
      const target: CoreBookshelfBook = {
        sourceId: 'source-a', bookId: '/book/a', title: '目标书籍', author: '作者 A',
        coverUrl: '', intro: '', kind: '', lastChapter: '', group: '', lastReadAt: 12,
      };
      const other: CoreBookshelfBook = {
        sourceId: 'source-b', bookId: '/book/b', title: '另一册书', author: '作者 B',
        coverUrl: '', intro: '', kind: '', lastChapter: '', group: '', lastReadAt: 8,
      };
      const listed = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'bookshelf-list-loaded', bookshelfBooks: [target, other],
      });
      const opened = ReaderReducer.reduce(listed, {
        type: 'bookshelf-book-action-open', sourceId: target.sourceId, bookId: target.bookId,
      });
      expect(opened.overlay).assertEqual('book-action');
      expect(opened.pendingBookshelfActionSourceId).assertEqual(target.sourceId);
      expect(opened.pendingBookshelfActionBookId).assertEqual(target.bookId);

      const removal = ReaderReducer.reduce(opened, {
        type: 'book-action', bookAction: 'delete', sourceId: target.sourceId, bookId: target.bookId,
      });
      expect(removal.overlay).assertEqual('dialog');
      expect(removal.pendingBookshelfRemovalSourceId).assertEqual(target.sourceId);
      expect(removal.pendingBookshelfRemovalBookId).assertEqual(target.bookId);
      expect(removal.pendingBookshelfActionBookId).assertEqual('');
    });

    it('longPressActionMenuRejectsAStaleShelfIdentity', 0, () => {
      const listed = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'bookshelf-list-loaded', bookshelfBooks: [],
      });
      const opened = ReaderReducer.reduce(listed, {
        type: 'bookshelf-book-action-open', sourceId: 'gone-source', bookId: 'gone-book',
      });
      expect(opened.overlay).assertEqual('');
      expect(opened.pendingBookshelfActionSourceId).assertEqual('');
      expect(opened.pendingBookshelfActionBookId).assertEqual('');
    });

    // ── Core book-group vertical: list state and failure state ──
    it('reducerBookGroupListUsesCoreRowsAndClearsRequestState', 0, () => {
      const s = DemoUiState.initial();
      const loading = ReaderReducer.reduce(s, { type: 'book-group-load-start' });
      expect(loading.bookGroupsLoading).assertTrue();
      const rows: CoreBookGroup[] = [{
        groupId: 7, groupName: '科幻', cover: '', order: 2, enableRefresh: true, show: true,
      }];
      const after = ReaderReducer.reduce(loading, { type: 'book-group-list-loaded', bookGroups: rows });
      expect(after.bookGroupsLoaded).assertTrue();
      expect(after.bookGroupsLoading).assertFalse();
      expect(after.bookGroups.length).assertEqual(1);
      expect(after.bookGroups[0].groupName).assertEqual('科幻');
      expect(after.bookGroupsError).assertEqual('');
    });

    it('reducerBookGroupFailureKeepsManagementPageDataAndSurfacesError', 0, () => {
      // 'group-management' is a retired user-declined route: route-push redirects
      // to 'bookshelf'. Tests that verify book-group reducer semantics set the
      // routeId directly to simulate the management surface without going
      // through the retired navigation path.
      const initial = DemoUiState.initial();
      initial.routeId = 'group-management';
      const s = initial;
      const loading = ReaderReducer.reduce(s, { type: 'book-group-create', bookGroupName: '待读' });
      expect(loading.bookGroupsLoading).assertTrue();
      const after = ReaderReducer.reduce(loading, {
        type: 'book-group-operation-failed', message: 'Core unavailable',
      });
      expect(after.bookGroupsLoading).assertFalse();
      expect(after.bookGroupsError).assertEqual('Core unavailable');
      expect(after.pageState).assertEqual(s.pageState);
    });

    it('bookGroupDeleteRequiresBoundLiveRowSecondConfirmationAndClearsOnNavigation', 0, () => {
      const row: CoreBookGroup = {
        groupId: 7, groupName: '科幻', cover: '', order: 2, enableRefresh: true, show: true,
      };
      const base = DemoUiState.initial();
      base.routeId = 'group-management';
      const management = base;
      const listed = ReaderReducer.reduce(management, {
        type: 'book-group-list-loaded', bookGroups: [row],
      });
      const requested = ReaderReducer.reduce(listed, {
        type: 'book-group-delete-request', bookGroupId: row.groupId,
      });
      expect(requested.pendingBookGroupDeleteId).assertEqual(row.groupId);
      expect(requested.bookGroupsLoading).assertFalse();

      const rawDelete = ReaderReducer.reduce(requested, {
        type: 'book-group-delete', bookGroupId: row.groupId,
      });
      expect(rawDelete.pendingBookGroupDeleteId).assertEqual(row.groupId);
      expect(rawDelete.bookGroupsError.length > 0).assertTrue();

      const confirmed = ReaderReducer.reduce(requested, {
        type: 'book-group-delete-confirm', bookGroupId: row.groupId,
      });
      expect(confirmed.pendingBookGroupDeleteId).assertEqual(row.groupId);
      expect(confirmed.bookGroupsLoading).assertTrue();

      // 'bookshelf-group-management' is also retired: route-push redirects to
      // 'bookshelf', which clears the pending delete target via navigation.
      const navigated = ReaderReducer.reduce(requested, {
        type: 'route-push', id: 'bookshelf-group-management',
      });
      expect(navigated.pendingBookGroupDeleteId).assertEqual(0);
    });

    // ── MotionAdapter: bookshelf 相关 motionId 存在 ──
    it('bookshelfViewSwitchMotionSpecExists', 0, () => {
      expect(MotionSpecRegistry.has('bookshelf.view.switch')).assertTrue();
      const spec = MotionSpecRegistry.byId('bookshelf.view.switch');
      expect(spec !== undefined).assertTrue();
      expect(spec!.durationMs).assertEqual(320);
      expect(spec!.reducedMotionPolicy).assertEqual('zeroDuration');
    });

    it('bookshelfCardPressMotionSpecExists', 0, () => {
      expect(MotionSpecRegistry.has('card.press')).assertTrue();
    });

    it('bookshelfListRowSelectMotionSpecExists', 0, () => {
      expect(MotionSpecRegistry.has('listRow.select')).assertTrue();
    });
  });
}
