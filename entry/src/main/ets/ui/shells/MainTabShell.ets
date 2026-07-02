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
  onToggleBookshelfMore: () => void = () => {};
  onCloseBookshelfMore: () => void = () => {};
  onSetBookshelfView: (view: string) => void = (_view: string) => {};
  onToggleBookshelfFilter: () => void = () => {};
  onSelectBookshelfFilterOption: (kind: string, value: string) => void = (_kind: string, _value: string) => {};

  build() {
    if (ReaderAdaptive.isNavRail(this.uiState.adaptive)) {
      Row() {
        MainTabNav({
          uiState: this.uiState,
          isRail: true,
          onSelectTab: this.onSelectTab
        })
          .margin({ left: 16, right: 18 })

        MainTabContentHost({
          uiState: this.uiState,
          onReaderEntry: this.onReaderEntry,
          onToggleReducedMotion: this.onToggleReducedMotion,
          onToggleBookshelfMore: this.onToggleBookshelfMore,
          onCloseBookshelfMore: this.onCloseBookshelfMore,
          onSetBookshelfView: this.onSetBookshelfView,
          onToggleBookshelfFilter: this.onToggleBookshelfFilter,
          onSelectBookshelfFilterOption: this.onSelectBookshelfFilterOption
        })
          .layoutWeight(1)
      }
      .width('100%')
      .height('100%')
      .alignItems(VerticalAlign.Center)
      .backgroundColor('#F4EFE8')
    } else {
      Stack({ alignContent: Alignment.Bottom }) {
        MainTabContentHost({
          uiState: this.uiState,
          onReaderEntry: this.onReaderEntry,
          onToggleReducedMotion: this.onToggleReducedMotion,
          onToggleBookshelfMore: this.onToggleBookshelfMore,
          onCloseBookshelfMore: this.onCloseBookshelfMore,
          onSetBookshelfView: this.onSetBookshelfView,
          onToggleBookshelfFilter: this.onToggleBookshelfFilter,
          onSelectBookshelfFilterOption: this.onSelectBookshelfFilterOption
        })

        Column() {
          MainTabNav({
            uiState: this.uiState,
            isRail: false,
            onSelectTab: this.onSelectTab
          })
        }
        .width('100%')
        .padding({ left: 14, right: 14, bottom: 14 })
      }
      .width('100%')
      .height('100%')
      .backgroundColor('#F4EFE8')
    }
  }
}

@Component
struct MainTabContentHost {
  @Prop uiState: ReaderUiState;
  onReaderEntry: (target: ReaderEntryTarget) => void = (_target: ReaderEntryTarget) => {};
  onToggleReducedMotion: (enabled: boolean) => void = (_enabled: boolean) => {};
  onToggleBookshelfMore: () => void = () => {};
  onCloseBookshelfMore: () => void = () => {};
  onSetBookshelfView: (view: string) => void = (_view: string) => {};
  onToggleBookshelfFilter: () => void = () => {};
  onSelectBookshelfFilterOption: (kind: string, value: string) => void = (_kind: string, _value: string) => {};

  build() {
    Column() {
      if (this.uiState.activeTab === ReaderMainTab.discover) {
        DiscoverTab()
      } else if (this.uiState.activeTab === ReaderMainTab.rss) {
        RssTab()
      } else if (this.uiState.activeTab === ReaderMainTab.settings) {
        SettingsTab({
          uiState: this.uiState,
          onToggleReducedMotion: this.onToggleReducedMotion
        })
      } else {
        BookshelfTab({
          uiState: this.uiState,
          onReaderEntry: this.onReaderEntry,
          onToggleMore: this.onToggleBookshelfMore,
          onCloseMore: this.onCloseBookshelfMore,
          onSetView: this.onSetBookshelfView,
          onToggleFilter: this.onToggleBookshelfFilter,
          onSelectFilterOption: this.onSelectBookshelfFilterOption
        })
      }
    }
    .width('100%')
    .height('100%')
    .animation({ duration: ReaderMotion.durationTabSwitch(this.uiState.reducedMotion), curve: Curve.EaseOut })
  }
}

@Component
struct MainTabNav {
  @Prop uiState: ReaderUiState;
  @Prop isRail: boolean = false;
  onSelectTab: (tab: string) => void = (_tab: string) => {};

  build() {
    if (this.isRail) {
      Column() {
        MainTabNavItem({
          tabType: ReaderMainTab.bookshelf,
          tabLabel: ReaderMainTab.label(ReaderMainTab.bookshelf),
          isActive: this.uiState.activeTab === ReaderMainTab.bookshelf,
          isRail: true,
          reducedMotion: this.uiState.reducedMotion,
          onSelectTab: this.onSelectTab
        })
        MainTabNavItem({
          tabType: ReaderMainTab.discover,
          tabLabel: ReaderMainTab.label(ReaderMainTab.discover),
          isActive: this.uiState.activeTab === ReaderMainTab.discover,
          isRail: true,
          reducedMotion: this.uiState.reducedMotion,
          onSelectTab: this.onSelectTab
        })
        MainTabNavItem({
          tabType: ReaderMainTab.rss,
          tabLabel: ReaderMainTab.label(ReaderMainTab.rss),
          isActive: this.uiState.activeTab === ReaderMainTab.rss,
          isRail: true,
          reducedMotion: this.uiState.reducedMotion,
          onSelectTab: this.onSelectTab
        })
        MainTabNavItem({
          tabType: ReaderMainTab.settings,
          tabLabel: ReaderMainTab.label(ReaderMainTab.settings),
          isActive: this.uiState.activeTab === ReaderMainTab.settings,
          isRail: true,
          reducedMotion: this.uiState.reducedMotion,
          onSelectTab: this.onSelectTab
        })
      }
      .width(82)
      .padding(8)
      .backgroundColor('#E6FFFCF8')
      .border({ width: 1, color: '#D8CCBC' })
      .borderRadius(24)
      .shadow({ radius: 14, color: '#34261A1F', offsetX: 0, offsetY: 5 })
    } else {
      Row() {
        MainTabNavItem({
          tabType: ReaderMainTab.bookshelf,
          tabLabel: ReaderMainTab.label(ReaderMainTab.bookshelf),
          isActive: this.uiState.activeTab === ReaderMainTab.bookshelf,
          reducedMotion: this.uiState.reducedMotion,
          onSelectTab: this.onSelectTab
        })
        MainTabNavItem({
          tabType: ReaderMainTab.discover,
          tabLabel: ReaderMainTab.label(ReaderMainTab.discover),
          isActive: this.uiState.activeTab === ReaderMainTab.discover,
          reducedMotion: this.uiState.reducedMotion,
          onSelectTab: this.onSelectTab
        })
        MainTabNavItem({
          tabType: ReaderMainTab.rss,
          tabLabel: ReaderMainTab.label(ReaderMainTab.rss),
          isActive: this.uiState.activeTab === ReaderMainTab.rss,
          reducedMotion: this.uiState.reducedMotion,
          onSelectTab: this.onSelectTab
        })
        MainTabNavItem({
          tabType: ReaderMainTab.settings,
          tabLabel: ReaderMainTab.label(ReaderMainTab.settings),
          isActive: this.uiState.activeTab === ReaderMainTab.settings,
          reducedMotion: this.uiState.reducedMotion,
          onSelectTab: this.onSelectTab
        })
      }
      .width('100%')
      .height(68)
      .padding({ left: 8, right: 8, top: 7, bottom: 7 })
      .backgroundColor('#E6FFFCF8')
      .border({ width: 1, color: '#D8CCBC' })
      .borderRadius(24)
      .shadow({ radius: 14, color: '#34261A1F', offsetX: 0, offsetY: 5 })
    }
  }
}

@Component
struct MainTabNavItem {
  @Prop tabType: string = '';
  @Prop tabLabel: string = '';
  @Prop isActive: boolean = false;
  @Prop isRail: boolean = false;
  @Prop reducedMotion: boolean = false;
  onSelectTab: (tab: string) => void = (_tab: string) => {};

  build() {
    Column() {
      Row() {
        MainTabIcon({
          tabType: this.tabType,
          isActive: this.isActive
        })
      }
      .width(this.isRail ? 32 : 30)
      .height(this.isRail ? 32 : 30)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .borderRadius(this.isRail ? 16 : 15)

      Text(this.tabLabel)
        .fontSize(11)
        .fontWeight(FontWeight.Bolder)
        .fontColor(this.isActive ? '#FFFAF4' : '#756F69')
        .lineHeight(this.isRail ? 16 : 18)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .layoutWeight(this.isRail ? 0 : 1)
    .width(this.isRail ? 66 : '100%')
    .height(this.isRail ? 58 : 54)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(this.isActive ? '#274F66' : '#00000000')
    .borderRadius(24)
    .margin({ bottom: this.isRail ? 6 : 0 })
    .animation({ duration: ReaderMotion.durationTabSelect(this.reducedMotion), curve: Curve.EaseOut })
    .accessibilityText(`主导航 ${this.tabLabel}`)
    .onClick(() => this.onSelectTab(this.tabType))
  }
}

@Component
struct MainTabIcon {
  @Prop tabType: string = '';
  @Prop isActive: boolean = false;

  build() {
    if (this.tabType === ReaderMainTab.discover) {
      if (this.isActive) {
        Image($r('app.media.main_tab_icon_discover_active'))
          .width(24)
          .height(24)
          .objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.main_tab_icon_discover_muted'))
          .width(24)
          .height(24)
          .objectFit(ImageFit.Contain)
      }
    } else if (this.tabType === ReaderMainTab.rss) {
      if (this.isActive) {
        Image($r('app.media.main_tab_icon_rss_active'))
          .width(24)
          .height(24)
          .objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.main_tab_icon_rss_muted'))
          .width(24)
          .height(24)
          .objectFit(ImageFit.Contain)
      }
    } else if (this.tabType === ReaderMainTab.settings) {
      if (this.isActive) {
        Image($r('app.media.main_tab_icon_settings_active'))
          .width(24)
          .height(24)
          .objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.main_tab_icon_settings_muted'))
          .width(24)
          .height(24)
          .objectFit(ImageFit.Contain)
      }
    } else if (this.isActive) {
      Image($r('app.media.main_tab_icon_bookshelf_active'))
        .width(24)
        .height(24)
        .objectFit(ImageFit.Contain)
    } else {
      Image($r('app.media.main_tab_icon_bookshelf_muted'))
        .width(24)
        .height(24)
        .objectFit(ImageFit.Contain)
    }
  }
}
