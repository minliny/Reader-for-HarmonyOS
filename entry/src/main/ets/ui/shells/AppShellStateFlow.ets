import { PageState } from '../../contract';
import { MotionAdapter } from '../adapters/MotionAdapter';
import { TokenAdapter } from '../adapters/TokenAdapter';
import { ReaderMainTab } from '../ReaderRouteMapping';
import { ReaderUiState } from '../ReaderUiState';

export interface AppShellTabSnapshot {
  id: string;
  label: string;
  selected: boolean;
}

export interface AppShellStateSnapshot {
  routeId: string;
  activeTab: string;
  tabs: AppShellTabSnapshot[];
  pageState: PageState;
  tabSwitchDurationMs: number;
  bottomNavHeight: number;
  bottomNavZIndex: number;
}

export class AppShellStateFlow {
  static snapshot(state: ReaderUiState): AppShellStateSnapshot {
    const tabs: AppShellTabSnapshot[] = [];
    const tabOrder = ReaderMainTab.all;
    for (let i = 0; i < tabOrder.length; i++) {
      const tab = tabOrder[i];
      tabs.push({
        id: tab,
        label: ReaderMainTab.label(tab),
        selected: state.activeTab === tab
      });
    }
    return {
      routeId: state.route.id,
      activeTab: state.activeTab,
      tabs,
      pageState: state.pageState ?? 'default',
      tabSwitchDurationMs: MotionAdapter.tabSwitch(state.reducedMotion).durationMs,
      bottomNavHeight: TokenAdapter.tabBarHeight(),
      bottomNavZIndex: TokenAdapter.mainNavZIndex()
    };
  }

  static hasFourNativeTabs(state: ReaderUiState): boolean {
    const snapshot = AppShellStateFlow.snapshot(state);
    return snapshot.tabs.length === 4 &&
      snapshot.tabs[0].id === ReaderMainTab.bookshelf &&
      snapshot.tabs[1].id === ReaderMainTab.discover &&
      snapshot.tabs[2].id === ReaderMainTab.rss &&
      snapshot.tabs[3].id === ReaderMainTab.settings;
  }
}
