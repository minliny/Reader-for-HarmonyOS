import { ReaderStandardPage } from '../common/ReaderStandardPage';
import { readerPageAreaLength } from '../common/ReaderPageShell';
import { MainTabBar } from './MainTabBar';
import { PageBackBar } from '../common/PageBackBar';
import { AppTopBar } from '../common/AppTopBar';


// SettingsShell —— Settings 页面骨架 (FIGMA_NATIVE_UI_ARCHITECTURE_PLAN §七/§十)。
// 负责 Settings Home TopBar + BackTopBar + Scroll Content + BottomNav + 子页返回结构 +
// 响应式页面边距。Settings 分 Home 与 General 两态(不互替): Home 显示设置菜单 + 底部栏,
// General 显示返回栏 + 通用设置区块。页面只提供 homeContent/generalContent + activeSection/
// onSectionChange + 导航回调; 不复制 TopBar/BackBar/BottomNav/Scroll 骨架。
// ReaderStandardPage 统一持有 Scroll、顶栏、底栏与全高 overlay 宿主。
// onOverlayOriginChange 上报宿主全局坐标，供业务浮层换算触发条相对位置。
@Component
export struct SettingsShell {
  @Prop activeSection: 'home' | 'general' = 'home';
  @Prop tapBottomScrollTop: boolean = true;
  @Prop showOverlay: boolean = false;
  onSectionChange: (section: 'home' | 'general') => void = (_section: 'home' | 'general'): void => {};
  onBack: () => void = (): void => {};
  onOpenSourceManagement: () => void = (): void => {};
  onOpenSync: () => void = (): void => {};
  onRssRequested: () => void = (): void => {};
  onDiscoverRequested: () => void = (): void => {};
  onOverlayOriginChange: (x: number, y: number) => void = (_x: number, _y: number): void => {};
  @BuilderParam homeContent: () => void;
  @BuilderParam generalContent: () => void;
  @BuilderParam overlayContent: () => void;
  private readonly homeScroller: Scroller = new Scroller();
  private readonly generalScroller: Scroller = new Scroller();

  build() {
    if (this.activeSection === 'home') {
      ReaderStandardPage({
        variant: 'settingsHome',
        scroller: this.homeScroller,
        content: (): void => { this.homeContent(); },
        header: (): void => { this.homeTopBar(); },
        footer: (): void => { this.homeNavigation(); },
        overlay: (): void => { this.pageOverlay(); },
      }).onAreaChange((_old: Area, next: Area): void => this.reportOverlayOrigin(next));
    } else {
      ReaderStandardPage({
        variant: 'settingsGeneral',
        scroller: this.generalScroller,
        content: (): void => { this.generalContent(); },
        header: (): void => { this.generalTopBar(); },
        overlay: (): void => { this.pageOverlay(); },
      }).onAreaChange((_old: Area, next: Area): void => this.reportOverlayOrigin(next));
    }
  }

  @Builder
  private homeTopBar() {
    AppTopBar({ title: '设置' });
  }

  @Builder
  private generalTopBar() {
    PageBackBar({ title: '通用设置', onBack: (): void => this.onSectionChange('home') });
  }

  @Builder
  private homeNavigation() {
    MainTabBar({
      current: 'settings',
      onSelect: (key: string): void => this.onMainTab(key),
      onCurrentTap: (_key: string): void => this.scrollHomeToTop(),
    });
  }

  @Builder
  private pageOverlay() {
    if (this.showOverlay) { this.overlayContent(); }
  }

  private reportOverlayOrigin(area: Area): void {
    // Area.globalPosition 已是 vp 单位，不能再 px2vp。
    this.onOverlayOriginChange(readerPageAreaLength(area.globalPosition.x), readerPageAreaLength(area.globalPosition.y));
  }

  private onMainTab(key: string): void {
    if (key === 'bookshelf') {
      this.onBack();
    } else if (key === 'discover') {
      this.onDiscoverRequested();
    } else if (key === 'rss') {
      this.onRssRequested();
    }
    // 'settings' is this page; MainTabBar suppresses the current tab.
  }

  private scrollHomeToTop(): void {
    if (!this.tapBottomScrollTop || this.activeSection !== 'home') return;
    this.homeScroller.scrollTo({ xOffset: 0, yOffset: 0, animation: true });
  }

}
