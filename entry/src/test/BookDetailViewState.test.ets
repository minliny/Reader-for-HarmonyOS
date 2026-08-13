// BookDetailViewState.test — B1 P0 核心接线验证：book-detail 路由的 ViewState 渲染、
// reducer 事件处理（book-detail-load / book-detail-success / set-error / route-pop）、LibraryShell motionId 解析。
import { describe, it, expect } from '@ohos/hypium';
import { ViewStateTable, ViewStateComponent } from '../main/ets/contract/generated/ViewStateTable';
import { RouteTable } from '../main/ets/contract/generated/RouteTable';
import { ReaderReducer } from '../main/ets/ui/store/ReaderReducer';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';
import { ReaderMotionResolver } from '../main/ets/ui/motion/ReaderMotionResolver';
import { MotionSpecRegistry } from '../main/ets/ui/motion/MotionSpecRegistry';
import { BookDetail } from '../main/ets/ui/store/ReaderUiState';

function collectTypes(components: ViewStateComponent[], sink: string[]): void {
  for (let i = 0; i < components.length; i++) {
    sink.push(components[i].type);
    if (components[i].children.length > 0) {
      collectTypes(components[i].children, sink);
    }
  }
}

export default function BookDetailViewStateTests(): void {
  describe('BookDetailViewState', () => {
    // ── 路由 → Shell 映射 ──
    it('bookDetailResolvesToLibraryShell', 0, () => {
      expect(RouteTable.shellOf('book-detail')).assertEqual('LibraryShell');
    });

    it('bookDirectoryResolvesToLibraryShell', 0, () => {
      expect(RouteTable.shellOf('book-directory')).assertEqual('LibraryShell');
    });

    // ── ViewState 渲染 ──
    it('bookDetailDefaultBodyContainsHeroSummaryChapterList', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('book-detail', 'default');
      const types: string[] = [];
      collectTypes(body, types);
      expect(types.indexOf('BookHero') >= 0).assertTrue();
      expect(types.indexOf('BookSummaryCard') >= 0).assertTrue();
      expect(types.indexOf('BookChapterList') >= 0).assertTrue();
    });

    it('bookDetailLoadingBodyContainsLoading', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('book-detail', 'loading');
      const types: string[] = [];
      collectTypes(body, types);
      expect(types.indexOf('Loading') >= 0).assertTrue();
    });

    // ── Reducer: book-detail-load → setRouteLoading ──
    it('reducerBookDetailLoadSetsLoadingState', 0, () => {
      const s = DemoUiState.initial();
      const after = ReaderReducer.reduce(s, { type: 'book-detail-load' });
      expect(after.loading).assertTrue();
      expect(after.pageState).assertEqual('loading');
    });

    // ── Reducer: book-detail-success → setCurrentBook ──
    it('reducerBookDetailSuccessSetsCurrentBook', 0, () => {
      const s = DemoUiState.initial();
      const loading = ReaderReducer.reduce(s, { type: 'book-detail-load' });
      const book: BookDetail = {
        bookId: 'bk-001',
        title: '长夜余火',
        author: '爱潜水的乌贼',
        summary: '一段简介',
        sourceName: '优书网',
        sourceUrl: 'https://example.com',
        latestChapter: '第 1 章',
        chapterListUrl: 'https://example.com/chapters',
      };
      const after = ReaderReducer.reduce(loading, { type: 'book-detail-success', book: book });
      expect(after.loading).assertFalse();
      expect(after.pageState).assertEqual('default');
      expect(after.currentBook !== null).assertTrue();
      expect(after.currentBook!.title).assertEqual('长夜余火');
    });

    it('reducerBookDetailSuccessClearsError', 0, () => {
      const s = DemoUiState.initial();
      const errored = ReaderReducer.reduce(s, { type: 'set-error', error: { code: 'X', message: 'm', retryable: false } });
      const after = ReaderReducer.reduce(errored, { type: 'book-detail-success', book: null });
      expect(after.error).assertNull();
    });

    // ── Reducer: set-error → pageState='error'（book-detail 加载失败错误态） ──
    it('reducerBookDetailErrorSetsErrorState', 0, () => {
      const s = DemoUiState.initial();
      const pushed = ReaderReducer.reduce(s, { type: 'route-push', id: 'book-detail' });
      const loading = ReaderReducer.reduce(pushed, { type: 'book-detail-load' });
      expect(loading.pageState).assertEqual('loading');
      const errored = ReaderReducer.reduce(loading, {
        type: 'set-error',
        error: { code: 'DETAIL_FAILED', message: '加载失败', retryable: true },
      });
      expect(errored.loading).assertFalse();
      expect(errored.pageState).assertEqual('error');
      expect(errored.error !== null).assertTrue();
      expect(errored.error!.code).assertEqual('DETAIL_FAILED');
    });

    // ── Reducer: route-pop → 从 book-detail 返回（back 链路） ──
    it('reducerRoutePopReturnsFromBookDetail', 0, () => {
      const s = DemoUiState.initial();
      expect(s.routeId).assertEqual('bookshelf');
      const pushed = ReaderReducer.reduce(s, { type: 'route-push', id: 'book-detail' });
      expect(pushed.routeId).assertEqual('book-detail');
      expect(pushed.stack.length).assertEqual(2);
      const popped = ReaderReducer.reduce(pushed, { type: 'route-pop' });
      expect(popped.routeId).assertEqual('bookshelf');
      expect(popped.stack.length).assertEqual(1);
    });

    // ── MotionAdapter 解析 LibraryShell motionId ──
    it('resolvesLibraryShellPush', 0, () => {
      const id = ReaderMotionResolver.resolve({ operation: 'push', containerRole: 'libraryShell' });
      expect(id).assertEqual('app.route.push.forward');
    });

    it('resolvesLibraryShellPop', 0, () => {
      const id = ReaderMotionResolver.resolve({ operation: 'pop', containerRole: 'libraryShell' });
      expect(id).assertEqual('app.route.pop.backward');
    });

    it('libraryShellPushSpecDuration', 0, () => {
      const spec = MotionSpecRegistry.byId('app.route.push.forward');
      expect(spec !== undefined).assertTrue();
      expect(spec!.durationMs).assertEqual(160);
    });
  });
}
