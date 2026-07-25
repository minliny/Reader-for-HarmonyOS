// SettingsViewState.test — B1 P0 核心接线验证：settings 路由的 ViewState 渲染、
// 新增 settings reducer 事件（segment/stepper/switch）、SettingsShell motionId 解析、
// tab 切换与 close（route-pop）链路。
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

export default function SettingsViewStateTests(): void {
  describe('SettingsViewState', () => {
    // ── 路由 → Shell 映射 ──
    it('settingsTabResolvesToMainTabShell', 0, () => {
      expect(RouteTable.shellOf('settings')).assertEqual('MainTabShell');
    });

    it('settingsGeneralResolvesToSettingsShell', 0, () => {
      expect(RouteTable.shellOf('settings-general')).assertEqual('SettingsShell');
    });

    it('bookshelfSearchSettingsResolvesToSettingsShell', 0, () => {
      expect(RouteTable.shellOf('bookshelf-search-settings')).assertEqual('SettingsShell');
    });

    // ── ViewState 渲染 ──
    it('settingsHomeBodyContainsSettingsHomePage', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('settings', 'default');
      const types: string[] = [];
      collectTypes(body, types);
      expect(types.indexOf('SettingsHomePage') >= 0).assertTrue();
    });

    it('settingsGeneralBodyContainsSettingsGeneralPage', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('settings-general', 'default');
      const types: string[] = [];
      collectTypes(body, types);
      expect(types.indexOf('SettingsGeneralPage') >= 0).assertTrue();
    });

    it('bookshelfSearchSettingsBodyContainsBookshelfSearchSettingsPage', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('bookshelf-search-settings', 'default');
      const types: string[] = [];
      collectTypes(body, types);
      expect(types.indexOf('BookshelfSearchSettingsPage') >= 0).assertTrue();
    });

    // ── Reducer: settings-segment-switch ──
    it('reducerSettingsSegmentSwitchesAppThemeMode', 0, () => {
      const s = DemoUiState.initial();
      expect(s.appThemeMode).assertEqual('system');
      const after = ReaderReducer.reduce(s, { type: 'settings-segment-switch', settingsKey: 'appThemeMode', settingsValue: 'dark' });
      expect(after.appThemeMode).assertEqual('dark');
    });

    it('reducerSettingsSegmentIgnoresUnknownKey', 0, () => {
      const s = DemoUiState.initial();
      const after = ReaderReducer.reduce(s, { type: 'settings-segment-switch', settingsKey: 'unknown', settingsValue: 'x' });
      expect(after.appThemeMode).assertEqual(s.appThemeMode);
    });

    it('reducerSettingsSegmentSetsOnlySupportedCoreHistoryLimits', 0, () => {
      const s = DemoUiState.initial();
      const fifty = ReaderReducer.reduce(s, {
        type: 'settings-segment-switch', settingsKey: 'searchHistoryLimit', settingsValue: '50',
      });
      expect(fifty.searchHistoryLimit).assertEqual(50);
      const rejected = ReaderReducer.reduce(fifty, {
        type: 'settings-segment-switch', settingsKey: 'searchHistoryLimit', settingsValue: '999',
      });
      expect(rejected.searchHistoryLimit).assertEqual(50);
    });

    // ── Reducer: settings-stepper-change ──
    it('reducerSettingsStepperRejectsRetiredCoverColumns', 0, () => {
      const s = DemoUiState.initial();
      const after = ReaderReducer.reduce(s, { type: 'settings-stepper-change', settingsKey: 'coverColumns', delta: 1 });
      expect(after.appThemeMode).assertEqual(s.appThemeMode);
      expect(after.bookshelfFilter.view).assertEqual(s.bookshelfFilter.view);
    });

    // ── Reducer: settings-switch-toggle ──
    it('reducerSettingsSwitchTogglesAutoCheckUpdate', 0, () => {
      const s = DemoUiState.initial();
      expect(s.settingsToggles.autoCheckUpdate).assertTrue();
      const after = ReaderReducer.reduce(s, { type: 'settings-switch-toggle', settingsKey: 'autoCheckUpdate', settingsToggleValue: false });
      expect(after.settingsToggles.autoCheckUpdate).assertFalse();
    });

    it('reducerSettingsSwitchPreservesOtherToggles', 0, () => {
      const s = DemoUiState.initial();
      const after = ReaderReducer.reduce(s, { type: 'settings-switch-toggle', settingsKey: 'mergeSameBooks', settingsToggleValue: false });
      expect(after.settingsToggles.mergeSameBooks).assertFalse();
      expect(after.settingsToggles.autoCheckUpdate).assertTrue();
      expect(after.settingsToggles.enableSearchHistory).assertTrue();
    });

    // ── Reducer: switch-tab → settings（tab switch 链路） ──
    it('reducerSwitchTabToSettings', 0, () => {
      const s = DemoUiState.initial();
      expect(s.tab).assertEqual('bookshelf');
      const after = ReaderReducer.reduce(s, { type: 'switch-tab', tab: 'settings' });
      expect(after.tab).assertEqual('settings');
      expect(after.routeId).assertEqual('settings');
      expect(after.stack.length).assertEqual(1);
      expect(after.stack[0].id).assertEqual('settings');
    });

    // ── Reducer: route-pop → 从 settings-general 返回（close 链路） ──
    it('reducerRoutePopReturnsFromSettingsGeneral', 0, () => {
      const s = DemoUiState.initial();
      const settingsTab = ReaderReducer.reduce(s, { type: 'switch-tab', tab: 'settings' });
      const pushed = ReaderReducer.reduce(settingsTab, { type: 'route-push', id: 'settings-general' });
      expect(pushed.routeId).assertEqual('settings-general');
      expect(pushed.stack.length).assertEqual(2);
      const popped = ReaderReducer.reduce(pushed, { type: 'route-pop' });
      expect(popped.routeId).assertEqual('settings');
      expect(popped.stack.length).assertEqual(1);
    });

    // ── MotionAdapter 解析 SettingsShell motionId ──
    it('resolvesSettingsShellPush', 0, () => {
      const id = ReaderMotionResolver.resolve({ operation: 'push', containerRole: 'settingsShell' });
      expect(id).assertEqual('app.route.push.forward');
    });

    it('resolvesSettingsShellPop', 0, () => {
      const id = ReaderMotionResolver.resolve({ operation: 'pop', containerRole: 'settingsShell' });
      expect(id).assertEqual('app.route.pop.backward');
    });

    it('settingsShellPushSpecExists', 0, () => {
      expect(MotionSpecRegistry.has('app.route.push.forward')).assertTrue();
    });
  });
}
