// SourceSwitchViewState.test — B1 P0 核心接线验证：source-switch 路由的
// ViewState 渲染、reducer 事件处理、MotionAdapter motionId 解析。
import { describe, it, expect } from '@ohos/hypium';
import { ViewStateTable, ViewStateComponent } from '../main/ets/contract/generated/ViewStateTable';
import { RouteTable } from '../main/ets/contract/generated/RouteTable';
import { ReaderReducer } from '../main/ets/ui/store/ReaderReducer';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';
import { ReaderMotionResolver } from '../main/ets/ui/motion/ReaderMotionResolver';
import { MotionSpecRegistry } from '../main/ets/ui/motion/MotionSpecRegistry';

function collectTypes(components: ViewStateComponent[], sink: string[]): void {
  for (let i = 0; i < components.length; i++) {
    sink.push(components[i].type);
    if (components[i].children.length > 0) {
      collectTypes(components[i].children, sink);
    }
  }
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
    it('reducerSourceToggleAddsSourceId', 0, () => {
      const s = DemoUiState.initial();
      expect(s.sourceSelection.length === 0).assertTrue();
      const after = ReaderReducer.reduce(s, { type: 'source-toggle', sourceId: '优书网' });
      expect(after.sourceSelection.length === 1).assertTrue();
      expect(after.sourceSelection[0]).assertEqual('优书网');
    });

    it('reducerSourceToggleRemovesExistingSourceId', 0, () => {
      const s = DemoUiState.initial();
      const after1 = ReaderReducer.reduce(s, { type: 'source-toggle', sourceId: '优书网' });
      const after2 = ReaderReducer.reduce(after1, { type: 'source-toggle', sourceId: '优书网' });
      expect(after2.sourceSelection.length === 0).assertTrue();
    });

    it('reducerSourceClearEmptiesSelection', 0, () => {
      const s = DemoUiState.initial();
      const after = ReaderReducer.reduce(s, { type: 'source-toggle', sourceId: '优书网' });
      const cleared = ReaderReducer.reduce(after, { type: 'source-clear' });
      expect(cleared.sourceSelection.length === 0).assertTrue();
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
