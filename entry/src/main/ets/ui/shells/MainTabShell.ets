import { BookshelfTab } from '../components/BookshelfTab';
import { DiscoverTab } from '../components/DiscoverTab';
import { RssTab } from '../components/RssTab';
import { SettingsTab } from '../components/SettingsTab';
import { ReaderAdaptive } from '../ReaderAdaptive';
import { ReaderMotion } from '../ReaderMotion';
import { ReaderMainTab } from '../ReaderRouteMapping';
import { ReaderEntryTarget, ReaderUiState } from '../ReaderUiState';

@Component
export struct MainTabShell {
  @Prop uiState: ReaderUiState;
  @Prop currentTab: number = 0;
  onSelectTab: (tab: string) => void = (_tab: string) => {};
  onReaderEntry: (target: ReaderEntryTarget) => void = (_target: ReaderEntryTarget) => {};
  onToggleReducedMotion: (enabled: boolean) => void = (_enabled: boolean) => {};

  build() {
    Tabs({
      barPosition: ReaderAdaptive.isNavRail(this.uiState.adaptive) ? BarPosition.Start : BarPosition.End,
      index: this.currentTab
    }) {
      TabContent() {
        BookshelfTab({
          uiState: this.uiState,
          onReaderEntry: this.onReaderEntry
        })
      }
      .tabBar(this.TabBuilder(ReaderMainTab.label(ReaderMainTab.bookshelf), ReaderMainTab.bookshelf))

      TabContent() {
        DiscoverTab()
      }
      .tabBar(this.TabBuilder(ReaderMainTab.label(ReaderMainTab.discover), ReaderMainTab.discover))

      TabContent() {
        RssTab()
      }
      .tabBar(this.TabBuilder(ReaderMainTab.label(ReaderMainTab.rss), ReaderMainTab.rss))

      TabContent() {
        SettingsTab({
          uiState: this.uiState,
          onToggleReducedMotion: this.onToggleReducedMotion
        })
      }
      .tabBar(this.TabBuilder(ReaderMainTab.label(ReaderMainTab.settings), ReaderMainTab.settings))
    }
    .vertical(ReaderAdaptive.isNavRail(this.uiState.adaptive))
    .barWidth(ReaderAdaptive.isNavRail(this.uiState.adaptive) ? 88 : '100%')
    .barHeight(ReaderAdaptive.isNavRail(this.uiState.adaptive) ? '100%' : 64)
    .barMode(BarMode.Fixed)
    .animation({ duration: ReaderMotion.durationTabSwitch(this.uiState.reducedMotion), curve: Curve.EaseOut })
    .onChange((index: number) => {
      this.onSelectTab(ReaderMainTab.at(index));
    })
  }

  @Builder
  TabBuilder(title: string, tab: string) {
    Column() {
      Text(title)
        .fontSize(ReaderAdaptive.isNavRail(this.uiState.adaptive) ? 13 : 14)
        .fontColor(this.uiState.activeTab === tab ? '#007AFF' : '#999999')
      if (this.uiState.activeTab === tab) {
        Circle({ width: 4, height: 4 })
          .fill('#007AFF')
          .margin({ top: 2 })
      }
    }
    .width(ReaderAdaptive.isNavRail(this.uiState.adaptive) ? 88 : '100%')
    .height(ReaderAdaptive.isNavRail(this.uiState.adaptive) ? 64 : 56)
    .justifyContent(FlexAlign.Center)
    .padding({ top: 6, bottom: 6 })
    .animation({ duration: ReaderMotion.durationTabSelect(this.uiState.reducedMotion), curve: Curve.EaseOut })
    .onClick(() => {
      this.onSelectTab(tab);
    })
  }
}
