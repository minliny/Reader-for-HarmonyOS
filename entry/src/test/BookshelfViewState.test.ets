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

    // ── MotionAdapter: bookshelf 相关 motionId 存在 ──
    it('bookshelfViewSwitchMotionSpecExists', 0, () => {
      expect(MotionSpecRegistry.has('bookshelf.view.switch')).assertTrue();
      const spec = MotionSpecRegistry.byId('bookshelf.view.switch');
      expect(spec !== undefined).assertTrue();
      expect(spec!.durationMs).assertEqual(160);
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
