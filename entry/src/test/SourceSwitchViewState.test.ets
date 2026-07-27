// SourceSwitchViewState.test — source-switch 的当前 Figma Window、直接候选
// 提交和已撤销状态矩阵的 reducer/display firewall 验证。F3 motion is not
// claimed here: the current Window has no locally wired production timeline.
import { describe, it, expect } from '@ohos/hypium';
import { ViewStateTable, ViewStateComponent } from '../main/ets/contract/generated/ViewStateTable';
import { RouteId, RouteTable } from '../main/ets/contract/generated/RouteTable';
import { ReaderReducer, isRetiredSourceSwitchRoute } from '../main/ets/ui/store/ReaderReducer';
import { ReaderUiStore } from '../main/ets/ui/store/ReaderUiStore';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';
import { BookDetail, CoreSourceEntry } from '../main/ets/ui/store/ReaderUiState';

function collectTypes(components: ViewStateComponent[], sink: string[]): void {
  for (let i = 0; i < components.length; i++) {
    sink.push(components[i].type);
    if (components[i].children.length > 0) {
      collectTypes(components[i].children, sink);
    }
  }
}

function enabledSource(sourceId: string, name: string): CoreSourceEntry {
  return {
    sourceId: sourceId,
    name: name,
    baseUrl: `https://${sourceId}.example`,
    enabled: true,
    enabledExplore: true,
  };
}

function stateWithSources() {
  return ReaderReducer.reduce(DemoUiState.initial(), {
    type: 'source-list-loaded',
    sources: [enabledSource('source-a', '书源 A'), enabledSource('source-b', '书源 B')],
  });
}

function localBook(): BookDetail {
  return {
    bookId: 'local-book', sourceId: 'local', title: '本地书', author: '作者',
    summary: '', sourceName: '本地导入', sourceUrl: '', latestChapter: '', chapterListUrl: 'local-book',
  };
}

export default function SourceSwitchViewStateTests(): void {
  describe('SourceSwitchViewState', () => {
    // ── ViewState 渲染 ──
    it('onlyCurrentSourceSwitchRouteRendersTheLiveFlowShell', 0, () => {
      expect(RouteTable.shellOf('source-switch')).assertEqual('FlowShell');
      // The generated union still retains this historical route ID for
      // compatibility. The display firewall, not a second visual page, owns
      // its removal from the presentation graph.
      expect(RouteTable.shellOf('source-switch-results')).assertEqual('FlowShell');
      // The retirement firewall is now inlined into ReaderReducer (the
      // parallel RetiredSourceSwitchRouteDisplayPolicy module was removed).
      // A deep link to source-switch-results is blocked at the reducer level
      // instead of being redirected to 'reader'.
      expect(isRetiredSourceSwitchRoute('source-switch-results' as RouteId)).assertTrue();
    });

    it('sourceSwitchBodyContainsSourceSwitchFlowPage', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('source-switch', 'default');
      const types: string[] = [];
      collectTypes(body, types);
      expect(types.indexOf('SourceSwitchFlowPage') >= 0).assertTrue();
    });

    it('generatedStateMatrixFixtureCannotReopenTheLiveWindow', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('source-switch-results', 'default');
      const types: string[] = [];
      collectTypes(body, types);
      // This only proves traceability of the generated contract fixture. It is
      // never directly rendered after the inlined retirement firewall.
      expect(types.indexOf('SourceSwitchFlowPage') >= 0).assertTrue();
      expect(isRetiredSourceSwitchRoute('source-switch-results' as RouteId)).assertTrue();
    });

    // ── Reducer 处理 source.switch.* 事件 ──
    it('reducerSourceToggleSelectsExactlyOnePersistedSource', 0, () => {
      const s = stateWithSources();
      expect(s.sourceSelection.length === 0).assertTrue();
      const after = ReaderReducer.reduce(s, { type: 'source-toggle', sourceId: 'source-a' });
      expect(after.sourceSelection.length === 1).assertTrue();
      expect(after.sourceSelection[0]).assertEqual('source-a');
    });

    it('reducerSourceToggleReplacesRadioSelectionInsteadOfAccumulating', 0, () => {
      const s = stateWithSources();
      const after1 = ReaderReducer.reduce(s, { type: 'source-toggle', sourceId: 'source-a' });
      const after2 = ReaderReducer.reduce(after1, { type: 'source-toggle', sourceId: 'source-b' });
      expect(after2.sourceSelection.length).assertEqual(1);
      expect(after2.sourceSelection[0]).assertEqual('source-b');
    });

    it('legacySelectAllCannotCreateMultiSourceSelection', 0, () => {
      const s = stateWithSources();
      const after = ReaderReducer.reduce(s, {
        type: 'source-select-all', sourceIds: ['source-a', 'source-b'],
      });
      expect(after.sourceSelection.length).assertEqual(1);
      expect(after.sourceSelection[0]).assertEqual('source-a');
    });

    it('internalEmptySelectionFailsClosedWithoutCreatingAnotherVisualState', 0, () => {
      const pushed = ReaderReducer.push(stateWithSources(), 'source-switch');
      const after = ReaderReducer.reduce(pushed, { type: 'source-switch-confirm' });
      expect(after.routeId).assertEqual('source-switch');
      expect(after.loading).assertFalse();
      expect(after.error !== null).assertTrue();
      if (after.error !== null) expect(after.error.code).assertEqual('SOURCE_SWITCH_SELECTION_REQUIRED');
    });

    it('directCandidateTransactionWaitsForCoreCompletionBeforeClosingTheWindow', 0, () => {
      const withBook = ReaderReducer.reduce(stateWithSources(), {
        type: 'book-detail-success',
        book: {
          bookId: 'book-a', sourceId: 'source-a', title: '测试书', author: '作者',
          summary: '', sourceName: '书源 A', sourceUrl: 'source-a', latestChapter: '第一章',
          chapterListUrl: '/toc',
        },
      });
      const reader = ReaderReducer.push(withBook, 'reader');
      const pushed = ReaderReducer.push(reader, 'source-switch');
      const selected = ReaderReducer.reduce(pushed, { type: 'source-toggle', sourceId: 'source-b' });
      const started = ReaderReducer.reduce(selected, { type: 'source-switch-confirm' });
      expect(started.routeId).assertEqual('source-switch');
      expect(started.loading).assertTrue();
      const completed = ReaderReducer.reduce(started, { type: 'source-switch-completed' });
      expect(completed.routeId).assertEqual('reader');
      expect(completed.sourceSelection.length).assertEqual(0);
    });

    it('localBookCannotOpenOrRetryAnySourceSwitchRoute', 0, () => {
      const local = ReaderReducer.reduce(stateWithSources(), {
        type: 'book-detail-success', book: localBook(),
      });
      const sourceSwitchRoutes: RouteId[] = [
        'source-switch', 'source-switch-results', 'source-switch-empty', 'source-switch-error',
        'source-switch-timeout', 'source-switch-loading', 'source-switch-rollback', 'source-switch-preview',
      ];
      for (let index = 0; index < sourceSwitchRoutes.length; index += 1) {
        const route = sourceSwitchRoutes[index];
        const pushed = ReaderReducer.reduce(local, { type: 'route-push', id: route });
        const replaced = ReaderReducer.reduce(local, { type: 'route-replace', id: route });
        expect(pushed.routeId).assertEqual(local.routeId);
        expect(replaced.routeId).assertEqual(local.routeId);
      }
      const selected = ReaderReducer.reduce(local, { type: 'source-toggle', sourceId: 'source-b' });
      expect(selected.sourceSelection.length).assertEqual(0);
      const confirmed = ReaderReducer.reduce(local, { type: 'source-switch-confirm' });
      expect(confirmed.routeId).assertEqual(local.routeId);
      expect(confirmed.loading).assertFalse();
    });

    it('storeRequestSourceSwitchOpenRejectsALocalBookBeforeAnyRouteOrCoreWork', 0, () => {
      // This exercises the public component entry point, not just reducer
      // deep-link fencing. A local file has no remote source identity, so the
      // action must return before it can open a route or ask Effects to load
      // replacement candidates.
      ReaderUiStore.init();
      ReaderUiStore.dispatch({ type: 'book-detail-success', book: localBook() });
      const before = ReaderUiStore.snapshot();

      ReaderUiStore.requestSourceSwitchOpen();

      const after = ReaderUiStore.snapshot();
      expect(after.routeId).assertEqual(before.routeId);
      expect(after.stack.length).assertEqual(before.stack.length);
      expect(after.loading).assertEqual(before.loading);
    });

    it('remoteBookCannotNavigateToWithdrawnSourceSwitchStateRoutes', 0, () => {
      const remote = ReaderReducer.reduce(stateWithSources(), {
        type: 'book-detail-success',
        book: {
          bookId: 'book-a', sourceId: 'source-a', title: '测试书', author: '作者',
          summary: '', sourceName: '书源 A', sourceUrl: 'source-a', latestChapter: '第一章',
          chapterListUrl: '/toc',
        },
      });
      const retiredRoutes: RouteId[] = [
        'source-switch-results', 'source-switch-empty', 'source-switch-error',
        'source-switch-timeout', 'source-switch-loading', 'source-switch-rollback',
        'source-switch-preview',
      ];
      for (let index = 0; index < retiredRoutes.length; index += 1) {
        const route = retiredRoutes[index];
        const pushed = ReaderReducer.reduce(remote, { type: 'route-push', id: route });
        const replaced = ReaderReducer.reduce(remote, { type: 'route-replace', id: route });
        expect(pushed.routeId).assertEqual(remote.routeId);
        expect(replaced.routeId).assertEqual(remote.routeId);
      }
    });

    // ── Reducer: set-loading → source-switch loading 态 ──
    it('reducerSetLoadingOnSourceSwitchRoute', 0, () => {
      const s = DemoUiState.initial();
      const pushed = ReaderReducer.reduce(s, { type: 'route-push', id: 'source-switch' });
      expect(pushed.routeId).assertEqual('source-switch');
      expect(pushed.loading).assertFalse();
      const loading = ReaderReducer.reduce(pushed, { type: 'set-loading', loading: true });
      expect(loading.loading).assertTrue();
      const done = ReaderReducer.reduce(loading, { type: 'set-loading', loading: false });
      expect(done.loading).assertFalse();
    });

  });
}
