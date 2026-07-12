// SourceSwitchViewState.test — B1 P0 核心接线验证：source-switch 路由的
// ViewState 渲染、reducer 事件处理、MotionAdapter motionId 解析、loading 态。
import { describe, it, expect } from '@ohos/hypium';
import { ViewStateTable, ViewStateComponent } from '../main/ets/contract/generated/ViewStateTable';
import { RouteTable } from '../main/ets/contract/generated/RouteTable';
import { ReaderReducer } from '../main/ets/ui/store/ReaderReducer';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';
import { ReaderMotionResolver } from '../main/ets/ui/motion/ReaderMotionResolver';
import { MotionSpecRegistry } from '../main/ets/ui/motion/MotionSpecRegistry';
import { CoreSourceEntry } from '../main/ets/ui/store/ReaderUiState';

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

export default function SourceSwitchViewStateTests(): void {
  describe('SourceSwitchViewState', () => {
    // ── ViewState 渲染 ──
    it('sourceSwitchRouteRendersFlowShell', 0, () => {
      expect(RouteTable.shellOf('source-switch')).assertEqual('FlowShell');
      expect(RouteTable.shellOf('source-switch-results')).assertEqual('FlowShell');
    });

    it('sourceSwitchBodyContainsSourceSwitchFlowPage', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('source-switch', 'default');
      const types: string[] = [];
      collectTypes(body, types);
      expect(types.indexOf('SourceSwitchFlowPage') >= 0).assertTrue();
    });

    it('sourceSwitchResultsBodyContainsSourceSwitchFlowPage', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('source-switch-results', 'default');
      const types: string[] = [];
      collectTypes(body, types);
      expect(types.indexOf('SourceSwitchFlowPage') >= 0).assertTrue();
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

    it('emptyConfirmStaysOnSwitchRouteWithVisibleValidationError', 0, () => {
      const pushed = ReaderReducer.push(stateWithSources(), 'source-switch');
      const after = ReaderReducer.reduce(pushed, { type: 'source-switch-confirm' });
      expect(after.routeId).assertEqual('source-switch');
      expect(after.loading).assertFalse();
      expect(after.error !== null).assertTrue();
      if (after.error !== null) expect(after.error.code).assertEqual('SOURCE_SWITCH_SELECTION_REQUIRED');
    });

    it('confirmedSwitchWaitsForCompletionBeforePoppingRoute', 0, () => {
      const withBook = ReaderReducer.reduce(stateWithSources(), {
        type: 'book-detail-success',
        book: {
          bookId: 'book-a', sourceId: 'source-a', title: '测试书', author: '作者',
          summary: '', sourceName: '书源 A', sourceUrl: 'source-a', latestChapter: '第一章',
          chapterListUrl: '/toc',
        },
      });
      const pushed = ReaderReducer.push(withBook, 'source-switch');
      const selected = ReaderReducer.reduce(pushed, { type: 'source-toggle', sourceId: 'source-b' });
      const started = ReaderReducer.reduce(selected, { type: 'source-switch-confirm' });
      expect(started.routeId).assertEqual('source-switch');
      expect(started.loading).assertTrue();
      const completed = ReaderReducer.reduce(started, { type: 'source-switch-completed' });
      expect(completed.routeId).assertEqual('bookshelf');
      expect(completed.sourceSelection.length).assertEqual(0);
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

    // ── MotionAdapter 解析 motionId ──
    it('resolvesFlowShellPush', 0, () => {
      const id = ReaderMotionResolver.resolve({ operation: 'push', containerRole: 'flowShell' });
      expect(id).assertEqual('source.switch.route.push');
    });

    it('resolvesFlowShellPop', 0, () => {
      const id = ReaderMotionResolver.resolve({ operation: 'pop', containerRole: 'flowShell' });
      expect(id).assertEqual('source.switch.route.pop');
    });

    it('resolvesFlowShellReplace', 0, () => {
      const id = ReaderMotionResolver.resolve({ operation: 'replace', containerRole: 'flowShell' });
      expect(id).assertEqual('source.switch.route.replace');
    });

    it('flowShellMotionSpecsExist', 0, () => {
      expect(MotionSpecRegistry.has('source.switch.route.push')).assertTrue();
      expect(MotionSpecRegistry.has('source.switch.route.pop')).assertTrue();
      expect(MotionSpecRegistry.has('source.switch.route.replace')).assertTrue();
    });

    it('flowShellPushSpecDuration', 0, () => {
      const spec = MotionSpecRegistry.byId('source.switch.route.push');
      expect(spec !== undefined).assertTrue();
      expect(spec!.durationMs).assertEqual(280);
      expect(spec!.reducedMotionPolicy).assertEqual('zeroDuration');
    });
  });
}
