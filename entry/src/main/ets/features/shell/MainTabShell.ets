import { MainTabBar } from './MainTabBar';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  readerInteractiveSafeBottom,
  readerInteractiveSafeLeft,
  readerVisualSafeTop,
} from '../common/ReaderWindowMetrics';
import { ReaderPageScaffold } from '../common/ReaderPageScaffold';
import type { ReaderHeaderKind } from '../common/ReaderPageShell';


// MainTabShell —— 主页面(书架/发现/RSS/设置)公共骨架 (FIGMA_NATIVE_UI_ARCHITECTURE_PLAN §七)。
// 根背景、固定顶栏与叠层由 ReaderPageScaffold 持有；本壳仅组合主导航和页面槽。
// 顶栏总高度通过共享回调传回滚动内容，导航透明宿主不拦截空白。
// 完成 Tablet 版式的页面可启用共享左侧导航轨道。状态栏 padding
// 与安全区仍由 Index 根 Stack 统一处理，避免双 padding。
@Component
export struct MainTabShell {
  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  @Prop activeTab: string = 'bookshelf';
  @Prop showBottomNav: boolean = true;
  @Prop showTabletRail: boolean = false;
  @Prop railVariant: 'standard' | 'bookshelf' = 'standard';
  @Prop navigationGeneration: number = 0;
  private mounted: boolean = false;
  onMainTab: (key: string, presentedGeneration?: number) => void = (_key: string): void => {};
  @Prop headerKind: ReaderHeaderKind = 'home';
  @Prop headerTop: number = 0;
  @Prop headerInsetLeft: number = 0;
  @Prop headerInsetRight: number = 0;
  onHeaderHeightChange: (height: number) => void = (_height: number): void => {};
  @BuilderParam content: () => void;
  @BuilderParam header: () => void = this.emptySlot;
  @BuilderParam overlayContent: () => void = this.emptySlot;
  @Builder private emptySlot() {}

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  private requestMainTab(key: string, presentedGeneration: number): void {
    if (!this.mounted || presentedGeneration !== this.navigationGeneration) return;
    this.onMainTab(key, presentedGeneration);
  }

  build() {
    ReaderPageScaffold({ variant: 'mainTab', headerKind: this.headerKind,
      headerTop: this.headerTop, headerInsetLeft: this.headerInsetLeft, headerInsetRight: this.headerInsetRight,
      content: (): void => { this.content(); },
      header: (): void => { this.header(); },
      footer: (): void => { this.bottomNavigation(); },
      overlayContent: (): void => { this.mainOverlays(); },
      onHeaderHeightChange: (height: number): void => this.onHeaderHeightChange(height + this.headerTop),
    });
  }

  @Builder
  private bottomNavigation() {
    if (this.showBottomNav && !this.showTabletRail) {
      ForEach([this.navigationGeneration], (generation: number) => {
        MainTabBar({ current: this.activeTab, onSelect: (key: string): void => this.requestMainTab(key, generation) });
      }, (generation: number): string => generation.toString());
    }
  }

  @Builder
  private mainOverlays() {
    if (this.showTabletRail) {
      ForEach([this.navigationGeneration], (generation: number) => {
        MainTabBar({ current: this.activeTab, vertical: true, railVariant: this.railVariant, onSelect: (key: string): void => this.requestMainTab(key, generation) })
          .position({ x: this.railLeft(), y: this.railTop() });
      }, (generation: number): string => generation.toString());
    }
    this.overlayContent();
  }

  private railLeft(): number {
    if (this.readerWindowMetricsRevision < 0) {
      return 17;
    }
    return Math.max(17, readerInteractiveSafeLeft(ReaderWindowCoordinator.metrics()));
  }

  private railTop(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    const windowHeight = metrics.windowRect.height;
    if (!Number.isFinite(windowHeight) || windowHeight <= 0) {
      return 0;
    }
    const safeTop = readerVisualSafeTop(metrics);
    const safeBottom = readerInteractiveSafeBottom(metrics);
    const availableHeight = Math.max(0, windowHeight - safeTop - safeBottom);
    // Index 已把主页面宿主放到 visual safeTop 以下；这里使用宿主局部坐标，
    // 只按可用高度居中，不能再次叠加 safeTop。
    return Math.max(0, (availableHeight - 332) / 2);
  }
}
