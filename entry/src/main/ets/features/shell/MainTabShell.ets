import { ReaderStandardPage } from '../../ui/layout/ReaderStandardPage';
import { readerMainRailLeading, readerMainRailBottomInset } from './MainNavigationSpec';
import { publishReaderMainViewport } from './MainNavigationSpec';
import { ReaderBottomNavigation } from '../../app/navigation/ReaderBottomNavigation';
import { MainNavigationOverlay } from './MainNavigationOverlay';
import { readerMainNavigationMode, type MainNavigationMode } from './MainNavigationSpec';
import { ReaderPageScaffold } from '../../ui/layout/ReaderPageScaffold';
import { ReaderPageGeometry, readerChromePageGeometry } from '../../ui/layout/ReaderPageGeometry';
import { readerPresentedHeaderBottom, type ReaderStandardPageVariant } from '../../ui/layout/ReaderPageShell';
import { ReaderFrameStyle, readerFrameStyle } from '../../ui/layout/ReaderFrameStyle';
import { readerAppColor } from '../../ui/foundation/ReaderThemeRegistry';

export type MainTabHeaderKind = 'standard' | 'home' | 'floating' | 'mangaDirectory' | 'selection' | 'search' | 'rss' | 'directoryTools' | 'download' | 'reader';


// MainTabShell —— 主页面(书架/发现/RSS/设置)公共骨架 (FIGMA_NATIVE_UI_ARCHITECTURE_PLAN §七)。
// 根背景、固定顶栏与叠层由 ReaderPageScaffold 持有；本壳仅组合主导航和页面槽。
// 顶栏总高度通过共享回调传回滚动内容，导航透明宿主不拦截空白。
// 完成 Tablet 版式的页面可启用共享左侧导航轨道。状态栏 padding
// 与安全区仍由 Index 根 Stack 统一处理，避免双 padding。
@Component
export struct MainTabShell {
  @StorageLink('readerMainViewportRevision') private mainViewportRevision: number = 0;
  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWideNavigationRail') private wideNavigationRail: boolean = false;
  @Prop activeTab: string = 'bookshelf';
  @Prop standardScroll: boolean = false;
  @Prop standardPageVariant: ReaderStandardPageVariant = 'settingsHome';
  scroller: Scroller = new Scroller();
  @Prop navigationGeneration: number = 0;
  private mounted: boolean = false;
  onMainTab: (key: string, presentedGeneration?: number) => void = (_key: string): void => {};
  onCurrentTabTap: (key: string, presentedGeneration?: number) => void = (_key: string): void => {};
  @Prop headerKind: MainTabHeaderKind = 'home';
  @Prop headerVisible: boolean = true;
  @Prop headerTop: number = 0;
  @Prop headerMeasurementKey: number = 0;
  @Prop footerMeasurementKey: number = 0;
  @Prop headerInsetLeft: number = 0;
  @Prop headerInsetRight: number = 0;
  onHeaderHeightChange: (height: number, presentedKey?: number) => void = (_height: number, _presentedKey?: number): void => {};
  onFooterHeightChange: (height: number, presentedKey: number) => void = (_height: number, _presentedKey: number): void => {};
  @BuilderParam content: () => void;
  @BuilderParam header: () => void = this.emptySlot;
  @BuilderParam overlayContent: () => void = this.emptySlot;
  @BuilderParam scrollOverlayContent: (contentStartInset: number) => void = this.emptyScrollOverlay;
  @Builder private emptyScrollOverlay(_contentStartInset: number) {}
  @Builder private emptySlot() {}

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  private requestMainTab(key: string, presentedGeneration: number): void {
    if (!this.mounted || presentedGeneration !== this.navigationGeneration) return;
    this.onMainTab(key, presentedGeneration);
  }

  private requestCurrentTab(key: string, presentedGeneration: number): void {
    if (!this.mounted || presentedGeneration !== this.navigationGeneration) return;
    this.onCurrentTabTap(key, presentedGeneration);
  }

  private footerHeightChangeHandler(navigation: number, measurementKey: number): (height: number, presentedKey: number) => void {
    return (height: number, presentedKey: number): void => {
      if (!this.mounted || navigation !== this.navigationGeneration ||
        measurementKey !== this.footerMeasurementKey || presentedKey !== measurementKey) return;
      this.onFooterHeightChange(height, presentedKey);
    };
  }

  private navigationMode(): MainNavigationMode {
    return readerMainNavigationMode(this.wideNavigationRail, this.mainViewportRevision, this.readerWindowMetricsRevision);
  }

  private pageGeometry(): ReaderPageGeometry {
    return readerChromePageGeometry(this.headerTop, this.headerInsetLeft, this.headerInsetRight);
  }

  private frameStyle(): ReaderFrameStyle {
    const pageBackground = readerAppColor('TOK_PAPER', this.appThemeScheme);
    const solidHeader = this.headerKind === 'standard' || this.headerKind === 'directoryTools' ?
      readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme) :
      this.headerKind === 'download' ? readerAppColor('TOK_DOWNLOAD_PAPER', this.appThemeScheme) : pageBackground;
    const transparent = this.headerKind === 'floating' || this.headerKind === 'mangaDirectory' ||
      this.headerKind === 'reader';
    return readerFrameStyle({ backgroundColor: pageBackground, headerBackground: solidHeader,
      headerTransparent: transparent, footerBackground: pageBackground });
  }

  build() {
    if (this.standardScroll) {
      ReaderStandardPage({
        variant: this.standardPageVariant, scroller: this.scroller,
        onViewportChange: (width: number, height: number): void => {
          if (this.mounted) publishReaderMainViewport(width, height);
        },
        contentLeadingRail: this.navigationMode() === 'rail' ? readerMainRailLeading() : 0,
        contentEndInset: this.navigationMode() === 'rail' ? readerMainRailBottomInset() : -1,
        content: (): void => { this.content(); },
        header: (): void => { this.header(); },
        footer: (): void => { this.bottomNavigation(); },
        overlayContent: (startInset: number): void => { this.mainOverlays(startInset); },
      });
    } else {
    ReaderPageScaffold({ frameStyle: this.frameStyle(), headerVisible: this.headerVisible,
      geometry: this.pageGeometry(), headerMeasurementKey: this.headerMeasurementKey,
      footerMeasurementKey: this.footerMeasurementKey,
      content: (): void => { this.content(); },
      header: (): void => { this.header(); },
      footer: (): void => { this.bottomNavigation(); },
      overlayContent: (): void => { this.mainOverlays(); },
      onHeaderHeightChange: (height: number, presentedKey: number): void =>
        this.onHeaderHeightChange(readerPresentedHeaderBottom(this.headerTop, height), presentedKey),
      onFooterHeightChange: this.footerHeightChangeHandler(this.navigationGeneration, this.footerMeasurementKey),
    }).onAreaChange((_old: Area, area: Area): void => {
      if (this.mounted) publishReaderMainViewport(Number.parseFloat(`${area.width}`), Number.parseFloat(`${area.height}`));
    });
    }
  }

  @Builder
  private bottomNavigation() {
    if (this.navigationMode() === 'bottom') {
      ForEach([this.navigationGeneration], (generation: number) => {
        ReaderBottomNavigation({ current: this.activeTab, onSelect: (key: string): void => this.requestMainTab(key, generation),
          onCurrentTap: (key: string): void => this.requestCurrentTab(key, generation) });
      }, (generation: number): string => generation.toString());
    }
  }

  @Builder
  private mainOverlays(contentStartInset: number = 0) {
    MainNavigationOverlay({
      railActive: this.navigationMode() === 'rail',
      activeTab: this.activeTab,
      navigationGeneration: this.navigationGeneration,
      onSelect: (key: string, generation: number): void => this.requestMainTab(key, generation),
      onCurrentTap: (key: string, generation: number): void => this.requestCurrentTab(key, generation),
      overlayContent: (): void => {
        this.overlayContent();
        this.scrollOverlayContent(contentStartInset);
      },
    });
  }
}
